use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Player {
    pub id: String,
    pub match_name: String,
    pub full_name: String,
    pub date_of_birth: String,
    pub nationality: String,
    #[serde(default)]
    pub football_nation: String,
    #[serde(default)]
    pub birth_country: Option<String>,
    #[serde(default)]
    pub media: PlayerMedia,

    pub position: Position,

    // The player's natural/preferred position (never changed by formation logic)
    #[serde(default)]
    pub natural_position: Position,

    // Alternate positions this player can also play (with reduced effectiveness)
    #[serde(default)]
    pub alternate_positions: Vec<Position>,

    #[serde(default)]
    pub footedness: Footedness,

    #[serde(default = "default_weak_foot")]
    pub weak_foot: u8,

    // Core attributes 0-100
    pub attributes: PlayerAttributes,

    // Dynamic match/season values
    pub condition: u8, // 0-100 (short-term energy; depletes during matches, recovers daily)
    pub morale: u8,    // 0-100
    /// Long-term physical shape (0–100). Determines how fast condition depletes and
    /// recovers, and modulates injury risk. Changes slowly over weeks.
    #[serde(default = "default_fitness")]
    pub fitness: u8,

    pub injury: Option<Injury>,
    pub team_id: Option<String>,
    #[serde(default)]
    pub retired: bool,
    #[serde(default)]
    pub squad_role: SquadRole,

    // Traits / flairs derived from attributes
    #[serde(default)]
    pub traits: Vec<PlayerTrait>,

    // Derived ratings (set by ofm_core, backend is source of truth)
    /// Position-weighted overall rating (1–99). Computed from natural position.
    #[serde(default)]
    pub ovr: u8,
    /// Player's ceiling rating (1–99). Set at generation; higher than ovr for young players.
    #[serde(default)]
    pub potential: u8,

    // Contract & value
    pub contract_end: Option<String>,
    pub wage: u32, // weekly wage
    pub market_value: u64,

    // Season stats
    pub stats: PlayerSeasonStats,

    // Career history
    pub career: Vec<CareerEntry>,
    #[serde(default)]
    pub movement_history: Vec<PlayerMovementEntry>,

    // Individual training focus override (takes priority over group and team default)
    #[serde(default)]
    pub training_focus: Option<crate::team::TrainingFocus>,

    // Transfer status
    #[serde(default)]
    pub transfer_listed: bool,
    #[serde(default)]
    pub loan_listed: bool,
    #[serde(default)]
    pub transfer_offers: Vec<TransferOffer>,
    #[serde(default)]
    pub loan_offers: Vec<LoanOffer>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub active_loan: Option<ActiveLoan>,
    #[serde(default)]
    pub morale_core: PlayerMoraleCore,

    /// Jersey/squad number (1–99). None means unassigned.
    #[serde(default)]
    pub jersey_number: Option<u8>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct PlayerMedia {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub face: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Default, Serialize, Deserialize)]
pub enum Position {
    #[default]
    Goalkeeper,
    Defender,
    Midfielder,
    Forward,
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

impl Position {
    pub fn is_legacy_bucket(&self) -> bool {
        matches!(
            self,
            Position::Goalkeeper | Position::Defender | Position::Midfielder | Position::Forward
        )
    }

    pub fn to_group_position(&self) -> Position {
        match self {
            Position::Goalkeeper => Position::Goalkeeper,
            Position::Defender
            | Position::RightBack
            | Position::CenterBack
            | Position::LeftBack
            | Position::RightWingBack
            | Position::LeftWingBack => Position::Defender,
            Position::Midfielder
            | Position::DefensiveMidfielder
            | Position::CentralMidfielder
            | Position::AttackingMidfielder
            | Position::RightMidfielder
            | Position::LeftMidfielder => Position::Midfielder,
            Position::Forward
            | Position::RightWinger
            | Position::LeftWinger
            | Position::Striker => Position::Forward,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum Footedness {
    Left,
    #[default]
    Right,
    Both,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum SquadRole {
    #[default]
    Senior,
    Youth,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerAttributes {
    // Physical
    pub pace: u8,
    pub stamina: u8,
    pub strength: u8,
    #[serde(default = "default_attr")]
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
    #[serde(default = "default_attr")]
    pub composure: u8,
    #[serde(default = "default_attr")]
    pub aggression: u8,
    #[serde(default = "default_attr")]
    pub teamwork: u8,
    #[serde(default = "default_attr")]
    pub leadership: u8,

    // Goalkeeper
    #[serde(default = "default_attr")]
    pub handling: u8,
    #[serde(default = "default_attr")]
    pub reflexes: u8,
    #[serde(default = "default_attr")]
    pub aerial: u8,
}

fn default_attr() -> u8 {
    50
}

fn default_weak_foot() -> u8 {
    2
}

fn default_fitness() -> u8 {
    75
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Injury {
    pub name: String,
    pub days_remaining: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum PlayerIssueCategory {
    Contract,
    PlayingTime,
    Morale,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PlayerIssue {
    pub category: PlayerIssueCategory,
    pub severity: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(default)]
pub struct RecentTreatmentMemory {
    pub action_key: String,
    pub times_recently_used: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum PlayerPromiseKind {
    PlayingTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub enum RenewalSessionStatus {
    #[default]
    Idle,
    Open,
    Agreed,
    Blocked,
    Stalled,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub enum RenewalSessionOutcome {
    #[default]
    None,
    AcceptedByManager,
    AcceptedByAssistant,
    RejectedByPlayer,
    BlockedByManager,
    Stalled,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ContractExitIntent {
    LetExpire {
        set_on: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        reason: Option<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(default)]
pub struct ContractRenewalState {
    pub status: RenewalSessionStatus,
    pub manager_blocked_until: Option<String>,
    pub last_attempt_date: Option<String>,
    pub last_assistant_attempt_date: Option<String>,
    pub last_outcome: Option<RenewalSessionOutcome>,
    pub conversation_round: u8,
    pub exit_intent: Option<ContractExitIntent>,
}

impl Default for ContractRenewalState {
    fn default() -> Self {
        Self {
            status: RenewalSessionStatus::Idle,
            manager_blocked_until: None,
            last_attempt_date: None,
            last_assistant_attempt_date: None,
            last_outcome: None,
            conversation_round: 0,
            exit_intent: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(default)]
pub struct PlayerPromise {
    pub kind: PlayerPromiseKind,
    pub matches_remaining: u8,
}

impl Default for PlayerPromise {
    fn default() -> Self {
        Self {
            kind: PlayerPromiseKind::PlayingTime,
            matches_remaining: 0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(default)]
pub struct PlayerMoraleCore {
    pub manager_trust: u8,
    pub unresolved_issue: Option<PlayerIssue>,
    pub recent_treatment: Option<RecentTreatmentMemory>,
    pub pending_promise: Option<PlayerPromise>,
    pub talk_cooldown_until: Option<String>,
    pub renewal_state: Option<ContractRenewalState>,
}

impl Default for PlayerMoraleCore {
    fn default() -> Self {
        Self {
            manager_trust: 50,
            unresolved_issue: None,
            recent_treatment: None,
            pending_promise: None,
            talk_cooldown_until: None,
            renewal_state: None,
        }
    }
}

fn default_transfer_offer_status() -> TransferOfferStatus {
    TransferOfferStatus::Pending
}

fn default_transfer_offer_date() -> String {
    String::new()
}

fn default_transfer_offer_round() -> u8 {
    0
}

fn default_loan_offer_round() -> u8 {
    0
}

fn default_loan_offer_status() -> LoanOfferStatus {
    LoanOfferStatus::Pending
}

fn default_loan_offer_date() -> String {
    String::new()
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct PlayerSeasonStats {
    pub appearances: u32,
    pub goals: u32,
    pub assists: u32,
    pub clean_sheets: u32,
    pub yellow_cards: u32,
    pub red_cards: u32,
    pub avg_rating: f32,
    pub minutes_played: u32,
    pub shots: u32,
    pub shots_on_target: u32,
    pub passes_completed: u32,
    pub passes_attempted: u32,
    pub tackles_won: u32,
    pub interceptions: u32,
    pub fouls_committed: u32,
    /// Expected goals accumulated across the season: the quality of the chances
    /// he had. The gap between this and `goals` is his finishing.
    #[serde(default)]
    pub xg: f32,
    /// Expected assists: the quality of the chances he created.
    #[serde(default)]
    pub xa: f32,
    /// Expected threat: the danger he added by moving the ball up the pitch.
    #[serde(default)]
    pub xt: f32,
    /// Kilometres covered. Estimated from role and stamina, not simulated.
    #[serde(default)]
    pub distance_km: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CareerEntry {
    pub season: u32,
    pub team_id: String,
    pub team_name: String,
    pub appearances: u32,
    pub goals: u32,
    pub assists: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PlayerMovementKind {
    PermanentTransfer,
    LoanStart,
    LoanReturn,
    LoanToBuy,
    FreeAgentSigning,
    Released,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PlayerMovementEntry {
    pub date: String,
    pub kind: PlayerMovementKind,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub from_team_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub from_team_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub to_team_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub to_team_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fee: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub loan_end_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferOffer {
    pub id: String,
    pub from_team_id: String,
    pub fee: u64,
    pub wage_offered: u32,
    #[serde(default)]
    pub last_manager_fee: Option<u64>,
    #[serde(default = "default_transfer_offer_round")]
    pub negotiation_round: u8,
    #[serde(default)]
    pub suggested_counter_fee: Option<u64>,
    #[serde(default = "default_transfer_offer_status")]
    pub status: TransferOfferStatus,
    #[serde(default = "default_transfer_offer_date")]
    pub date: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub registration_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum TransferOfferStatus {
    Pending,
    PendingRegistration,
    Accepted,
    Rejected,
    Withdrawn,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoanOffer {
    pub id: String,
    pub from_team_id: String,
    pub parent_team_id: String,
    pub start_date: String,
    pub end_date: String,
    pub wage_contribution_pct: u8,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub buy_option_fee: Option<u64>,
    #[serde(default)]
    pub last_manager_wage_contribution_pct: Option<u8>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_manager_end_date: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_manager_buy_option_fee: Option<u64>,
    #[serde(default = "default_loan_offer_round")]
    pub negotiation_round: u8,
    #[serde(default)]
    pub suggested_wage_contribution_pct: Option<u8>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub suggested_end_date: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub suggested_buy_option_fee: Option<u64>,
    #[serde(default = "default_loan_offer_status")]
    pub status: LoanOfferStatus,
    #[serde(default = "default_loan_offer_date")]
    pub date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum LoanOfferStatus {
    Pending,
    PendingRegistration,
    Accepted,
    Rejected,
    Withdrawn,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ActiveLoan {
    pub parent_team_id: String,
    pub loan_team_id: String,
    pub start_date: String,
    pub end_date: String,
    pub wage_contribution_pct: u8,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub buy_option_fee: Option<u64>,
    #[serde(default)]
    pub loan_start_minutes: u32,
    #[serde(default)]
    pub loan_start_appearances: u32,
    #[serde(default)]
    pub development_reported_minutes: u32,
    #[serde(default)]
    pub development_reported_appearances: u32,
}

#[derive(Copy, Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum PlayerTrait {
    // Physical
    Speedster, // pace >= 85
    Tank,      // strength >= 85 && stamina >= 75
    Agile,     // agility >= 85
    Tireless,  // stamina >= 90
    // Technical
    Playmaker,    // passing >= 80 && vision >= 80
    Sharpshooter, // shooting >= 85
    Dribbler,     // dribbling >= 85
    BallWinner,   // tackling >= 80 && aggression >= 70
    Rock,         // defending >= 85 && positioning >= 75
    // Mental
    Leader,     // leadership >= 85 && teamwork >= 75
    CoolHead,   // composure >= 85 && decisions >= 80
    Visionary,  // vision >= 85
    HotHead,    // aggression >= 85 && composure < 50
    TeamPlayer, // teamwork >= 85
    // Goalkeeper
    SafeHands,       // handling >= 85 (GK only)
    CatReflexes,     // reflexes >= 85 (GK only)
    AerialDominance, // aerial >= 85
    // Combo / Special
    CompleteForward, // FWD: shooting >= 75 && dribbling >= 75 && pace >= 70 && strength >= 70
    Engine,          // MID: stamina >= 85 && pace >= 70 && teamwork >= 75
    SetPieceSpecialist, // passing >= 80 && shooting >= 75 && vision >= 75
    // Potential / Star
    Wonderkid, // age <= 21 && potential >= 85 && (potential - ovr) >= 10
}

/// How a trait behaves once the attributes behind it start to go.
///
/// Football does not treat these the same way. A winger who has lost his legs
/// has lost them, and everyone can see it; a playmaker a few points off his
/// peak has not forgotten how to find the pass. Deriving every trait from
/// current attributes with one rule makes the first case right and the second
/// wrong — and, worse, makes a trait flicker on and off as an attribute drifts
/// across a threshold by a point.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TraitPersistence {
    /// Goes the season the attribute does.
    Physical,
    /// Survives a dip, not a decline.
    Technical,
    /// Learned, and not easily unlearned. Only a collapse takes it.
    Learned,
}

impl TraitPersistence {
    /// How far an attribute may fall below the threshold that earned the trait
    /// before the trait is lost.
    const fn slack(self) -> u8 {
        match self {
            TraitPersistence::Physical => 0,
            TraitPersistence::Technical => 8,
            TraitPersistence::Learned => 25,
        }
    }
}

/// Which of the three a trait is.
///
/// Exhaustive on purpose: a new trait must say how it ages rather than
/// inheriting whatever a catch-all arm happened to be.
pub const fn persistence(player_trait: PlayerTrait) -> TraitPersistence {
    use PlayerTrait as T;
    use TraitPersistence::*;
    match player_trait {
        // Legs, lungs and joints.
        T::Speedster | T::Tank | T::Agile | T::Tireless | T::Engine => Physical,

        // Technique fades with the body that executes it, but more slowly.
        T::Sharpshooter
        | T::Dribbler
        | T::BallWinner
        | T::Rock
        | T::CatReflexes
        | T::AerialDominance
        | T::CompleteForward => Technical,

        // How a player reads and handles a game. Learned, and it stays.
        T::Playmaker
        | T::Visionary
        | T::Leader
        | T::CoolHead
        | T::TeamPlayer
        | T::SafeHands
        | T::SetPieceSpecialist => Learned,

        // A temperament, not a skill: it does not mellow because the legs did.
        T::HotHead => Learned,

        // Awarded on age and potential, and expires on its own.
        T::Wonderkid => Physical,
    }
}

/// Every attribute-derived trait, so a caller can ask about all of them.
pub const ALL_TRAITS: [PlayerTrait; 21] = [
    PlayerTrait::Speedster,
    PlayerTrait::Tank,
    PlayerTrait::Agile,
    PlayerTrait::Tireless,
    PlayerTrait::Playmaker,
    PlayerTrait::Sharpshooter,
    PlayerTrait::Dribbler,
    PlayerTrait::BallWinner,
    PlayerTrait::Rock,
    PlayerTrait::Leader,
    PlayerTrait::CoolHead,
    PlayerTrait::Visionary,
    PlayerTrait::HotHead,
    PlayerTrait::TeamPlayer,
    PlayerTrait::SafeHands,
    PlayerTrait::CatReflexes,
    PlayerTrait::AerialDominance,
    PlayerTrait::CompleteForward,
    PlayerTrait::Engine,
    PlayerTrait::SetPieceSpecialist,
    PlayerTrait::Wonderkid,
];

/// Whether these attributes earn a trait, allowing `slack` points of shortfall.
///
/// At `slack` zero this is the threshold that earns the trait in the first
/// place; above zero it is the looser bar a player who already has it must fall
/// under before losing it.
fn qualifies(player_trait: PlayerTrait, attrs: &PlayerAttributes, slack: u8) -> bool {
    // Reaching a threshold, with the shortfall allowance applied.
    let met = |value: u8, threshold: u8| value.saturating_add(slack) >= threshold;
    // The one condition that reads the other way — a hot head is calm enough to
    // stop being one — so slack has to loosen it in the same direction.
    let under = |value: u8, threshold: u8| value < threshold.saturating_add(slack);

    use PlayerTrait as T;
    match player_trait {
        // Physical
        T::Speedster => met(attrs.pace, 85),
        T::Tank => met(attrs.strength, 85) && met(attrs.stamina, 75),
        T::Agile => met(attrs.agility, 85),
        T::Tireless => met(attrs.stamina, 90),

        // Technical
        T::Playmaker => met(attrs.passing, 80) && met(attrs.vision, 80),
        T::Sharpshooter => met(attrs.shooting, 85),
        T::Dribbler => met(attrs.dribbling, 85),
        T::BallWinner => met(attrs.tackling, 80) && met(attrs.aggression, 70),
        T::Rock => met(attrs.defending, 85) && met(attrs.positioning, 75),

        // Mental
        T::Leader => met(attrs.leadership, 85) && met(attrs.teamwork, 75),
        T::CoolHead => met(attrs.composure, 85) && met(attrs.decisions, 80),
        T::Visionary => met(attrs.vision, 85),
        T::HotHead => met(attrs.aggression, 85) && under(attrs.composure, 50),
        T::TeamPlayer => met(attrs.teamwork, 85),

        // Goalkeeper-oriented; any player with the attributes can earn these.
        T::SafeHands => met(attrs.handling, 85),
        T::CatReflexes => met(attrs.reflexes, 85),
        T::AerialDominance => met(attrs.aerial, 85),

        // Combo
        T::CompleteForward => {
            met(attrs.shooting, 75)
                && met(attrs.dribbling, 75)
                && met(attrs.pace, 70)
                && met(attrs.strength, 70)
        }
        T::Engine => met(attrs.stamina, 85) && met(attrs.pace, 70) && met(attrs.teamwork, 75),
        T::SetPieceSpecialist => {
            met(attrs.passing, 80) && met(attrs.shooting, 75) && met(attrs.vision, 75)
        }

        // Awarded elsewhere, on age and potential.
        T::Wonderkid => false,
    }
}

/// Derive traits purely from a player's attributes (position-independent).
///
/// This is the bar for *earning* a trait. A player who already has one is
/// judged by [`recompute_traits`], which is more forgiving.
pub fn compute_traits(attrs: &PlayerAttributes, position: &Position) -> Vec<PlayerTrait> {
    recompute_traits(attrs, position, &[])
}

/// Work out a player's traits given what he already has.
///
/// Earning a trait always takes the full threshold — nobody picks one up by
/// nearly qualifying. Keeping one is easier, and how much easier depends on
/// what sort of trait it is: see [`TraitPersistence`]. A player who has fallen
/// apart loses even what he learned, or a single outstanding season would label
/// him for a twenty-year career.
pub fn recompute_traits(
    attrs: &PlayerAttributes,
    _position: &Position,
    existing: &[PlayerTrait],
) -> Vec<PlayerTrait> {
    ALL_TRAITS
        .into_iter()
        .filter(|player_trait| {
            if qualifies(*player_trait, attrs, 0) {
                return true;
            }
            existing.contains(player_trait)
                && qualifies(*player_trait, attrs, persistence(*player_trait).slack())
        })
        .collect()
}

impl Player {
    pub fn new(
        id: String,
        match_name: String,
        full_name: String,
        date_of_birth: String,
        nationality: String,
        position: Position,
        attributes: PlayerAttributes,
    ) -> Self {
        let traits = compute_traits(&attributes, &position);
        let football_nation = crate::identity::normalize_football_nation_code(&nationality);
        let birth_country = crate::identity::derive_birth_country_code(&nationality);
        Self {
            id,
            match_name,
            full_name,
            date_of_birth,
            nationality,
            football_nation,
            birth_country,
            media: PlayerMedia::default(),
            natural_position: position.clone(),
            position,
            alternate_positions: Vec::new(),
            footedness: Footedness::default(),
            weak_foot: default_weak_foot(),
            attributes,
            condition: 100,
            morale: 100,
            fitness: 75,
            injury: None,
            team_id: None,
            retired: false,
            squad_role: SquadRole::Senior,
            traits,
            ovr: 0,
            potential: 0,
            contract_end: None,
            wage: 0,
            market_value: 0,
            stats: PlayerSeasonStats::default(),
            career: Vec::new(),
            movement_history: Vec::new(),
            training_focus: None,
            transfer_listed: false,
            loan_listed: false,
            transfer_offers: Vec::new(),
            loan_offers: Vec::new(),
            active_loan: None,
            morale_core: PlayerMoraleCore::default(),
            jersey_number: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_attributes() -> PlayerAttributes {
        PlayerAttributes {
            pace: 70,
            stamina: 72,
            strength: 65,
            agility: 68,
            passing: 74,
            shooting: 61,
            tackling: 58,
            dribbling: 69,
            defending: 56,
            positioning: 67,
            vision: 73,
            decisions: 71,
            composure: 66,
            aggression: 54,
            teamwork: 76,
            leadership: 49,
            handling: 20,
            reflexes: 24,
            aerial: 44,
        }
    }

    #[test]
    fn player_new_defaults_footedness_and_weak_foot() {
        let player = Player::new(
            "p-001".to_string(),
            "J. Smith".to_string(),
            "John Smith".to_string(),
            "2000-01-15".to_string(),
            "GB".to_string(),
            Position::Midfielder,
            sample_attributes(),
        );

        assert_eq!(player.footedness, Footedness::Right);
        assert_eq!(player.weak_foot, 2);
        assert_eq!(player.squad_role, SquadRole::Senior);
        assert_eq!(player.squad_role, SquadRole::Senior);
    }

    #[test]
    fn position_group_conversion_maps_granular_positions_back_to_legacy_groups() {
        assert_eq!(Position::RightBack.to_group_position(), Position::Defender);
        assert_eq!(
            Position::AttackingMidfielder.to_group_position(),
            Position::Midfielder,
        );
        assert_eq!(Position::LeftWinger.to_group_position(), Position::Forward);
    }

    #[test]
    fn player_deserialization_defaults_missing_foot_fields() {
        let player: Player = serde_json::from_value(serde_json::json!({
            "id": "p-legacy",
            "match_name": "J. Legacy",
            "full_name": "John Legacy",
            "date_of_birth": "2000-01-15",
            "nationality": "GB",
            "position": "Midfielder",
            "natural_position": "Midfielder",
            "alternate_positions": [],
            "attributes": sample_attributes(),
            "condition": 100,
            "morale": 100,
            "injury": null,
            "team_id": null,
            "traits": [],
            "contract_end": null,
            "wage": 0,
            "market_value": 0,
            "stats": {},
            "career": [],
            "transfer_listed": false,
            "loan_listed": false,
            "transfer_offers": [],
            "morale_core": {}
        }))
        .expect("legacy player json should deserialize");

        assert_eq!(player.footedness, Footedness::Right);
        assert_eq!(player.weak_foot, 2);
        assert_eq!(player.natural_position, Position::Midfielder);
        assert!(!player.retired);
        assert!(player.movement_history.is_empty());
    }
}

#[cfg(test)]
mod trait_persistence_tests {
    use super::*;

    fn attrs() -> PlayerAttributes {
        PlayerAttributes {
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
        }
    }

    /// Legs are legs. A winger who has lost his pace is not a Speedster any
    /// more, whatever he used to be, and the engine should stop picking him to
    /// run at people the season it happens.
    #[test]
    fn pace_goes_and_the_trait_goes_with_it() {
        let mut prime = attrs();
        prime.pace = 92;
        let earned = compute_traits(&prime, &Position::Forward);
        assert!(earned.contains(&PlayerTrait::Speedster));

        let mut veteran = prime.clone();
        veteran.pace = 74;
        let kept = recompute_traits(&veteran, &Position::Forward, &earned);
        assert!(
            !kept.contains(&PlayerTrait::Speedster),
            "a 74-pace veteran is still listed as a Speedster"
        );
    }

    /// Vision is a way of seeing the game, not a sprint time. A playmaker a
    /// few points off his peak has not forgotten how to find the pass, and a
    /// trait that switches off the season an attribute drifts by one point is
    /// noise rather than characterisation.
    #[test]
    fn a_playmaker_does_not_forget_how_to_pass() {
        let mut prime = attrs();
        prime.vision = 88;
        prime.passing = 84;
        let earned = compute_traits(&prime, &Position::Midfielder);
        assert!(earned.contains(&PlayerTrait::Visionary));
        assert!(earned.contains(&PlayerTrait::Playmaker));

        let mut older = prime.clone();
        older.vision = 79;
        older.passing = 78;
        let kept = recompute_traits(&older, &Position::Midfielder, &earned);
        assert!(
            kept.contains(&PlayerTrait::Visionary),
            "a learned trait vanished after a modest decline"
        );
        assert!(kept.contains(&PlayerTrait::Playmaker));
    }

    /// Sticky is not immortal. A player who falls apart loses even what he
    /// learned, or a one-season wonder carries the label for a twenty-year
    /// career.
    #[test]
    fn a_collapse_takes_even_a_learned_trait() {
        let mut prime = attrs();
        prime.vision = 88;
        let earned = compute_traits(&prime, &Position::Midfielder);
        assert!(earned.contains(&PlayerTrait::Visionary));

        let mut finished = prime.clone();
        finished.vision = 45;
        let kept = recompute_traits(&finished, &Position::Midfielder, &earned);
        assert!(
            !kept.contains(&PlayerTrait::Visionary),
            "a player with 45 vision is still marked Visionary"
        );
    }

    /// A technical trait sits between the two: kept through a dip, gone after a
    /// real decline.
    #[test]
    fn a_technical_trait_survives_a_dip_but_not_a_decline() {
        let mut prime = attrs();
        prime.shooting = 87;
        let earned = compute_traits(&prime, &Position::Forward);
        assert!(earned.contains(&PlayerTrait::Sharpshooter));

        let mut dipped = prime.clone();
        dipped.shooting = 82;
        assert!(
            recompute_traits(&dipped, &Position::Forward, &earned)
                .contains(&PlayerTrait::Sharpshooter),
            "a five-point dip should not cost a striker his finishing"
        );

        let mut declined = prime.clone();
        declined.shooting = 70;
        assert!(
            !recompute_traits(&declined, &Position::Forward, &earned)
                .contains(&PlayerTrait::Sharpshooter)
        );
    }

    /// Retention only keeps what was already there. Nobody picks up a trait by
    /// getting close to it — the thresholds would be meaningless.
    #[test]
    fn nobody_earns_a_trait_by_nearly_qualifying() {
        let mut nearly = attrs();
        nearly.shooting = 82;
        nearly.vision = 82;
        let from_nothing = recompute_traits(&nearly, &Position::Forward, &[]);
        assert!(!from_nothing.contains(&PlayerTrait::Sharpshooter));
        assert!(!from_nothing.contains(&PlayerTrait::Visionary));
    }

    /// A player still at his peak keeps exactly what the thresholds say, so
    /// retention can never inflate a squad.
    #[test]
    fn retention_never_adds_to_what_the_attributes_earn() {
        let mut prime = attrs();
        prime.pace = 90;
        prime.vision = 90;
        prime.shooting = 90;
        let earned = compute_traits(&prime, &Position::Forward);
        let kept = recompute_traits(&prime, &Position::Forward, &earned);
        assert_eq!(earned, kept);
    }

    /// Every trait has to say how it behaves in decline, or a new one silently
    /// inherits whatever the fallback happens to be.
    #[test]
    fn every_trait_declares_how_it_ages() {
        for player_trait in ALL_TRAITS {
            // Wonderkid is not attribute-derived; it is awarded on age and
            // potential and expires on its own.
            if player_trait == PlayerTrait::Wonderkid {
                continue;
            }
            let _ = persistence(player_trait);
        }
    }
}
