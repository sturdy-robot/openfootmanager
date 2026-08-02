//! What a role actually does on the pitch.
//!
//! Roles used to be a flat multiplier: a lookup returning something between
//! 0.85 and 1.15, applied to a player's skill once the engine had already
//! decided he was involved. That is invisible in a stat sheet — measured over
//! two thousand matches, swapping a striker between Poacher, Target Man, False 9
//! and Complete Forward changed his shots per ninety by one percent.
//!
//! It could not have worked, because it was applied to the wrong thing. Whether
//! a player is a Poacher or a False 9 does not change how well he passes; it
//! changes **where he is** and **how much of the ball he gets**. So a role is
//! described here as occupancy across the pitch plus how involved the player is,
//! and it is read when the engine chooses *who acts* rather than after.
//!
//! That is also what fixes forwards finishing matches with no passes. Build-up
//! only ever sampled defenders and midfield only ever sampled midfielders, so a
//! forward could not touch the ball outside the final third no matter what his
//! role said.

use crate::sim::state::Band;
use crate::types::{PlayerRole, Position, Slot};

/// How a player tends to be used, independent of how good he is.
#[derive(Debug, Clone, Copy)]
pub struct RoleProfile {
    /// Relative likelihood of being in each band when his side has the ball,
    /// indexed by [`Band::index`].
    pub occupancy: [f32; 5],
    /// How much this player wants the ball when he is in the right area.
    /// A playmaker takes more touches than a runner standing in the same place.
    pub involvement: f32,
    /// How readily he contests possession when his side does not have it.
    pub defensive_engagement: f32,
}

/// Where each position naturally plays, before any role adjustment.
///
/// Deliberately non-zero almost everywhere: a defender does get forward, a
/// striker does drop in. Hard zeroes are what produced the old behaviour where
/// whole positions were absent from whole phases of play.
///
/// Used for bench players and for saves written before deployed slots crossed
/// the boundary; a starter is placed by [`slot_occupancy`] instead.
#[inline]
fn position_occupancy(position: Position) -> [f32; 5] {
    match position {
        //                   OwnBox OwnThird Middle Final OppBox
        Position::Goalkeeper => [1.00, 0.18, 0.01, 0.00, 0.00],
        Position::Defender => [0.90, 1.00, 0.45, 0.12, 0.05],
        Position::Midfielder => [0.30, 0.75, 1.00, 0.70, 0.25],
        Position::Forward => [0.04, 0.15, 0.45, 1.00, 1.00],
    }
}

/// Where a deployed slot plays.
///
/// This is what makes one formation play differently from another beyond simply
/// counting bodies per third. A holding midfielder and an attacking midfielder
/// are both `Midfielder`, and a wing-back and a centre-half are both
/// `Defender`; they do not play the same game, and until the deployed slot
/// crossed the boundary the engine could not tell them apart.
#[inline]
fn slot_occupancy(slot: Slot) -> [f32; 5] {
    match slot {
        //                          OwnBox OwnThird Middle Final OppBox
        Slot::Goalkeeper           => [1.00, 0.18, 0.01, 0.00, 0.00],
        Slot::CenterBack           => [1.00, 1.00, 0.35, 0.06, 0.04],
        Slot::RightBack            => [0.85, 1.00, 0.60, 0.22, 0.06],
        Slot::LeftBack             => [0.85, 1.00, 0.60, 0.22, 0.06],
        Slot::RightWingBack        => [0.60, 0.90, 0.85, 0.55, 0.15],
        Slot::LeftWingBack         => [0.60, 0.90, 0.85, 0.55, 0.15],
        Slot::DefensiveMidfielder  => [0.55, 1.00, 1.00, 0.30, 0.08],
        Slot::CentralMidfielder    => [0.30, 0.75, 1.00, 0.65, 0.20],
        Slot::AttackingMidfielder  => [0.10, 0.35, 0.85, 1.00, 0.55],
        Slot::RightMidfielder      => [0.25, 0.65, 1.00, 0.75, 0.20],
        Slot::LeftMidfielder       => [0.25, 0.65, 1.00, 0.75, 0.20],
        Slot::RightWinger          => [0.06, 0.20, 0.60, 1.00, 0.70],
        Slot::LeftWinger           => [0.06, 0.20, 0.60, 1.00, 0.70],
        Slot::Striker              => [0.03, 0.10, 0.35, 0.95, 1.00],
    }
}

/// Where this player plays, preferring the deployed slot when it is known.
#[inline]
fn placement(position: Position, slot: Option<Slot>) -> [f32; 5] {
    match slot {
        Some(slot) => slot_occupancy(slot),
        None => position_occupancy(position),
    }
}

/// Per-band multipliers on top of the position, and the two involvement dials.
///
/// A value above 1 in a band pulls the player into it; below 1 pushes him out.
/// Only the bands a role actually changes are listed; everything else is 1.0.
#[inline]
fn role_shape(role: PlayerRole) -> ([f32; 5], f32, f32) {
    use PlayerRole as R;
    // (occupancy multipliers, involvement, defensive engagement)
    match role {
        // — Goalkeepers ————————————————————————————————————————————————
        R::SweeperKeeper => ([1.0, 1.8, 1.0, 1.0, 1.0], 1.05, 1.15),
        R::BallPlayingKeeper => ([1.0, 1.4, 1.0, 1.0, 1.0], 1.30, 1.0),

        // — Centre backs ———————————————————————————————————————————————
        R::Stopper => ([1.0, 1.0, 1.2, 1.0, 1.0], 0.95, 1.20),
        R::CoverCB => ([1.2, 1.1, 0.8, 1.0, 1.0], 0.95, 1.10),
        R::BallPlayingCB => ([1.0, 1.0, 1.4, 1.0, 1.0], 1.35, 0.95),

        // — Full backs —————————————————————————————————————————————————
        R::AttackingFB => ([0.8, 0.9, 1.4, 2.2, 1.2], 1.15, 0.90),
        R::DefensiveFB => ([1.2, 1.1, 0.8, 0.5, 0.5], 0.90, 1.15),
        R::InvertedFB => ([0.9, 1.0, 1.8, 0.8, 0.5], 1.25, 1.0),
        R::WingBack => ([0.7, 0.9, 1.5, 2.8, 1.5], 1.20, 0.90),

        // — Defensive midfield —————————————————————————————————————————
        R::AnchorMan => ([1.4, 1.4, 1.1, 0.4, 0.2], 1.05, 1.25),
        R::BallWinner => ([1.2, 1.3, 1.2, 0.6, 0.3], 1.0, 1.40),
        R::DeepLyingPlaymaker => ([1.3, 1.5, 1.2, 0.6, 0.3], 1.45, 1.0),

        // — Central midfield ———————————————————————————————————————————
        R::BoxToBox => ([1.1, 1.1, 1.1, 1.3, 0.9], 1.15, 1.15),
        R::Carrilero => ([1.0, 1.2, 1.2, 0.8, 0.4], 1.15, 1.10),
        R::Mezzala => ([0.7, 0.9, 1.1, 1.5, 0.8], 1.25, 0.95),

        // — Attacking midfield —————————————————————————————————————————
        R::AdvancedPlaymaker => ([0.4, 0.6, 1.2, 1.8, 0.9], 1.50, 0.85),
        R::ShadowStriker => ([0.3, 0.4, 0.8, 1.5, 1.8], 1.10, 0.80),

        // — Wide ———————————————————————————————————————————————————————
        R::WideForward => ([1.0, 1.0, 1.0, 1.3, 1.1], 1.10, 0.85),
        R::InsideForward => ([1.0, 1.0, 1.1, 1.3, 1.3], 1.15, 0.80),
        R::InvertedWinger => ([1.0, 1.0, 1.2, 1.4, 1.0], 1.20, 0.85),

        // — Strikers ———————————————————————————————————————————————————
        // A Poacher lives in the box and is quiet everywhere else; a False 9
        // does the opposite. These two are the clearest test of whether roles
        // reach the simulation at all.
        R::Poacher => ([0.5, 0.4, 0.4, 0.8, 2.0], 0.80, 0.70),
        R::TargetMan => ([1.0, 1.2, 1.1, 1.2, 1.4], 1.10, 0.90),
        R::DeepLyingForward => ([1.0, 1.6, 2.0, 1.2, 0.7], 1.35, 0.95),
        R::False9 => ([1.0, 1.8, 2.6, 1.3, 0.6], 1.45, 1.0),
        R::PressingForward => ([1.0, 1.1, 1.2, 1.2, 1.0], 1.0, 1.60),
        R::CompleteForward => ([0.9, 1.1, 1.3, 1.3, 1.3], 1.25, 1.0),

        R::Standard => ([1.0; 5], 1.0, 1.0),
    }
}

/// How a player of this position and role is used.
pub fn profile(position: Position, slot: Option<Slot>, role: PlayerRole) -> RoleProfile {
    let base = placement(position, slot);
    let (shape, involvement, defensive_engagement) = role_shape(role);
    let mut occupancy = [0.0f32; 5];
    for index in 0..5 {
        occupancy[index] = base[index] * shape[index];
    }
    RoleProfile {
        occupancy,
        involvement,
        defensive_engagement,
    }
}

/// Relative likelihood of this player being the one on the ball in `band`.
///
/// Reads a single band rather than building the whole profile: this runs for
/// every player on both sides, twice per action, hundreds of times a match.
#[inline]
pub fn on_ball_weight(
    position: Position,
    slot: Option<Slot>,
    role: PlayerRole,
    band: Band,
) -> f64 {
    let index = band.index();
    let (shape, involvement, _) = role_shape(role);
    (placement(position, slot)[index] * shape[index] * involvement) as f64
}

/// Relative likelihood of this player being the one contesting in `band`.
///
/// The band is given from the *defending* player's point of view.
#[inline]
pub fn off_ball_weight(
    position: Position,
    slot: Option<Slot>,
    role: PlayerRole,
    band: Band,
) -> f64 {
    let index = band.index();
    let (shape, _, engagement) = role_shape(role);
    (placement(position, slot)[index] * shape[index] * engagement) as f64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_role_has_some_presence_somewhere() {
        for role in ALL_ROLES {
            for position in [
                Position::Goalkeeper,
                Position::Defender,
                Position::Midfielder,
                Position::Forward,
            ] {
                let total: f32 = profile(position, None, role).occupancy.iter().sum();
                assert!(
                    total > 0.0,
                    "{role:?} as {position:?} is nowhere on the pitch"
                );
            }
        }
    }

    #[test]
    fn a_forward_can_receive_the_ball_outside_the_final_third() {
        // The complaint this stage exists to fix: forwards finishing a match
        // having attempted no pass, because they were never selectable in
        // build-up or midfield.
        let weight = on_ball_weight(Position::Forward, None, PlayerRole::Standard, Band::Middle);
        assert!(weight > 0.0, "a forward must be able to touch the ball in midfield");
    }

    #[test]
    fn a_false_nine_drops_deeper_than_a_poacher() {
        let false9 = on_ball_weight(Position::Forward, None, PlayerRole::False9, Band::Middle);
        let poacher = on_ball_weight(Position::Forward, None, PlayerRole::Poacher, Band::Middle);
        assert!(
            false9 > poacher * 3.0,
            "a False 9 should be far more involved in midfield than a Poacher \
             ({false9} vs {poacher})"
        );
    }

    #[test]
    fn a_poacher_lives_in_the_box() {
        let poacher = on_ball_weight(Position::Forward, None, PlayerRole::Poacher, Band::OppBox);
        let false9 = on_ball_weight(Position::Forward, None, PlayerRole::False9, Band::OppBox);
        assert!(
            poacher > false9,
            "a Poacher should be in the box more than a False 9 ({poacher} vs {false9})"
        );
    }

    #[test]
    fn a_ball_winner_contests_more_than_a_playmaker() {
        let winner = off_ball_weight(Position::Midfielder, None, PlayerRole::BallWinner, Band::Middle);
        let playmaker = off_ball_weight(Position::Midfielder, None, PlayerRole::AdvancedPlaymaker,
            Band::Middle,
        );
        assert!(winner > playmaker, "{winner} vs {playmaker}");
    }

    #[test]
    fn a_keeper_stays_at_home() {
        let profile = profile(Position::Goalkeeper, None, PlayerRole::Standard);
        assert!(profile.occupancy[Band::OwnBox.index()] > 0.0);
        assert_eq!(profile.occupancy[Band::OppBox.index()], 0.0);
    }

    #[test]
    fn a_deployed_slot_separates_players_the_coarse_position_cannot() {
        // Both are `Midfielder`, and until the deployed slot crossed the
        // domain boundary the engine could not tell them apart at all.
        let holding = on_ball_weight(
            Position::Midfielder,
            Some(Slot::DefensiveMidfielder),
            PlayerRole::Standard,
            Band::FinalThird,
        );
        let attacking = on_ball_weight(
            Position::Midfielder,
            Some(Slot::AttackingMidfielder),
            PlayerRole::Standard,
            Band::FinalThird,
        );
        assert!(
            attacking > holding * 2.0,
            "an attacking midfielder should be far more present in the final \
             third than a holding one ({attacking} vs {holding})"
        );
    }

    #[test]
    fn a_wing_back_gets_further_forward_than_a_centre_half() {
        let wing_back = on_ball_weight(
            Position::Defender,
            Some(Slot::RightWingBack),
            PlayerRole::Standard,
            Band::FinalThird,
        );
        let centre_half = on_ball_weight(
            Position::Defender,
            Some(Slot::CenterBack),
            PlayerRole::Standard,
            Band::FinalThird,
        );
        assert!(wing_back > centre_half, "{wing_back} vs {centre_half}");
    }

    #[test]
    fn every_slot_reports_the_bucket_it_belongs_to() {
        assert_eq!(Slot::RightWingBack.position(), Position::Defender);
        assert_eq!(Slot::AttackingMidfielder.position(), Position::Midfielder);
        assert_eq!(Slot::LeftWinger.position(), Position::Forward);
        assert_eq!(Slot::Goalkeeper.position(), Position::Goalkeeper);
    }

    const ALL_ROLES: [PlayerRole; 27] = [
        PlayerRole::Standard,
        PlayerRole::BallPlayingKeeper,
        PlayerRole::SweeperKeeper,
        PlayerRole::Stopper,
        PlayerRole::CoverCB,
        PlayerRole::BallPlayingCB,
        PlayerRole::AttackingFB,
        PlayerRole::DefensiveFB,
        PlayerRole::InvertedFB,
        PlayerRole::WingBack,
        PlayerRole::AnchorMan,
        PlayerRole::BallWinner,
        PlayerRole::DeepLyingPlaymaker,
        PlayerRole::BoxToBox,
        PlayerRole::Carrilero,
        PlayerRole::Mezzala,
        PlayerRole::AdvancedPlaymaker,
        PlayerRole::ShadowStriker,
        PlayerRole::WideForward,
        PlayerRole::InsideForward,
        PlayerRole::InvertedWinger,
        PlayerRole::Poacher,
        PlayerRole::TargetMan,
        PlayerRole::DeepLyingForward,
        PlayerRole::False9,
        PlayerRole::PressingForward,
        PlayerRole::CompleteForward,
    ];
}
