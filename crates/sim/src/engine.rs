use crate::event::MatchEvent;
use crate::model::{BallZone, MatchState};
use crate::rng::Rng;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ToyMatchConfig {
    pub seed: u64,
    pub max_minutes: u16,
}

impl ToyMatchConfig {
    pub fn new(seed: u64) -> Self {
        Self {
            seed,
            max_minutes: 10,
        }
    }
}

pub fn simulate_toy_match(config: ToyMatchConfig) -> Vec<String> {
    let mut rng = Rng::new(config.seed);
    let mut state = MatchState::new();
    let mut out = Vec::new();

    while state.minute < config.max_minutes {
        let (event, next_state) = step(&mut rng, state);
        out.push(event.to_commentary(state.possession, state.ball_zone, state.minute));
        state = next_state;
        state.minute = state.minute.saturating_add(1);
    }

    out
}

fn step(rng: &mut Rng, state: MatchState) -> (MatchEvent, MatchState) {
    let roll = rng.gen_range_u32(100);

    match state.ball_zone {
        BallZone::DefensiveThird => {
            if roll < 65 {
                (
                    MatchEvent::PassCompleted,
                    MatchState {
                        ball_zone: BallZone::MiddleThird,
                        ..state
                    },
                )
            } else if roll < 85 {
                (
                    MatchEvent::PassIntercepted,
                    MatchState {
                        possession: state.possession.other(),
                        ball_zone: BallZone::MiddleThird,
                        ..state
                    },
                )
            } else {
                (
                    MatchEvent::Foul,
                    MatchState {
                        possession: state.possession.other(),
                        ..state
                    },
                )
            }
        }
        BallZone::MiddleThird => {
            if roll < 50 {
                (
                    MatchEvent::PassCompleted,
                    MatchState {
                        ball_zone: BallZone::AttackingThird,
                        ..state
                    },
                )
            } else if roll < 70 {
                (
                    MatchEvent::DribbleWon,
                    MatchState {
                        ball_zone: BallZone::AttackingThird,
                        ..state
                    },
                )
            } else if roll < 90 {
                (
                    MatchEvent::TackleWon,
                    MatchState {
                        possession: state.possession.other(),
                        ..state
                    },
                )
            } else {
                (MatchEvent::Foul, state)
            }
        }
        BallZone::AttackingThird => {
            if roll < 40 {
                (
                    MatchEvent::ShotOnTarget,
                    MatchState {
                        ball_zone: BallZone::MiddleThird,
                        ..state
                    },
                )
            } else if roll < 65 {
                (
                    MatchEvent::ShotOffTarget,
                    MatchState {
                        ball_zone: BallZone::MiddleThird,
                        ..state
                    },
                )
            } else if roll < 85 {
                (
                    MatchEvent::DribbleLost,
                    MatchState {
                        possession: state.possession.other(),
                        ball_zone: BallZone::MiddleThird,
                        ..state
                    },
                )
            } else {
                (
                    MatchEvent::PassIntercepted,
                    MatchState {
                        possession: state.possession.other(),
                        ball_zone: BallZone::DefensiveThird,
                        ..state
                    },
                )
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn toy_match_is_deterministic_for_same_seed() {
        let a = simulate_toy_match(ToyMatchConfig {
            seed: 42,
            max_minutes: 10,
        });
        let b = simulate_toy_match(ToyMatchConfig {
            seed: 42,
            max_minutes: 10,
        });
        assert_eq!(a, b);
        assert_eq!(a.len(), 10);
    }
}
