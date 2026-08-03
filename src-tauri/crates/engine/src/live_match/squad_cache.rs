//! Per-squad data the hot path reads by index rather than by player id.
//!
//! A squad's membership barely changes during a match — five substitutions at
//! most, and the XI is slot-aligned so a sub takes the vacated index rather
//! than being appended. Everything derived from a player that the resolution
//! code needs hundreds of times a minute therefore belongs in an array parallel
//! to `TeamData::players`, prepared once and patched when someone comes on.
//!
//! What that replaces, in each case, is a hash of a `String` player id:
//!
//! - **`id`** — a shared handle, so taking a player snapshot is a refcount bump
//!   instead of copying the text of the id.
//! - **`traits`** — matched against the known names once, at kick-off, instead
//!   of scanning a `Vec<String>` every time a trait bonus is asked for.
//! - **`condition`** — the stamina figure that used to live in a
//!   `HashMap<String, f64>`, looked up on every contested action.
//! - **`selection_weight`** — condition folded into a multiplier for choosing
//!   who acts, refreshed once a minute because it is read for every player on
//!   both sides, twice per action.

use std::sync::Arc;

use super::helpers::Need;
use crate::sim::player_traits::TraitFlags;
use crate::sim::roles;
use crate::sim::state::Band;
use crate::types::PlayerData;

/// Everything about one player that stays put between substitutions.
///
/// Choosing who acts weighs every player on both sides, twice per action —
/// something like fifteen thousand times a match. Each of those used to walk a
/// twenty-seven-arm match on the player's role, read a placement table, and sum
/// four attributes, all to arrive at numbers that had not changed since
/// kick-off. They are worked out once and read from here instead.
#[derive(Debug, Clone, Default)]
struct Placement {
    /// Relative likelihood of being on the ball, per band.
    on_ball: [f64; Band::COUNT],
    /// Relative likelihood of contesting it, per band.
    off_ball: [f64; Band::COUNT],
    /// How suited this player is to each job, already squared.
    suitability: [f64; Need::COUNT],
}

impl Placement {
    fn new(player: &PlayerData) -> Self {
        let mut on_ball = [0.0; Band::COUNT];
        let mut off_ball = [0.0; Band::COUNT];
        for (index, band) in Band::ALL.iter().enumerate() {
            on_ball[index] =
                roles::on_ball_weight(player.position, player.slot, player.role, *band);
            off_ball[index] =
                roles::off_ball_weight(player.position, player.slot, player.role, *band);
        }

        let mut suitability = [0.0; Need::COUNT];
        for (index, need) in Need::ALL.iter().enumerate() {
            // Deliberately super-linear: a clearly better player should be
            // picked noticeably more often, not marginally.
            let relative = need.fitness(player) / 50.0;
            suitability[index] = relative * relative;
        }

        Self {
            on_ball,
            off_ball,
            suitability,
        }
    }
}

#[derive(Debug, Clone, Default)]
pub(super) struct SquadCache {
    ids: Vec<Arc<str>>,
    traits: Vec<TraitFlags>,
    /// Live stamina, 0–100.
    condition: Vec<f64>,
    /// Condition as a selection multiplier; see `refresh_selection_weights`.
    selection_weight: Vec<f64>,
    placement: Vec<Placement>,
}

impl SquadCache {
    /// Prepare the cache for a squad at kick-off.
    pub fn new(players: &[PlayerData]) -> Self {
        Self {
            ids: players.iter().map(|p| Arc::from(p.id.as_str())).collect(),
            traits: players
                .iter()
                .map(|p| TraitFlags::from_names(&p.traits))
                .collect(),
            condition: players.iter().map(|p| p.condition as f64).collect(),
            selection_weight: vec![1.0; players.len()],
            placement: players.iter().map(Placement::new).collect(),
        }
    }

    /// A player has come on in another's place. The squad keeps its length and
    /// its ordering — the XI is slot-aligned, so the substitute plays the slot
    /// that was vacated — which is exactly what lets every index stay valid.
    pub fn replace(&mut self, index: usize, player: &PlayerData) {
        if index >= self.ids.len() {
            return;
        }
        self.ids[index] = Arc::from(player.id.as_str());
        self.traits[index] = TraitFlags::from_names(&player.traits);
        self.condition[index] = player.condition as f64;
        self.selection_weight[index] = selection_weight(player.condition as f64);
        self.placement[index] = Placement::new(player);
    }

    /// Recompute where everyone plays.
    ///
    /// Changing formation rewrites players' positions in place, without anybody
    /// leaving the pitch. Nothing else about the squad moves, so this is the one
    /// case where the cache can go stale while every index stays perfectly
    /// valid — and the batch path never changes formation, so no golden report
    /// would ever catch it.
    pub fn refresh_placements(&mut self, players: &[PlayerData]) {
        self.placement.clear();
        self.placement.extend(players.iter().map(Placement::new));
    }

    /// How likely this player is to be the one acting in `band`.
    ///
    /// Zero means he is not in this part of the pitch at all.
    pub fn placement(&self, index: usize, band: Band, need: Need) -> f64 {
        let Some(placement) = self.placement.get(index) else {
            return 0.0;
        };
        if need.is_defensive() {
            placement.off_ball[band.index()]
        } else {
            placement.on_ball[band.index()]
        }
    }

    /// How suited this player is to the job being asked of him.
    pub fn suitability(&self, index: usize, need: Need) -> f64 {
        match self.placement.get(index) {
            Some(placement) => placement.suitability[need.index()],
            None => 0.0,
        }
    }

    pub fn id(&self, index: usize) -> Arc<str> {
        match self.ids.get(index) {
            Some(id) => Arc::clone(id),
            None => Arc::from(""),
        }
    }

    pub fn traits(&self, index: usize) -> TraitFlags {
        self.traits.get(index).copied().unwrap_or_default()
    }

    /// A player's live stamina. Falls back to the midpoint for an index that is
    /// not in this squad, which is what the id-keyed map did for an id it had
    /// never seen.
    pub fn condition(&self, index: usize) -> f64 {
        self.condition.get(index).copied().unwrap_or(50.0)
    }

    /// A substitution can leave the weights a minute stale; a neutral value is
    /// the right answer until the next refresh.
    pub fn selection_weight(&self, index: usize) -> f64 {
        self.selection_weight.get(index).copied().unwrap_or(1.0)
    }

    pub fn deplete(&mut self, index: usize, amount: f64) {
        if let Some(condition) = self.condition.get_mut(index) {
            *condition = (*condition - amount).max(5.0);
        }
    }

    pub fn refresh_selection_weights(&mut self) {
        for (weight, condition) in self.selection_weight.iter_mut().zip(&self.condition) {
            *weight = selection_weight(*condition);
        }
    }

    /// Find a player by id. Only for the paths that genuinely start from an id
    /// — a command naming a player, a snapshot being assembled — never from
    /// inside action resolution.
    pub fn index_of(&self, id: &str) -> Option<usize> {
        self.ids.iter().position(|known| &**known == id)
    }
}

/// How much a player's condition weighs on being chosen to act.
///
/// A tired player is less involved but not absent, so this floors well above
/// zero: at full condition 1.0, at nothing 0.55.
#[inline]
fn selection_weight(condition: f64) -> f64 {
    0.55 + 0.45 * (condition / 100.0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{PlayerRole, Position};

    fn player(id: &str, condition: u8, traits: &[&str]) -> PlayerData {
        PlayerData {
            id: id.to_string(),
            name: id.to_string(),
            position: Position::Midfielder,
            ovr: 70,
            condition,
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
            traits: traits.iter().map(|t| t.to_string()).collect(),
            slot: None,
            role: PlayerRole::Standard,
        }
    }

    #[test]
    fn a_cache_mirrors_the_squad_it_was_built_from() {
        let squad = [player("a", 90, &["Sharpshooter"]), player("b", 40, &[])];
        let cache = SquadCache::new(&squad);

        assert_eq!(&*cache.id(0), "a");
        assert_eq!(&*cache.id(1), "b");
        assert!(cache.traits(0).sharpshooter());
        assert!(!cache.traits(1).sharpshooter());
        assert_eq!(cache.condition(0), 90.0);
        assert_eq!(cache.condition(1), 40.0);
    }

    #[test]
    fn a_substitute_takes_over_the_index_completely() {
        // The bug this guards against is a cache that keeps any part of the
        // player who went off — his id, his traits or his stamina — and so
        // attributes the substitute's actions to him.
        let squad = [player("starter", 30, &["HotHead"])];
        let mut cache = SquadCache::new(&squad);

        cache.replace(0, &player("sub", 100, &["CoolHead"]));

        assert_eq!(&*cache.id(0), "sub");
        assert!(cache.traits(0).cool_head());
        assert!(!cache.traits(0).hot_head(), "the starter's trait survived");
        assert_eq!(cache.condition(0), 100.0, "the substitute came on tired");
    }

    #[test]
    fn a_fresh_player_is_likelier_to_act_than_a_spent_one() {
        let squad = [player("fresh", 100, &[]), player("spent", 5, &[])];
        let mut cache = SquadCache::new(&squad);
        cache.refresh_selection_weights();

        assert!(cache.selection_weight(0) > cache.selection_weight(1));
        // Tiredness reduces involvement; it never removes a player from the
        // game, which would leave a side unable to act at all.
        assert!(cache.selection_weight(1) > 0.0);
    }

    #[test]
    fn depletion_floors_rather_than_going_negative() {
        let squad = [player("a", 10, &[])];
        let mut cache = SquadCache::new(&squad);
        cache.deplete(0, 500.0);
        assert_eq!(cache.condition(0), 5.0);
    }

    #[test]
    fn an_index_outside_the_squad_answers_neutrally() {
        // Reached when a side has fewer players than the engine asks about —
        // a red card down to nine, a malformed squad. It must not panic.
        let cache = SquadCache::new(&[player("a", 80, &[])]);
        assert_eq!(&*cache.id(99), "");
        assert_eq!(cache.traits(99), TraitFlags::none());
        assert_eq!(cache.selection_weight(99), 1.0);
    }

    #[test]
    fn a_player_can_still_be_found_by_id() {
        let squad = [player("a", 80, &[]), player("b", 80, &[])];
        let cache = SquadCache::new(&squad);
        assert_eq!(cache.index_of("b"), Some(1));
        assert_eq!(cache.index_of("nobody"), None);
    }
}
