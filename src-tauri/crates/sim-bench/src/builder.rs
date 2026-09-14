use engine::Slot;
use engine::{PlayerData, PlayerRole, PlayStyle, Position, TacticsConfig, TeamData};
use rand::{Rng, RngExt};

/// Build a synthetic team with per-attribute values centered on `avg_ovr`.
/// Formation is parsed as "4-3-3" → 4 DEF, 3 MID, 3 FWD (plus 1 GK always).
/// Player roles are sampled from position-appropriate distributions.
pub fn build_team(
    id: &str,
    name: &str,
    avg_ovr: u8,
    play_style: PlayStyle,
    formation: &str,
    rng: &mut impl Rng,
) -> TeamData {
    build_team_with_tactics(id, name, avg_ovr, play_style, formation, TacticsConfig::default(), rng)
}

pub fn build_team_with_tactics(
    id: &str,
    name: &str,
    avg_ovr: u8,
    play_style: PlayStyle,
    formation: &str,
    tactics: TacticsConfig,
    rng: &mut impl Rng,
) -> TeamData {
    let (n_def, n_mid, n_fwd, used_fallback) = parse_formation(formation);
    let mut players = Vec::with_capacity(11);

    players.push(make_player(id, "GK", 1, 1, Position::Goalkeeper, avg_ovr, rng));
    for i in 1..=n_def {
        players.push(make_player(id, "DEF", i, n_def, Position::Defender, avg_ovr, rng));
    }
    for i in 1..=n_mid {
        players.push(make_player(id, "MID", i, n_mid, Position::Midfielder, avg_ovr, rng));
    }
    for i in 1..=n_fwd {
        players.push(make_player(id, "FWD", i, n_fwd, Position::Forward, avg_ovr, rng));
    }

    TeamData {
        id: id.to_string(),
        name: name.to_string(),
        formation: if used_fallback { "4-4-2".to_string() } else { formation.to_string() },
        play_style,
        tactics,
        players,
    }
}

fn sample_role(position: Position, slot_idx: u8, total_in_position: u8, rng: &mut impl Rng) -> PlayerRole {
    match position {
        Position::Goalkeeper => {
            const ROLES: [PlayerRole; 3] = [
                PlayerRole::Standard,
                PlayerRole::BallPlayingKeeper,
                PlayerRole::SweeperKeeper,
            ];
            ROLES[rng.random_range(0usize..3)]
        }
        Position::Defender => {
            // FB count: 0 for 3-back, 2 for 4-back and 5-back.
            // CB slots are the first (total - fb_count) slots.
            let fb_count = if total_in_position <= 3 { 0u8 } else { 2u8 };
            let cb_count = total_in_position - fb_count;
            if slot_idx <= cb_count {
                // CB slots
                const ROLES: [PlayerRole; 3] =
                    [PlayerRole::Stopper, PlayerRole::CoverCB, PlayerRole::BallPlayingCB];
                ROLES[rng.random_range(0usize..3)]
            } else {
                // FB/WB slots
                const ROLES: [PlayerRole; 4] = [
                    PlayerRole::AttackingFB,
                    PlayerRole::DefensiveFB,
                    PlayerRole::WingBack,
                    PlayerRole::InvertedFB,
                ];
                ROLES[rng.random_range(0usize..4)]
            }
        }
        Position::Midfielder => {
            if slot_idx == 1 {
                // Holding/DM slot
                const ROLES: [PlayerRole; 3] =
                    [PlayerRole::AnchorMan, PlayerRole::BallWinner, PlayerRole::DeepLyingPlaymaker];
                ROLES[rng.random_range(0usize..3)]
            } else {
                const ROLES: [PlayerRole; 5] = [
                    PlayerRole::BoxToBox,
                    PlayerRole::Mezzala,
                    PlayerRole::Carrilero,
                    PlayerRole::InvertedWinger,
                    PlayerRole::WideForward,
                ];
                ROLES[rng.random_range(0usize..5)]
            }
        }
        Position::Forward => {
            const ROLES: [PlayerRole; 6] = [
                PlayerRole::Poacher,
                PlayerRole::TargetMan,
                PlayerRole::CompleteForward,
                PlayerRole::False9,
                PlayerRole::DeepLyingForward,
                PlayerRole::PressingForward,
            ];
            ROLES[rng.random_range(0usize..6)]
        }
    }
}

fn parse_formation(formation: &str) -> (u8, u8, u8, bool) {
    let parts: Vec<u8> = formation
        .split('-')
        .filter_map(|s| s.parse::<u8>().ok())
        .collect();

    let result = match parts.len() {
        2 => (parts[0], 0, parts[1]),
        3 => (parts[0], parts[1], parts[2]),
        4 => (parts[0], parts[1] + parts[2], parts[3]),
        _ => return (4, 4, 2, true),
    };

    // Ensure exactly 10 outfield players; fall back to 4-4-2 if not
    if result.0 + result.1 + result.2 != 10 {
        return (4, 4, 2, true);
    }
    (result.0, result.1, result.2, false)
}

/// The slot a player of this position and index occupies within the shape.
///
/// Without this the bench builds every squad with `slot: None`, so the deployed
/// slot — the thing that makes a 4-3-3 play differently from a 3-5-2 beyond
/// counting bodies — would never be exercised by a single benchmark.
///
/// `idx` is **one-based**, counting from the left of the line, because that is
/// what `build_team` passes and what the player's id is built from. It was
/// written against a zero-based index it never received, so `idx == 0` was
/// never true: no squad the benchmark built had a left back, a left midfielder
/// or a left winger, and a back four came out CB, CB, RB, CB. Every calibration
/// number taken before this was measured on those squads.
fn slot_for(position: Position, idx: u8, total: u8) -> Slot {
    let wide_left = idx == 1;
    let wide_right = total > 1 && idx == total;
    match position {
        Position::Goalkeeper => Slot::Goalkeeper,
        // Five at the back is wing backs, four is full backs, three is three
        // centre halves. The wing-back arm used to name the *left* berth twice.
        Position::Defender if total >= 5 && wide_left => Slot::LeftWingBack,
        Position::Defender if total >= 5 && wide_right => Slot::RightWingBack,
        Position::Defender if total >= 4 && wide_left => Slot::LeftBack,
        Position::Defender if total >= 4 && wide_right => Slot::RightBack,
        Position::Defender => Slot::CenterBack,
        // Four or more across the middle puts a man wide on each side; a flat
        // three holds, runs and creates through the centre.
        Position::Midfielder if total >= 4 && wide_left => Slot::LeftMidfielder,
        Position::Midfielder if total >= 4 && wide_right => Slot::RightMidfielder,
        Position::Midfielder if idx == 1 => Slot::DefensiveMidfielder,
        Position::Midfielder if total >= 3 && idx == total => Slot::AttackingMidfielder,
        Position::Midfielder => Slot::CentralMidfielder,
        // A front three is winger, striker, winger.
        Position::Forward if total >= 3 && wide_left => Slot::LeftWinger,
        Position::Forward if total >= 3 && wide_right => Slot::RightWinger,
        Position::Forward => Slot::Striker,
    }
}

fn make_player(
    team_id: &str,
    pos_label: &str,
    idx: u8,
    total_in_position: u8,
    position: Position,
    avg_ovr: u8,
    rng: &mut impl Rng,
) -> PlayerData {
    let base = avg_ovr as f64;

    fn noise(base: f64, rng: &mut impl Rng) -> u8 {
        (base + rng.random_range(-10.0f64..10.0f64)).clamp(10.0, 99.0) as u8
    }
    fn biased(base: f64, offset: f64, rng: &mut impl Rng) -> u8 {
        (base + offset + rng.random_range(-8.0f64..8.0f64)).clamp(10.0, 99.0) as u8
    }

    let (shoot_off, tackle_off, pass_off, defend_off, gk_off) = match position {
        Position::Goalkeeper => (-25.0, 0.0, 0.0, 10.0, 20.0),
        Position::Defender => (-18.0, 12.0, -5.0, 18.0, -15.0),
        Position::Midfielder => (-3.0, 5.0, 12.0, 0.0, -15.0),
        Position::Forward => (18.0, -12.0, 3.0, -18.0, -20.0),
    };

    let role = sample_role(position, idx, total_in_position, rng);

    PlayerData {
        id: format!("{team_id}_{pos_label}{idx}"),
        name: format!("{pos_label}{idx}"),
        position,
        ovr: avg_ovr,
        condition: rng.random_range(80u8..=100u8),
        fitness: rng.random_range(65u8..=90u8),
        pace: noise(base, rng),
        stamina: noise(base, rng),
        strength: noise(base, rng),
        agility: noise(base, rng),
        passing: biased(base, pass_off, rng),
        shooting: biased(base, shoot_off, rng),
        tackling: biased(base, tackle_off, rng),
        dribbling: noise(base, rng),
        defending: biased(base, defend_off, rng),
        positioning: noise(base, rng),
        vision: biased(base, pass_off / 2.0, rng),
        decisions: noise(base, rng),
        composure: noise(base, rng),
        aggression: noise(base, rng),
        teamwork: noise(base, rng),
        leadership: noise(base, rng),
        handling: biased(base, gk_off, rng),
        reflexes: biased(base, gk_off, rng),
        aerial: noise(base, rng),
        traits: vec![],
        slot: Some(slot_for(position, idx, total_in_position)),
        role,
    }
}

#[cfg(test)]
mod shape_tests {
    use super::*;
    use rand::rngs::StdRng;
    use rand::SeedableRng;

    fn slots(formation: &str) -> Vec<Slot> {
        let mut rng = StdRng::seed_from_u64(1);
        build_team("t", "T", 70, PlayStyle::Balanced, formation, &mut rng)
            .players
            .iter()
            .filter_map(|p| p.slot)
            .collect()
    }

    /// `make_player` is called with `i` from `1..=n`, and `slot_for` asks
    /// whether `idx == 0` to find the left-sided berth. Nobody was ever index
    /// zero, so no squad the benchmark built had a left back, a left midfielder
    /// or a left winger, and the holding midfielder went missing too: a back
    /// four came out CB, CB, RB, CB and a midfield four CM, CM, RM, CM.
    ///
    /// Every calibration number was measured on those squads, which is why this
    /// is pinned by exact layout rather than by counting bodies.
    #[test]
    fn a_back_four_has_two_full_backs_one_on_each_side() {
        let s = slots("4-4-2");
        assert_eq!(
            &s[1..5],
            &[
                Slot::LeftBack,
                Slot::CenterBack,
                Slot::CenterBack,
                Slot::RightBack
            ],
            "defence was {:?}",
            &s[1..5]
        );
    }

    #[test]
    fn a_midfield_four_is_flanked_on_both_sides() {
        let s = slots("4-4-2");
        assert_eq!(
            &s[5..9],
            &[
                Slot::LeftMidfielder,
                Slot::CentralMidfielder,
                Slot::CentralMidfielder,
                Slot::RightMidfielder
            ],
            "midfield was {:?}",
            &s[5..9]
        );
    }

    #[test]
    fn a_front_three_is_two_wingers_and_a_striker() {
        let s = slots("4-3-3");
        assert_eq!(
            &s[8..11],
            &[Slot::LeftWinger, Slot::Striker, Slot::RightWinger],
            "attack was {:?}",
            &s[8..11]
        );
    }

    #[test]
    fn every_supported_shape_fills_eleven_distinct_berths() {
        for formation in ["4-4-2", "4-3-3", "3-5-2", "5-3-2", "4-5-1", "3-4-3"] {
            let s = slots(formation);
            assert_eq!(s.len(), 11, "{formation} did not deploy eleven");
            assert_eq!(s[0], Slot::Goalkeeper, "{formation} has no keeper");
            // A back five is wing backs, never two on the same flank.
            let left_wing_backs = s.iter().filter(|x| **x == Slot::LeftWingBack).count();
            assert!(
                left_wing_backs <= 1,
                "{formation} deployed {left_wing_backs} left wing backs: {s:?}"
            );
        }
    }
}
