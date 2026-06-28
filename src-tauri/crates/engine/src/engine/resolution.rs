use rand::{Rng, RngExt};

use crate::event::{EventType, MatchEvent};
use crate::shared::{
    PlayStylePhase, TraitContext, defensive_shape_modifier, home_mod, marking_modifier,
    play_style_modifier, tempo_progression_modifier, trait_bonus, width_attack_modifier,
};
use crate::types::{Position, Side, Zone};

use super::MatchContext;
use super::fouls::maybe_foul;
use super::snap_player;

// ---------------------------------------------------------------------------
// Action resolution per zone
// ---------------------------------------------------------------------------

pub(super) fn resolve_action<R: Rng>(ctx: &mut MatchContext, minute: u8, rng: &mut R) {
    let att_side = ctx.possession;
    let def_side = att_side.opposite();
    let zone = ctx.ball_zone;

    if zone.is_box_for(att_side) {
        resolve_shot(ctx, minute, att_side, rng);
        ctx.ball_zone = Zone::Midfield;
        ctx.possession = def_side;
    } else if zone == Zone::attacking_third(att_side) {
        resolve_attacking_third(ctx, minute, att_side, def_side, rng);
    } else if zone == Zone::Midfield {
        resolve_midfield(ctx, minute, att_side, def_side, rng);
    } else {
        resolve_buildup(ctx, minute, att_side, def_side, rng);
    }
}

// ---------------------------------------------------------------------------
// Zone-specific resolution
// ---------------------------------------------------------------------------

fn resolve_buildup<R: Rng>(
    ctx: &mut MatchContext,
    minute: u8,
    att_side: Side,
    def_side: Side,
    rng: &mut R,
) {
    let passer = snap_player(ctx, att_side, Position::Defender, rng);
    let pass_skill = (passer.passing as f64
        + passer.vision as f64
        + passer.composure as f64
        + passer.teamwork as f64)
        / 4.0
        * trait_bonus(&passer, TraitContext::Passing);
    let press = effective_press(ctx, def_side);
    let ball_zone = ctx.ball_zone;

    let success_chance = (pass_skill * 1.3) / (pass_skill * 1.3 + press);
    if rng.random_range(0.0..1.0f64) < success_chance {
        ctx.emit(
            MatchEvent::new(minute, EventType::PassCompleted, att_side, ball_zone)
                .with_player(&passer.id),
        );
        ctx.ball_zone = Zone::Midfield;
    } else {
        let interceptor = snap_player(ctx, def_side, Position::Midfielder, rng);
        ctx.emit(
            MatchEvent::new(minute, EventType::PassIntercepted, att_side, ball_zone)
                .with_player(&passer.id),
        );
        ctx.emit(
            MatchEvent::new(minute, EventType::Interception, def_side, ball_zone)
                .with_player(&interceptor.id),
        );
        ctx.possession = def_side;
    }
}

fn resolve_midfield<R: Rng>(
    ctx: &mut MatchContext,
    minute: u8,
    att_side: Side,
    def_side: Side,
    rng: &mut R,
) {
    let attacker = snap_player(ctx, att_side, Position::Midfielder, rng);
    let defender = snap_player(ctx, def_side, Position::Midfielder, rng);

    let att_rating = (attacker.dribbling as f64
        + attacker.passing as f64
        + attacker.vision as f64
        + attacker.teamwork as f64)
        / 4.0
        * trait_bonus(&attacker, TraitContext::Midfield);
    let def_rating = (defender.tackling as f64
        + defender.positioning as f64
        + defender.decisions as f64
        + defender.teamwork as f64)
        / 4.0
        * trait_bonus(&defender, TraitContext::Tackling);

    let att_mod = play_style_modifier(
        ctx.team(att_side).play_style,
        PlayStylePhase::Midfield,
        true,
    );
    let def_mod = play_style_modifier(
        ctx.team(def_side).play_style,
        PlayStylePhase::Midfield,
        false,
    );
    let att_eff = att_rating
        * att_mod
        * home_mod(att_side, ctx.config)
        * tempo_progression_modifier(ctx.team(att_side).tactics_phase);
    let def_eff = def_rating
        * def_mod
        * home_mod(def_side, ctx.config)
        * marking_modifier(ctx.team(def_side).tactics_phase);
    let success = att_eff / (att_eff + def_eff);

    if rng.random_range(0.0..1.0f64) < success {
        ctx.emit(
            MatchEvent::new(minute, EventType::PassCompleted, att_side, Zone::Midfield)
                .with_player(&attacker.id),
        );
        ctx.ball_zone = Zone::attacking_third(att_side);
    } else {
        if rng.random_range(0.0..1.0f64) < 0.6 {
            ctx.emit(
                MatchEvent::new(minute, EventType::Tackle, def_side, Zone::Midfield)
                    .with_player(&defender.id),
            );
            maybe_foul(
                ctx,
                minute,
                def_side,
                &attacker,
                &defender,
                Zone::Midfield,
                rng,
            );
        } else {
            ctx.emit(
                MatchEvent::new(minute, EventType::Interception, def_side, Zone::Midfield)
                    .with_player(&defender.id),
            );
        }
        ctx.possession = def_side;
        ctx.ball_zone = Zone::Midfield;
    }
}

fn resolve_attacking_third<R: Rng>(
    ctx: &mut MatchContext,
    minute: u8,
    att_side: Side,
    def_side: Side,
    rng: &mut R,
) {
    let attacker = snap_player(ctx, att_side, Position::Forward, rng);
    let defender = snap_player(ctx, def_side, Position::Defender, rng);

    let att_rating = (attacker.dribbling as f64
        + attacker.pace as f64
        + attacker.agility as f64
        + attacker.composure as f64)
        / 4.0
        * trait_bonus(&attacker, TraitContext::Dribbling);
    let def_rating = (defender.defending as f64
        + defender.tackling as f64
        + defender.positioning as f64
        + defender.aerial as f64)
        / 4.0
        * trait_bonus(&defender, TraitContext::Tackling);

    let att_mod = play_style_modifier(ctx.team(att_side).play_style, PlayStylePhase::Attack, true);
    let def_mod = play_style_modifier(
        ctx.team(def_side).play_style,
        PlayStylePhase::Defense,
        false,
    );
    let att_eff = att_rating
        * att_mod
        * home_mod(att_side, ctx.config)
        * width_attack_modifier(ctx.team(att_side).tactics_phase);
    let def_eff = def_rating
        * def_mod
        * home_mod(def_side, ctx.config)
        * defensive_shape_modifier(ctx.team(def_side).tactics_phase);
    let success = att_eff / (att_eff + def_eff);
    let zone = Zone::attacking_third(att_side);

    if rng.random_range(0.0..1.0f64) < success {
        ctx.emit(
            MatchEvent::new(minute, EventType::Dribble, att_side, zone).with_player(&attacker.id),
        );
        ctx.ball_zone = Zone::attacking_box(att_side);
    } else {
        let is_tackle = rng.random_range(0.0..1.0f64) < 0.5;
        if is_tackle {
            ctx.emit(
                MatchEvent::new(minute, EventType::DribbleTackled, att_side, zone)
                    .with_player(&attacker.id)
                    .with_secondary(&defender.id),
            );
            ctx.emit(
                MatchEvent::new(minute, EventType::Tackle, def_side, zone)
                    .with_player(&defender.id),
            );
            maybe_foul(ctx, minute, def_side, &attacker, &defender, zone, rng);
        } else {
            ctx.emit(
                MatchEvent::new(minute, EventType::Clearance, def_side, zone)
                    .with_player(&defender.id),
            );
        }
        if rng.random_range(0.0..1.0f64) < 0.25 {
            ctx.emit(MatchEvent::new(minute, EventType::Corner, att_side, zone));
            if rng.random_range(0.0..1.0f64) < 0.30 {
                ctx.ball_zone = Zone::attacking_box(att_side);
                return;
            }
        }
        ctx.possession = def_side;
        ctx.ball_zone = Zone::defensive_third(att_side);
    }
}

fn resolve_shot<R: Rng>(ctx: &mut MatchContext, minute: u8, att_side: Side, rng: &mut R) {
    let def_side = att_side.opposite();
    let shooter = snap_player(ctx, att_side, Position::Forward, rng);
    let assister = snap_player(ctx, att_side, Position::Midfielder, rng);
    let goalkeeper = snap_player(ctx, def_side, Position::Goalkeeper, rng);

    let shoot_rating =
        (shooter.shooting as f64 + shooter.composure as f64 + shooter.decisions as f64) / 3.0
            * trait_bonus(&shooter, TraitContext::Shooting);
    let gk_rating =
        (goalkeeper.handling as f64 + goalkeeper.reflexes as f64 + goalkeeper.positioning as f64)
            / 3.0
            * trait_bonus(&goalkeeper, TraitContext::Goalkeeping);

    let accuracy =
        (ctx.config.shot_accuracy_base + (shoot_rating - 50.0) / 200.0).clamp(0.15, 0.85);
    let zone = Zone::attacking_box(att_side);

    if rng.random_range(0.0..1.0f64) > accuracy {
        if rng.random_range(0.0..1.0f64) < 0.4 {
            ctx.emit(
                MatchEvent::new(minute, EventType::ShotBlocked, att_side, zone)
                    .with_player(&shooter.id),
            );
        } else {
            ctx.emit(
                MatchEvent::new(minute, EventType::ShotOffTarget, att_side, zone)
                    .with_player(&shooter.id),
            );
        }
        return;
    }

    let conversion =
        (ctx.config.goal_conversion_base + (shoot_rating - gk_rating) / 150.0).clamp(0.10, 0.70);

    if rng.random_range(0.0..1.0f64) < conversion {
        ctx.emit(
            MatchEvent::new(minute, EventType::Goal, att_side, zone)
                .with_player(&shooter.id)
                .with_secondary(&assister.id),
        );
        ctx.add_goal(att_side);
    } else {
        ctx.emit(
            MatchEvent::new(minute, EventType::ShotSaved, att_side, zone).with_player(&shooter.id),
        );
    }
}

// ---------------------------------------------------------------------------
// Rating helpers
// ---------------------------------------------------------------------------

pub(super) fn effective_midfield(ctx: &MatchContext, side: Side) -> f64 {
    let base = ctx.team(side).midfield_rating();
    let modifier = play_style_modifier(ctx.team(side).play_style, PlayStylePhase::Midfield, true);
    base * modifier * home_mod(side, ctx.config)
}

fn effective_press(ctx: &MatchContext, pressing_side: Side) -> f64 {
    let team = ctx.team(pressing_side);
    let base = team.position_attr_avg(Position::Midfielder, |p| {
        ((p.stamina as u16 + p.tackling as u16 + p.pace as u16) / 3) as u8
    });
    let modifier = play_style_modifier(team.play_style, PlayStylePhase::Press, true);
    base * modifier * home_mod(pressing_side, ctx.config)
}
