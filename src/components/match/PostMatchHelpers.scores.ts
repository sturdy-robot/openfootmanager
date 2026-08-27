import type { MatchSnapshot, Side } from "./types";

/** One player's score, and the player it belongs to. */
export interface PerformanceScore {
  playerId: string;
  score: number;
}

/**
 * How much each kind of recorded event moves a player's score.
 *
 * Written out rather than buried in a chain of `else if`, because this table
 * *is* the metric. There is nothing else to it: no engine reading of how a
 * player actually played, no possession or duel data — the match engine on
 * `develop` produces no player rating at all. Every number below is a weight
 * someone chose, applied to events the engine did record.
 *
 * That is why what the screen shows is a **performance score** and not a
 * rating. "Rating" is reserved for a value the engine produces, and when one
 * exists it will replace this rather than sit beside it.
 */
const EVENT_WEIGHTS: Record<string, number> = {
  Goal: 1.2,
  PenaltyGoal: 1.2,
  ShotSaved: 0.2,
  ShotOnTarget: 0.2,
  ShotOffTarget: -0.1,
  PassCompleted: 0.02,
  Tackle: 0.15,
  Interception: 0.15,
  Foul: -0.2,
  YellowCard: -0.5,
  SecondYellow: -0.5,
  RedCard: -1.5,
};

/** What a goal is worth to whoever set it up. */
const ASSIST_WEIGHT = 0.7;

/** Everyone on the winning side is credited for the result. */
const WINNING_SIDE_BONUS = 0.5;

/** Where a player who did nothing the engine recorded stands. */
const BASELINE = 6;

const LOWEST = 1;
const HIGHEST = 10;

function scoredAGoal(eventType: string): boolean {
  return eventType === "Goal" || eventType === "PenaltyGoal";
}

/**
 * A side's players scored on what the engine recorded, best first.
 *
 * Derived entirely from the match events — see [`EVENT_WEIGHTS`] for what that
 * means and what it does not.
 */
export function buildPerformanceScores(
  snapshot: MatchSnapshot,
  side: Side,
): PerformanceScore[] {
  const team = side === "Home" ? snapshot.home_team : snapshot.away_team;
  const scores = new Map<string, number>(
    team.players.map((player) => [player.id, BASELINE]),
  );

  const credit = (playerId: string | null | undefined, weight: number) => {
    if (!playerId) return;
    const current = scores.get(playerId);
    if (current === undefined) return;
    scores.set(playerId, current + weight);
  };

  for (const event of snapshot.events) {
    if (event.side !== side) continue;
    credit(event.player_id, EVENT_WEIGHTS[event.event_type] ?? 0);
    if (scoredAGoal(event.event_type)) {
      credit(event.secondary_player_id, ASSIST_WEIGHT);
    }
  }

  const won =
    side === "Home"
      ? snapshot.home_score > snapshot.away_score
      : snapshot.away_score > snapshot.home_score;

  return team.players
    .map((player) => {
      const raw = (scores.get(player.id) ?? BASELINE) + (won ? WINNING_SIDE_BONUS : 0);
      const bounded = Math.max(LOWEST, Math.min(HIGHEST, raw));
      // Rounded here rather than at the point it is drawn, so what is compared
      // and ordered is the same number the manager reads. Twenty completed
      // passes otherwise arrive as 6.400000000000001.
      return { playerId: player.id, score: Math.round(bounded * 10) / 10 };
    })
    .sort((left, right) => right.score - left.score);
}
