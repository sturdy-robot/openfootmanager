//! How much the world's staff move, role by role, season by season: who joins a club, moves, is
//! released or leaves, how large the free-staff market runs, and how long clubs go without a role.
//!
//! Measurement only (the AI staff management plan's slice 1): it records today's behaviour as the
//! baseline the later slices are measured against. The world is compared with itself after every
//! day and after the rollover, so a change the end of season makes counts in the season it ends.

use std::collections::HashMap;

use domain::staff::{Staff, StaffRole};
use domain::team::Team;
use ofm_core::end_of_season::EndOfSeasonSummary;
use ofm_core::game::Game;

use crate::driver::SeasonObserver;

/// The four roles, in the order the reports list them.
pub const ROLES: [StaffRole; 4] = [
    StaffRole::Coach,
    StaffRole::Physio,
    StaffRole::Scout,
    StaffRole::AssistantManager,
];

/// What one role's staff did in one season.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct RoleChurn {
    /// Joined a club from the market, or appeared at a club without passing through it.
    pub hires: usize,
    /// Changed from one club to another.
    pub moves: usize,
    /// Left a club for the market.
    pub releases: usize,
    /// Left the world from a club (retired, or removed).
    pub club_exits: usize,
    /// Appeared on the market.
    pub market_entrants: usize,
    /// Left the world from the market.
    pub market_exits: usize,
    /// The market's size for this role at its smallest and largest after any day or the rollover.
    pub market_min: usize,
    pub market_max: usize,
    /// Days a club went without a member of this role, summed over clubs.
    pub vacant_club_days: usize,
}

/// Where a staff member was the last time the world was looked at.
#[derive(Debug, Clone)]
struct Seen {
    role: StaffRole,
    team_id: Option<String>,
}

fn role_index(role: &StaffRole) -> usize {
    ROLES
        .iter()
        .position(|candidate| candidate == role)
        .unwrap_or_default()
}

fn snapshot(staff: &[Staff]) -> HashMap<String, Seen> {
    staff
        .iter()
        .map(|member| {
            (
                member.id.clone(),
                Seen {
                    role: member.role.clone(),
                    team_id: member.team_id.clone(),
                },
            )
        })
        .collect()
}

/// Adds to `season` (one entry per role, in `ROLES` order) what changed between `before` and
/// `staff`, and the market's size now.
fn record_changes(season: &mut [RoleChurn; 4], before: &HashMap<String, Seen>, staff: &[Staff]) {
    for member in staff {
        let churn = &mut season[role_index(&member.role)];
        match (
            before.get(&member.id).map(|seen| &seen.team_id),
            &member.team_id,
        ) {
            (None, Some(_)) | (Some(None), Some(_)) => churn.hires += 1,
            (Some(Some(was)), Some(now)) if was != now => churn.moves += 1,
            (Some(Some(_)), None) => churn.releases += 1,
            (None, None) => churn.market_entrants += 1,
            _ => {}
        }
    }
    let now: HashMap<&str, ()> = staff
        .iter()
        .map(|member| (member.id.as_str(), ()))
        .collect();
    for (id, seen) in before {
        if now.contains_key(id.as_str()) {
            continue;
        }
        let churn = &mut season[role_index(&seen.role)];
        if seen.team_id.is_some() {
            churn.club_exits += 1;
        } else {
            churn.market_exits += 1;
        }
    }
    for role in &ROLES {
        let market = staff
            .iter()
            .filter(|member| &member.role == role && member.team_id.is_none())
            .count();
        let churn = &mut season[role_index(role)];
        churn.market_min = churn.market_min.min(market);
        churn.market_max = churn.market_max.max(market);
    }
}

/// Adds a day to `season` for every club missing a role.
fn record_vacancies(season: &mut [RoleChurn; 4], teams: &[Team], staff: &[Staff]) {
    for team in teams {
        for role in &ROLES {
            let staffed = staff
                .iter()
                .any(|member| &member.role == role && member.team_id.as_deref() == Some(&team.id));
            if !staffed {
                season[role_index(role)].vacant_club_days += 1;
            }
        }
    }
}

fn empty_season() -> [RoleChurn; 4] {
    std::array::from_fn(|_| RoleChurn {
        market_min: usize::MAX,
        ..RoleChurn::default()
    })
}

/// Each completed season's churn, in order, one entry per role in `ROLES` order.
pub struct StaffChurnLog {
    pub seasons: Vec<[RoleChurn; 4]>,
    current: [RoleChurn; 4],
    last_seen: Option<HashMap<String, Seen>>,
}

impl StaffChurnLog {
    /// A log whose first comparison is against `game` as it opens.
    pub fn starting_from(game: &Game) -> Self {
        Self {
            seasons: Vec::new(),
            current: empty_season(),
            last_seen: Some(snapshot(&game.staff)),
        }
    }

    fn look(&mut self, game: &Game) {
        if let Some(before) = &self.last_seen {
            record_changes(&mut self.current, before, &game.staff);
        }
        self.last_seen = Some(snapshot(&game.staff));
    }
}

impl SeasonObserver for StaffChurnLog {
    fn on_day_end(&mut self, game: &Game, _season: u32, _day: u32) {
        self.look(game);
        record_vacancies(&mut self.current, &game.teams, &game.staff);
    }

    fn on_season_end(&mut self, game: &Game, _summary: &EndOfSeasonSummary, _season: u32) {
        // The rollover's changes (its retirements, conversions and market top-up) belong to the
        // season that just ended.
        self.look(game);
        let mut finished = std::mem::replace(&mut self.current, empty_season());
        for role in &mut finished {
            if role.market_min == usize::MAX {
                role.market_min = 0;
            }
        }
        self.seasons.push(finished);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use domain::staff::StaffAttributes;

    fn member(id: &str, role: StaffRole, club: Option<&str>) -> Staff {
        let mut staff = Staff::new(
            id.to_string(),
            "First".to_string(),
            "Last".to_string(),
            "1980-01-01".to_string(),
            role,
            StaffAttributes {
                coaching: 60,
                judging_ability: 60,
                judging_potential: 60,
                physiotherapy: 60,
            },
        );
        staff.team_id = club.map(str::to_string);
        staff
    }

    fn coach(season: &[RoleChurn; 4]) -> &RoleChurn {
        &season[role_index(&StaffRole::Coach)]
    }

    /// Given coaches who are, the day before: one at club A, one at club B, one on the market, one
    ///       at club C and one on the market
    /// When, a day later, the first is still at A, the second has moved to A, the third has joined
    ///      B, the fourth is on the market, the fifth has left the world, and a new coach is on
    ///      the market and another new one at C
    /// Then the day counts one move, two hires, one release, one market exit and one market
    ///      entrant, and nothing for the coach who stayed.
    #[test]
    fn a_days_changes_are_counted_by_what_happened_to_each_member() {
        let before = snapshot(&[
            member("stays", StaffRole::Coach, Some("a")),
            member("moves", StaffRole::Coach, Some("b")),
            member("joins", StaffRole::Coach, None),
            member("released", StaffRole::Coach, Some("c")),
            member("leaves", StaffRole::Coach, None),
        ]);
        let now = [
            member("stays", StaffRole::Coach, Some("a")),
            member("moves", StaffRole::Coach, Some("a")),
            member("joins", StaffRole::Coach, Some("b")),
            member("released", StaffRole::Coach, None),
            member("new-free", StaffRole::Coach, None),
            member("new-at-club", StaffRole::Coach, Some("c")),
        ];
        let mut season = empty_season();

        record_changes(&mut season, &before, &now);

        let coaches = coach(&season);
        assert_eq!(coaches.moves, 1);
        assert_eq!(coaches.hires, 2);
        assert_eq!(coaches.releases, 1);
        assert_eq!(coaches.market_exits, 1);
        assert_eq!(coaches.market_entrants, 1);
        assert_eq!(coaches.club_exits, 0);
    }

    /// Given a physio at a club the day before
    /// When he is gone from the world a day later
    /// Then it counts as a physio leaving from a club, not from the market, and no coach moved.
    #[test]
    fn a_member_gone_from_a_club_is_a_club_exit_of_his_role() {
        let before = snapshot(&[member("retires", StaffRole::Physio, Some("a"))]);
        let mut season = empty_season();

        record_changes(&mut season, &before, &[]);

        assert_eq!(season[role_index(&StaffRole::Physio)].club_exits, 1);
        assert_eq!(
            coach(&season),
            &RoleChurn {
                market_min: 0,
                ..RoleChurn::default()
            }
        );
    }

    /// Given a market of three free scouts one day and one the next
    /// When both days are recorded
    /// Then the scouts' market ran from 1 to 3.
    #[test]
    fn the_market_size_is_kept_at_its_smallest_and_largest() {
        let three = [
            member("s1", StaffRole::Scout, None),
            member("s2", StaffRole::Scout, None),
            member("s3", StaffRole::Scout, None),
        ];
        let mut season = empty_season();

        record_changes(&mut season, &snapshot(&three), &three);
        record_changes(&mut season, &snapshot(&three), &three[..1]);

        let scouts = &season[role_index(&StaffRole::Scout)];
        assert_eq!((scouts.market_min, scouts.market_max), (1, 3));
    }

    /// Given two clubs, one with a coach and one without, and neither with a physio
    /// When a day's vacancies are recorded
    /// Then one club went a day without a coach and two without a physio.
    #[test]
    fn a_club_without_a_role_adds_a_vacant_day_for_that_role() {
        let with_coach = Team::new(
            "a".to_string(),
            "A".to_string(),
            "A".to_string(),
            "GB".to_string(),
            "City".to_string(),
            "Ground".to_string(),
            10_000,
        );
        let mut without = with_coach.clone();
        without.id = "b".to_string();
        let staff = [member("c", StaffRole::Coach, Some("a"))];
        let mut season = empty_season();

        record_vacancies(&mut season, &[with_coach, without], &staff);

        assert_eq!(coach(&season).vacant_club_days, 1);
        assert_eq!(season[role_index(&StaffRole::Physio)].vacant_club_days, 2);
    }
}
