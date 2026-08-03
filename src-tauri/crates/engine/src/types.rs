use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// Position — mirrors domain::player::Position but kept independent
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Position {
    Goalkeeper,
    Defender,
    Midfielder,
    Forward,
}

// ---------------------------------------------------------------------------
// PlayStyle — mirrors domain::team::PlayStyle
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PlayStyle {
    Balanced,
    Attacking,
    Defensive,
    Possession,
    Counter,
    HighPress,
}

// ---------------------------------------------------------------------------
// PlayerRole — mirrors domain::team::PlayerRole, kept independent
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub enum PlayerRole {
    // Goalkeeper
    #[default]
    Standard,
    BallPlayingKeeper,
    SweeperKeeper,
    // Center Back
    Stopper,
    CoverCB,
    BallPlayingCB,
    // Full Back / Wing Back
    AttackingFB,
    DefensiveFB,
    InvertedFB,
    WingBack,
    // Defensive Midfielder
    AnchorMan,
    BallWinner,
    DeepLyingPlaymaker,
    // Central Midfielder
    BoxToBox,
    Carrilero,
    Mezzala,
    // Attacking Midfielder
    AdvancedPlaymaker,
    ShadowStriker,
    // Wide
    WideForward,
    InsideForward,
    InvertedWinger,
    // Striker
    Poacher,
    TargetMan,
    DeepLyingForward,
    False9,
    PressingForward,
    CompleteForward,
}


// ---------------------------------------------------------------------------
// Slot — the granular position a player is deployed in
// ---------------------------------------------------------------------------

/// Where a player is actually deployed, as opposed to which quarter of the
/// pitch he belongs to.
///
/// [`Position`] has four buckets, which is too coarse to tell a holding
/// midfielder from an attacking one, or a wing-back from a centre-half. The
/// granular slot is derived from the formation and the starting eleven's order,
/// and was already being computed at the domain boundary and thrown away — so a
/// 4-3-3 and a 3-5-2 differed only in how many players landed in each bucket.
///
/// Mirrors `domain::player::Position`'s granular variants. The engine keeps its
/// own copy rather than depending on `domain`; `ofm_core` maps between them, as
/// it does for [`PlayerRole`].
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Slot {
    Goalkeeper,
    RightBack,
    CenterBack,
    LeftBack,
    RightWingBack,
    LeftWingBack,
    DefensiveMidfielder,
    CentralMidfielder,
    AttackingMidfielder,
    RightMidfielder,
    LeftMidfielder,
    RightWinger,
    LeftWinger,
    Striker,
}

impl Slot {
    /// The coarse bucket this slot belongs to.
    pub fn position(self) -> Position {
        match self {
            Slot::Goalkeeper => Position::Goalkeeper,
            Slot::RightBack | Slot::CenterBack | Slot::LeftBack => Position::Defender,
            Slot::RightWingBack | Slot::LeftWingBack => Position::Defender,
            Slot::DefensiveMidfielder
            | Slot::CentralMidfielder
            | Slot::AttackingMidfielder
            | Slot::RightMidfielder
            | Slot::LeftMidfielder => Position::Midfielder,
            Slot::RightWinger | Slot::LeftWinger | Slot::Striker => Position::Forward,
        }
    }
}

// ---------------------------------------------------------------------------
// PlayerData — a snapshot of a player for engine consumption
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerData {
    pub id: String,
    pub name: String,
    pub position: Position,
    #[serde(default)]
    pub ovr: u8,
    pub condition: u8, // 0-100
    /// Long-term physical shape (0-100). Multiplies stamina depletion rate in-match.
    #[serde(default = "default_fitness")]
    pub fitness: u8,

    // Physical
    pub pace: u8,
    pub stamina: u8,
    pub strength: u8,
    #[serde(default = "default_engine_attr")]
    pub agility: u8,

    // Technical
    pub passing: u8,
    pub shooting: u8,
    pub tackling: u8,
    pub dribbling: u8,
    pub defending: u8,

    // Mental
    pub positioning: u8,
    pub vision: u8,
    pub decisions: u8,
    #[serde(default = "default_engine_attr")]
    pub composure: u8,
    #[serde(default = "default_engine_attr")]
    pub aggression: u8,
    #[serde(default = "default_engine_attr")]
    pub teamwork: u8,
    #[serde(default = "default_engine_attr")]
    pub leadership: u8,

    // Goalkeeper
    #[serde(default = "default_engine_attr")]
    pub handling: u8,
    #[serde(default = "default_engine_attr")]
    pub reflexes: u8,
    #[serde(default = "default_engine_attr")]
    pub aerial: u8,

    // Traits (string names matching domain::player::PlayerTrait variants)
    #[serde(default)]
    pub traits: Vec<String>,

    #[serde(default)]
    pub role: PlayerRole,

    /// The granular slot this player is deployed in, when known. Falls back to
    /// [`PlayerData::position`] for bench players and for saves written before
    /// slots were carried across the boundary.
    #[serde(default)]
    pub slot: Option<Slot>,
}

fn default_engine_attr() -> u8 {
    50
}

fn default_fitness() -> u8 {
    75
}

impl PlayerData {
    /// Overall rating (simple mean of core 11 attributes).
    pub fn overall(&self) -> f64 {
        (self.pace as f64
            + self.stamina as f64
            + self.strength as f64
            + self.passing as f64
            + self.shooting as f64
            + self.tackling as f64
            + self.dribbling as f64
            + self.defending as f64
            + self.positioning as f64
            + self.vision as f64
            + self.decisions as f64)
            / 11.0
    }

}

// ---------------------------------------------------------------------------
// TacticsConfig — tactical settings that influence simulation modifiers
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub enum PressingIntensity {
    Passive,
    #[default]
    Medium,
    Aggressive,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub enum DefensiveLine {
    VeryLow,
    Low,
    #[default]
    Medium,
    High,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub enum TacticsPitchWidth {
    Narrow,
    #[default]
    Normal,
    Wide,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub enum TacticsBuildUpStyle {
    Short,
    #[default]
    Mixed,
    Long,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub enum MarkingStyle {
    #[default]
    Zonal,
    Mixed,
    ManToMan,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub enum Tempo {
    Patient,
    #[default]
    Direct,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub enum DefensiveShape {
    Stretched,
    #[default]
    Normal,
    Compact,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub enum CounterPressDuration {
    #[default]
    None,
    Short,
    Long,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub enum BreakSpeed {
    Slow,
    #[default]
    Medium,
    Fast,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TacticsConfig {
    pub pressing_intensity: PressingIntensity,
    pub defensive_line: DefensiveLine,
    pub width: TacticsPitchWidth,
    pub build_up_style: TacticsBuildUpStyle,
    pub marking_style: MarkingStyle,
    // Phase-blueprint dials added on top of the original five. Each defaults to
    // the neutral option so existing `TacticsConfig::default()` callers and
    // serialized saves are unaffected.
    #[serde(default)]
    pub tempo: Tempo,
    #[serde(default)]
    pub defensive_shape: DefensiveShape,
    #[serde(default)]
    pub counter_press_duration: CounterPressDuration,
    #[serde(default)]
    pub break_speed: BreakSpeed,
}

// ---------------------------------------------------------------------------
// TeamData — everything the engine needs to know about one side
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TeamData {
    pub id: String,
    pub name: String,
    pub formation: String,
    pub play_style: PlayStyle,
    pub players: Vec<PlayerData>,
    #[serde(default)]
    pub tactics: TacticsConfig,
}

impl TeamData {
    /// Count players by position.
    pub fn count_position(&self, pos: Position) -> usize {
        self.players.iter().filter(|p| p.position == pos).count()
    }

    /// Average of a composite attribute among players in the given position.
    ///
    /// The composite is computed in floating point. It used to be built with
    /// integer division and cast back to `u8` before averaging, which
    /// truncated every one of these ratings.
    pub fn position_attr_avg(&self, pos: Position, attr_fn: fn(&PlayerData) -> f64) -> f64 {
        let mut total = 0.0;
        let mut counted = 0;
        for player in self.players.iter().filter(|p| p.position == pos) {
            total += attr_fn(player);
            counted += 1;
        }
        if counted == 0 {
            // Nobody plays this position — a shape with no recognised holder
            // still needs a number rather than a division by zero.
            return 40.0;
        }
        total / counted as f64
    }


    /// Composite midfield rating, used by the possession contest.
    pub fn midfield_rating(&self) -> f64 {
        self.position_attr_avg(Position::Midfielder, |p| {
            (p.passing as f64 + p.vision as f64 + p.decisions as f64 + p.stamina as f64) / 4.0
        })
    }


}

// ---------------------------------------------------------------------------
// MatchConfig — tuneable simulation parameters
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchConfig {
    /// Multiplier applied to the home team's ratings (e.g. 1.08 = 8% boost).
    pub home_advantage: f64,
    /// Base probability that a shot from the box is on target (0.0–1.0).
    pub shot_accuracy_base: f64,
    /// Base probability that an on-target shot beats the keeper (0.0–1.0).
    pub goal_conversion_base: f64,
    /// Per-minute fatigue factor applied to condition.
    pub fatigue_per_minute: f64,
    /// Probability of a foul on any defensive action (0.0–1.0).
    pub foul_probability: f64,
    /// Probability a foul results in a yellow card.
    pub yellow_card_probability: f64,
    /// Probability a yellow-card foul is upgraded to red (second yellow or serious foul).
    pub red_card_probability: f64,
    /// Probability that a foul inside the attacking box is adjudicated as a penalty kick.
    /// Conditional on a box foul occurring — not a per-game rate. ~50% in real football.
    pub penalty_probability: f64,
    /// Minutes of stoppage time per half (0 = none).
    pub stoppage_time_max: u8,
    /// Probability of an injury per foul event.
    pub injury_probability: f64,
}

impl Default for MatchConfig {
    fn default() -> Self {
        Self {
            home_advantage: 1.08,
            // Calibrated against the effective shooting skill the engine
            // actually produces, which is a fatigue-adjusted rating rather than
            // the raw attribute. When the two engines were merged onto the live
            // core's per-player fatigue model, effective skill rose (the old
            // batch model multiplied by team-mean condition, ~0.90 falling to
            // 0.70; the live model uses 0.6 + 0.4·condition, ~0.96 falling to
            // ~0.89), which pushed shots on target to 47% — outside the 32–45%
            // real-football band. This constant moved with the scale it is
            // calibrated against.
            shot_accuracy_base: 0.30,
            // Recalibrated when actor selection became weighted. The engine
            // now puts its best finisher on the end of a chance rather than a
            // random forward, and its actual keeper in goal, so the same base
            // produced a markedly higher conversion rate.
            goal_conversion_base: 0.29,
            fatigue_per_minute: 0.20,
            foul_probability: 0.134,
            yellow_card_probability: 0.11,
            red_card_probability: 0.04,
            penalty_probability: 0.50,
            stoppage_time_max: 4,
            injury_probability: 0.03,
        }
    }
}

// ---------------------------------------------------------------------------
// Side — which side of the match
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Side {
    Home,
    Away,
}

impl Side {
    pub fn opposite(self) -> Side {
        match self {
            Side::Home => Side::Away,
            Side::Away => Side::Home,
        }
    }
}

// ---------------------------------------------------------------------------
// Zone — regions of the pitch from the perspective of the match (not a team)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Zone {
    HomeBox,
    HomeDefense,
    Midfield,
    AwayDefense,
    AwayBox,
}

impl Zone {
    /// The attacking zone for a given side (where they score).
    pub fn attacking_box(side: Side) -> Zone {
        match side {
            Side::Home => Zone::AwayBox,
            Side::Away => Zone::HomeBox,
        }
    }

    /// The attacking third for a given side.
    pub fn attacking_third(side: Side) -> Zone {
        match side {
            Side::Home => Zone::AwayDefense,
            Side::Away => Zone::HomeDefense,
        }
    }

    /// The defensive third for a given side.
    pub fn defensive_third(side: Side) -> Zone {
        match side {
            Side::Home => Zone::HomeDefense,
            Side::Away => Zone::AwayDefense,
        }
    }

    /// Advance the ball one zone towards the given side's goal.
    pub fn advance_towards(self, attacking_side: Side) -> Zone {
        match attacking_side {
            Side::Home => match self {
                Zone::HomeBox => Zone::HomeDefense,
                Zone::HomeDefense => Zone::Midfield,
                Zone::Midfield => Zone::AwayDefense,
                Zone::AwayDefense => Zone::AwayBox,
                Zone::AwayBox => Zone::AwayBox,
            },
            Side::Away => match self {
                Zone::AwayBox => Zone::AwayDefense,
                Zone::AwayDefense => Zone::Midfield,
                Zone::Midfield => Zone::HomeDefense,
                Zone::HomeDefense => Zone::HomeBox,
                Zone::HomeBox => Zone::HomeBox,
            },
        }
    }

    /// Is this zone the attacking box for the given side?
    pub fn is_box_for(self, attacking_side: Side) -> bool {
        self == Zone::attacking_box(attacking_side)
    }
}
