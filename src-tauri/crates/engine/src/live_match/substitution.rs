use crate::event::{EventType, MatchEvent};
use crate::types::{Position, Side, Zone};

use super::{LiveMatchState, SubstitutionRecord};

// ---------------------------------------------------------------------------
// Substitution mechanics
// ---------------------------------------------------------------------------

impl LiveMatchState {
    pub(super) fn do_substitution(
        &mut self,
        side: Side,
        player_off_id: &str,
        player_on_id: &str,
    ) -> Result<(), String> {
        let subs_made = match side {
            Side::Home => &mut self.home_subs_made,
            Side::Away => &mut self.away_subs_made,
        };

        if *subs_made >= self.max_subs {
            return Err("be.error.liveMatch.maxSubstitutionsReached".into());
        }

        // Cannot substitute a player who has been sent off
        if self.sent_off.contains(player_off_id) {
            return Err("be.error.liveMatch.cannotSubstituteSentOffPlayer".into());
        }

        let team = self.team_mut(side);
        let off_idx = team
            .players
            .iter()
            .position(|p| p.id == player_off_id)
            .ok_or("be.error.liveMatch.playerNotOnPitch")?;

        // Cannot bring on a player who was already substituted off
        let already_subbed_off: std::collections::HashSet<&str> = self
            .substitutions
            .iter()
            .map(|s| s.player_off_id.as_str())
            .collect();
        if already_subbed_off.contains(player_on_id) {
            return Err("be.error.liveMatch.playerAlreadySubstitutedOff".into());
        }

        let bench = match side {
            Side::Home => &mut self.home_bench,
            Side::Away => &mut self.away_bench,
        };
        let on_idx = bench
            .iter()
            .position(|p| p.id == player_on_id)
            .ok_or("be.error.liveMatch.playerNotOnBench")?;

        let mut player_on = bench.remove(on_idx);
        let player_off = self.team_mut(side).players.remove(off_idx);

        // The XI is slot-aligned (entry i plays formation slot i), so the sub
        // takes over the vacated slot: same index, and the slot's position —
        // players are simulated where they actually play, not where they'd
        // naturally play.
        player_on.position = player_off.position;

        // The substitute takes over the vacated index outright — his id, his
        // traits and his fresh legs all replace the man who went off. What the
        // departing player did has to be banked under his own name first, or it
        // would be credited to the man who replaced him.
        let departing = self.cache(side).id(off_idx);
        self.metrics_mut(side).retire(off_idx, departing);
        self.cache_mut(side).replace(off_idx, &player_on);
        let work_rates = self.cache(side).work_rates();
        self.metrics_mut(side).set_work_rate(work_rates);
        self.team_mut(side).players.insert(off_idx, player_on);

        // Move subbed-off player to bench (they can't come back, but we keep them)
        match side {
            Side::Home => self.home_bench.push(player_off),
            Side::Away => self.away_bench.push(player_off),
        }

        *match side {
            Side::Home => &mut self.home_subs_made,
            Side::Away => &mut self.away_subs_made,
        } += 1;

        // Record the substitution
        let evt = MatchEvent::new(
            self.current_minute,
            EventType::Substitution,
            side,
            Zone::Midfield,
        )
        .with_player(player_on_id)
        .with_secondary(player_off_id);
        self.events.push(evt);

        self.substitutions.push(SubstitutionRecord {
            minute: self.current_minute,
            side,
            player_off_id: player_off_id.to_string(),
            player_on_id: player_on_id.to_string(),
        });

        Ok(())
    }

    /// Pre-match swap: exchange a starting player with a bench player without
    /// counting as a substitution. Only valid during PreKickOff phase.
    pub(super) fn do_pre_match_swap(
        &mut self,
        side: Side,
        player_off_id: &str,
        player_on_id: &str,
    ) -> Result<(), String> {
        let team = self.team_mut(side);
        let off_idx = team
            .players
            .iter()
            .position(|p| p.id == player_off_id)
            .ok_or("be.error.liveMatch.playerNotInStartingXi")?;

        let bench = match side {
            Side::Home => &mut self.home_bench,
            Side::Away => &mut self.away_bench,
        };
        let on_idx = bench
            .iter()
            .position(|p| p.id == player_on_id)
            .ok_or("be.error.liveMatch.playerNotOnBench")?;

        let mut player_on = bench.remove(on_idx);
        let player_off = self.team_mut(side).players.remove(off_idx);

        // The XI is slot-aligned (entry i plays formation slot i). Removing the
        // outgoing player and pushing the incoming one to the END shifted every
        // later starter into a different slot and dropped the newcomer into the
        // last one — the lineup visibly "reorganized" after a swap. Keep the
        // vacated index and adopt the slot's position instead.
        player_on.position = player_off.position;

        // The substitute takes over the vacated index outright — his id, his
        // traits and his fresh legs all replace the man who went off. What the
        // departing player did has to be banked under his own name first, or it
        // would be credited to the man who replaced him.
        let departing = self.cache(side).id(off_idx);
        self.metrics_mut(side).retire(off_idx, departing);
        self.cache_mut(side).replace(off_idx, &player_on);
        let work_rates = self.cache(side).work_rates();
        self.metrics_mut(side).set_work_rate(work_rates);
        self.team_mut(side).players.insert(off_idx, player_on);

        // Move swapped-out player to bench
        match side {
            Side::Home => self.home_bench.push(player_off),
            Side::Away => self.away_bench.push(player_off),
        }

        Ok(())
    }

    // -----------------------------------------------------------------------
    // Formation mechanics
    // -----------------------------------------------------------------------

    /// Parse a formation string like "4-4-2" into (defenders, midfielders, forwards).
    pub(super) fn parse_formation(formation: &str) -> (usize, usize, usize) {
        let parts: Vec<usize> = formation
            .split('-')
            .filter_map(|s| s.parse().ok())
            .collect();
        match parts.len() {
            3 => (parts[0], parts[1], parts[2]),
            4 => (parts[0], parts[1] + parts[2], parts[3]), // e.g. 4-2-3-1
            _ => (4, 4, 2),                                 // fallback
        }
    }

    /// Apply a formation change: update the formation string and redistribute
    /// outfield player positions to match the new shape.
    pub(super) fn apply_formation(&mut self, side: Side, formation: &str) {
        let (num_def, num_mid, num_fwd) = Self::parse_formation(formation);
        let team = self.team_mut(side);
        team.formation = formation.to_string();

        // Collect outfield players (skip GK) sorted by defensive-ness
        // (defenders first, then midfielders, then forwards) using a simple
        // heuristic: defending+tackling vs shooting+dribbling
        let mut outfield_indices: Vec<usize> = team
            .players
            .iter()
            .enumerate()
            .filter(|(_, p)| p.position != Position::Goalkeeper)
            .map(|(i, _)| i)
            .collect();

        // Sort by defensive score descending (most defensive first)
        outfield_indices.sort_by(|&a, &b| {
            let pa = &team.players[a];
            let pb = &team.players[b];
            let def_a = (pa.defending as u16 + pa.tackling as u16 + pa.strength as u16) as f64;
            let def_b = (pb.defending as u16 + pb.tackling as u16 + pb.strength as u16) as f64;
            def_b
                .partial_cmp(&def_a)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        // Assign positions: first num_def → Defender, next num_mid → Midfielder, rest → Forward
        for (slot, &idx) in outfield_indices.iter().enumerate() {
            let new_pos = if slot < num_def {
                Position::Defender
            } else if slot < num_def + num_mid {
                Position::Midfielder
            } else if slot < num_def + num_mid + num_fwd {
                Position::Forward
            } else {
                // Extra players (e.g. if team has <11 due to red cards) keep current
                continue;
            };
            team.players[idx].position = new_pos;
        }

        // Everyone is still on the pitch and every index is still valid, but
        // half the squad now plays somewhere else — which is exactly the case
        // where the cached placements would otherwise stay quietly wrong for
        // the rest of the match.
        let players = std::mem::take(&mut self.team_mut(side).players);
        self.cache_mut(side).refresh_placements(&players);
        self.team_mut(side).players = players;
        let work_rates = self.cache(side).work_rates();
        self.metrics_mut(side).set_work_rate(work_rates);
    }
}

#[cfg(test)]
mod tests {
    use crate::live_match::LiveMatchState;
    use crate::live_match::helpers::Need;
    use crate::sim::state::Band;
    use crate::types::{
        MatchConfig, PlayStyle, PlayerData, PlayerRole, Position, Side, TacticsConfig, TeamData,
    };

    fn player(id: &str, position: Position, defending: u8) -> PlayerData {
        PlayerData {
            id: id.to_string(),
            name: id.to_string(),
            position,
            ovr: 70,
            condition: 90,
            fitness: 80,
            pace: 70,
            stamina: 70,
            strength: 70,
            agility: 70,
            passing: 70,
            shooting: 70,
            tackling: defending,
            dribbling: 70,
            defending,
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
            traits: vec![],
            slot: None,
            role: PlayerRole::Standard,
        }
    }

    /// An eleven whose outfielders differ only in how defensive they are, so a
    /// formation change is guaranteed to move somebody.
    fn eleven(prefix: &str) -> TeamData {
        let mut players = vec![player(&format!("{prefix}_gk"), Position::Goalkeeper, 40)];
        for i in 0..10 {
            // Descending defensive score, so the sort inside `apply_formation`
            // is stable and predictable.
            players.push(player(
                &format!("{prefix}_o{i}"),
                Position::Midfielder,
                90 - i * 5,
            ));
        }
        TeamData {
            id: prefix.to_string(),
            name: prefix.to_string(),
            formation: "4-4-2".to_string(),
            play_style: PlayStyle::Balanced,
            players,
            tactics: TacticsConfig::default(),
        }
    }

    fn state() -> LiveMatchState {
        LiveMatchState::new(
            eleven("home"),
            eleven("away"),
            MatchConfig::default(),
            vec![],
            vec![],
            false,
        )
    }

    /// Changing formation rewrites players' positions in place. Nobody leaves
    /// the pitch and every squad index stays valid, so this is the one way the
    /// cached placements can go stale while everything else still looks right —
    /// and the batch path never changes formation, so no golden report would
    /// catch it. A stale cache means the engine keeps picking players for a
    /// shape they stopped playing when the manager changed it.
    #[test]
    fn changing_formation_moves_where_the_engine_looks_for_players() {
        let mut state = state();

        let before: Vec<f64> = (0..11)
            .map(|i| {
                state
                    .cache(Side::Home)
                    .placement(i, Band::OppBox, Need::Shoot)
            })
            .collect();

        // 4-4-2 to 3-4-3: one defender becomes a forward.
        state.apply_formation(Side::Home, "3-4-3");

        let after: Vec<f64> = (0..11)
            .map(|i| {
                state
                    .cache(Side::Home)
                    .placement(i, Band::OppBox, Need::Shoot)
            })
            .collect();

        assert_ne!(
            before, after,
            "nobody's presence in the opposition box changed after switching \
             from 4-4-2 to 3-4-3 — the cached placements are stale"
        );

        // And specifically: the cache must agree with where the players
        // actually are now, not merely differ from before.
        for (index, p) in state.team_ref(Side::Home).players.iter().enumerate() {
            let expected =
                crate::sim::roles::on_ball_weight(p.position, p.slot, p.role, Band::OppBox);
            assert_eq!(
                after[index], expected,
                "{} is a {:?} but the cache still places him elsewhere",
                p.id, p.position
            );
        }
    }

    /// A substitution replaces the player at a squad index outright. The XI is
    /// slot-aligned, so the index itself must survive — everything the engine
    /// reads by index depends on it.
    #[test]
    fn a_substitute_takes_the_vacated_index_and_the_cache_follows() {
        let mut home = eleven("home");
        let bench = vec![player("sub", Position::Forward, 20)];
        let mut state = LiveMatchState::new(
            std::mem::replace(&mut home, eleven("spare")),
            eleven("away"),
            MatchConfig::default(),
            bench,
            vec![],
            false,
        );

        let target = 5usize;
        let off_id = state.team_ref(Side::Home).players[target].id.clone();
        state.do_substitution(Side::Home, &off_id, "sub").unwrap();

        assert_eq!(
            state.team_ref(Side::Home).players[target].id,
            "sub",
            "the substitute did not take the vacated slot"
        );
        assert_eq!(
            &*state.cache(Side::Home).id(target),
            "sub",
            "the squad cache still names the player who went off"
        );
    }
}
