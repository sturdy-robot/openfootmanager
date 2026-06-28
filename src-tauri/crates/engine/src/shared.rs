use crate::types::{
    BreakSpeed, BuildUpStyle, CounterPressDuration, DefensiveLine, DefensiveShape, MarkingStyle,
    MatchConfig, PlayStyle, PlayerData, PlayerRole, PressingIntensity, Side, TacticsPhase, Tempo,
    Width,
};

// ---------------------------------------------------------------------------
// PlayerSnap — lightweight snapshot of a player to avoid borrow conflicts
// ---------------------------------------------------------------------------

#[derive(Clone)]
#[allow(dead_code)]
pub(crate) struct PlayerSnap {
    pub id: String,
    pub pace: u8,
    pub stamina: u8,
    pub strength: u8,
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
    pub leadership: u8,
    pub handling: u8,
    pub reflexes: u8,
    pub aerial: u8,
    pub traits: Vec<String>,
    pub role: PlayerRole,
}

impl PlayerSnap {
    pub fn from(p: &PlayerData) -> Self {
        Self {
            id: p.id.clone(),
            pace: p.pace,
            stamina: p.stamina,
            strength: p.strength,
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
            leadership: p.leadership,
            handling: p.handling,
            reflexes: p.reflexes,
            aerial: p.aerial,
            traits: p.traits.clone(),
            role: p.role,
        }
    }

    pub fn has_trait(&self, name: &str) -> bool {
        self.traits.iter().any(|t| t == name)
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
    Midfield,
}

/// Compute a multiplicative trait bonus for a specific action context.
/// Returns a modifier >= 1.0 (bonus) based on relevant traits.
pub(crate) fn trait_bonus(snap: &PlayerSnap, context: TraitContext) -> f64 {
    let mut bonus = 1.0;
    match context {
        TraitContext::Shooting => {
            if snap.has_trait("Sharpshooter") {
                bonus *= 1.08;
            }
            if snap.has_trait("CoolHead") {
                bonus *= 1.04;
            }
            if snap.has_trait("CompleteForward") {
                bonus *= 1.05;
            }
        }
        TraitContext::Dribbling => {
            if snap.has_trait("Dribbler") {
                bonus *= 1.08;
            }
            if snap.has_trait("Speedster") {
                bonus *= 1.04;
            }
            if snap.has_trait("Agile") {
                bonus *= 1.04;
            }
        }
        TraitContext::Passing => {
            if snap.has_trait("Playmaker") {
                bonus *= 1.08;
            }
            if snap.has_trait("Visionary") {
                bonus *= 1.05;
            }
            if snap.has_trait("SetPieceSpecialist") {
                bonus *= 1.03;
            }
        }
        TraitContext::Tackling => {
            if snap.has_trait("BallWinner") {
                bonus *= 1.08;
            }
            if snap.has_trait("Rock") {
                bonus *= 1.05;
            }
            if snap.has_trait("Tank") {
                bonus *= 1.04;
            }
        }
        TraitContext::Goalkeeping => {
            if snap.has_trait("SafeHands") {
                bonus *= 1.08;
            }
            if snap.has_trait("CatReflexes") {
                bonus *= 1.06;
            }
            if snap.has_trait("AerialDominance") {
                bonus *= 1.04;
            }
        }
        TraitContext::Foul => {
            if snap.has_trait("HotHead") {
                bonus *= 1.25;
            }
            if snap.has_trait("CoolHead") {
                bonus *= 0.70;
            }
        }
        TraitContext::Midfield => {
            if snap.has_trait("Engine") {
                bonus *= 1.06;
            }
            if snap.has_trait("TeamPlayer") {
                bonus *= 1.04;
            }
            if snap.has_trait("Tireless") {
                bonus *= 1.03;
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
    Midfield,
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
        (PlayStyle::Possession, PlayStylePhase::Midfield) => 1.15,
        (PlayStyle::Possession, PlayStylePhase::Attack) => 0.97,
        (PlayStyle::Counter, PlayStylePhase::Attack) => 1.18,
        (PlayStyle::Counter, PlayStylePhase::Midfield) => 0.92,
        (PlayStyle::HighPress, PlayStylePhase::Press) => 1.20,
        (PlayStyle::HighPress, PlayStylePhase::Defense) => 0.95,
        _ => 1.0,
    }
}

// ---------------------------------------------------------------------------
// Phase-blueprint modifiers
//
// Each function maps one `TacticsPhase` knob onto a rating multiplier or an
// event probability. The neutral (#[default]) option of every knob returns
// ×1.0 — and, for the probabilistic transition knobs, 0.0 — so a team on its
// defaults leaves simulation behaviour (and the RNG stream) unchanged.
//
// Hook placement matters: the engine resets the ball to Midfield on every
// minute's possession contest and never visits the deep build-up zone, so the
// "keep / win the ball" knobs are routed through that per-minute contest
// (`retain = mid_att / (mid_att + mid_def)`) — multiplying the rating, not
// adding a draw, so neutral stays byte-identical. The "create / prevent a
// chance" knobs live in the per-action midfield / attacking-third resolvers
// that actually fire. Magnitudes are deliberately subtle and are the tunable
// surface (see PHASE_MAGNITUDES in the consumption tests).
// ---------------------------------------------------------------------------

// --- Possession contest: keep the ball (attacking side) ---

/// Build-up style scales how securely the team keeps possession. Short plays it
/// safe and retains; Long is more direct and concedes the ball more readily.
pub(crate) fn build_up_retention_modifier(phase: TacticsPhase) -> f64 {
    match phase.build_up_style {
        BuildUpStyle::Short => 1.05,
        BuildUpStyle::Mixed => 1.0,
        BuildUpStyle::Long => 0.95,
    }
}

/// Tempo's possession side: Patient circulates and holds the ball; Direct moves
/// it on faster at a slightly higher risk of losing it.
pub(crate) fn tempo_retention_modifier(phase: TacticsPhase) -> f64 {
    match phase.tempo {
        Tempo::Patient => 1.03,
        Tempo::Direct => 1.0,
    }
}

/// Combined attacking-side multiplier applied to the possessing team's weight in
/// the per-minute possession contest.
pub(crate) fn possession_attack_modifier(phase: TacticsPhase) -> f64 {
    build_up_retention_modifier(phase) * tempo_retention_modifier(phase)
}

// --- Possession contest: win the ball back (defending side) ---

/// Defensive line height: a higher line wins the ball back more readily (at the
/// cost, conceptually, of space in behind — not modelled in v1).
pub(crate) fn defensive_line_press_modifier(phase: TacticsPhase) -> f64 {
    match phase.defensive_line {
        DefensiveLine::VeryLow => 0.95,
        DefensiveLine::Low => 0.975,
        DefensiveLine::Medium => 1.0,
        DefensiveLine::High => 1.05,
    }
}

/// Pressing intensity: harder pressing wins the ball back more often.
pub(crate) fn pressing_press_modifier(phase: TacticsPhase) -> f64 {
    match phase.pressing_intensity {
        PressingIntensity::Passive => 0.96,
        PressingIntensity::Medium => 1.0,
        PressingIntensity::Aggressive => 1.06,
    }
}

/// Combined defending-side multiplier applied to the pressing team's weight in
/// the per-minute possession contest.
pub(crate) fn possession_defense_modifier(phase: TacticsPhase) -> f64 {
    defensive_line_press_modifier(phase) * pressing_press_modifier(phase)
}

/// Pressing intensity also scales how fast the team tires (cost of pressing).
/// Applies only to the live engine, which tracks in-match condition.
pub(crate) fn pressing_fatigue_modifier(phase: TacticsPhase) -> f64 {
    match phase.pressing_intensity {
        PressingIntensity::Passive => 0.95,
        PressingIntensity::Medium => 1.0,
        PressingIntensity::Aggressive => 1.08,
    }
}

// --- Per-action resolvers: create / deny chances ---

/// Tempo's progression side: Direct breaks lines through midfield faster,
/// Patient is more measured. Pairs with `tempo_retention_modifier` so Patient
/// trades quicker progression for more secure possession.
pub(crate) fn tempo_progression_modifier(phase: TacticsPhase) -> f64 {
    match phase.tempo {
        Tempo::Direct => 1.0,
        Tempo::Patient => 0.92,
    }
}

/// Marking style scales how tightly the team denies midfield progression.
pub(crate) fn marking_modifier(phase: TacticsPhase) -> f64 {
    match phase.marking_style {
        MarkingStyle::Zonal => 1.0,
        MarkingStyle::Mixed => 1.03,
        MarkingStyle::ManToMan => 1.06,
    }
}

/// Width scales chance creation in the attacking third.
pub(crate) fn width_attack_modifier(phase: TacticsPhase) -> f64 {
    match phase.width {
        Width::Wide => 1.04,
        Width::Normal => 1.0,
        Width::Narrow => 0.96,
    }
}

/// Defensive shape scales how hard it is to create chances against the team.
pub(crate) fn defensive_shape_modifier(phase: TacticsPhase) -> f64 {
    match phase.defensive_shape {
        DefensiveShape::Stretched => 0.93,
        DefensiveShape::Normal => 1.0,
        DefensiveShape::Compact => 1.07,
    }
}

// --- Transitions: applied at the per-minute possession flip ---

/// Counter-press duration: chance for the side that just lost the ball to win
/// it straight back. None ⇒ no roll (neutral, RNG-safe).
pub(crate) fn counter_press_rewin_chance(phase: TacticsPhase) -> f64 {
    match phase.counter_press_duration {
        CounterPressDuration::None => 0.0,
        CounterPressDuration::Short => 0.06,
        CounterPressDuration::Long => 0.12,
    }
}

/// Break speed: chance for the side that just won the ball to spring a fast
/// counter straight into its attacking third instead of resetting to midfield.
/// Neutral (Medium/Slow) ⇒ no roll; only Fast enables counters in v1.
pub(crate) fn break_speed_counter_chance(phase: TacticsPhase) -> f64 {
    match phase.break_speed {
        BreakSpeed::Slow => 0.0,
        BreakSpeed::Medium => 0.0,
        BreakSpeed::Fast => 0.10,
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
        (PlayerRole::BallPlayingKeeper, PlayStylePhase::Midfield) => 1.06,
        // Center Backs
        (PlayerRole::Stopper, PlayStylePhase::Defense) => 1.08,
        (PlayerRole::BallPlayingCB, PlayStylePhase::Midfield) => 1.05,
        (PlayerRole::CoverCB, PlayStylePhase::Defense) => 1.05,
        // Full Backs
        (PlayerRole::AttackingFB, PlayStylePhase::Attack) => 1.08,
        (PlayerRole::AttackingFB, PlayStylePhase::Defense) => 0.93,
        (PlayerRole::DefensiveFB, PlayStylePhase::Defense) => 1.08,
        (PlayerRole::DefensiveFB, PlayStylePhase::Attack) => 0.93,
        (PlayerRole::WingBack, PlayStylePhase::Attack) => 1.10,
        (PlayerRole::WingBack, PlayStylePhase::Defense) => 0.97,
        (PlayerRole::InvertedFB, PlayStylePhase::Midfield) => 1.06,
        // Defensive Midfielders
        (PlayerRole::AnchorMan, PlayStylePhase::Defense) => 1.10,
        (PlayerRole::AnchorMan, PlayStylePhase::Attack) => 0.90,
        (PlayerRole::BallWinner, PlayStylePhase::Defense) => 1.08,
        (PlayerRole::DeepLyingPlaymaker, PlayStylePhase::Midfield) => 1.10,
        (PlayerRole::DeepLyingPlaymaker, PlayStylePhase::Attack) => 0.93,
        // Central Midfielders
        (PlayerRole::BoxToBox, PlayStylePhase::Midfield) => 1.06,
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
        (PlayerRole::InvertedWinger, PlayStylePhase::Midfield) => 1.08,
        // Strikers
        (PlayerRole::Poacher, PlayStylePhase::Attack) => 1.12,
        (PlayerRole::Poacher, PlayStylePhase::Defense) => 0.85,
        (PlayerRole::TargetMan, PlayStylePhase::Attack) => 1.08,
        (PlayerRole::DeepLyingForward, PlayStylePhase::Midfield) => 1.06,
        (PlayerRole::False9, PlayStylePhase::Midfield) => 1.08,
        (PlayerRole::False9, PlayStylePhase::Attack) => 1.05,
        (PlayerRole::PressingForward, PlayStylePhase::Press) => 1.15,
        (PlayerRole::CompleteForward, PlayStylePhase::Attack) => 1.10,
        (PlayerRole::CompleteForward, PlayStylePhase::Defense) => 1.03,
        _ => 1.0,
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
