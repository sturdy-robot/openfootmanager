//! What a player actually does with the ball.
//!
//! Until now the ball's position chose the action: in midfield you contested a
//! 50/50, in the final third you took someone on, in the box you shot. Nobody
//! ever simply passed to a team-mate, which is what football mostly consists
//! of. The stat sheet showed it — 89 passes a team, against four to seven
//! hundred in a real match, and a completion rate of 94% because the few
//! "passes" that existed were the easy ones out of defence.
//!
//! An action is now *chosen* from a weighted distribution, which is how the
//! original design worked: a side's instructions bias which event happens
//! rather than nudging whether it comes off.
//!
//! Two things fall out of that, and both matter more than the realism of any
//! single number:
//!
//! - **Volume and chance creation decouple.** Shots happen when a shot is
//!   chosen, not as a side effect of how many touches a match contains. The
//!   engine can play a thousand passes without producing a thousand chances,
//!   which is what made the previous model so awkward to calibrate.
//! - **Progression is a decision, not a correction.** A pass either keeps the
//!   ball where it is or carries it forward, decided when it is played. The old
//!   model let the resolver move the ball and then sometimes put it back.

use rand::{Rng, RngExt};

use crate::sim::state::Band;
use crate::types::{
    DefensiveShape, PlayerRole, PressingIntensity, TacticsBuildUpStyle, TacticsConfig,
    TacticsPitchWidth, Tempo,
};

/// Something a player can do with the ball.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Action {
    /// A simple ball to a team-mate nearby. The bread and butter: most likely
    /// to come off, and it keeps play where it is.
    ShortPass,
    /// A pass that breaks a line. More likely to be cut out, moves play on.
    ProgressivePass,
    /// Hit long. Often given away, but skips a phase of the pitch entirely.
    LongPass,
    /// Move with the ball rather than release it.
    Carry,
    /// Commit to beating an opponent — a duel, roughly even.
    TakeOn,
    /// Deliver into the box from wide.
    Cross,
    /// Have a go at goal.
    Shot,
}

/// Relative weights over the actions available in one situation.
pub type ActionWeights = [(Action, f64); 7];

/// What a side tends to do in each part of the pitch, before instructions.
///
/// Passing dominates everywhere, which is the point: real matches are mostly
/// players giving each other the ball. Shots appear from the final third
/// onwards, and crossing only where there is a box to cross into.
fn base_weights(band: Band) -> ActionWeights {
    use Action::*;
    match band {
        // Playing out from the back: safety first, or hit it long.
        Band::OwnBox => [
            (ShortPass, 52.0),
            (ProgressivePass, 7.0),
            (LongPass, 20.0),
            (Carry, 16.0),
            (TakeOn, 4.0),
            (Cross, 0.0),
            (Shot, 0.0),
        ],
        Band::OwnThird => [
            (ShortPass, 63.0),
            (ProgressivePass, 5.0),
            (LongPass, 10.0),
            (Carry, 14.0),
            (TakeOn, 4.0),
            (Cross, 0.0),
            (Shot, 0.0),
        ],
        Band::Middle => [
            (ShortPass, 62.0),
            (ProgressivePass, 3.4),
            (LongPass, 6.0),
            (Carry, 14.0),
            (TakeOn, 7.0),
            (Cross, 0.0),
            (Shot, 0.5),
        ],
        Band::FinalThird => [
            (ShortPass, 60.0),
            (ProgressivePass, 1.1),
            (LongPass, 2.0),
            (Carry, 13.0),
            (TakeOn, 2.0),
            (Cross, 4.4),
            (Shot, 0.35),
        ],
        // In the box the point is to score.
        Band::OppBox => [
            (ShortPass, 16.0),
            (ProgressivePass, 4.0),
            (LongPass, 0.0),
            (Carry, 4.0),
            (TakeOn, 10.0),
            (Cross, 3.0),
            (Shot, 34.0),
        ],
    }
}

/// How a role changes what its holder does with the ball.
///
/// This is the second half of what makes a role visible. Occupancy decides how
/// often a player is on the ball; this decides what he does when he is. A
/// poacher shoots; a deep-lying playmaker passes and does not dribble.
fn role_bias(role: PlayerRole, action: Action) -> f64 {
    use Action::*;
    use PlayerRole as R;
    match (role, action) {
        // Creators pass, and pass forward.
        (R::DeepLyingPlaymaker | R::AdvancedPlaymaker, ShortPass) => 1.25,
        (R::DeepLyingPlaymaker | R::AdvancedPlaymaker, ProgressivePass) => 1.60,
        (R::DeepLyingPlaymaker | R::AdvancedPlaymaker, TakeOn) => 0.55,
        (R::BallPlayingCB | R::BallPlayingKeeper, ProgressivePass) => 1.40,
        (R::BallPlayingCB | R::BallPlayingKeeper, LongPass) => 0.70,

        // Runners carry and commit.
        (R::Mezzala | R::BoxToBox, Carry) => 1.30,
        (R::InvertedWinger | R::InsideForward | R::WideForward, TakeOn) => 1.45,
        (R::InvertedWinger | R::InsideForward, Shot) => 1.30,
        (R::WideForward | R::WingBack | R::AttackingFB, Cross) => 1.60,
        (R::InvertedWinger | R::InvertedFB, Cross) => 0.60,

        // Finishers shoot and little else.
        (R::Poacher, Shot) => 1.85,
        (R::Poacher, ShortPass | ProgressivePass) => 0.55,
        (R::Poacher, TakeOn | Carry) => 0.60,
        (R::ShadowStriker, Shot) => 1.45,
        (R::CompleteForward, Shot) => 1.20,

        // A target man is hit long and holds it up.
        (R::TargetMan, LongPass) => 1.50,
        (R::TargetMan, ShortPass) => 1.15,
        (R::TargetMan, TakeOn) => 0.60,

        // A false nine drops in and links play rather than finishing.
        (R::False9 | R::DeepLyingForward, ShortPass) => 1.35,
        (R::False9 | R::DeepLyingForward, ProgressivePass) => 1.40,
        (R::False9, Shot) => 0.80,

        // Destroyers and stoppers keep it simple.
        (R::BallWinner | R::AnchorMan | R::Stopper | R::CoverCB, ShortPass) => 1.20,
        (R::BallWinner | R::AnchorMan | R::Stopper | R::CoverCB, TakeOn | Shot) => 0.50,
        (R::DefensiveFB, Cross) => 0.60,

        _ => 1.0,
    }
}

/// How a side's instructions bias what it does with the ball.
///
/// Applied to the choice of action rather than to whether it succeeds. A
/// modifier on a success roll is invisible on a stat sheet; a modifier on what
/// a side *tries* shows up in every column.
fn tactical_bias(tactics: &TacticsConfig, band: Band, action: Action) -> f64 {
    use Action::*;
    let mut weight = 1.0;

    // Patient sides work it; direct sides go forward.
    weight *= match (tactics.tempo, action) {
        (Tempo::Patient, ShortPass) => 1.45,
        (Tempo::Patient, ProgressivePass) => 0.80,
        (Tempo::Patient, LongPass) => 0.45,
        (Tempo::Patient, Shot) => 0.75,
        (Tempo::Direct, _) => 1.0,
        _ => 1.0,
    };

    // Build-up style is about getting out of your own half.
    if matches!(band, Band::OwnBox | Band::OwnThird) {
        weight *= match (tactics.build_up_style, action) {
            (TacticsBuildUpStyle::Short, ShortPass) => 1.55,
            (TacticsBuildUpStyle::Short, LongPass) => 0.25,
            (TacticsBuildUpStyle::Long, LongPass) => 3.20,
            (TacticsBuildUpStyle::Long, ShortPass) => 0.55,
            _ => 1.0,
        };
    }

    // Width decides whether the ball goes round them or through them.
    weight *= match (tactics.width, action) {
        (TacticsPitchWidth::Wide, Cross) => 1.70,
        (TacticsPitchWidth::Wide, ProgressivePass) => 0.85,
        (TacticsPitchWidth::Narrow, Cross) => 0.40,
        (TacticsPitchWidth::Narrow, ProgressivePass) => 1.25,
        (TacticsPitchWidth::Narrow, TakeOn) => 1.15,
        _ => 1.0,
    };

    weight
}

/// How the opposition's set-up changes what is on.
fn opposition_bias(opponent: &TacticsConfig, action: Action) -> f64 {
    use Action::*;
    let mut weight = 1.0;

    // A compact block closes the middle, so play goes sideways and wide.
    weight *= match (opponent.defensive_shape, action) {
        (DefensiveShape::Compact, ProgressivePass) => 0.70,
        (DefensiveShape::Compact, ShortPass) => 1.20,
        (DefensiveShape::Compact, Cross) => 1.25,
        (DefensiveShape::Stretched, ProgressivePass) => 1.30,
        (DefensiveShape::Stretched, TakeOn) => 1.15,
        _ => 1.0,
    };

    // Being pressed means letting go of it quickly.
    weight *= match (opponent.pressing_intensity, action) {
        (PressingIntensity::Aggressive, LongPass) => 1.45,
        (PressingIntensity::Aggressive, Carry) => 0.75,
        (PressingIntensity::Aggressive, ShortPass) => 0.90,
        (PressingIntensity::Passive, ShortPass) => 1.15,
        (PressingIntensity::Passive, Carry) => 1.20,
        _ => 1.0,
    };

    weight
}

/// Pick what this player does with the ball.
pub fn choose_action<R: Rng + ?Sized>(
    band: Band,
    role: PlayerRole,
    own: &TacticsConfig,
    opponent: &TacticsConfig,
    rng: &mut R,
) -> Action {
    let mut weights = base_weights(band);
    let mut total = 0.0;
    for entry in weights.iter_mut() {
        if entry.1 > 0.0 {
            entry.1 *= role_bias(role, entry.0)
                * tactical_bias(own, band, entry.0)
                * opposition_bias(opponent, entry.0);
        }
        total += entry.1;
    }

    if total <= 0.0 {
        return Action::ShortPass;
    }
    let mut roll = rng.random_range(0.0..total);
    for (action, weight) in weights {
        roll -= weight;
        if roll <= 0.0 {
            return action;
        }
    }
    Action::ShortPass
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand::SeedableRng;
    use rand::rngs::StdRng;

    fn distribution(
        band: Band,
        role: PlayerRole,
        own: &TacticsConfig,
        opponent: &TacticsConfig,
    ) -> std::collections::HashMap<Action, u32> {
        let mut rng = StdRng::seed_from_u64(7);
        let mut counts = std::collections::HashMap::new();
        for _ in 0..20_000 {
            *counts
                .entry(choose_action(band, role, own, opponent, &mut rng))
                .or_insert(0) += 1;
        }
        counts
    }

    fn share(band: Band, role: PlayerRole, action: Action) -> f64 {
        let neutral = TacticsConfig::default();
        let counts = distribution(band, role, &neutral, &neutral);
        let total: u32 = counts.values().sum();
        counts.get(&action).copied().unwrap_or(0) as f64 / total as f64
    }

    #[test]
    fn football_is_mostly_passing() {
        for band in [Band::OwnThird, Band::Middle] {
            let passing = share(band, PlayerRole::Standard, Action::ShortPass)
                + share(band, PlayerRole::Standard, Action::ProgressivePass)
                + share(band, PlayerRole::Standard, Action::LongPass);
            assert!(
                passing > 0.6,
                "{band:?} is only {passing:.2} passing — a match should be mostly passes"
            );
        }
    }

    #[test]
    fn nobody_shoots_from_their_own_half() {
        assert_eq!(share(Band::OwnBox, PlayerRole::Standard, Action::Shot), 0.0);
        assert_eq!(
            share(Band::OwnThird, PlayerRole::Standard, Action::Shot),
            0.0
        );
    }

    #[test]
    fn the_box_is_for_shooting() {
        // Shooting should be the likeliest thing to do in the box by a clear
        // margin — but not so dominant that arriving there guarantees a shot,
        // or one entry produces a hatful of them.
        let shooting = share(Band::OppBox, PlayerRole::Standard, Action::Shot);
        let next_most = [
            Action::ShortPass,
            Action::TakeOn,
            Action::Carry,
            Action::Cross,
        ]
        .into_iter()
        .map(|action| share(Band::OppBox, PlayerRole::Standard, action))
        .fold(0.0f64, f64::max);
        assert!(shooting > next_most * 1.5, "{shooting} vs {next_most}");
    }

    #[test]
    fn a_poacher_shoots_more_than_a_false_nine_and_passes_less() {
        let poacher_shots = share(Band::OppBox, PlayerRole::Poacher, Action::Shot);
        let false9_shots = share(Band::OppBox, PlayerRole::False9, Action::Shot);
        assert!(
            poacher_shots > false9_shots,
            "{poacher_shots} vs {false9_shots}"
        );

        let poacher_passes = share(Band::FinalThird, PlayerRole::Poacher, Action::ShortPass);
        let false9_passes = share(Band::FinalThird, PlayerRole::False9, Action::ShortPass);
        assert!(
            false9_passes > poacher_passes,
            "{false9_passes} vs {poacher_passes}"
        );
    }

    #[test]
    fn a_playmaker_plays_forward_more_than_a_ball_winner() {
        let playmaker = share(
            Band::Middle,
            PlayerRole::AdvancedPlaymaker,
            Action::ProgressivePass,
        );
        let winner = share(
            Band::Middle,
            PlayerRole::BallWinner,
            Action::ProgressivePass,
        );
        assert!(playmaker > winner, "{playmaker} vs {winner}");
    }

    #[test]
    fn instructions_change_what_a_side_tries() {
        let neutral = TacticsConfig::default();
        let long = TacticsConfig {
            build_up_style: TacticsBuildUpStyle::Long,
            ..Default::default()
        };
        let counts_neutral = distribution(Band::OwnThird, PlayerRole::Standard, &neutral, &neutral);
        let counts_long = distribution(Band::OwnThird, PlayerRole::Standard, &long, &neutral);
        let long_share = |c: &std::collections::HashMap<Action, u32>| {
            let total: u32 = c.values().sum();
            c.get(&Action::LongPass).copied().unwrap_or(0) as f64 / total as f64
        };
        assert!(
            long_share(&counts_long) > long_share(&counts_neutral) * 2.0,
            "a long-ball side should visibly hit it long"
        );
    }

    #[test]
    fn an_uninstructed_side_is_not_biased() {
        let neutral = TacticsConfig::default();
        for action in [
            Action::ShortPass,
            Action::ProgressivePass,
            Action::LongPass,
            Action::Carry,
            Action::TakeOn,
            Action::Cross,
            Action::Shot,
        ] {
            assert_eq!(tactical_bias(&neutral, Band::Middle, action), 1.0);
            assert_eq!(opposition_bias(&neutral, action), 1.0);
        }
    }
}
