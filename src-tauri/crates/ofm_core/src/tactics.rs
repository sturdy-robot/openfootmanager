use domain::player::Position;
use domain::team::{PlayerRole, Team, TeamTacticsDraft};
use std::collections::HashSet;

use crate::player_rating::formation_slots;

/// Return whether a role can be assigned to a granular formation position.
/// This is the backend source of truth shared by legacy migration and commands.
pub fn role_valid_for_position(role: &PlayerRole, position: &Position) -> bool {
    use PlayerRole as R;
    use Position as P;

    match position {
        P::Goalkeeper => matches!(role, R::Standard | R::BallPlayingKeeper | R::SweeperKeeper),
        P::CenterBack => matches!(
            role,
            R::Standard | R::Stopper | R::CoverCB | R::BallPlayingCB
        ),
        P::RightBack | P::LeftBack | P::RightWingBack | P::LeftWingBack => matches!(
            role,
            R::Standard | R::AttackingFB | R::DefensiveFB | R::InvertedFB | R::WingBack
        ),
        P::DefensiveMidfielder => matches!(
            role,
            R::Standard | R::AnchorMan | R::BallWinner | R::DeepLyingPlaymaker
        ),
        P::CentralMidfielder => {
            matches!(role, R::Standard | R::BoxToBox | R::Carrilero | R::Mezzala)
        }
        P::AttackingMidfielder => {
            matches!(role, R::Standard | R::AdvancedPlaymaker | R::ShadowStriker)
        }
        P::RightMidfielder | P::LeftMidfielder | P::RightWinger | P::LeftWinger => matches!(
            role,
            R::Standard | R::WideForward | R::InsideForward | R::InvertedWinger
        ),
        P::Striker => matches!(
            role,
            R::Standard
                | R::Poacher
                | R::TargetMan
                | R::DeepLyingForward
                | R::False9
                | R::PressingForward
                | R::CompleteForward
        ),
        P::Defender => matches!(
            role,
            R::Standard
                | R::Stopper
                | R::CoverCB
                | R::BallPlayingCB
                | R::AttackingFB
                | R::DefensiveFB
                | R::InvertedFB
                | R::WingBack
        ),
        P::Midfielder => matches!(
            role,
            R::Standard
                | R::AnchorMan
                | R::BallWinner
                | R::DeepLyingPlaymaker
                | R::BoxToBox
                | R::Carrilero
                | R::Mezzala
                | R::AdvancedPlaymaker
                | R::ShadowStriker
                | R::WideForward
                | R::InsideForward
                | R::InvertedWinger
        ),
        P::Forward => matches!(
            role,
            R::Standard
                | R::WideForward
                | R::InsideForward
                | R::InvertedWinger
                | R::Poacher
                | R::TargetMan
                | R::DeepLyingForward
                | R::False9
                | R::PressingForward
                | R::CompleteForward
        ),
    }
}

/// Normalize role storage to the current formation. Existing slot roles remain
/// at their indices when valid; incompatible and missing roles become Standard.
pub fn reconcile_slot_roles(team: &mut Team) {
    let slots = formation_slots(&team.formation);
    let previous = std::mem::take(&mut team.slot_roles);
    team.slot_roles = slots
        .iter()
        .enumerate()
        .map(|(index, position)| {
            previous
                .get(index)
                .filter(|role| role_valid_for_position(role, position))
                .cloned()
                .unwrap_or_default()
        })
        .collect();
}

/// Upgrade the legacy player-keyed role map to slot ownership. Invalid legacy
/// values are deliberately reset and the legacy map is cleared for next save.
pub fn migrate_legacy_player_roles(team: &mut Team) {
    if team.slot_roles.is_empty() && !team.player_roles.is_empty() {
        let slots = formation_slots(&team.formation);
        team.slot_roles = slots
            .iter()
            .enumerate()
            .map(|(index, position)| {
                team.starting_xi_ids
                    .get(index)
                    .and_then(|player_id| team.player_roles.get(player_id))
                    .filter(|role| role_valid_for_position(role, position))
                    .cloned()
                    .unwrap_or_default()
            })
            .collect();
    }
    reconcile_slot_roles(team);
    team.player_roles.clear();
}

/// Validate and apply a complete team draft without partially mutating `team`.
pub fn apply_team_tactics_draft(
    team: &mut Team,
    roster_ids: &HashSet<String>,
    draft: TeamTacticsDraft,
) -> Result<(), String> {
    let slots = formation_slots(&draft.formation);
    let formation_count = draft
        .formation
        .split('-')
        .map(str::parse::<usize>)
        .collect::<Result<Vec<_>, _>>()
        .map_err(|_| "be.error.invalidFormation".to_string())?;
    if formation_count.iter().sum::<usize>() != 10 || slots.len() != 11 {
        return Err("be.error.invalidFormation".to_string());
    }
    if draft.starting_xi_ids.len() != slots.len() {
        return Err("be.error.invalidStartingXi".to_string());
    }
    let unique_players = draft.starting_xi_ids.iter().collect::<HashSet<_>>();
    if unique_players.len() != draft.starting_xi_ids.len()
        || draft
            .starting_xi_ids
            .iter()
            .any(|player_id| !roster_ids.contains(player_id))
    {
        return Err("be.error.invalidStartingXi".to_string());
    }
    if draft.slot_roles.len() != slots.len()
        || draft
            .slot_roles
            .iter()
            .zip(&slots)
            .any(|(role, position)| !role_valid_for_position(role, position))
    {
        return Err("be.error.roleNotValidForPosition".to_string());
    }
    let assignments = [
        &draft.match_roles.captain,
        &draft.match_roles.vice_captain,
        &draft.match_roles.penalty_taker,
        &draft.match_roles.free_kick_taker,
        &draft.match_roles.corner_taker,
    ];
    if assignments
        .into_iter()
        .flatten()
        .any(|player_id| !unique_players.contains(player_id))
    {
        return Err("be.error.matchRolePlayerNotInStartingXi".to_string());
    }

    team.formation = draft.formation;
    team.play_style = draft.play_style;
    team.starting_xi_ids = draft.starting_xi_ids;
    team.slot_roles = draft.slot_roles;
    team.tactics_phase = draft.tactics_phase;
    team.match_roles = draft.match_roles;
    team.player_roles.clear();
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use domain::team::{MatchRoles, PlayStyle, TacticsPhaseSettings, TeamTacticsDraft};

    fn team() -> Team {
        Team::new(
            "team-1".into(),
            "Test FC".into(),
            "TST".into(),
            "England".into(),
            "London".into(),
            "Test Ground".into(),
            10_000,
        )
    }

    #[test]
    fn migrates_legacy_player_roles_to_starting_xi_slots() {
        let mut team = team();
        team.slot_roles.clear();
        team.starting_xi_ids = (0..11).map(|index| format!("p{index}")).collect();
        team.player_roles
            .insert("p0".into(), PlayerRole::SweeperKeeper);
        team.player_roles.insert("p9".into(), PlayerRole::Poacher);
        team.player_roles.insert("p1".into(), PlayerRole::Poacher);

        migrate_legacy_player_roles(&mut team);

        assert_eq!(team.slot_roles[0], PlayerRole::SweeperKeeper);
        assert_eq!(team.slot_roles[1], PlayerRole::Standard);
        assert_eq!(team.slot_roles[9], PlayerRole::Poacher);
        assert!(team.player_roles.is_empty());
    }

    fn complete_draft() -> TeamTacticsDraft {
        TeamTacticsDraft {
            formation: "4-4-2".into(),
            play_style: PlayStyle::Balanced,
            starting_xi_ids: (0..11).map(|index| format!("p{index}")).collect(),
            slot_roles: vec![PlayerRole::Standard; 11],
            tactics_phase: TacticsPhaseSettings::default(),
            match_roles: MatchRoles {
                captain: Some("p0".into()),
                penalty_taker: Some("p9".into()),
                ..MatchRoles::default()
            },
        }
    }

    #[test]
    fn applies_a_complete_team_draft_atomically() {
        let mut team = team();
        let roster_ids = (0..14).map(|index| format!("p{index}")).collect();
        let mut draft = complete_draft();
        draft.play_style = PlayStyle::Possession;
        draft.slot_roles[9] = PlayerRole::Poacher;

        apply_team_tactics_draft(&mut team, &roster_ids, draft).unwrap();

        assert_eq!(team.play_style, PlayStyle::Possession);
        assert_eq!(team.starting_xi_ids[9], "p9");
        assert_eq!(team.slot_roles[9], PlayerRole::Poacher);
        assert_eq!(team.match_roles.captain.as_deref(), Some("p0"));
    }

    #[test]
    fn invalid_assignment_leaves_the_team_unchanged() {
        let mut team = team();
        let original_formation = team.formation.clone();
        let original_style = team.play_style.clone();
        let original_xi = team.starting_xi_ids.clone();
        let roster_ids = (0..14).map(|index| format!("p{index}")).collect();
        let mut draft = complete_draft();
        draft.formation = "4-3-3".into();
        draft.play_style = PlayStyle::Attacking;
        draft.match_roles.captain = Some("bench-player".into());

        assert!(apply_team_tactics_draft(&mut team, &roster_ids, draft).is_err());
        assert_eq!(team.formation, original_formation);
        assert_eq!(team.play_style, original_style);
        assert_eq!(team.starting_xi_ids, original_xi);
    }
}
