use rand::{Rng, RngExt};

use crate::event::{EventDetail, EventType, MatchEvent};
use crate::shared::{
    PlayStylePhase, PlayerSnap, TraitContext, role_attribute_modifier,
    tactics_defensive_conversion_mod, tactics_foul_modifier, tactics_shape_modifier, trait_bonus,
};
use crate::sim::state::Band;
use crate::types::{Side, Zone};

use super::LiveMatchState;
use super::helpers::{Need, danger_band, foul_severity, save_quality};
use crate::sim::action::{Action, choose_action};

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
        Band::OwnBox => 0.70,
        Band::OwnThird => 1.60,
        Band::Middle => 1.30,
        Band::FinalThird => 0.80,
        Band::OppBox => 0.80,
    }
}

/// How ambitious a pass is.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum PassKind {
    /// To a team-mate nearby. Keeps play where it is.
    Short,
    /// Breaks a line. Moves play on one phase.
    Progressive,
    /// Hit long. Skips a phase, given away far more often.
    Long,
}

impl PassKind {
    /// Baseline completion before the passer, the press or the pitch.
    ///
    /// Real football completes around 80–88% of passes overall, and that
    /// average is dominated by short ones. A long ball is closer to a coin
    /// flip.
    fn base_completion(self) -> f64 {
        match self {
            PassKind::Short => 0.860,
            PassKind::Progressive => 0.700,
            PassKind::Long => 0.47,
        }
    }

    /// How far up the pitch it moves play when it comes off.
    fn bands_gained(self) -> u8 {
        match self {
            PassKind::Short => 0,
            PassKind::Progressive => 1,
            PassKind::Long => 2,
        }
    }
}

impl LiveMatchState {
    pub(super) fn resolve_action<R: Rng + ?Sized>(
        &mut self,
        minute: u8,
        rng: &mut R,
    ) -> Vec<MatchEvent> {
        let att_side = self.possession;
        let def_side = att_side.opposite();
        let band = Band::from_zone(self.ball_zone, att_side);

        // Who is on the ball is settled first, because what he does with it
        // depends on the sort of player he is.
        let need = match band {
            Band::OwnBox | Band::OwnThird => Need::BuildUp,
            Band::Middle => Need::Progress,
            Band::FinalThird | Band::OppBox => Need::TakeOn,
        };
        let actor = self.pick_actor(att_side, band, need, rng);

        let own_tactics = self.team_ref(att_side).tactics;
        let opponent_tactics = self.team_ref(def_side).tactics;
        let action = choose_action(band, actor.role, &own_tactics, &opponent_tactics, rng);

        match action {
            Action::ShortPass => self.resolve_pass(
                minute,
                att_side,
                def_side,
                band,
                &actor,
                PassKind::Short,
                rng,
            ),
            Action::ProgressivePass => self.resolve_pass(
                minute,
                att_side,
                def_side,
                band,
                &actor,
                PassKind::Progressive,
                rng,
            ),
            Action::LongPass => self.resolve_pass(
                minute,
                att_side,
                def_side,
                band,
                &actor,
                PassKind::Long,
                rng,
            ),
            Action::Carry => self.resolve_carry(minute, att_side, def_side, band, &actor, rng),
            Action::TakeOn => self.resolve_take_on(minute, att_side, def_side, band, &actor, rng),
            Action::Cross => self.resolve_cross(minute, att_side, def_side, band, &actor, rng),
            Action::Shot => self.resolve_shot(minute, att_side, rng),
        }
    }

    fn resolve_shot<R: Rng + ?Sized>(
        &mut self,
        minute: u8,
        att_side: Side,
        rng: &mut R,
    ) -> Vec<MatchEvent> {
        let mut events = Vec::new();
        let def_side = att_side.opposite();
        let zone = Zone::attacking_box(att_side);

        // Box foul rate fixed at 3.6% per shot — independent of foul_probability (which tunes outfield fouls)
        if rng.random_range(0.0..1.0f64) < 0.036 {
            let fouler = self.pick_actor(def_side, Band::OwnBox, Need::Defend, rng);
            let fouled = self.pick_actor(att_side, Band::OppBox, Need::Shoot, rng);
            let foul_evt = MatchEvent::new(minute, EventType::Foul, def_side, zone)
                .with_player(fouler.id.clone())
                .with_secondary(fouled.id.clone())
                .with_detail(EventDetail::Foul {
                    severity: foul_severity(fouler.aggression),
                });
            self.events.push(foul_evt.clone());
            events.push(foul_evt);

            if rng.random_range(0.0..1.0f64) < self.config.penalty_probability {
                let pen_evt = MatchEvent::new(minute, EventType::PenaltyAwarded, att_side, zone);
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
        let shoot_rating = self.condition_adjusted_skill(&shooter, shoot_raw)
            * trait_bonus(&shooter, TraitContext::Shooting);
        let gk_raw = (goalkeeper.handling as f64
            + goalkeeper.reflexes as f64
            + goalkeeper.positioning as f64)
            / 3.0;
        let gk_rating = self.condition_adjusted_skill(&goalkeeper, gk_raw)
            * trait_bonus(&goalkeeper, TraitContext::Goalkeeping);

        let accuracy =
            (self.config.shot_accuracy_base + (shoot_rating - 50.0) / 200.0).clamp(0.15, 0.85);

        if rng.random_range(0.0..1.0f64) > accuracy {
            let detail = EventDetail::Shot {
                danger: danger_band(shoot_rating),
            };
            if rng.random_range(0.0..1.0f64) < 0.4 {
                let evt = MatchEvent::new(minute, EventType::ShotBlocked, att_side, zone)
                    .with_player(shooter.id.clone())
                    .with_detail(detail);
                self.events.push(evt.clone());
                events.push(evt);
                self.ball_zone = Zone::Midfield;
                self.possession = def_side;
            } else {
                let evt = MatchEvent::new(minute, EventType::ShotOffTarget, att_side, zone)
                    .with_player(shooter.id.clone())
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
        let conversion = (self.config.goal_conversion_base * def_line_mod
            + (shoot_rating - gk_rating) / 150.0)
            .clamp(0.10, 0.70);

        if rng.random_range(0.0..1.0f64) < conversion {
            let context = self.goal_context(att_side);
            let evt = MatchEvent::new(minute, EventType::Goal, att_side, zone)
                .with_player(shooter.id.clone())
                .with_secondary(assister.id.clone())
                .with_detail(EventDetail::Goal { context });
            self.events.push(evt.clone());
            events.push(evt);
            self.add_goal(att_side);
            self.ball_zone = Zone::Midfield;
            self.possession = def_side;
        } else {
            let evt = MatchEvent::new(minute, EventType::ShotSaved, att_side, zone)
                .with_player(shooter.id.clone())
                .with_detail(EventDetail::Save {
                    quality: save_quality(gk_rating),
                });
            self.events.push(evt.clone());
            events.push(evt);
            // 40% of saves → corner (keeper parries wide), 60% → goal kick (keeper catches)
            if rng.random_range(0.0..1.0f64) < 0.52 {
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
            .with_player(fouler.id.clone())
            .with_secondary(fouled.id.clone())
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
            let evt = MatchEvent::new(minute, EventType::Injury, att_side, zone)
                .with_player(fouled.id.clone());
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

impl LiveMatchState {
    /// Committing to beat a man: a duel, roughly even, and the main source of
    /// fouls in dangerous areas.
    fn resolve_take_on<R: Rng + ?Sized>(
        &mut self,
        minute: u8,
        att_side: Side,
        def_side: Side,
        band: Band,
        attacker: &PlayerSnap,
        rng: &mut R,
    ) -> Vec<MatchEvent> {
        let mut events = Vec::new();
        let zone = self.ball_zone;
        let defender = self.pick_actor(def_side, band.mirror(), Need::Defend, rng);

        let att_raw = (attacker.dribbling as f64
            + attacker.pace as f64
            + attacker.agility as f64
            + attacker.composure as f64)
            / 4.0;
        let def_raw =
            (defender.defending as f64 + defender.tackling as f64 + defender.positioning as f64)
                / 3.0;
        let att_eff = self.condition_adjusted_skill(attacker, att_raw)
            * trait_bonus(attacker, TraitContext::Dribbling)
            * role_attribute_modifier(attacker.role, PlayStylePhase::Attack)
            * crate::shared::home_mod(att_side, &self.config);
        let def_eff = self.condition_adjusted_skill(&defender, def_raw)
            * trait_bonus(&defender, TraitContext::Tackling)
            * role_attribute_modifier(defender.role, PlayStylePhase::Defense)
            * crate::shared::home_mod(def_side, &self.config)
            * tactics_shape_modifier(&self.team_ref(def_side).tactics);
        let success = att_eff / (att_eff + def_eff);

        if rng.random_range(0.0..1.0f64) < success {
            let evt = MatchEvent::new(minute, EventType::Dribble, att_side, zone)
                .with_player(attacker.id.clone());
            self.events.push(evt.clone());
            events.push(evt);
            // Beating a man usually just buys space; only sometimes does it
            // carry play into the next phase.
            if rng.random_range(0.0..1.0f64) < 0.42
                && let Some(further) = band.advanced()
            {
                self.ball_zone = further.to_zone(att_side);
            }
            return events;
        }

        // Beaten: a tackle, or a foul, or the ball hacked away.
        let is_tackle = rng.random_range(0.0..1.0f64) < 0.5;
        let fouled = if is_tackle {
            let beaten = MatchEvent::new(minute, EventType::DribbleTackled, att_side, zone)
                .with_player(attacker.id.clone())
                .with_secondary(defender.id.clone());
            let tackle = MatchEvent::new(minute, EventType::Tackle, def_side, zone)
                .with_player(defender.id.clone());
            self.events.push(beaten.clone());
            self.events.push(tackle.clone());
            events.push(beaten);
            events.push(tackle);
            let foul_mod = tactics_foul_modifier(&self.team_ref(def_side).tactics);
            let foul_events =
                self.maybe_foul(minute, def_side, attacker, &defender, zone, rng, foul_mod);
            let was_fouled = foul_events.iter().any(|e| e.event_type == EventType::Foul);
            events.extend(foul_events);
            was_fouled
        } else {
            let clearance = MatchEvent::new(minute, EventType::Clearance, def_side, zone)
                .with_player(defender.id.clone());
            self.events.push(clearance.clone());
            events.push(clearance);
            false
        };

        if fouled {
            // The free kick stays with the side that was fouled. A dangerous
            // one is worth something: a delivery into the box is how free kicks
            // turn into goals, and without it set-piece scoring never happens.
            self.possession = att_side;
            self.ball_zone = zone;
            if matches!(band, Band::FinalThird | Band::OppBox)
                && rng.random_range(0.0..1.0f64) < 0.72
            {
                // A free kick in a dangerous area is delivered and attacked
                // there and then. Merely moving the ball into the box left set
                // pieces producing almost no goals, because play usually
                // recycled before anyone had a shot.
                self.ball_zone = Band::OppBox.to_zone(att_side);
                events.extend(self.resolve_shot(minute, att_side, rng));
            }
            return events;
        }

        // A cleared ball in the final third is often a corner.
        if matches!(band, Band::FinalThird | Band::OppBox) && rng.random_range(0.0..1.0f64) < 0.20 {
            let corner = MatchEvent::new(minute, EventType::Corner, att_side, zone);
            self.events.push(corner.clone());
            events.push(corner);
            if rng.random_range(0.0..1.0f64) < 0.18 {
                self.ball_zone = Band::OppBox.to_zone(att_side);
                return events;
            }
        }

        self.possession = def_side;
        self.ball_zone = band.mirror().to_zone(def_side);
        events
    }

    /// A ball into the box, contested in the air.
    fn resolve_cross<R: Rng + ?Sized>(
        &mut self,
        minute: u8,
        att_side: Side,
        def_side: Side,
        band: Band,
        crosser: &PlayerSnap,
        rng: &mut R,
    ) -> Vec<MatchEvent> {
        let mut events = Vec::new();
        let zone = self.ball_zone;

        let evt = MatchEvent::new(minute, EventType::Cross, att_side, zone)
            .with_player(crosser.id.clone());
        self.events.push(evt.clone());
        events.push(evt);

        let attacker = self.pick_actor(att_side, Band::OppBox, Need::Shoot, rng);
        let defender = self.pick_actor(def_side, Band::OwnBox, Need::Defend, rng);
        let delivery = self.condition_adjusted_skill(
            crosser,
            (crosser.passing as f64 + crosser.vision as f64) / 2.0,
        );
        let attacking = attacker.aerial as f64 * (0.75 + delivery / 400.0);
        let defending = defender.aerial as f64;

        // Most crosses are cleared or overhit. Only the ones that actually pick
        // out a runner become a chance — otherwise crossing often enough to
        // look like football would flood the match with shots.
        const CROSS_FINDS_A_MAN: f64 = 0.30;
        if rng.random_range(0.0..1.0f64) < attacking / (attacking + defending) * CROSS_FINDS_A_MAN {
            self.ball_zone = Band::OppBox.to_zone(att_side);
            events.extend(self.resolve_shot(minute, att_side, rng));
        } else {
            let clearance = MatchEvent::new(minute, EventType::Clearance, def_side, zone)
                .with_player(defender.id.clone());
            self.events.push(clearance.clone());
            events.push(clearance);
            if rng.random_range(0.0..1.0f64) < 0.22 {
                let corner = MatchEvent::new(minute, EventType::Corner, att_side, zone);
                self.events.push(corner.clone());
                events.push(corner);
                if rng.random_range(0.0..1.0f64) < 0.44 {
                    self.ball_zone = Band::OppBox.to_zone(att_side);
                    return events;
                }
            }
            self.possession = def_side;
            self.ball_zone = band.mirror().to_zone(def_side);
        }
        events
    }
}

impl LiveMatchState {
    /// A pass: the thing football mostly consists of.
    ///
    /// Completion is the passer's quality against the pressure he is under,
    /// nudged by where he is — playing out of your own box is harder than
    /// knocking it about in midfield, and the final third is tighter still.
    #[allow(clippy::too_many_arguments)]
    fn resolve_pass<R: Rng + ?Sized>(
        &mut self,
        minute: u8,
        att_side: Side,
        def_side: Side,
        band: Band,
        passer: &PlayerSnap,
        kind: PassKind,
        rng: &mut R,
    ) -> Vec<MatchEvent> {
        let mut events = Vec::new();
        let zone = self.ball_zone;

        let skill = self.condition_adjusted_skill(
            passer,
            (passer.passing as f64
                + passer.vision as f64
                + passer.composure as f64
                + passer.teamwork as f64)
                / 4.0,
        ) * trait_bonus(passer, TraitContext::Passing)
            * crate::shared::home_mod(att_side, &self.config);

        let press = self.effective_press(def_side);
        // Skill and pressure move completion around the baseline rather than
        // replacing it, so a poor passer is worse but not hopeless.
        let quality = skill / (skill + press * 0.55);
        let space = match band {
            Band::OwnBox => 0.94,
            Band::OwnThird => 1.0,
            Band::Middle => 1.0,
            Band::FinalThird => 0.93,
            Band::OppBox => 0.88,
        };
        let completion =
            (kind.base_completion() * (0.72 + 0.56 * quality) * space).clamp(0.20, 0.985);

        if rng.random_range(0.0..1.0f64) < completion {
            let evt = MatchEvent::new(minute, EventType::PassCompleted, att_side, zone)
                .with_player(passer.id.clone());
            self.events.push(evt.clone());
            events.push(evt);

            let mut landed = band;
            for _ in 0..kind.bands_gained() {
                landed = landed.advanced().unwrap_or(landed);
            }
            // A pass inside the box is a cut-back or a recycle: the ball comes
            // back out. Without this the box is an absorbing state — play
            // arrives, passes to itself, and shoots again and again off a
            // single entry.
            if band == Band::OppBox && kind != PassKind::Long {
                landed = Band::FinalThird;
            }
            self.ball_zone = landed.to_zone(att_side);
        } else {
            let interceptor = self.pick_actor(def_side, band.mirror(), Need::Defend, rng);
            let lost = MatchEvent::new(minute, EventType::PassIntercepted, att_side, zone)
                .with_player(passer.id.clone());
            let won = MatchEvent::new(minute, EventType::Interception, def_side, zone)
                .with_player(interceptor.id.clone());
            self.events.push(lost.clone());
            self.events.push(won.clone());
            events.push(lost);
            events.push(won);
            self.possession = def_side;
            self.ball_zone = band.mirror().to_zone(def_side);
        }
        events
    }

    /// Moving with the ball. Low risk, no progress by itself.
    fn resolve_carry<R: Rng + ?Sized>(
        &mut self,
        minute: u8,
        att_side: Side,
        def_side: Side,
        band: Band,
        carrier: &PlayerSnap,
        rng: &mut R,
    ) -> Vec<MatchEvent> {
        let mut events = Vec::new();
        let zone = self.ball_zone;
        let skill = self.condition_adjusted_skill(
            carrier,
            (carrier.dribbling as f64 + carrier.composure as f64 + carrier.decisions as f64) / 3.0,
        ) * crate::shared::home_mod(att_side, &self.config);
        let press = self.effective_press(def_side);
        let keep = (skill / (skill + press * 0.45)).clamp(0.55, 0.97);

        if rng.random_range(0.0..1.0f64) < keep {
            let evt = MatchEvent::new(minute, EventType::Dribble, att_side, zone)
                .with_player(carrier.id.clone());
            self.events.push(evt.clone());
            events.push(evt);
        } else {
            let winner = self.pick_actor(def_side, band.mirror(), Need::Defend, rng);
            let tackle = MatchEvent::new(minute, EventType::Tackle, def_side, zone)
                .with_player(winner.id.clone());
            self.events.push(tackle.clone());
            events.push(tackle);

            // A challenge that takes the ball off a carrier is the other main
            // source of fouls. Attaching them only to take-ons left the match
            // with barely half the fouls a real one has.
            let foul_mod = tactics_foul_modifier(&self.team_ref(def_side).tactics);
            let foul_events =
                self.maybe_foul(minute, def_side, carrier, &winner, zone, rng, foul_mod);
            let was_fouled = foul_events.iter().any(|e| e.event_type == EventType::Foul);
            events.extend(foul_events);
            if was_fouled {
                self.ball_zone = zone;
                return events;
            }

            self.possession = def_side;
            self.ball_zone = band.mirror().to_zone(def_side);
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
