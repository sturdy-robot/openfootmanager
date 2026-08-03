use rand::{Rng, RngExt};

use crate::sim::state::Band;
use crate::event::{EventDetail, EventType, MatchEvent};
use crate::shared::{
    PlayStylePhase, PlayerSnap, TraitContext, play_style_modifier, role_attribute_modifier,
    tactics_buildup_mod, tactics_cross_probability, tactics_defensive_conversion_mod,
    tactics_foul_modifier, tactics_pressing_contest, tactics_shape_modifier,
    tactics_tempo_retention, trait_bonus,
};
use crate::types::{Side, Zone};

use super::LiveMatchState;
use super::helpers::{Need, danger_band, foul_severity, save_quality};

// ---------------------------------------------------------------------------
// Action resolution
// ---------------------------------------------------------------------------

/// How much more likely a defender is to concede a foul, by where they are
/// defending.
///
/// Fouls are not spread evenly over the pitch: a defender under pressure near
/// his own box commits far more of them than one closing down in midfield,
/// which is why so many dangerous free kicks are conceded in the final third.
/// A flat rate leaves free-kick goals undersupplied, and the more the ball is
/// circulated in midfield the worse that gets.
///
/// The band is read from the *fouling* side's point of view, so `OwnThird` is
/// the defender's own third — the attacking side's dangerous territory.
fn foul_pressure(band: Band) -> f64 {
    match band {
        Band::OwnBox => 1.45,
        Band::OwnThird => 1.44,
        Band::Middle => 0.95,
        Band::FinalThird => 0.80,
        Band::OppBox => 0.80,
    }
}

impl LiveMatchState {
    pub(super) fn resolve_action<R: Rng + ?Sized>(&mut self, minute: u8, rng: &mut R) -> Vec<MatchEvent> {
        let att_side = self.possession;
        let def_side = att_side.opposite();
        let zone = self.ball_zone;

        if zone.is_box_for(att_side) {
            self.resolve_shot(minute, att_side, rng)
        } else if zone == Zone::attacking_third(att_side) {
            self.resolve_attacking_third(minute, att_side, def_side, rng)
        } else if zone == Zone::Midfield {
            self.resolve_midfield(minute, att_side, def_side, rng)
        } else {
            self.resolve_buildup(minute, att_side, def_side, rng)
        }
    }

    fn resolve_buildup<R: Rng + ?Sized>(
        &mut self,
        minute: u8,
        att_side: Side,
        def_side: Side,
        rng: &mut R,
    ) -> Vec<MatchEvent> {
        let mut events = Vec::new();
        let passer = self.pick_actor(att_side, Band::OwnThird, Need::BuildUp, rng);
        let pass_skill = self.condition_adjusted_skill(
            &passer.id,
            (passer.passing as f64
                + passer.vision as f64
                + passer.composure as f64
                + passer.teamwork as f64)
                / 4.0,
        ) * trait_bonus(&passer, TraitContext::Passing);
        let press = self.effective_press(def_side);
        let ball_zone = self.ball_zone;

        let buildup_mod = tactics_buildup_mod(&self.team_ref(att_side).tactics);
        let success_chance = (pass_skill * 1.3 * buildup_mod) / (pass_skill * 1.3 * buildup_mod + press);
        if rng.random_range(0.0..1.0f64) < success_chance {
            let evt = MatchEvent::new(minute, EventType::PassCompleted, att_side, ball_zone)
                .with_player(&passer.id);
            self.events.push(evt.clone());
            events.push(evt);
            self.ball_zone = Zone::Midfield;
        } else {
            let interceptor = self.pick_actor(def_side, Band::FinalThird, Need::Defend, rng);
            let evt1 = MatchEvent::new(minute, EventType::PassIntercepted, att_side, ball_zone)
                .with_player(&passer.id);
            let evt2 = MatchEvent::new(minute, EventType::Interception, def_side, ball_zone)
                .with_player(&interceptor.id);
            self.events.push(evt1.clone());
            self.events.push(evt2.clone());
            events.push(evt1);
            events.push(evt2);
            self.possession = def_side;
        }
        events
    }

    fn resolve_midfield<R: Rng + ?Sized>(
        &mut self,
        minute: u8,
        att_side: Side,
        def_side: Side,
        rng: &mut R,
    ) -> Vec<MatchEvent> {
        let mut events = Vec::new();
        let attacker = self.pick_actor(att_side, Band::Middle, Need::Progress, rng);
        let defender = self.pick_actor(def_side, Band::Middle, Need::Defend, rng);

        let att_raw = (attacker.dribbling as f64
            + attacker.passing as f64
            + attacker.vision as f64
            + attacker.teamwork as f64)
            / 4.0;
        let def_raw = (defender.tackling as f64
            + defender.positioning as f64
            + defender.decisions as f64
            + defender.teamwork as f64)
            / 4.0;
        let att_rating = self.condition_adjusted_skill(&attacker.id, att_raw)
            * trait_bonus(&attacker, TraitContext::Midfield);
        let def_rating = self.condition_adjusted_skill(&defender.id, def_raw)
            * trait_bonus(&defender, TraitContext::Tackling);

        let att_mod = play_style_modifier(
            self.team_ref(att_side).play_style,
            PlayStylePhase::Midfield,
            true,
        ) * role_attribute_modifier(attacker.role, PlayStylePhase::Midfield);
        let def_mod = play_style_modifier(
            self.team_ref(def_side).play_style,
            PlayStylePhase::Midfield,
            false,
        ) * role_attribute_modifier(defender.role, PlayStylePhase::Defense);
        // This roll decides whether the ball is kept or lost — whether it
        // *advances* is the retention layer's call, in `possession.rs`. So the
        // tempo term here is retention, not progression: a patient side keeps
        // the ball better. It used to be progression, which meant a patient
        // side lost the ball *more* often and needed a compensating possession
        // bonus elsewhere to cancel out. Pressing is the other side of the same
        // roll: a side pressing hard wins it back more.
        let att_eff = att_rating
            * att_mod
            * crate::shared::home_mod(att_side, &self.config)
            * tactics_tempo_retention(&self.team_ref(att_side).tactics);
        let def_eff = def_rating
            * def_mod
            * crate::shared::home_mod(def_side, &self.config)
            * tactics_pressing_contest(&self.team_ref(def_side).tactics);
        let success = att_eff / (att_eff + def_eff);

        if rng.random_range(0.0..1.0f64) < success {
            let evt = MatchEvent::new(minute, EventType::PassCompleted, att_side, Zone::Midfield)
                .with_player(&attacker.id);
            self.events.push(evt.clone());
            events.push(evt);
            self.ball_zone = Zone::attacking_third(att_side);
        } else {
            if rng.random_range(0.0..1.0f64) < 0.6 {
                let evt = MatchEvent::new(minute, EventType::Tackle, def_side, Zone::Midfield)
                    .with_player(&defender.id);
                self.events.push(evt.clone());
                events.push(evt);
                let foul_mod = tactics_foul_modifier(&self.team_ref(def_side).tactics);
                let foul_events =
                    self.maybe_foul(minute, def_side, &attacker, &defender, Zone::Midfield, rng, foul_mod);
                let fouled = foul_events.iter().any(|e| e.event_type == EventType::Foul);
                events.extend(foul_events);
                if fouled {
                    // Fouled team (att_side) retains possession for the free kick
                    self.possession = att_side;
                    self.ball_zone = Zone::Midfield;
                    return events;
                }
            } else {
                let evt =
                    MatchEvent::new(minute, EventType::Interception, def_side, Zone::Midfield)
                        .with_player(&defender.id);
                self.events.push(evt.clone());
                events.push(evt);
            }
            self.possession = def_side;
            self.ball_zone = Zone::Midfield;
        }
        events
    }

    fn resolve_attacking_third<R: Rng + ?Sized>(
        &mut self,
        minute: u8,
        att_side: Side,
        def_side: Side,
        rng: &mut R,
    ) -> Vec<MatchEvent> {
        let mut events = Vec::new();
        let attacker = self.pick_actor(att_side, Band::FinalThird, Need::TakeOn, rng);
        let defender = self.pick_actor(def_side, Band::OwnThird, Need::Defend, rng);

        let att_raw = (attacker.dribbling as f64
            + attacker.pace as f64
            + attacker.agility as f64
            + attacker.composure as f64)
            / 4.0;
        let def_raw = (defender.defending as f64
            + defender.tackling as f64
            + defender.positioning as f64
            + defender.aerial as f64)
            / 4.0;
        let att_rating = self.condition_adjusted_skill(&attacker.id, att_raw)
            * trait_bonus(&attacker, TraitContext::Dribbling);
        let def_rating = self.condition_adjusted_skill(&defender.id, def_raw)
            * trait_bonus(&defender, TraitContext::Tackling);

        let att_mod = play_style_modifier(
            self.team_ref(att_side).play_style,
            PlayStylePhase::Attack,
            true,
        ) * role_attribute_modifier(attacker.role, PlayStylePhase::Attack);
        let def_mod = play_style_modifier(
            self.team_ref(def_side).play_style,
            PlayStylePhase::Defense,
            false,
        ) * role_attribute_modifier(defender.role, PlayStylePhase::Defense);
        let att_eff = att_rating * att_mod * crate::shared::home_mod(att_side, &self.config);
        let def_eff = def_rating
            * def_mod
            * crate::shared::home_mod(def_side, &self.config)
            * tactics_shape_modifier(&self.team_ref(def_side).tactics);
        let success = att_eff / (att_eff + def_eff);
        let zone = Zone::attacking_third(att_side);
        let cross_prob = tactics_cross_probability(&self.team_ref(att_side).tactics);

        if rng.random_range(0.0..1.0f64) < success {
            let evt = MatchEvent::new(minute, EventType::Dribble, att_side, zone)
                .with_player(&attacker.id);
            self.events.push(evt.clone());
            events.push(evt);
            if rng.random_range(0.0..1.0f64) < cross_prob {
                let winger_id = attacker.id.clone();
                let cross_evt = MatchEvent::new(minute, EventType::Cross, att_side, zone)
                    .with_player(&winger_id);
                self.events.push(cross_evt.clone());
                events.push(cross_evt);
                let header = self.pick_actor(att_side, Band::OppBox, Need::Shoot, rng);
                let def_header = self.pick_actor(def_side, Band::OwnBox, Need::Defend, rng);
                let aerial_att = header.aerial as f64;
                let aerial_def = def_header.aerial as f64;
                let aerial_win = aerial_att / (aerial_att + aerial_def);
                if rng.random_range(0.0..1.0f64) < aerial_win {
                    self.ball_zone = Zone::attacking_box(att_side);
                    let shot_events = self.resolve_shot(minute, att_side, rng);
                    events.extend(shot_events);
                } else {
                    let clear_evt =
                        MatchEvent::new(minute, EventType::Clearance, def_side, zone)
                            .with_player(&def_header.id);
                    self.events.push(clear_evt.clone());
                    events.push(clear_evt);
                    self.possession = def_side;
                    self.ball_zone = Zone::defensive_third(att_side);
                }
            } else {
                self.ball_zone = Zone::attacking_box(att_side);
            }
        } else {
            let is_tackle = rng.random_range(0.0..1.0f64) < 0.5;
            let fouled = if is_tackle {
                let evt1 = MatchEvent::new(minute, EventType::DribbleTackled, att_side, zone)
                    .with_player(&attacker.id)
                    .with_secondary(&defender.id);
                let evt2 = MatchEvent::new(minute, EventType::Tackle, def_side, zone)
                    .with_player(&defender.id);
                self.events.push(evt1.clone());
                self.events.push(evt2.clone());
                events.push(evt1);
                events.push(evt2);
                let foul_mod = tactics_foul_modifier(&self.team_ref(def_side).tactics);
                let foul_events =
                    self.maybe_foul(minute, def_side, &attacker, &defender, zone, rng, foul_mod);
                let was_fouled = foul_events.iter().any(|e| e.event_type == EventType::Foul);
                events.extend(foul_events);
                was_fouled
            } else {
                let evt = MatchEvent::new(minute, EventType::Clearance, def_side, zone)
                    .with_player(&defender.id);
                self.events.push(evt.clone());
                events.push(evt);
                false
            };
            if fouled {
                // Fouled team (att_side) retains possession for the free kick in the attacking third
                self.possession = att_side;
                self.ball_zone = zone;
                return events;
            }
            if rng.random_range(0.0..1.0f64) < 0.13 {
                let evt = MatchEvent::new(minute, EventType::Corner, att_side, zone);
                self.events.push(evt.clone());
                events.push(evt);
                // How often a corner actually produces a chance. Lower than it
                // looks: most corners are cleared. Set pieces are exempt from
                // the retain-or-progress decision, so whatever survives here
                // reaches the box, where it used to be pulled back out again.
                if rng.random_range(0.0..1.0f64) < 0.18 {
                    self.ball_zone = Zone::attacking_box(att_side);
                    return events;
                }
            }
            self.possession = def_side;
            self.ball_zone = Zone::defensive_third(att_side);
        }
        events
    }

    fn resolve_shot<R: Rng + ?Sized>(&mut self, minute: u8, att_side: Side, rng: &mut R) -> Vec<MatchEvent> {
        let mut events = Vec::new();
        let def_side = att_side.opposite();
        let zone = Zone::attacking_box(att_side);

        // Box foul rate fixed at 3.6% per shot — independent of foul_probability (which tunes outfield fouls)
        if rng.random_range(0.0..1.0f64) < 0.036 {
            let fouler = self.pick_actor(def_side, Band::OwnBox, Need::Defend, rng);
            let fouled = self.pick_actor(att_side, Band::OppBox, Need::Shoot, rng);
            let foul_evt = MatchEvent::new(minute, EventType::Foul, def_side, zone)
                .with_player(&fouler.id)
                .with_secondary(&fouled.id)
                .with_detail(EventDetail::Foul {
                    severity: foul_severity(fouler.aggression),
                });
            self.events.push(foul_evt.clone());
            events.push(foul_evt);

            if rng.random_range(0.0..1.0f64) < self.config.penalty_probability {
                let pen_evt =
                    MatchEvent::new(minute, EventType::PenaltyAwarded, att_side, zone);
                self.events.push(pen_evt.clone());
                events.push(pen_evt);
                let pen_events = self.resolve_in_match_penalty(minute, att_side, rng);
                events.extend(pen_events);
                let card_events = self.maybe_card(minute, def_side, &fouler.id.clone(), zone, rng);
                events.extend(card_events);
                self.ball_zone = Zone::Midfield;
                self.possession = def_side;
                return events;
            }
            let card_events = self.maybe_card(minute, def_side, &fouler.id.clone(), zone, rng);
            events.extend(card_events);
            // Foul but no penalty: advantage played, shot continues
        }

        let shooter = self.pick_actor(att_side, Band::OppBox, Need::Shoot, rng);
        let assister = self.pick_actor(att_side, Band::FinalThird, Need::Progress, rng);
        let goalkeeper = self.pick_actor(def_side, Band::OwnBox, Need::Keep, rng);

        let shoot_raw =
            (shooter.shooting as f64 + shooter.composure as f64 + shooter.decisions as f64) / 3.0;
        let shoot_rating = self.condition_adjusted_skill(&shooter.id, shoot_raw)
            * trait_bonus(&shooter, TraitContext::Shooting);
        let gk_raw = (goalkeeper.handling as f64
            + goalkeeper.reflexes as f64
            + goalkeeper.positioning as f64)
            / 3.0;
        let gk_rating = self.condition_adjusted_skill(&goalkeeper.id, gk_raw)
            * trait_bonus(&goalkeeper, TraitContext::Goalkeeping);

        let accuracy =
            (self.config.shot_accuracy_base + (shoot_rating - 50.0) / 200.0).clamp(0.15, 0.85);

        if rng.random_range(0.0..1.0f64) > accuracy {
            let detail = EventDetail::Shot {
                danger: danger_band(shoot_rating),
            };
            if rng.random_range(0.0..1.0f64) < 0.4 {
                let evt = MatchEvent::new(minute, EventType::ShotBlocked, att_side, zone)
                    .with_player(&shooter.id)
                    .with_detail(detail);
                self.events.push(evt.clone());
                events.push(evt);
                self.ball_zone = Zone::Midfield;
                self.possession = def_side;
            } else {
                let evt = MatchEvent::new(minute, EventType::ShotOffTarget, att_side, zone)
                    .with_player(&shooter.id)
                    .with_detail(detail);
                self.events.push(evt.clone());
                events.push(evt);
                let gk_evt = MatchEvent::new(minute, EventType::GoalKick, def_side, zone);
                self.events.push(gk_evt.clone());
                events.push(gk_evt);
                self.ball_zone = Zone::defensive_third(def_side);
                self.possession = def_side;
            }
            return events;
        }

        let def_line_mod = tactics_defensive_conversion_mod(&self.team_ref(def_side).tactics);
        let conversion = (self.config.goal_conversion_base * def_line_mod + (shoot_rating - gk_rating) / 150.0)
            .clamp(0.10, 0.70);

        if rng.random_range(0.0..1.0f64) < conversion {
            let context = self.goal_context(att_side);
            let evt = MatchEvent::new(minute, EventType::Goal, att_side, zone)
                .with_player(&shooter.id)
                .with_secondary(&assister.id)
                .with_detail(EventDetail::Goal { context });
            self.events.push(evt.clone());
            events.push(evt);
            self.add_goal(att_side);
            self.ball_zone = Zone::Midfield;
            self.possession = def_side;
        } else {
            let evt = MatchEvent::new(minute, EventType::ShotSaved, att_side, zone)
                .with_player(&shooter.id)
                .with_detail(EventDetail::Save {
                    quality: save_quality(gk_rating),
                });
            self.events.push(evt.clone());
            events.push(evt);
            // 40% of saves → corner (keeper parries wide), 60% → goal kick (keeper catches)
            if rng.random_range(0.0..1.0f64) < 0.40 {
                let corner_evt = MatchEvent::new(minute, EventType::Corner, att_side, zone);
                self.events.push(corner_evt.clone());
                events.push(corner_evt);
                self.possession = att_side;
                self.ball_zone = Zone::attacking_box(att_side);
            } else {
                let gk_evt = MatchEvent::new(minute, EventType::GoalKick, def_side, zone);
                self.events.push(gk_evt.clone());
                events.push(gk_evt);
                self.ball_zone = Zone::defensive_third(def_side);
                self.possession = def_side;
            }
        }

        events
    }

    // -----------------------------------------------------------------------
    // Foul / card / penalty
    // -----------------------------------------------------------------------

    // Mirrors `engine::fouls::maybe_foul` — foul resolution needs the full context
    // (who, whom, where, when, tactics, RNG), so the argument count is inherent.
    #[allow(clippy::too_many_arguments)]
    pub(super) fn maybe_foul<R: Rng + ?Sized>(
        &mut self,
        minute: u8,
        fouling_side: Side,
        fouled: &PlayerSnap,
        fouler: &PlayerSnap,
        zone: Zone,
        rng: &mut R,
        tactics_mod: f64,
    ) -> Vec<MatchEvent> {
        let mut events = Vec::new();

        let aggression_mod = fouler.aggression as f64 / 100.0;
        let foul_chance = self.config.foul_probability
            * (0.6 + aggression_mod * 0.8)
            * trait_bonus(fouler, TraitContext::Foul)
            * tactics_mod
            * foul_pressure(Band::from_zone(zone, fouling_side));
        if rng.random_range(0.0..1.0f64) >= foul_chance {
            return events;
        }

        let evt = MatchEvent::new(minute, EventType::Foul, fouling_side, zone)
            .with_player(&fouler.id)
            .with_secondary(&fouled.id)
            .with_detail(EventDetail::Foul {
                severity: foul_severity(fouler.aggression),
            });
        self.events.push(evt.clone());
        events.push(evt);

        let att_side = fouling_side.opposite();

        if zone.is_box_for(att_side)
            && rng.random_range(0.0..1.0f64) < self.config.penalty_probability
        {
            let evt = MatchEvent::new(minute, EventType::PenaltyAwarded, att_side, zone);
            self.events.push(evt.clone());
            events.push(evt);
            let pen_events = self.resolve_in_match_penalty(minute, att_side, rng);
            events.extend(pen_events);
        } else {
            let evt = MatchEvent::new(minute, EventType::FreeKick, att_side, zone);
            self.events.push(evt.clone());
            events.push(evt);
        }

        let card_events = self.maybe_card(minute, fouling_side, &fouler.id, zone, rng);
        events.extend(card_events);

        if rng.random_range(0.0..1.0f64) < self.config.injury_probability {
            let evt =
                MatchEvent::new(minute, EventType::Injury, att_side, zone).with_player(&fouled.id);
            self.events.push(evt.clone());
            events.push(evt);
        }

        events
    }

    pub(super) fn maybe_card<R: Rng + ?Sized>(
        &mut self,
        minute: u8,
        side: Side,
        fouler_id: &str,
        zone: Zone,
        rng: &mut R,
    ) -> Vec<MatchEvent> {
        let mut events = Vec::new();

        let aggression_factor = self
            .team_ref(side)
            .players
            .iter()
            .find(|p| p.id == fouler_id)
            .map(|p| p.aggression as f64 / 100.0)
            .unwrap_or(0.5);
        let card_chance = self.config.yellow_card_probability * (0.5 + aggression_factor);
        if rng.random_range(0.0..1.0f64) >= card_chance {
            return events;
        }

        if rng.random_range(0.0..1.0f64) < self.config.red_card_probability {
            let evt =
                MatchEvent::new(minute, EventType::RedCard, side, zone).with_player(fouler_id);
            self.events.push(evt.clone());
            events.push(evt);
            self.sent_off.insert(fouler_id.to_string());
            return events;
        }

        let current_yellows = self.yellows.entry(fouler_id.to_string()).or_insert(0);
        *current_yellows += 1;

        if *current_yellows >= 2 {
            let evt =
                MatchEvent::new(minute, EventType::SecondYellow, side, zone).with_player(fouler_id);
            self.events.push(evt.clone());
            events.push(evt);
            self.sent_off.insert(fouler_id.to_string());
        } else {
            let evt =
                MatchEvent::new(minute, EventType::YellowCard, side, zone).with_player(fouler_id);
            self.events.push(evt.clone());
            events.push(evt);
        }

        events
    }
}

#[cfg(test)]
mod event_detail_tests {
    use rand::SeedableRng;
    use rand::rngs::StdRng;

    use crate::event::{EventDetail, EventType, GoalContext};
    use crate::live_match::LiveMatchState;
    use crate::types::{MatchConfig, PlayStyle, PlayerData, Position, TeamData};

    fn make_player(id: &str, pos: Position) -> PlayerData {
        PlayerData {
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

    fn make_team(id: &str) -> TeamData {
        TeamData {
            id: id.to_string(),
            name: id.to_string(),
            formation: "4-4-2".to_string(),
            play_style: PlayStyle::Balanced,
            tactics: crate::types::TacticsConfig::default(),
            players: vec![
                make_player(&format!("{id}_gk"), Position::Goalkeeper),
                make_player(&format!("{id}_d1"), Position::Defender),
                make_player(&format!("{id}_d2"), Position::Defender),
                make_player(&format!("{id}_d3"), Position::Defender),
                make_player(&format!("{id}_d4"), Position::Defender),
                make_player(&format!("{id}_m1"), Position::Midfielder),
                make_player(&format!("{id}_m2"), Position::Midfielder),
                make_player(&format!("{id}_m3"), Position::Midfielder),
                make_player(&format!("{id}_m4"), Position::Midfielder),
                make_player(&format!("{id}_f1"), Position::Forward),
                make_player(&format!("{id}_f2"), Position::Forward),
            ],
        }
    }

    /// The first goal of any match must be classified as `Opener` because both
    /// scores are 0 at that point.
    #[test]
    fn first_goal_detail_is_opener() {
        // Try multiple seeds and validate the invariant whenever a goal appears.
        let mut saw_any_goal = false;
        for seed in 0u64..500 {
            let mut state = LiveMatchState::new(
                make_team("home"),
                make_team("away"),
                MatchConfig::default(),
                vec![],
                vec![],
                false,
            );
            let mut rng = StdRng::seed_from_u64(seed);

            // Step minute-by-minute until finished or the first scoring event
            // appears. A `PenaltyGoal` can score before any open-play `Goal` and
            // updates the score, so the first open-play goal is only guaranteed
            // to be an `Opener` when nothing scored before it.
            let first_scoring = loop {
                let result = state.step_minute(&mut rng);
                let scoring = result
                    .events
                    .iter()
                    .find(|e| matches!(e.event_type, EventType::Goal | EventType::PenaltyGoal))
                    .cloned();
                if let Some(evt) = scoring {
                    break Some(evt);
                }
                if result.is_finished {
                    break None;
                }
            };

            if let Some(first_evt) = first_scoring
                && first_evt.event_type == EventType::Goal
            {
                assert_eq!(
                    first_evt.detail,
                    Some(EventDetail::Goal {
                        context: GoalContext::Opener
                    }),
                    "seed {seed}: first goal detail should be Opener, got {:?}",
                    first_evt.detail
                );
                saw_any_goal = true;
            }
            // No goal scored in this seed — try the next one.
        }
        assert!(
            saw_any_goal,
            "No goal was scored in 500 seeds; increase seed range or check engine config"
        );
    }
}
