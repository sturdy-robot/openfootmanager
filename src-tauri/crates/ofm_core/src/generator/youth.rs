//! Youngsters joining a club's academy: the one youth-recruit generator,
//! behind both a youth scout's prospects and the annual intake.

use super::*;
use domain::player::{Player, Position};
use domain::team::Team;

/// Generate a youth prospect who is joining **now**.
///
/// `current_year` is the year the recruit arrives, not the year the world opened:
/// a prospect scouted five seasons into a career is fifteen in *that* season. The
/// two coincide only for the opening intake, which is why the distinction is
/// worth naming — a call site that passed the world's opening year here would
/// quietly produce a squad of players five years too old.
pub fn generate_youth_academy_recruit(
    team: &Team,
    target_position: Option<&Position>,
    current_year: u32,
    rng: &mut impl rand::Rng,
) -> Player {
    generate_youth_academy_recruit_with_nationality(team, target_position, None, current_year, rng)
}

/// As [`generate_youth_academy_recruit`], with the prospect's nationality forced
/// rather than drawn from the club's country. See there for `current_year`.
pub fn generate_youth_academy_recruit_with_nationality(
    team: &Team,
    target_position: Option<&Position>,
    nationality_override: Option<&str>,
    current_year: u32,
    rng: &mut impl rand::Rng,
) -> Player {
    youth_recruit(
        team,
        target_position,
        nationality_override,
        current_year,
        None,
        rng,
    )
}

/// A youngster joining `team`'s academy in its annual intake: of `group`, aged
/// `age`, drawn from `rng`. The same recruit a youth scout finds, at the age a
/// club takes one in rather than the age it scouts one.
pub(crate) fn generate_youth_intake_recruit(
    team: &Team,
    group: &Position,
    age: u32,
    current_year: u32,
    rng: &mut impl rand::Rng,
) -> Player {
    youth_recruit(team, Some(group), None, current_year, Some(age), rng)
}

fn youth_recruit(
    team: &Team,
    target_position: Option<&Position>,
    nationality_override: Option<&str>,
    current_year: u32,
    age: Option<u32>,
    rng: &mut impl rand::Rng,
) -> Player {
    use domain::player::SquadRole;

    let names_def = default_names_definition();
    let country_codes = generation::nationality_distribution();
    let nationality = nationality_override
        .map(generation::canonicalize_generated_nationality)
        .unwrap_or_else(|| {
            // `team_local_nationality`, not `team.country`: a club carries both a
            // location and a football identity, and where they differ the
            // football identity is the one a youth intake should draw on.
            pick_nationality_from_def(team_local_nationality(team), country_codes, rng)
        });
    let youth_slots = youth_slots_for_target(target_position.map(Position::to_group_position));
    let slot_index = youth_slots[rng.random_range(0..youth_slots.len())];
    let mut player = generate_random_player_from_def(
        &team.id,
        slot_index,
        &nationality,
        current_year,
        PlayerRoll::for_academy(team.reputation, age),
        &names_def,
        rng,
    );
    player.squad_role = SquadRole::Youth;
    player.transfer_listed = false;
    player.loan_listed = false;
    // A specific position (LB, CM, ...) from the day he arrives: the upgrade used to run only on
    // a new game's squads and on load, so a signed prospect showed the generic group until a reload.
    crate::player_identity::upgrade_player_identity(&mut player, None);
    player
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand::SeedableRng;

    const RECRUITS: usize = 4_000;
    const AGE: u32 = 16;
    const YEAR: u32 = 2030;

    fn club(reputation: u32) -> Team {
        let mut team = Team::new(
            format!("club{reputation}"),
            format!("Club {reputation}"),
            "CLB".to_string(),
            "ENG".to_string(),
            "London".to_string(),
            "Ground".to_string(),
            20_000,
        );
        team.reputation = reputation;
        team
    }

    /// The ceilings of `RECRUITS` intake recruits of `team`, from a fixed seed.
    fn academy_ceilings(team: &Team, seed: u64) -> Vec<f64> {
        let mut rng = rand::rngs::StdRng::seed_from_u64(seed);
        (0..RECRUITS)
            .map(|_| {
                let recruit =
                    generate_youth_intake_recruit(team, &Position::Midfielder, AGE, YEAR, &mut rng);
                f64::from(recruit.potential)
            })
            .collect()
    }

    /// The same recruits rolled on the single world-wide bell, from the same seed: every
    /// academy's draws before academies had a standard.
    fn world_bell_ceilings(seed: u64) -> Vec<f64> {
        let mut rng = rand::rngs::StdRng::seed_from_u64(seed);
        let names = default_names_definition();
        let slot = youth_slots_for_target(Some(Position::Midfielder))[0];
        (0..RECRUITS)
            .map(|_| {
                let recruit = generate_random_player_from_def(
                    "club",
                    slot,
                    "ENG",
                    YEAR,
                    PlayerRoll::unscaled(Some(AGE)),
                    &names,
                    &mut rng,
                );
                f64::from(recruit.potential)
            })
            .collect()
    }

    fn mean(values: &[f64]) -> f64 {
        values.iter().sum::<f64>() / values.len() as f64
    }

    fn share_at_or_above(values: &[f64], ceiling: f64) -> f64 {
        values.iter().filter(|&&value| value >= ceiling).count() as f64 / values.len() as f64
    }

    /// Given a big club and a small one taking recruits from the same seeds
    /// When each takes its intake
    /// Then the big club's recruits have clearly higher ceilings: an academy draws on its club's
    ///      standing
    #[test]
    fn a_big_clubs_academy_recruits_higher_ceilings_than_a_small_clubs() {
        let big = mean(&academy_ceilings(&club(800), 1));
        let small = mean(&academy_ceilings(&club(200), 1));

        assert!(
            big - small > 2.0,
            "big club {big:.2} against small club {small:.2}"
        );
    }

    /// Given a club of average reputation
    /// When it takes its intake
    /// Then its recruits' ceilings average the world-wide bell's: no lift is added, so the
    ///      world's academies do not inflate its ratings season after season
    #[test]
    fn an_average_clubs_academy_recruits_on_the_world_bells_mean() {
        let average = mean(&academy_ceilings(&club(500), 2));
        let world = mean(&world_bell_ceilings(2));

        assert!(
            (average - world).abs() < 0.4,
            "average club {average:.2} against the world bell {world:.2}"
        );
    }

    /// Given clubs spread across the world's reputations
    /// When they all take their intake
    /// Then they produce S-tier ceilings at the world-wide bell's rate, give or take sampling: the
    ///      best prospects gather at the big clubs, but there are neither more nor fewer of them
    #[test]
    fn the_worlds_academies_produce_s_tier_ceilings_at_the_world_bells_rate() {
        let pooled: Vec<f64> = [275, 425, 500, 575, 725]
            .into_iter()
            .enumerate()
            .flat_map(|(index, reputation)| academy_ceilings(&club(reputation), 10 + index as u64))
            .collect();
        let world: Vec<f64> = (10..15).flat_map(world_bell_ceilings).collect();

        let academies = share_at_or_above(&pooled, 81.0);
        let bell = share_at_or_above(&world, 81.0);
        assert!(
            academies <= bell * 1.2 && academies >= bell * 0.8,
            "academies {academies:.4} against the world bell {bell:.4}"
        );
    }
}
