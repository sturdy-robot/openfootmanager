//! Player traits as a bitmask.
//!
//! A trait arrives from the world as a string, and the engine used to carry the
//! whole `Vec<String>` into every player snapshot — one heap allocation per
//! selection, twice per action, some seven hundred times a match. Answering
//! "is this player a Sharpshooter?" then walked the vector comparing strings.
//!
//! The set of traits the engine actually reacts to is fixed and small, so it
//! fits in a `u16`. The strings are matched once, when the match is set up, and
//! every question after that is a bit test. The names are the contract with the
//! world data and must keep matching `domain`'s trait ids exactly — a name that
//! does not match here simply has no effect, which is why
//! [`tests::every_known_trait_round_trips`] pins them.

/// The traits the engine reads, one bit each.
///
/// Traits the game defines but the engine does not react to are absent
/// deliberately: adding a bit here without a matching effect in
/// [`crate::shared::trait_bonus`] would be a bit that never changes anything.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub(crate) struct TraitFlags(u16);

/// Every trait the engine understands, paired with its bit.
///
/// One table, so the mask and the name can never disagree about which bit means
/// what.
const KNOWN: [(&str, u16); 16] = [
    ("Sharpshooter", 1 << 0),
    ("CoolHead", 1 << 1),
    ("CompleteForward", 1 << 2),
    ("Dribbler", 1 << 3),
    ("Speedster", 1 << 4),
    ("Agile", 1 << 5),
    ("Playmaker", 1 << 6),
    ("Visionary", 1 << 7),
    ("BallWinner", 1 << 8),
    ("Rock", 1 << 9),
    ("Tank", 1 << 10),
    ("SafeHands", 1 << 11),
    ("CatReflexes", 1 << 12),
    ("AerialDominance", 1 << 13),
    ("SetPieceSpecialist", 1 << 14),
    ("HotHead", 1 << 15),
];

impl TraitFlags {
    /// Match a player's trait names against the table, once.
    pub fn from_names<S: AsRef<str>>(names: &[S]) -> Self {
        let mut bits = 0u16;
        for name in names {
            let name = name.as_ref();
            for (known, bit) in KNOWN {
                if name == known {
                    bits |= bit;
                    break;
                }
            }
        }
        Self(bits)
    }

    /// Nobody's traits — used by the placeholder player.
    pub const fn none() -> Self {
        Self(0)
    }

    #[inline]
    fn has_bit(self, bit: u16) -> bool {
        self.0 & bit != 0
    }
}

/// Each trait gets a named accessor rather than a public bit constant, so a
/// caller cannot ask about a bit that has no meaning.
macro_rules! trait_accessors {
    ($($method:ident => $name:literal),* $(,)?) => {
        impl TraitFlags {
            $(
                #[inline]
                pub fn $method(self) -> bool {
                    self.has_bit(bit_of($name))
                }
            )*
        }
    };
}

/// Look the bit up in the same table the mask is built from. Evaluated at
/// compile time in practice — the name is always a literal.
const fn bit_of(name: &str) -> u16 {
    let mut i = 0;
    while i < KNOWN.len() {
        if const_str_eq(KNOWN[i].0, name) {
            return KNOWN[i].1;
        }
        i += 1;
    }
    // An accessor naming a trait that is not in the table is a bug in this
    // file, and one that would otherwise silently answer "no" forever.
    panic!("accessor names a trait that is not in KNOWN");
}

const fn const_str_eq(a: &str, b: &str) -> bool {
    let (a, b) = (a.as_bytes(), b.as_bytes());
    if a.len() != b.len() {
        return false;
    }
    let mut i = 0;
    while i < a.len() {
        if a[i] != b[i] {
            return false;
        }
        i += 1;
    }
    true
}

trait_accessors! {
    sharpshooter => "Sharpshooter",
    cool_head => "CoolHead",
    complete_forward => "CompleteForward",
    dribbler => "Dribbler",
    speedster => "Speedster",
    agile => "Agile",
    playmaker => "Playmaker",
    visionary => "Visionary",
    ball_winner => "BallWinner",
    rock => "Rock",
    tank => "Tank",
    safe_hands => "SafeHands",
    cat_reflexes => "CatReflexes",
    aerial_dominance => "AerialDominance",
    set_piece_specialist => "SetPieceSpecialist",
    hot_head => "HotHead",
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The mask must answer exactly what a scan of the strings would, since
    /// this replaced such a scan and the golden reports must not move.
    fn scan(names: &[&str], wanted: &str) -> bool {
        names.contains(&wanted)
    }

    #[test]
    fn every_known_trait_round_trips() {
        for (name, _) in KNOWN {
            let flags = TraitFlags::from_names(&[name]);
            assert!(
                flags != TraitFlags::none(),
                "{name} set no bit — the accessor and the table disagree"
            );
        }
    }

    #[test]
    fn a_mask_answers_what_a_string_scan_would() {
        let names = ["Sharpshooter", "Playmaker", "NotATrait", "Sharpshooter"];
        let flags = TraitFlags::from_names(&names);

        assert_eq!(flags.sharpshooter(), scan(&names, "Sharpshooter"));
        assert_eq!(flags.playmaker(), scan(&names, "Playmaker"));
        assert_eq!(flags.cool_head(), scan(&names, "CoolHead"));
        assert_eq!(flags.hot_head(), scan(&names, "HotHead"));
    }

    #[test]
    fn an_unknown_trait_sets_nothing() {
        // A world can carry traits the engine has no opinion about; they must
        // not collide with one it does.
        let flags = TraitFlags::from_names(&["Mercurial", "Loyal", "Ambitious"]);
        assert_eq!(flags, TraitFlags::none());
    }

    #[test]
    fn traits_combine_independently() {
        let flags = TraitFlags::from_names(&["Rock", "Tank"]);
        assert!(flags.rock() && flags.tank());
        assert!(!flags.sharpshooter());
    }

    #[test]
    fn every_bit_is_distinct() {
        // A copy-paste in the table would silently make two traits the same
        // trait, and every effect of one would fire for the other.
        let mut seen = 0u16;
        for (name, bit) in KNOWN {
            assert_eq!(seen & bit, 0, "{name} reuses a bit already taken");
            seen |= bit;
        }
    }
}
