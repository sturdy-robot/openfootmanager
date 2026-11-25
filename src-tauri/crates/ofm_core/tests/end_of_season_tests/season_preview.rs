use super::*;

/// Eleven players for `club_id`, every attribute at `rating`, so the side it fields rates near it.
fn field_a_squad(game: &mut Game, club_id: &str, rating: u8) {
    let positions = [
        Position::Goalkeeper,
        Position::RightBack,
        Position::CenterBack,
        Position::CenterBack,
        Position::LeftBack,
        Position::CentralMidfielder,
        Position::CentralMidfielder,
        Position::CentralMidfielder,
        Position::Forward,
        Position::Forward,
        Position::Forward,
    ];
    for (index, position) in positions.into_iter().enumerate() {
        let id = format!("{club_id}-xi-{index}");
        let mut player = make_player(&id, &id, club_id, position);
        player.attributes = PlayerAttributes {
            pace: rating,
            stamina: rating,
            strength: rating,
            agility: rating,
            passing: rating,
            shooting: rating,
            tackling: rating,
            dribbling: rating,
            defending: rating,
            positioning: rating,
            vision: rating,
            decisions: rating,
            composure: rating,
            aggression: rating,
            teamwork: rating,
            leadership: rating,
            handling: rating,
            reflexes: rating,
            aerial: rating,
        };
        game.players.push(player);
    }
}

/// Given the first division as the next season has it, Test FC (the user's) and Third FC (promoted),
///       and a squad strong for one and weak for the other, both ways round
/// When the season rolls over
/// Then the preview's favourite is the stronger club both times, chosen by the game's team-strength
///      rule, so no draw can pass both arrangements.
#[test]
fn the_season_previews_favourite_is_the_strongest_club_in_the_division() {
    for (test_fc_rating, third_fc_rating, expected) in [(30, 90, "Third FC"), (90, 30, "Test FC")] {
        let mut game = make_two_division_game("team1");
        field_a_squad(&mut game, "team1", test_fc_rating);
        field_a_squad(&mut game, "team3", third_fc_rating);

        process_end_of_season(&mut game);

        let (_, listed, favourite, dark_horse) = season_preview(&game);
        assert_eq!(listed, ["Test FC", "Third FC"]);
        assert_eq!(
            favourite, expected,
            "ratings {test_fc_rating}/{third_fc_rating}"
        );
        assert_ne!(dark_horse, favourite);
    }
}

/// The season preview article the rollover published, with every param it carries.
fn season_preview_params(game: &Game) -> std::collections::HashMap<String, String> {
    game.news
        .iter()
        .find(|article| article.category == domain::news::NewsCategory::SeasonPreview)
        .expect("the rollover publishes a season preview")
        .i18n_params
        .clone()
}

/// Given a user whose club plays in the second division, a generated one with a name key
/// When the season rolls over
/// Then the preview names that division (its stored name, key, country and the renewed edition),
///      never a fixed "Premier Division": the preview text takes it as a parameter (#1226).
#[test]
fn the_season_preview_names_the_users_division_with_its_name_key() {
    let mut game = make_two_division_game("team4");
    game.competitions[1].name_key = Some("tournaments.competitions.secondDivision".to_string());

    process_end_of_season(&mut game);

    let renewed = ofm_core::end_of_season::club_league_table(&game, "team4")
        .expect("the user still has a division")
        .season;
    let params = season_preview_params(&game);
    assert_eq!(
        params.get("competition"),
        Some(&"ENG Second Division".to_string())
    );
    assert_eq!(
        params.get("competitionKey"),
        Some(&"tournaments.competitions.secondDivision".to_string())
    );
    assert_eq!(params.get("competitionCountry"), Some(&"ENG".to_string()));
    assert_eq!(params.get("competitionSeason"), Some(&renewed.to_string()));
}

/// Given a user whose division is a hand-made one with no name key
/// When the season rolls over
/// Then the preview carries only its stored name.
#[test]
fn the_season_preview_of_a_division_without_a_name_key_carries_only_its_name() {
    let mut game = make_two_division_game("team4");

    process_end_of_season(&mut game);

    let params = season_preview_params(&game);
    assert_eq!(
        params.get("competition"),
        Some(&"ENG Second Division".to_string())
    );
    assert!(!params.contains_key("competitionKey"));
}

/// Given a user whose club plays in a generated third-tier division that plays a split season
///       (a closing phase), under a tier-division name key
/// When the season rolls over
/// Then the preview carries the tier and the phase beside the key, country and edition, so the
///      frontend names it in the player's language with its Clausura suffix (#1226).
#[test]
fn the_season_preview_carries_the_divisions_tier_and_phase() {
    let mut game = make_two_division_game("team4");
    game.competitions[1].name = "ENG Division 3".to_string();
    game.competitions[1].name_key = Some("tournaments.competitions.tierDivision".to_string());
    game.competitions[1].calendar = Some(CalendarMetadata {
        season: domain::competition_calendar::SeasonCalendar {
            division: Some(domain::competition_calendar::DivisionIdentity {
                family_id: "eng-league".to_string(),
                tier: 3,
                phase: domain::competition_calendar::SeasonPhase::Closing,
            }),
            ..Default::default()
        },
        ..Default::default()
    });

    process_end_of_season(&mut game);

    let params = season_preview_params(&game);
    assert_eq!(params.get("competitionTier"), Some(&"3".to_string()));
    assert_eq!(params.get("competitionPhase"), Some(&"closing".to_string()));
}

/// Given an annual division with no calendar identity (a hand-made one), and a generated one whose
///       key is set but whose phase is annual
/// When the season rolls over
/// Then neither carries a phase, and the hand-made one carries no tier either.
#[test]
fn an_annual_or_hand_made_division_carries_no_phase() {
    let mut keyed = make_two_division_game("team4");
    keyed.competitions[1].name_key = Some("tournaments.competitions.secondDivision".to_string());
    keyed.competitions[1].calendar = Some(CalendarMetadata {
        season: domain::competition_calendar::SeasonCalendar {
            division: Some(domain::competition_calendar::DivisionIdentity {
                family_id: "eng-league".to_string(),
                tier: 2,
                phase: domain::competition_calendar::SeasonPhase::Annual,
            }),
            ..Default::default()
        },
        ..Default::default()
    });
    process_end_of_season(&mut keyed);
    let mut hand_made = make_two_division_game("team4");
    process_end_of_season(&mut hand_made);

    let keyed_params = season_preview_params(&keyed);
    let hand_made_params = season_preview_params(&hand_made);

    assert_eq!(keyed_params.get("competitionTier"), Some(&"2".to_string()));
    assert!(!keyed_params.contains_key("competitionPhase"));
    assert!(!hand_made_params.contains_key("competitionTier"));
    assert!(!hand_made_params.contains_key("competitionPhase"));
}
