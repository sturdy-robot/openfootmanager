use crate::sim::player_traits::TraitFlags;
use crate::types::{
    BreakSpeed, CounterPressDuration, DefensiveLine, DefensiveShape, MarkingStyle, MatchConfig,
    PlayStyle, PlayerData, PlayerRole, PressingIntensity, Side, TacticsConfig,
};

// ---------------------------------------------------------------------------
// PlayerSnap — lightweight snapshot of a player to avoid borrow conflicts
// ---------------------------------------------------------------------------

#[derive(Clone)]
/// A copy of just the attributes the resolution code reads.
///
/// Taken on every action, twice, so it carries what is used and nothing more —
/// and, as far as possible, nothing that has to be allocated. A match resolves
/// somewhere around seven hundred actions, and this used to clone a `String`
/// and a `Vec<String>` on each of the fourteen hundred selections that implies.
///
/// So the id is a shared handle rather than a copy of the text, the traits are
/// a bitmask, and everything else is a `u8`. Cloning a snapshot is now a
/// refcount bump and a memcpy of about thirty bytes.
pub(crate) struct PlayerSnap {
    /// Shared with the squad rather than copied. `Arc`, not `Rc`: the live
    /// match session is held behind a mutex and shared between the Tauri
    /// command pool and the MCP server's runtime, so this has to stay `Send`.
    pub id: std::sync::Arc<str>,
    /// Which squad this player is in, and where in it — so condition can be a
    /// slice index instead of hashing the id on every action.
    pub side: Side,
    pub index: usize,
    pub pace: u8,
    pub agility: u8,
    pub passing: u8,
    pub shooting: u8,
    pub tackling: u8,
    pub dribbling: u8,
    pub defending: u8,
    pub positioning: u8,
    pub vision: u8,
    pub decisions: u8,
    pub composure: u8,
    pub aggression: u8,
    pub teamwork: u8,
    pub handling: u8,
    pub reflexes: u8,
    pub aerial: u8,
    pub traits: TraitFlags,
    pub role: PlayerRole,
}

impl PlayerSnap {
    /// Snapshot a player whose id handle and trait mask were prepared when the
    /// match was set up. See [`crate::live_match::SquadCache`].
    pub fn from_cached(
        p: &PlayerData,
        id: std::sync::Arc<str>,
        traits: TraitFlags,
        side: Side,
        index: usize,
    ) -> Self {
        Self {
            id,
            side,
            index,
            pace: p.pace,
            agility: p.agility,
            passing: p.passing,
            shooting: p.shooting,
            tackling: p.tackling,
            dribbling: p.dribbling,
            defending: p.defending,
            positioning: p.positioning,
            vision: p.vision,
            decisions: p.decisions,
            composure: p.composure,
            aggression: p.aggression,
            teamwork: p.teamwork,
            handling: p.handling,
            reflexes: p.reflexes,
            aerial: p.aerial,
            traits,
            role: p.role,
        }
    }

    /// A featureless stand-in for a side with nobody available.
    ///
    /// A club with an empty squad should not be possible, but a malformed
    /// world or a package with an empty club can produce one, and indexing
    /// into the squad took the whole turn down with it. The match plays out
    /// with an anonymous player instead.
    pub fn placeholder() -> Self {
        Self {
            id: std::sync::Arc::from(""),
            side: Side::Home,
            index: usize::MAX,
            pace: 50,
            agility: 50,
            passing: 50,
            shooting: 50,
            tackling: 50,
            dribbling: 50,
            defending: 50,
            positioning: 50,
            vision: 50,
            decisions: 50,
            composure: 50,
            aggression: 50,
            teamwork: 50,
            handling: 50,
            reflexes: 50,
            aerial: 50,
            traits: TraitFlags::none(),
            role: PlayerRole::Standard,
        }
    }
}

// ---------------------------------------------------------------------------
// TraitContext — which game action context we're computing a bonus for
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy)]
pub(crate) enum TraitContext {
    Shooting,
    Dribbling,
    Passing,
    Tackling,
    Goalkeeping,
    Foul,
}

/// Compute a multiplicative trait bonus for a specific action context.
/// Returns a modifier >= 1.0 (bonus) based on relevant traits.
pub(crate) fn trait_bonus(snap: &PlayerSnap, context: TraitContext) -> f64 {
    let mut bonus = 1.0;
    match context {
        TraitContext::Shooting => {
            if snap.traits.sharpshooter() {
                bonus *= 1.08;
            }
            if snap.traits.cool_head() {
                bonus *= 1.04;
            }
            if snap.traits.complete_forward() {
                bonus *= 1.05;
            }
        }
        TraitContext::Dribbling => {
            if snap.traits.dribbler() {
                bonus *= 1.08;
            }
            if snap.traits.speedster() {
                bonus *= 1.04;
            }
            if snap.traits.agile() {
                bonus *= 1.04;
            }
        }
        TraitContext::Passing => {
            if snap.traits.playmaker() {
                bonus *= 1.08;
            }
            if snap.traits.visionary() {
                bonus *= 1.05;
            }
            if snap.traits.set_piece_specialist() {
                bonus *= 1.03;
            }
        }
        TraitContext::Tackling => {
            if snap.traits.ball_winner() {
                bonus *= 1.08;
            }
            if snap.traits.rock() {
                bonus *= 1.05;
            }
            if snap.traits.tank() {
                bonus *= 1.04;
            }
        }
        TraitContext::Goalkeeping => {
            if snap.traits.safe_hands() {
                bonus *= 1.08;
            }
            if snap.traits.cat_reflexes() {
                bonus *= 1.06;
            }
            if snap.traits.aerial_dominance() {
                bonus *= 1.04;
            }
        }
        TraitContext::Foul => {
            if snap.traits.hot_head() {
                bonus *= 1.25;
            }
            if snap.traits.cool_head() {
                bonus *= 0.70;
            }
        }
    }
    bonus
}

// ---------------------------------------------------------------------------
// Play-style modifiers
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy)]
pub(crate) enum PlayStylePhase {
    Attack,
    Defense,
    Press,
}

pub(crate) fn play_style_modifier(
    style: PlayStyle,
    phase: PlayStylePhase,
    is_own_phase: bool,
) -> f64 {
    if !is_own_phase {
        return 1.0;
    }
    match (style, phase) {
        (PlayStyle::Attacking, PlayStylePhase::Attack) => 1.12,
        (PlayStyle::Attacking, PlayStylePhase::Defense) => 0.93,
        (PlayStyle::Defensive, PlayStylePhase::Defense) => 1.12,
        (PlayStyle::Defensive, PlayStylePhase::Attack) => 0.93,
        (PlayStyle::Possession, PlayStylePhase::Attack) => 0.97,
        (PlayStyle::Counter, PlayStylePhase::Attack) => 1.18,
        (PlayStyle::HighPress, PlayStylePhase::Press) => 1.20,
        (PlayStyle::HighPress, PlayStylePhase::Defense) => 0.95,
        _ => 1.0,
    }
}

// ---------------------------------------------------------------------------
// Role attribute modifier — applied per-player during zone resolution
// ---------------------------------------------------------------------------

/// Returns a multiplier (0.88–1.20) applied to the player's effective skill
/// calculation based on their assigned tactical role. Values reflect the
/// attribute biases described in domain::team::PlayerRole documentation.
pub(crate) fn role_attribute_modifier(role: PlayerRole, phase: PlayStylePhase) -> f64 {
    match (role, phase) {
        // Goalkeepers
        (PlayerRole::SweeperKeeper, PlayStylePhase::Defense) => 1.06,
        // Center Backs
        (PlayerRole::Stopper, PlayStylePhase::Defense) => 1.08,
        (PlayerRole::CoverCB, PlayStylePhase::Defense) => 1.05,
        // Full Backs
        (PlayerRole::AttackingFB, PlayStylePhase::Attack) => 1.08,
        (PlayerRole::AttackingFB, PlayStylePhase::Defense) => 0.93,
        (PlayerRole::DefensiveFB, PlayStylePhase::Defense) => 1.08,
        (PlayerRole::DefensiveFB, PlayStylePhase::Attack) => 0.93,
        (PlayerRole::WingBack, PlayStylePhase::Attack) => 1.10,
        (PlayerRole::WingBack, PlayStylePhase::Defense) => 0.97,
        // Defensive Midfielders
        (PlayerRole::AnchorMan, PlayStylePhase::Defense) => 1.10,
        (PlayerRole::AnchorMan, PlayStylePhase::Attack) => 0.90,
        (PlayerRole::BallWinner, PlayStylePhase::Defense) => 1.08,
        (PlayerRole::DeepLyingPlaymaker, PlayStylePhase::Attack) => 0.93,
        // Central Midfielders
        (PlayerRole::BoxToBox, PlayStylePhase::Attack) => 1.05,
        (PlayerRole::Mezzala, PlayStylePhase::Attack) => 1.08,
        (PlayerRole::Carrilero, PlayStylePhase::Defense) => 1.06,
        // Attacking Midfielders
        (PlayerRole::AdvancedPlaymaker, PlayStylePhase::Attack) => 1.10,
        (PlayerRole::ShadowStriker, PlayStylePhase::Attack) => 1.08,
        (PlayerRole::ShadowStriker, PlayStylePhase::Defense) => 0.92,
        // Wide
        (PlayerRole::WideForward, PlayStylePhase::Attack) => 1.08,
        (PlayerRole::InsideForward, PlayStylePhase::Attack) => 1.10,
        // Strikers
        (PlayerRole::Poacher, PlayStylePhase::Attack) => 1.12,
        (PlayerRole::Poacher, PlayStylePhase::Defense) => 0.85,
        (PlayerRole::TargetMan, PlayStylePhase::Attack) => 1.08,
        (PlayerRole::False9, PlayStylePhase::Attack) => 1.05,
        (PlayerRole::PressingForward, PlayStylePhase::Press) => 1.15,
        (PlayerRole::CompleteForward, PlayStylePhase::Attack) => 1.10,
        (PlayerRole::CompleteForward, PlayStylePhase::Defense) => 1.03,
        _ => 1.0,
    }
}

// ---------------------------------------------------------------------------
// Tactics modifiers — translate TacticsConfig settings to simulation multipliers
// ---------------------------------------------------------------------------

/// Foul rate multiplier from the defensive team's pressing + marking style.
pub(crate) fn tactics_foul_modifier(tactics: &TacticsConfig) -> f64 {
    let press = match tactics.pressing_intensity {
        PressingIntensity::Aggressive => 1.25,
        PressingIntensity::Passive => 0.80,
        PressingIntensity::Medium => 1.0,
    };
    let marking = match tactics.marking_style {
        MarkingStyle::ManToMan => 1.15,
        MarkingStyle::Mixed => 1.05,
        MarkingStyle::Zonal => 1.0,
    };
    press * marking
}

/// Shot conversion multiplier from the defending team's defensive line depth.
/// High line = more space in behind = easier for attackers to score.
pub(crate) fn tactics_defensive_conversion_mod(tactics: &TacticsConfig) -> f64 {
    match tactics.defensive_line {
        DefensiveLine::High => 1.12,
        DefensiveLine::Low => 0.92,
        DefensiveLine::VeryLow => 0.85,
        DefensiveLine::Medium => 1.0,
    }
}

// --- Extended phase dials (tempo / shape / pressing-possession / transitions) ---
//
// These cover dimensions the original five dials don't touch. Each neutral
// (#[default]) option returns ×1.0 — and the transition rolls return 0.0 — so a
// team on its defaults leaves the simulation (and the RNG stream) unchanged.
// build_up / width / def_line / marking are intentionally NOT re-hooked here:
// they already have live effects above, and re-hooking would double-count.

/// Pressing scales the effectiveness of the press that opposes the opponent's
/// build-up (a higher press forces more build-up turnovers).
pub(crate) fn tactics_pressing_press(tactics: &TacticsConfig) -> f64 {
    match tactics.pressing_intensity {
        PressingIntensity::Passive => 0.96,
        PressingIntensity::Medium => 1.0,
        PressingIntensity::Aggressive => 1.06,
    }
}

/// Pressing's energy cost: aggressive pressing tires a side faster. Applies only
/// to the live engine, which tracks in-match condition.
pub(crate) fn tactics_pressing_fatigue(tactics: &TacticsConfig) -> f64 {
    match tactics.pressing_intensity {
        PressingIntensity::Passive => 0.96,
        PressingIntensity::Medium => 1.0,
        PressingIntensity::Aggressive => 1.08,
    }
}

/// Defensive shape scales how hard it is to create chances against the team.
/// Applied to the defender's rating in the attacking third.
pub(crate) fn tactics_shape_modifier(tactics: &TacticsConfig) -> f64 {
    match tactics.defensive_shape {
        DefensiveShape::Stretched => 0.93,
        DefensiveShape::Normal => 1.0,
        DefensiveShape::Compact => 1.07,
    }
}

/// Counter-press duration: chance for the side that just lost the ball to win it
/// straight back at the possession flip. None ⇒ no roll (neutral, RNG-safe).
pub(crate) fn tactics_counter_press_rewin(tactics: &TacticsConfig) -> f64 {
    match tactics.counter_press_duration {
        CounterPressDuration::None => 0.0,
        CounterPressDuration::Short => 0.06,
        CounterPressDuration::Long => 0.12,
    }
}

/// Break speed: chance for the side that just won the ball to spring a fast
/// counter into its attacking third instead of resetting to midfield. Neutral
/// (Medium/Slow) ⇒ no roll; only Fast enables counters.
pub(crate) fn tactics_break_speed_counter(tactics: &TacticsConfig) -> f64 {
    match tactics.break_speed {
        BreakSpeed::Slow => 0.0,
        BreakSpeed::Medium => 0.0,
        BreakSpeed::Fast => 0.10,
    }
}

// ---------------------------------------------------------------------------
// Home advantage modifier
// ---------------------------------------------------------------------------

pub(crate) fn home_mod(side: Side, config: &MatchConfig) -> f64 {
    match side {
        Side::Home => config.home_advantage,
        Side::Away => 1.0,
    }
}

#[cfg(test)]
mod phase_modifier_tests {
    use super::*;

    fn cfg(f: impl FnOnce(&mut TacticsConfig)) -> TacticsConfig {
        let mut c = TacticsConfig::default();
        f(&mut c);
        c
    }

    /// The load-bearing invariant: a default TacticsConfig must leave every new
    /// dial neutral (×1.0 for ratings, 0.0 for the probabilistic transitions),
    /// so default teams simulate byte-identically to the pre-dial engine.
    #[test]
    fn default_config_is_fully_neutral() {
        let d = TacticsConfig::default();
        assert_eq!(tactics_pressing_press(&d), 1.0);
        assert_eq!(tactics_pressing_fatigue(&d), 1.0);
        assert_eq!(tactics_shape_modifier(&d), 1.0);
        assert_eq!(tactics_counter_press_rewin(&d), 0.0);
        assert_eq!(tactics_break_speed_counter(&d), 0.0);
    }

    #[test]
    fn tempo_directions() {
        // Direct is neutral; Patient progresses slower but retains more.
    }

    #[test]
    fn pressing_directions_monotonic() {
        let passive = cfg(|c| c.pressing_intensity = PressingIntensity::Passive);
        let medium = cfg(|c| c.pressing_intensity = PressingIntensity::Medium);
        let aggressive = cfg(|c| c.pressing_intensity = PressingIntensity::Aggressive);
        for f in [tactics_pressing_press, tactics_pressing_fatigue] {
            assert!(f(&passive) < f(&medium), "passive should be < medium");
            assert!(f(&medium) < f(&aggressive), "medium should be < aggressive");
            assert_eq!(f(&medium), 1.0, "medium must be neutral");
        }
    }

    #[test]
    fn shape_directions_monotonic() {
        let stretched = cfg(|c| c.defensive_shape = DefensiveShape::Stretched);
        let normal = cfg(|c| c.defensive_shape = DefensiveShape::Normal);
        let compact = cfg(|c| c.defensive_shape = DefensiveShape::Compact);
        assert!(tactics_shape_modifier(&stretched) < 1.0);
        assert_eq!(tactics_shape_modifier(&normal), 1.0);
        assert!(tactics_shape_modifier(&compact) > 1.0);
    }

    #[test]
    fn transition_dials_are_probabilities_with_neutral_zero() {
        // Counter-press: None rolls nothing; Long > Short > 0.
        assert_eq!(
            tactics_counter_press_rewin(&cfg(
                |c| c.counter_press_duration = CounterPressDuration::None
            )),
            0.0
        );
        let short = tactics_counter_press_rewin(&cfg(|c| {
            c.counter_press_duration = CounterPressDuration::Short
        }));
        let long = tactics_counter_press_rewin(&cfg(|c| {
            c.counter_press_duration = CounterPressDuration::Long
        }));
        assert!(0.0 < short && short < long && long < 1.0);
        // Break speed: only Fast rolls; Slow and Medium are no-ops.
        assert_eq!(
            tactics_break_speed_counter(&cfg(|c| c.break_speed = BreakSpeed::Slow)),
            0.0
        );
        assert_eq!(
            tactics_break_speed_counter(&cfg(|c| c.break_speed = BreakSpeed::Medium)),
            0.0
        );
        let fast = tactics_break_speed_counter(&cfg(|c| c.break_speed = BreakSpeed::Fast));
        assert!(0.0 < fast && fast < 1.0);
    }
}
