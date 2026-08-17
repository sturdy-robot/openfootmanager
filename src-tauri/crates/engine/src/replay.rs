//! What a replay needs to know before it trusts a stored line-up.
//!
//! Replay works by re-simulation: a fixture keeps a seed, the engine version it
//! was played under, and how each side lined up, and the match is played again
//! from those. That only reconstructs the match that actually happened if the
//! inputs are the same inputs.
//!
//! The stored line-up cannot be the whole of them. It records who started, in
//! what shape, with what instructions and how fresh — but a player's attributes,
//! traits and deployed slot are read from the squad as it stands *now*, and
//! training, ageing, injury and transfers all move them. Storing the entire
//! squad on every fixture would fix that and would also grow a save without
//! bound, for a feature almost no fixture will ever use.
//!
//! So this stores a fingerprint of what the engine was actually handed instead.
//! A replay recomputes it and compares: if it matches, the reconstruction is
//! sound and the match can be watched back. If it does not, the squad has moved
//! on and the replay is refused — the fixture stays readable from its stored
//! result, exactly as it does when the engine version has moved. Sixty-four bits
//! that are either right or wrong beat a partial snapshot that is quietly
//! approximate.

use crate::types::{PlayerData, TeamData};

/// A stable fingerprint of one side as the engine received it.
///
/// FNV-1a over a canonical description, for the same reason
/// `domain::league::derive_seed` uses it: `std`'s default hasher is explicitly
/// not stable across Rust releases, and a value written into a save has to mean
/// the same thing years later.
///
/// Everything that can change what the engine simulates goes in. Anything
/// cosmetic — a player's name — stays out, so renaming a club does not refuse
/// its replays.
pub fn lineup_fingerprint(team: &TeamData, bench: &[PlayerData]) -> u64 {
    let mut hash = Fnv::new();
    hash.text(&team.formation);
    hash.text(&format!("{:?}", team.play_style));
    hash.text(&format!("{:?}", team.tactics));
    for player in team.players.iter().chain(bench.iter()) {
        hash.player(player);
    }
    hash.finish()
}

struct Fnv(u64);

impl Fnv {
    const OFFSET_BASIS: u64 = 0xcbf2_9ce4_8422_2325;
    const PRIME: u64 = 0x0000_0100_0000_01b3;

    fn new() -> Self {
        Self(Self::OFFSET_BASIS)
    }

    fn byte(&mut self, byte: u8) {
        self.0 ^= byte as u64;
        self.0 = self.0.wrapping_mul(Self::PRIME);
    }

    fn text(&mut self, text: &str) {
        for byte in text.as_bytes() {
            self.byte(*byte);
        }
        // A separator, so ("ab", "c") and ("a", "bc") do not collide.
        self.byte(0x1f);
    }

    fn player(&mut self, p: &PlayerData) {
        self.text(&p.id);
        self.text(&format!("{:?}", p.position));
        self.text(&format!("{:?}", p.slot));
        self.text(&format!("{:?}", p.role));
        for value in [
            p.ovr,
            p.condition,
            p.fitness,
            p.pace,
            p.stamina,
            p.strength,
            p.agility,
            p.passing,
            p.shooting,
            p.tackling,
            p.dribbling,
            p.defending,
            p.positioning,
            p.vision,
            p.decisions,
            p.composure,
            p.aggression,
            p.teamwork,
            p.leadership,
            p.handling,
            p.reflexes,
            p.aerial,
        ] {
            self.byte(value);
        }
        for name in &p.traits {
            self.text(name);
        }
        self.byte(0x1e);
    }

    fn finish(self) -> u64 {
        // Zero is the "never computed" sentinel on a stored fixture, so a real
        // line-up must never hash to it.
        if self.0 == 0 { Self::OFFSET_BASIS } else { self.0 }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{PlayStyle, PlayerRole, Position, Slot, TacticsConfig};

    fn player(id: &str) -> PlayerData {
        PlayerData {
            id: id.to_string(),
            name: format!("Player {id}"),
            position: Position::Midfielder,
            ovr: 70,
            condition: 90,
            fitness: 80,
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
            aggression: 50,
            teamwork: 70,
            leadership: 50,
            handling: 20,
            reflexes: 30,
            aerial: 60,
            traits: Vec::new(),
            slot: Some(Slot::CentralMidfielder),
            role: PlayerRole::Standard,
        }
    }

    fn team() -> TeamData {
        TeamData {
            id: "t".to_string(),
            name: "Team".to_string(),
            players: vec![player("a"), player("b")],
            formation: "4-4-2".to_string(),
            play_style: PlayStyle::Balanced,
            tactics: TacticsConfig::default(),
        }
    }

    #[test]
    fn the_same_line_up_fingerprints_the_same() {
        assert_eq!(
            lineup_fingerprint(&team(), &[player("s")]),
            lineup_fingerprint(&team(), &[player("s")])
        );
    }

    #[test]
    fn it_is_never_the_unassigned_sentinel() {
        assert_ne!(lineup_fingerprint(&team(), &[]), 0);
    }

    // Each of these is something the stored line-up does not record and the
    // squad can change between the match being played and being watched back.
    // If any of them stopped moving the fingerprint, a replay would quietly
    // reconstruct a different match and present it as history.
    #[test]
    fn a_player_who_has_trained_no_longer_matches() {
        let mut trained = team();
        trained.players[0].passing += 1;
        assert_ne!(lineup_fingerprint(&team(), &[]), lineup_fingerprint(&trained, &[]));
    }

    #[test]
    fn a_player_who_has_picked_up_a_trait_no_longer_matches() {
        let mut learned = team();
        learned.players[0].traits.push("Playmaker".to_string());
        assert_ne!(lineup_fingerprint(&team(), &[]), lineup_fingerprint(&learned, &[]));
    }

    #[test]
    fn a_different_deployed_slot_no_longer_matches() {
        let mut moved = team();
        moved.players[0].slot = Some(Slot::DefensiveMidfielder);
        assert_ne!(lineup_fingerprint(&team(), &[]), lineup_fingerprint(&moved, &[]));
    }

    #[test]
    fn a_changed_bench_no_longer_matches() {
        assert_ne!(
            lineup_fingerprint(&team(), &[player("s")]),
            lineup_fingerprint(&team(), &[player("other")])
        );
    }

    #[test]
    fn different_instructions_no_longer_match() {
        let mut instructed = team();
        instructed.tactics.tempo = crate::types::Tempo::Patient;
        assert_ne!(
            lineup_fingerprint(&team(), &[]),
            lineup_fingerprint(&instructed, &[])
        );
    }

    // Renaming a club is not a change to what gets simulated, and refusing its
    // replays would be a bug of its own.
    #[test]
    fn renaming_the_club_still_matches() {
        let mut renamed = team();
        renamed.name = "Renamed FC".to_string();
        renamed.players[0].name = "Someone Else".to_string();
        assert_eq!(lineup_fingerprint(&team(), &[]), lineup_fingerprint(&renamed, &[]));
    }
}
