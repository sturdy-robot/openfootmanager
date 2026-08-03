use rand::{Rng, RngExt};

use crate::event::{DangerBand, FoulSeverity, GoalContext, SaveQuality};
use crate::shared::{
    PlayStylePhase, PlayerSnap, home_mod, play_style_modifier, tactics_pressing_fatigue,
    tactics_pressing_press,
};
use crate::types::{PlayerData, Position, Side, TeamData};

use std::collections::HashSet;

use crate::sim::roles;
use crate::sim::state::Band;

use super::{LiveMatchState, SetPieceTakers, SquadCache};

// ---------------------------------------------------------------------------
// Stamina system
// ---------------------------------------------------------------------------

/// What the engine is asking a player to do, which decides both who is a
/// plausible choice and which attributes matter.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum Need {
    /// Play the ball out from deep.
    BuildUp,
    /// Carry or move the ball through midfield.
    Progress,
    /// Beat a man in the final third.
    TakeOn,
    /// Have a shot.
    Shoot,
    /// Win the ball back.
    Defend,
    /// Keep goal.
    Keep,
}

impl Need {
    fn is_defensive(self) -> bool {
        matches!(self, Need::Defend)
    }

    /// The composite the engine cares about for this job, 0–100.
    ///
    /// Summed directly rather than through an array and a closure: this runs
    /// for every plausible player on every action.
    #[inline]
    fn fitness(self, p: &PlayerData) -> f64 {
        let total: u32 = match self {
            Need::BuildUp => {
                p.passing as u32 + p.vision as u32 + p.composure as u32 + p.teamwork as u32
            }
            Need::Progress => {
                p.passing as u32 + p.vision as u32 + p.dribbling as u32 + p.decisions as u32
            }
            Need::TakeOn => {
                p.dribbling as u32 + p.pace as u32 + p.agility as u32 + p.composure as u32
            }
            Need::Shoot => {
                p.shooting as u32 + p.composure as u32 + p.decisions as u32 + p.positioning as u32
            }
            Need::Defend => {
                p.tackling as u32 + p.positioning as u32 + p.defending as u32 + p.decisions as u32
            }
            Need::Keep => {
                p.handling as u32 + p.reflexes as u32 + p.positioning as u32 + p.aerial as u32
            }
        };
        total as f64 * 0.25
    }

    /// Position to fall back on if weighting cannot pick anybody.
    fn fallback_position(self) -> Position {
        match self {
            Need::BuildUp => Position::Defender,
            Need::Progress => Position::Midfielder,
            Need::TakeOn | Need::Shoot => Position::Forward,
            Need::Defend => Position::Defender,
            Need::Keep => Position::Goalkeeper,
        }
    }
}

/// Upper bound on how many players are weighted for one selection. A matchday
/// eleven plus room to spare; anyone past this simply is not considered.
const MAX_WEIGHTED_SQUAD: usize = 24;

impl LiveMatchState {
    pub(super) fn deplete_stamina_tick(&mut self) {
        let base_rate = self.config.fatigue_per_minute;
        // Aggressive pressing tires a side faster; neutral (Medium) is ×1.0.
        let home_rate = base_rate * tactics_pressing_fatigue(&self.home.tactics);
        let away_rate = base_rate * tactics_pressing_fatigue(&self.away.tactics);

        for (players, cache, fatigue_rate) in [
            (&self.home.players, &mut self.home_cache, home_rate),
            (&self.away.players, &mut self.away_cache, away_rate),
        ] {
            for (index, p) in players.iter().enumerate() {
                if !self.sent_off.is_empty() && self.sent_off.contains(&p.id) {
                    continue;
                }
                let stamina_factor = p.stamina as f64 / 100.0;
                let fitness_factor = p.fitness as f64 / 100.0;
                // Higher stamina → less depletion; higher fitness → less
                // depletion. Fitness scales the base depletion more
                // aggressively — unfit players tire much faster.
                let depletion =
                    fatigue_rate * (1.0 - stamina_factor * 0.5) * (1.3 - fitness_factor * 0.6);
                cache.deplete(index, depletion);
            }
            cache.refresh_selection_weights();
        }
    }

    /// Adjust a skill value based on the player's current in-match condition.
    pub(super) fn condition_adjusted_skill(&self, snap: &PlayerSnap, base_skill: f64) -> f64 {
        let condition = self.cache(snap.side).condition(snap.index);
        // At 100% condition: full skill. At 50%: ~80% skill. At 0%: ~60% skill.
        let factor = 0.6 + 0.4 * (condition / 100.0);
        base_skill * factor
    }

    pub(super) fn cache(&self, side: Side) -> &SquadCache {
        match side {
            Side::Home => &self.home_cache,
            Side::Away => &self.away_cache,
        }
    }

    pub(super) fn cache_mut(&mut self, side: Side) -> &mut SquadCache {
        match side {
            Side::Home => &mut self.home_cache,
            Side::Away => &mut self.away_cache,
        }
    }

    /// Take a snapshot of a player at a known squad index.
    ///
    /// Everything expensive about a snapshot — the id and the trait set — comes
    /// from the cache rather than being rebuilt, which is what makes this cheap
    /// enough to do twice for every action in the match.
    pub(super) fn snap_at(&self, side: Side, index: usize) -> PlayerSnap {
        let team = self.team_ref(side);
        match team.players.get(index) {
            Some(player) => {
                let cache = self.cache(side);
                PlayerSnap::from_cached(player, cache.id(index), cache.traits(index), side, index)
            }
            None => PlayerSnap::placeholder(),
        }
    }

    // -----------------------------------------------------------------------
    // Player selection helpers
    // -----------------------------------------------------------------------

    /// Choose who is on the ball, or who contests it, in a given band.
    ///
    /// Replaces picking uniformly from whoever plays a position. Two things
    /// were wrong with that. It made a position a hard gate — build-up only
    /// ever sampled defenders and midfield only midfielders, so a forward could
    /// not touch the ball outside the final third and finished matches with no
    /// passes. And it meant a player's quality had no bearing on how often he
    /// was involved: a 90-rated striker took exactly as many shots as a
    /// 55-rated one, so his shooting only ever showed up in conversion.
    ///
    /// Weight combines where the player's position and role put him, how much
    /// that role wants the ball, how suited he is to what is being asked, and
    /// how fresh he is. Quality now compounds across hundreds of actions
    /// instead of applying once.
    pub(super) fn pick_actor<R: Rng + ?Sized>(
        &self,
        side: Side,
        band: Band,
        need: Need,
        rng: &mut R,
    ) -> PlayerSnap {
        let team = self.team_ref(side);
        let dismissals = &self.sent_off;

        // Weights are computed once into a stack buffer rather than twice over
        // the squad. This runs twice per action and the possession chain
        // resolves hundreds of actions a match, so a second pass is not free.
        let mut weights = [0.0f64; MAX_WEIGHTED_SQUAD];
        let counted = team.players.len().min(MAX_WEIGHTED_SQUAD);
        let mut total = 0.0f64;
        for (index, player) in team.players.iter().take(counted).enumerate() {
            let weight = self.selection_weight(index, player, side, band, need, dismissals);
            weights[index] = weight;
            total += weight;
        }

        if total <= 0.0 {
            // Nobody is a plausible choice — an eleven reduced to nothing in
            // this band. Fall back to the old uniform behaviour so play
            // continues rather than stalling.
            return self.snap_player(side, need.fallback_position(), rng);
        }

        let mut roll = rng.random_range(0.0..total);
        for (index, weight) in weights.iter().enumerate().take(counted) {
            roll -= weight;
            if roll <= 0.0 {
                return self.snap_at(side, index);
            }
        }
        // Floating-point drift only; the last eligible player is the answer.
        match weights
            .iter()
            .enumerate()
            .take(counted)
            .rev()
            .find(|(_, weight)| **weight > 0.0)
            .map(|(index, _)| index)
        {
            Some(index) => self.snap_at(side, index),
            None if !team.players.is_empty() => self.snap_at(side, 0),
            None => PlayerSnap::placeholder(),
        }
    }

    #[inline]
    fn selection_weight(
        &self,
        index: usize,
        player: &PlayerData,
        side: Side,
        band: Band,
        need: Need,
        dismissals: &HashSet<String>,
    ) -> f64 {
        if !dismissals.is_empty() && dismissals.contains(&player.id) {
            return 0.0;
        }
        let placement = if need.is_defensive() {
            roles::off_ball_weight(player.position, player.slot, player.role, band)
        } else {
            roles::on_ball_weight(player.position, player.slot, player.role, band)
        };
        if placement <= 0.0 {
            return 0.0;
        }
        // Suitability is deliberately super-linear: a clearly better player
        // should be picked noticeably more often, not marginally. Squared
        // rather than an arbitrary fractional power — the shape is what
        // matters, and `powf` is far too expensive to run for every player on
        // every action.
        let relative = need.fitness(player) / 50.0;
        let suitability = relative * relative;
        placement * suitability * self.cache(side).selection_weight(index)
    }

    pub(super) fn snap_player<R: Rng + ?Sized>(
        &self,
        side: Side,
        preferred: Position,
        rng: &mut R,
    ) -> PlayerSnap {
        let team = self.team_ref(side);

        // Counted and then indexed rather than collected into a `Vec`.
        //
        // This runs twice per action, and the possession chain resolves
        // hundreds of actions a match, so the two heap allocations this used to
        // make were the single largest cost in the simulation. Dismissals are
        // rare enough that checking the empty set first avoids ~22 string
        // hashes per call in almost every match.
        //
        // The draw is still a single `random_range` over the same pool size, so
        // a given seed picks exactly the same player as before.
        let dismissals = &self.sent_off;
        let eligible =
            |player: &PlayerData| dismissals.is_empty() || !dismissals.contains(&player.id);

        let in_position = team
            .players
            .iter()
            .filter(|player| eligible(player) && player.position == preferred)
            .count();

        // Fall back to any available player only when nobody plays the
        // preferred position — an eleven reduced by dismissals, say.
        let pool_size = if in_position > 0 {
            in_position
        } else {
            team.players
                .iter()
                .filter(|player| eligible(player))
                .count()
        };
        if pool_size == 0 {
            // Nobody available at all — see `PlayerSnap::placeholder`.
            return PlayerSnap::placeholder();
        }

        let nth = rng.random_range(0..pool_size);
        let chosen = if in_position > 0 {
            team.players
                .iter()
                .enumerate()
                .filter(|(_, player)| eligible(player) && player.position == preferred)
                .nth(nth)
        } else {
            team.players
                .iter()
                .enumerate()
                .filter(|(_, player)| eligible(player))
                .nth(nth)
        };
        match chosen {
            Some((index, _)) => self.snap_at(side, index),
            None => PlayerSnap::placeholder(),
        }
    }

    pub(super) fn snap_player_by_id(&self, player_id: &str, side: Side) -> PlayerSnap {
        match self.cache(side).index_of(player_id) {
            Some(index) => self.snap_at(side, index),
            None => PlayerSnap::placeholder(),
        }
    }

    pub(super) fn pick_penalty_taker<R: Rng + ?Sized>(
        &self,
        side: Side,
        rng: &mut R,
    ) -> PlayerSnap {
        let team = self.team_ref(side);
        let available = |p: &PlayerData| !self.sent_off.contains(&p.id);

        // Use designated taker if set
        if let Some(ref id) = self.set_pieces_ref(side).penalty_taker {
            let designated = team
                .players
                .iter()
                .enumerate()
                .find(|(_, p)| p.id == *id && available(p));
            if let Some((index, _)) = designated {
                return self.snap_at(side, index);
            }
        }

        // Otherwise the best shooter available. Picked by a single scan rather
        // than by sorting the whole squad into a fresh `Vec`. `min_by_key` on
        // the reversed rating, not `max_by_key`: both find the best shooter,
        // but on a tie `min_by_key` keeps the first, which is what the stable
        // sort this replaced did. `max_by_key` would keep the last and quietly
        // change who takes every tied penalty in the game.
        let best = team
            .players
            .iter()
            .enumerate()
            .filter(|(_, p)| available(p))
            .min_by_key(|(_, p)| std::cmp::Reverse(p.shooting));
        match best {
            Some((index, _)) => self.snap_at(side, index),
            None => self.snap_player(side, Position::Forward, rng),
        }
    }

    pub(super) fn pick_goalkeeper(&self, side: Side) -> PlayerSnap {
        let team = self.team_ref(side);
        let available = |p: &PlayerData| !self.sent_off.contains(&p.id);

        let keeper = team
            .players
            .iter()
            .enumerate()
            .find(|(_, p)| p.position == Position::Goalkeeper && available(p));
        if let Some((index, _)) = keeper {
            return self.snap_at(side, index);
        }
        // No goalkeeper available — anyone still on the pitch goes in goal.
        match team.players.iter().enumerate().find(|(_, p)| available(p)) {
            Some((index, _)) => self.snap_at(side, index),
            None => PlayerSnap::placeholder(),
        }
    }

    // -----------------------------------------------------------------------
    // Rating helpers
    // -----------------------------------------------------------------------

    pub(super) fn effective_press(&self, pressing_side: Side) -> f64 {
        let team = self.team_ref(pressing_side);
        let base = team.position_attr_avg(Position::Midfielder, |p| {
            (p.stamina as f64 + p.tackling as f64 + p.pace as f64) / 3.0
        });
        let modifier = play_style_modifier(team.play_style, PlayStylePhase::Press, true);
        base * modifier
            * tactics_pressing_press(&team.tactics)
            * home_mod(pressing_side, &self.config)
    }

    // -----------------------------------------------------------------------
    // Internal accessors
    // -----------------------------------------------------------------------

    pub(super) fn team_ref(&self, side: Side) -> &TeamData {
        match side {
            Side::Home => &self.home,
            Side::Away => &self.away,
        }
    }

    pub(super) fn team_mut(&mut self, side: Side) -> &mut TeamData {
        match side {
            Side::Home => &mut self.home,
            Side::Away => &mut self.away,
        }
    }

    pub(super) fn set_pieces_ref(&self, side: Side) -> &SetPieceTakers {
        match side {
            Side::Home => &self.home_set_pieces,
            Side::Away => &self.away_set_pieces,
        }
    }

    pub(super) fn set_pieces_mut(&mut self, side: Side) -> &mut SetPieceTakers {
        match side {
            Side::Home => &mut self.home_set_pieces,
            Side::Away => &mut self.away_set_pieces,
        }
    }

    /// Classify a goal about to be scored by `side`, using the CURRENT (pre-increment) score.
    pub(super) fn goal_context(&self, side: Side) -> GoalContext {
        let (own, opp) = match side {
            Side::Home => (self.home_score, self.away_score),
            Side::Away => (self.away_score, self.home_score),
        };
        let own_new = own + 1;
        if own == 0 && opp == 0 {
            GoalContext::Opener
        } else if own_new == opp {
            GoalContext::Equaliser
        } else if own_new > opp {
            GoalContext::Extends
        } else {
            GoalContext::Consolation
        }
    }

    pub(super) fn add_goal(&mut self, side: Side) {
        match side {
            Side::Home => self.home_score += 1,
            Side::Away => self.away_score += 1,
        }
    }
}

/// Map a shooter's effective rating to a danger band for shot commentary.
pub(super) fn danger_band(shoot_rating: f64) -> DangerBand {
    if shoot_rating >= 68.0 {
        DangerBand::BigChance
    } else if shoot_rating >= 50.0 {
        DangerBand::Decent
    } else {
        DangerBand::Speculative
    }
}

/// Map a keeper's effective rating to a save-quality band.
pub(super) fn save_quality(gk_rating: f64) -> SaveQuality {
    if gk_rating >= 68.0 {
        SaveQuality::WorldClass
    } else if gk_rating >= 50.0 {
        SaveQuality::Strong
    } else {
        SaveQuality::Routine
    }
}

/// Map a fouler's aggression (0-100) to a foul-severity band.
pub(super) fn foul_severity(aggression: u8) -> FoulSeverity {
    if aggression >= 70 {
        FoulSeverity::Reckless
    } else if aggression >= 40 {
        FoulSeverity::Hard
    } else {
        FoulSeverity::Soft
    }
}

#[cfg(test)]
mod commentary_detail_tests {
    use super::*;
    use crate::event::GoalContext;

    #[test]
    fn danger_band_thresholds() {
        assert_eq!(danger_band(40.0), DangerBand::Speculative);
        assert_eq!(danger_band(49.9), DangerBand::Speculative);
        assert_eq!(danger_band(50.0), DangerBand::Decent);
        assert_eq!(danger_band(55.0), DangerBand::Decent);
        assert_eq!(danger_band(67.9), DangerBand::Decent);
        assert_eq!(danger_band(68.0), DangerBand::BigChance);
        assert_eq!(danger_band(75.0), DangerBand::BigChance);
    }

    #[test]
    fn save_quality_thresholds() {
        assert_eq!(save_quality(40.0), SaveQuality::Routine);
        assert_eq!(save_quality(49.9), SaveQuality::Routine);
        assert_eq!(save_quality(50.0), SaveQuality::Strong);
        assert_eq!(save_quality(55.0), SaveQuality::Strong);
        assert_eq!(save_quality(67.9), SaveQuality::Strong);
        assert_eq!(save_quality(68.0), SaveQuality::WorldClass);
        assert_eq!(save_quality(75.0), SaveQuality::WorldClass);
    }

    #[test]
    fn foul_severity_thresholds() {
        assert_eq!(foul_severity(20), FoulSeverity::Soft);
        assert_eq!(foul_severity(39), FoulSeverity::Soft);
        assert_eq!(foul_severity(40), FoulSeverity::Hard);
        assert_eq!(foul_severity(55), FoulSeverity::Hard);
        assert_eq!(foul_severity(69), FoulSeverity::Hard);
        assert_eq!(foul_severity(70), FoulSeverity::Reckless);
        assert_eq!(foul_severity(85), FoulSeverity::Reckless);
    }

    fn make_test_player(id: &str, pos: crate::types::Position) -> crate::types::PlayerData {
        crate::types::PlayerData {
            id: id.to_string(),
            name: id.to_string(),
            position: pos,
            ovr: 70,
            condition: 90,
            fitness: 75,
            pace: 70,
            stamina: 70,
            strength: 70,
            agility: 70,
            passing: 70,
            shooting: 70,
            tackling: 70,
            dribbling: 70,
            defending: 70,
            positioning: 70,
            vision: 70,
            decisions: 70,
            composure: 70,
            aggression: 70,
            teamwork: 70,
            leadership: 70,
            handling: 70,
            reflexes: 70,
            aerial: 70,
            traits: vec![],
            slot: None,
            role: crate::types::PlayerRole::Standard,
        }
    }

    fn make_test_state() -> LiveMatchState {
        use crate::types::{MatchConfig, PlayStyle, Position, TeamData};
        let make_team = |id: &str| TeamData {
            id: id.to_string(),
            name: id.to_string(),
            formation: "4-4-2".to_string(),
            play_style: PlayStyle::Balanced,
            players: vec![
                make_test_player(&format!("{}_gk", id), Position::Goalkeeper),
                make_test_player(&format!("{}_d1", id), Position::Defender),
                make_test_player(&format!("{}_d2", id), Position::Defender),
                make_test_player(&format!("{}_d3", id), Position::Defender),
                make_test_player(&format!("{}_d4", id), Position::Defender),
                make_test_player(&format!("{}_m1", id), Position::Midfielder),
                make_test_player(&format!("{}_m2", id), Position::Midfielder),
                make_test_player(&format!("{}_m3", id), Position::Midfielder),
                make_test_player(&format!("{}_m4", id), Position::Midfielder),
                make_test_player(&format!("{}_f1", id), Position::Forward),
                make_test_player(&format!("{}_f2", id), Position::Forward),
            ],
            tactics: crate::types::TacticsConfig::default(),
        };
        LiveMatchState::new(
            make_team("home"),
            make_team("away"),
            MatchConfig::default(),
            vec![],
            vec![],
            false,
        )
    }

    #[test]
    fn goal_context_classifies_correctly() {
        let mut state = make_test_state();
        // 0-0, Home about to score -> Opener
        state.home_score = 0;
        state.away_score = 0;
        assert_eq!(state.goal_context(Side::Home), GoalContext::Opener);
        // 0-1, Home about to score -> Equaliser (0+1 == 1)
        state.home_score = 0;
        state.away_score = 1;
        assert_eq!(state.goal_context(Side::Home), GoalContext::Equaliser);
        // 1-0, Home about to score -> Extends (1+1 > 0)
        state.home_score = 1;
        state.away_score = 0;
        assert_eq!(state.goal_context(Side::Home), GoalContext::Extends);
        // 0-2, Home about to score -> Consolation (0+1 < 2)
        state.home_score = 0;
        state.away_score = 2;
        assert_eq!(state.goal_context(Side::Home), GoalContext::Consolation);
        // Away-side flip: 1-0, Away about to score -> Equaliser
        state.home_score = 1;
        state.away_score = 0;
        assert_eq!(state.goal_context(Side::Away), GoalContext::Equaliser);
    }

    /// Once any goal has been scored — including a penalty, which reaches the
    /// scoreboard through `add_goal` exactly like an open-play goal — no later
    /// goal can be an `Opener`. This pins the cross-path invariant that
    /// `first_goal_detail_is_opener` depends on: that test deliberately skips
    /// seeds where a `PenaltyGoal` scores first, so the penalty-before-goal
    /// case is verified here instead.
    #[test]
    fn goal_after_a_prior_goal_is_never_opener() {
        let mut state = make_test_state();
        // Simulate a converted penalty for the home side via the real scoring API.
        state.add_goal(Side::Home);
        assert_eq!(state.home_score, 1);

        // The scoreboard has moved, so neither side's next goal opens the scoring.
        assert_ne!(state.goal_context(Side::Home), GoalContext::Opener);
        assert_ne!(state.goal_context(Side::Away), GoalContext::Opener);
        // Specifically: home extends the lead, away equalises.
        assert_eq!(state.goal_context(Side::Home), GoalContext::Extends);
        assert_eq!(state.goal_context(Side::Away), GoalContext::Equaliser);
    }
}
