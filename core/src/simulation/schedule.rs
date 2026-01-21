use uuid::Uuid;

use crate::models::schedule::{Fixture, Round, Schedule};

pub fn double_round_robin(club_ids: &[Uuid]) -> Schedule {
    let mut teams: Vec<Uuid> = club_ids.to_vec();

    if teams.len() % 2 == 1 {
        teams.push(Uuid::nil());
    }

    let rounds_per_leg = (teams.len() - 1) as u8;
    let half = teams.len() / 2;

    let mut rounds = Vec::with_capacity((rounds_per_leg as usize) * 2);

    for leg in 1..=2 {
        let mut rotation = teams.clone();
        for round_index in 0..rounds_per_leg {
            let mut fixtures = Vec::with_capacity(half);
            let mut bye = None;

            for i in 0..half {
                let home = rotation[i];
                let away = rotation[rotation.len() - 1 - i];

                if home.is_nil() || away.is_nil() {
                    bye = Some(if home.is_nil() { away } else { home });
                    continue;
                }

                let (home_club, away_club) = if leg == 1 {
                    (home, away)
                } else {
                    (away, home)
                };

                fixtures.push(Fixture {
                    id: Uuid::new_v4(),
                    home_club_id: home_club,
                    away_club_id: away_club,
                });
            }

            let round_number = round_index + 1 + (rounds_per_leg * (leg - 1));
            rounds.push(Round {
                number: round_number,
                leg,
                fixtures,
                bye,
            });

            rotate_teams(&mut rotation);
        }
    }

    Schedule { rounds }
}

fn rotate_teams(teams: &mut [Uuid]) {
    if teams.len() <= 2 {
        return;
    }

    let last = teams[teams.len() - 1];
    for idx in (2..teams.len()).rev() {
        teams[idx] = teams[idx - 1];
    }
    teams[1] = last;
}

#[cfg(test)]
mod tests {
    use super::*;

    fn club_id(seed: u128) -> Uuid {
        Uuid::from_u128(seed)
    }

    #[test]
    fn schedule_handles_odd_club_counts() {
        let clubs = vec![club_id(1), club_id(2), club_id(3), club_id(4), club_id(5)];
        let schedule = double_round_robin(&clubs);

        assert_eq!(schedule.rounds.len(), (clubs.len() * 2) as usize);
        assert!(schedule.rounds.iter().any(|round| round.bye.is_some()));
    }

    #[test]
    fn schedule_mirrors_fixtures_between_legs() {
        let clubs = vec![club_id(1), club_id(2), club_id(3), club_id(4)];
        let schedule = double_round_robin(&clubs);
        let first_leg = &schedule.rounds[0];
        let second_leg = &schedule.rounds[clubs.len() - 1];

        assert_eq!(first_leg.fixtures.len(), second_leg.fixtures.len());
        let first_fixture = &first_leg.fixtures[0];
        let second_fixture = &second_leg.fixtures[0];

        assert_eq!(first_fixture.home_club_id, second_fixture.away_club_id);
        assert_eq!(first_fixture.away_club_id, second_fixture.home_club_id);
    }
}
