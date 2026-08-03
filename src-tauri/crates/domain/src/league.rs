use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub enum CompetitionType {
    #[default]
    League,
    Cup,
    ContinentalClub,
    InternationalClub,
    InternationalNation,
    FriendlyCup,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub enum CompetitionScope {
    #[default]
    Domestic,
    Regional,
    Continental,
    International,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub enum CompetitionFormat {
    #[default]
    LeagueTable,
    Knockout,
    GroupAndKnockout,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(default)]
pub struct CompetitionRules {
    pub format: CompetitionFormat,
    pub counts_in_season_flow: bool,
    /// Group-and-knockout only: clubs advancing from each group.
    pub group_qualifiers_per_group: u32,
    /// Group-and-knockout only: additional best next-placed finishers across
    /// all groups that also advance (the 2026 World Cup's "best thirds").
    pub group_best_third_qualifiers: u32,
    /// Round-robin legs played inside each group.
    pub group_stage_legs: u8,
    /// Days between group-stage matchdays.
    pub group_matchday_gap_days: u32,
    /// Days between knockout rounds.
    pub knockout_round_gap_days: u32,
    /// Maximum fixtures scheduled on the same day within a single knockout round.
    /// Defaults to 1 (each match on its own day). Set higher for large tournaments
    /// like the World Cup where multiple matches happen on the same day.
    #[serde(default = "default_knockout_matches_per_day")]
    pub knockout_matches_per_day: u32,
}

fn default_knockout_matches_per_day() -> u32 { 1 }

impl Default for CompetitionRules {
    fn default() -> Self {
        Self {
            format: CompetitionFormat::LeagueTable,
            counts_in_season_flow: true,
            group_qualifiers_per_group: 2,
            group_best_third_qualifiers: 0,
            group_stage_legs: 2,
            group_matchday_gap_days: 7,
            knockout_round_gap_days: 14,
            knockout_matches_per_day: 1,
        }
    }
}

/// One group of a group-and-knockout competition: a mini league table whose
/// top finishers advance to the knockout rounds.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct GroupState {
    pub id: String,
    /// Short label ("A", "B", …); the UI renders it as "Group A".
    pub name: String,
    pub team_ids: Vec<String>,
    pub standings: Vec<StandingEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(default)]
pub struct KnockoutRoundState {
    pub id: String,
    pub name: String,
    pub fixture_ids: Vec<String>,
    /// Teams that advance from this round without playing (byes), used when the
    /// entrant count is not a power of two.
    pub bye_team_ids: Vec<String>,
    pub completed: bool,
}

/// One qualification berth a competition awards into another, based on this
/// season's results (e.g. "league finishers 1–4 enter the Champions Cup").
/// Authored on competition definitions; carried on the runtime competition so
/// it can be evaluated at season rollover.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Berth {
    /// Competition id the qualifying club(s) enter.
    pub target: String,
    /// How the qualifying club(s) are chosen from this competition's results.
    pub rule: BerthRule,
    /// Optional cascade: when a chosen club has already taken a higher-priority
    /// berth, its place passes to this competition instead (e.g. cup winner
    /// already in the Champions Cup → their cup berth drops to the Europa Cup).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fallback_to: Option<String>,
}

/// How a [`Berth`] selects qualifying clubs from the source competition.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum BerthRule {
    /// League finishers in the inclusive 1-based range `[from, to]`.
    PositionRange { from: u32, to: u32 },
    /// The winner of this (knockout/group-and-knockout) competition.
    CupWinner,
    /// The winner of a playoff contested by league finishers in the inclusive
    /// 1-based range `[from, to]`.
    PlayoffWinner { from: u32, to: u32 },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct League {
    pub id: String,
    pub name: String,
    pub kind: CompetitionType,
    pub scope: CompetitionScope,
    pub season: u32,
    pub region_id: Option<String>,
    pub country_id: Option<String>,
    #[serde(default)]
    pub required_region_ids: Vec<String>,
    pub participant_ids: Vec<String>,
    pub rules: CompetitionRules,
    pub fixtures: Vec<Fixture>,
    pub standings: Vec<StandingEntry>,
    #[serde(default)]
    pub groups: Vec<GroupState>,
    pub knockout_rounds: Vec<KnockoutRoundState>,
    #[serde(default)]
    pub transfer_log: Vec<CompletedTransfer>,
    #[serde(default)]
    pub transfer_rumours: Vec<TransferRumour>,
    #[serde(default)]
    pub priority: u32,
    /// Qualification berths this competition awards, evaluated at rollover.
    #[serde(default)]
    pub berths: Vec<Berth>,
    /// Calendar month the season starts (1–12). Stored so rollover can compute
    /// the correct next-season start date without re-reading the definition.
    #[serde(default = "default_season_start_month")]
    pub season_start_month: u8,
    /// Day of month the season starts (1–31).
    #[serde(default = "default_season_start_day")]
    pub season_start_day: u8,
    /// Optional i18n key for the competition name. When set, the frontend
    /// translates via `t(name_key, { year })` instead of displaying `name` raw.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name_key: Option<String>,
}

fn default_season_start_month() -> u8 {
    8
}
fn default_season_start_day() -> u8 {
    1
}

impl Default for League {
    fn default() -> Self {
        Self {
            id: String::new(),
            name: String::new(),
            kind: CompetitionType::League,
            scope: CompetitionScope::Domestic,
            season: 0,
            region_id: None,
            country_id: None,
            required_region_ids: Vec::new(),
            participant_ids: Vec::new(),
            rules: CompetitionRules::default(),
            fixtures: Vec::new(),
            standings: Vec::new(),
            groups: Vec::new(),
            knockout_rounds: Vec::new(),
            transfer_log: Vec::new(),
            transfer_rumours: Vec::new(),
            priority: 0,
            berths: Vec::new(),
            season_start_month: default_season_start_month(),
            season_start_day: default_season_start_day(),
            name_key: None,
        }
    }
}

pub type CompetitionState = League;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CompletedTransfer {
    pub date: String,
    pub from_team_id: String,
    pub to_team_id: String,
    pub player_id: String,
    pub fee: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TransferRumour {
    pub id: String,
    pub date: String,
    pub player_id: String,
    pub player_name: String,
    pub team_id: String,
    pub team_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub enum FixtureCompetition {
    #[default]
    League,
    Cup,
    ContinentalClub,
    InternationalClub,
    InternationalNation,
    Friendly,
    FriendlyCup,
    PreseasonTournament,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Fixture {
    pub id: String,
    pub competition_id: String,
    pub matchday: u32,
    pub date: String, // ISO 8601 date
    pub home_team_id: String,
    pub away_team_id: String,
    pub competition: FixtureCompetition,
    pub status: FixtureStatus,
    pub result: Option<MatchResult>,
    /// Random seed for this fixture's simulation, so the match can be
    /// reproduced exactly. Zero means "never assigned" — saves written before
    /// seeds existed deserialize this way, and callers fall back to
    /// [`Fixture::simulation_seed`], which derives a stable seed from the
    /// fixture id rather than requiring a data migration.
    pub seed: u64,
    /// The engine behaviour version that produced this fixture's result.
    /// A stored replay can only be re-simulated by an engine reporting the
    /// same version; on a mismatch the match is still readable from
    /// [`MatchResult`], it just cannot be watched back.
    pub engine_version: u32,
    /// Inputs needed to re-simulate this match for replay.
    ///
    /// Only recorded for matches the user actually played, because only human
    /// decisions are true inputs — AI decisions are drawn from the match RNG
    /// and so are reproduced by the seed alone.
    pub replay: Option<ReplayInput>,
}

impl Fixture {
    /// The seed to simulate this fixture with.
    ///
    /// Falls back to a value derived from the fixture id when no seed was
    /// stored, so fixtures from older saves still simulate reproducibly.
    pub fn simulation_seed(&self) -> u64 {
        if self.seed != 0 {
            return self.seed;
        }
        derive_seed(&self.id)
    }
}

/// A stable 64-bit hash of `input` (FNV-1a).
///
/// Deliberately hand-rolled rather than using `DefaultHasher`, whose output is
/// explicitly not guaranteed to be stable across Rust releases. A seed that has
/// to reproduce the same match years from now cannot depend on that.
pub fn derive_seed(input: &str) -> u64 {
    const OFFSET_BASIS: u64 = 0xcbf2_9ce4_8422_2325;
    const PRIME: u64 = 0x0000_0100_0000_01b3;

    let mut hash = OFFSET_BASIS;
    for byte in input.as_bytes() {
        hash ^= *byte as u64;
        hash = hash.wrapping_mul(PRIME);
    }
    // Zero is the "unassigned" sentinel, so never return it.
    if hash == 0 { OFFSET_BASIS } else { hash }
}

/// Everything needed to replay a match by re-simulating it.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct ReplayInput {
    pub home: ReplayLineup,
    pub away: ReplayLineup,
    /// User commands in the order they were applied.
    pub commands: Vec<ReplayCommand>,
}

/// One side as it lined up at kick-off.
///
/// Stored rather than re-derived, because squad condition, injuries and
/// personnel all change over a season — a later save cannot reconstruct who
/// actually started, or how fresh they were.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct ReplayLineup {
    pub formation: String,
    pub starting_xi_ids: Vec<String>,
    pub bench_ids: Vec<String>,
    /// Player id → role, for players whose role was not the default.
    pub player_roles: Vec<(String, crate::team::PlayerRole)>,
    pub tactics: crate::team::TacticsPhaseSettings,
    /// Player id → condition at kick-off (0–100).
    pub conditions: Vec<(String, u8)>,
}

/// A user command, tagged with when it was applied.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReplayCommand {
    pub minute: u8,
    pub command: ReplayCommandKind,
}

/// The user-issuable subset of the engine's match commands.
///
/// Mirrored in `domain` rather than reused from `engine`, for the same reason
/// [`crate::team::PlayerRole`] is: `domain` sits below `engine` and must not
/// depend on it.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ReplayCommandKind {
    Substitute {
        home: bool,
        player_off_id: String,
        player_on_id: String,
    },
    PreMatchSwap {
        home: bool,
        player_off_id: String,
        player_on_id: String,
    },
    ChangeFormation {
        home: bool,
        formation: String,
    },
    ChangePlayStyle {
        home: bool,
        play_style: crate::team::PlayStyle,
    },
    ChangePlayerRole {
        home: bool,
        player_id: String,
        role: crate::team::PlayerRole,
    },
    SetFreeKickTaker {
        home: bool,
        player_id: String,
    },
    SetCornerTaker {
        home: bool,
        player_id: String,
    },
    SetPenaltyTaker {
        home: bool,
        player_id: String,
    },
    SetCaptain {
        home: bool,
        player_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum FixtureStatus {
    Scheduled,
    InProgress,
    Completed,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct MatchResult {
    pub home_goals: u8,
    pub away_goals: u8,
    pub home_scorers: Vec<GoalEvent>,
    pub away_scorers: Vec<GoalEvent>,
    #[serde(default)]
    pub report: Option<CompactMatchReport>,
    /// Penalty-shootout score when a knockout tie is level after extra time.
    /// `None` for matches that never went to a shootout (the default). When set,
    /// it — not the regulation goals — decides who advances.
    #[serde(default)]
    pub home_penalties: Option<u8>,
    #[serde(default)]
    pub away_penalties: Option<u8>,
}

impl MatchResult {
    /// Whether the home side advances from a knockout tie: the penalty
    /// shootout decides it when the tie went to one, otherwise the goals do
    /// (a level result with no shootout still favours home, as before).
    pub fn advancing_is_home(&self) -> bool {
        match (self.home_penalties, self.away_penalties) {
            // A shootout only decides a tie that was level after regulation (and
            // extra time). Guarding on equal goals keeps a malformed or
            // mis-deserialized result — penalties set on a non-level score — from
            // flipping the rightful winner.
            (Some(home), Some(away)) if self.home_goals == self.away_goals => home >= away,
            _ => self.home_goals >= self.away_goals,
        }
    }
}

#[cfg(test)]
mod fixture_seed_tests {
    use super::{Fixture, derive_seed};

    fn fixture(id: &str, seed: u64) -> Fixture {
        Fixture {
            id: id.to_string(),
            seed,
            ..Default::default()
        }
    }

    #[test]
    fn a_stored_seed_is_used_verbatim() {
        assert_eq!(fixture("abc", 42).simulation_seed(), 42);
    }

    #[test]
    fn a_missing_seed_falls_back_to_a_stable_value_derived_from_the_id() {
        // Saves written before seeds existed deserialize with `seed: 0`. They
        // must still simulate reproducibly, without a data migration.
        let legacy = fixture("fixture-abc", 0);
        assert_eq!(legacy.simulation_seed(), legacy.simulation_seed());
        assert_eq!(legacy.simulation_seed(), derive_seed("fixture-abc"));
    }

    #[test]
    fn different_fixtures_get_different_seeds() {
        assert_ne!(
            fixture("fixture-a", 0).simulation_seed(),
            fixture("fixture-b", 0).simulation_seed()
        );
    }

    #[test]
    fn derived_seeds_are_never_the_unassigned_sentinel() {
        // Zero means "no seed stored", so deriving it would loop back into the
        // fallback every time.
        for id in ["", "a", "fixture-1", "0", "\u{1f600}"] {
            assert_ne!(derive_seed(id), 0, "derive_seed({id:?}) returned 0");
        }
    }

    /// Pins the hash so stored seeds keep meaning the same thing.
    ///
    /// `derive_seed` is a hand-rolled FNV-1a precisely because
    /// `DefaultHasher` is not guaranteed stable across Rust releases, and a
    /// seed has to reproduce the same match years from now. If this test
    /// fails, the algorithm changed and every legacy fixture would replay a
    /// different match.
    #[test]
    fn derive_seed_is_pinned() {
        assert_eq!(derive_seed("fixture-1"), 0x6f1e_f43d_b638_8654);
    }
}

#[cfg(test)]
mod match_result_tests {
    use super::MatchResult;

    fn result(home: u8, away: u8, pens: Option<(u8, u8)>) -> MatchResult {
        MatchResult {
            home_goals: home,
            away_goals: away,
            home_penalties: pens.map(|(h, _)| h),
            away_penalties: pens.map(|(_, a)| a),
            ..Default::default()
        }
    }

    #[test]
    fn shootout_decides_a_level_knockout_not_the_home_side() {
        // 1-1, away wins the shootout 4-2 → away advances, not home.
        assert!(!result(1, 1, Some((2, 4))).advancing_is_home());
        // 1-1, home wins the shootout → home advances.
        assert!(result(1, 1, Some((5, 4))).advancing_is_home());
        // Decisive in regulation: goals decide, shootout untouched.
        assert!(result(2, 1, None).advancing_is_home());
        assert!(!result(0, 2, None).advancing_is_home());
    }

    #[test]
    fn penalties_only_decide_a_level_score() {
        // Malformed data: penalties present on a decisive 2-1. The goals must
        // win — the (lower) penalty tally cannot flip the rightful winner.
        assert!(result(2, 1, Some((1, 5))).advancing_is_home());
        assert!(!result(1, 2, Some((5, 1))).advancing_is_home());
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoalEvent {
    pub player_id: String,
    pub minute: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CompactMatchReport {
    pub total_minutes: u8,
    pub home_stats: CompactTeamMatchStats,
    pub away_stats: CompactTeamMatchStats,
    pub events: Vec<CompactMatchEvent>,
    /// Who was on top, minute by minute — positive when the home side was.
    ///
    /// Kept in the saved record so a match can be read back long after it was
    /// played. One entry per minute in which anybody threatened, which is a
    /// few dozen numbers, not a per-minute array padded with zeroes.
    #[serde(default)]
    pub momentum: Vec<CompactMinuteMomentum>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub struct CompactMinuteMomentum {
    pub minute: u8,
    pub home: f32,
    pub away: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CompactTeamMatchStats {
    pub possession_pct: u8,
    pub shots: u16,
    pub shots_on_target: u16,
    pub fouls: u16,
    pub corners: u16,
    pub yellow_cards: u8,
    pub red_cards: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CompactMatchEvent {
    pub minute: u8,
    pub event_type: String,
    pub side: String,
    pub player_id: Option<String>,
    pub secondary_player_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StandingEntry {
    pub team_id: String,
    pub played: u32,
    pub won: u32,
    pub drawn: u32,
    pub lost: u32,
    pub goals_for: u32,
    pub goals_against: u32,
    pub points: u32,
}

impl StandingEntry {
    pub fn new(team_id: String) -> Self {
        Self {
            team_id,
            played: 0,
            won: 0,
            drawn: 0,
            lost: 0,
            goals_for: 0,
            goals_against: 0,
            points: 0,
        }
    }

    pub fn goal_difference(&self) -> i32 {
        self.goals_for as i32 - self.goals_against as i32
    }

    pub fn record_result(&mut self, goals_for: u8, goals_against: u8) {
        self.played += 1;
        self.goals_for += goals_for as u32;
        self.goals_against += goals_against as u32;
        if goals_for > goals_against {
            self.won += 1;
            self.points += 3;
        } else if goals_for == goals_against {
            self.drawn += 1;
            self.points += 1;
        } else {
            self.lost += 1;
        }
    }
}

impl Fixture {
    pub fn counts_for_league_standings(&self) -> bool {
        matches!(self.competition, FixtureCompetition::League)
    }

    /// The team advancing from this knockout fixture once a result is
    /// recorded: the winner on goals, or on penalties after a drawn tie.
    pub fn advancing_team_id(&self) -> Option<&str> {
        let result = self.result.as_ref()?;
        Some(if result.advancing_is_home() {
            self.home_team_id.as_str()
        } else {
            self.away_team_id.as_str()
        })
    }

    pub fn generates_match_report_news(&self) -> bool {
        matches!(
            self.competition,
            FixtureCompetition::League
                | FixtureCompetition::Cup
                | FixtureCompetition::ContinentalClub
                | FixtureCompetition::InternationalClub
                | FixtureCompetition::InternationalNation
                | FixtureCompetition::Friendly
                | FixtureCompetition::FriendlyCup
                | FixtureCompetition::PreseasonTournament
        )
    }
}

impl League {
    pub fn new(id: String, name: String, season: u32, team_ids: &[String]) -> Self {
        let standings = team_ids
            .iter()
            .map(|tid| StandingEntry::new(tid.clone()))
            .collect();

        Self {
            id,
            name,
            kind: CompetitionType::League,
            scope: CompetitionScope::Domestic,
            season,
            region_id: None,
            country_id: None,
            required_region_ids: Vec::new(),
            participant_ids: team_ids.to_vec(),
            rules: CompetitionRules::default(),
            fixtures: Vec::new(),
            standings,
            groups: Vec::new(),
            knockout_rounds: Vec::new(),
            transfer_log: Vec::new(),
            transfer_rumours: Vec::new(),
            priority: 0,
            berths: Vec::new(),
            season_start_month: default_season_start_month(),
            season_start_day: default_season_start_day(),
            name_key: None,
        }
    }

    /// Whether `fixture_id` belongs to one of this competition's knockout
    /// rounds — a tie that must produce a winner. Knockout pairings are
    /// single-leg (the schedule generator never creates two-legged ties).
    pub fn is_knockout_fixture(&self, fixture_id: &str) -> bool {
        self.knockout_rounds
            .iter()
            .any(|round| round.fixture_ids.iter().any(|id| id == fixture_id))
    }

    pub fn sorted_standings(&self) -> Vec<StandingEntry> {
        let mut sorted = self.standings.clone();
        sorted.sort_by(|a, b| {
            b.points
                .cmp(&a.points)
                .then(b.goal_difference().cmp(&a.goal_difference()))
                .then(b.goals_for.cmp(&a.goals_for))
        });
        sorted
    }
}

impl Default for Fixture {
    fn default() -> Self {
        Self {
            id: String::new(),
            competition_id: String::new(),
            matchday: 0,
            date: String::new(),
            home_team_id: String::new(),
            away_team_id: String::new(),
            competition: FixtureCompetition::League,
            status: FixtureStatus::Scheduled,
            result: None,
            seed: 0,
            engine_version: 0,
            replay: None,
        }
    }
}
