import { getMatchSnapshot } from "../../services/matchService";
import type {
  EnginePlayerData,
  EngineTeamData,
  MatchSnapshot,
  MatchStepResponse,
  PlayerCondition,
} from "./types";

/**
 * What the client should do with a step response.
 *
 * `desynced` is not an error: two requests can be answered out of order, and a
 * command applied elsewhere moves the match on. The caller fetches a full
 * snapshot rather than the reducer guessing at what it missed.
 */
export type MatchStepOutcome =
  | { kind: "applied"; snapshot: MatchSnapshot }
  | { kind: "ignored" }
  | { kind: "desynced" };

/**
 * Fold a step response into the snapshot the client is holding.
 *
 * The snapshot used to be rebuilt and re-sent whole every simulated minute —
 * both squads and the entire accumulated event log, 3.4 MB across a match to
 * describe a final state of 61 KB (#478). What arrives now is the handful of
 * values that moved, and the minutes that produced them.
 *
 * Everything that did not move keeps its identity, down to the individual
 * player. That is the difference between a memoised panel that skips a render
 * and one that re-renders every tick because the object underneath it is new.
 */
export function applyMatchStep(
  current: MatchSnapshot,
  response: MatchStepResponse,
): MatchStepOutcome {
  if (response.revision <= current.revision) {
    return { kind: "ignored" };
  }

  // A tick that brings a snapshot is one where something the delta cannot
  // describe has moved. It replaces the match whole, event log included — the
  // minutes must not also be appended, or their events appear twice.
  //
  // Checked before the desync, deliberately: a response carrying the whole
  // authoritative match is the answer to being behind, so asking for another
  // copy of it would be a round trip to fetch what is already in hand.
  if (response.snapshot) {
    return { kind: "applied", snapshot: response.snapshot };
  }
  if (response.base_revision !== current.revision) {
    return { kind: "desynced" };
  }

  const conditionById = new Map(
    response.delta.conditions.map((entry: PlayerCondition) => [
      entry.player_id,
      entry.condition,
    ]),
  );

  const newEvents = response.minutes.flatMap((minute) => minute.events);

  return {
    kind: "applied",
    snapshot: {
      ...current,
      revision: response.revision,
      phase: response.delta.phase,
      current_minute: response.delta.current_minute,
      home_score: response.delta.home_score,
      away_score: response.delta.away_score,
      possession: response.delta.possession,
      ball_zone: response.delta.ball_zone,
      home_possession_pct: response.delta.home_possession_pct,
      away_possession_pct: response.delta.away_possession_pct,
      events: newEvents.length ? [...current.events, ...newEvents] : current.events,
      home_team: withConditions(current.home_team, conditionById),
      away_team: withConditions(current.away_team, conditionById),
    },
  };
}

/** The team as it now stands, unchanged if not one condition moved. */
function withConditions(
  team: EngineTeamData,
  conditionById: Map<string, number>,
): EngineTeamData {
  let changed = false;

  const players = team.players.map((player: EnginePlayerData) => {
    const condition = conditionById.get(player.id);
    if (condition === undefined || condition === player.condition) {
      return player;
    }
    changed = true;
    return { ...player, condition };
  });

  return changed ? { ...team, players } : team;
}

/**
 * Fold a step response into the match on screen, resyncing if it cannot.
 *
 * A response is answered against the revision the client held when it asked.
 * If the match has moved since — a command applied elsewhere, or two requests
 * answered out of order — the whole match is fetched once to get back in step
 * rather than guessed at. `null` means the response had nothing newer to say.
 */
export async function resolveMatchStep(
  current: MatchSnapshot,
  response: MatchStepResponse,
): Promise<MatchSnapshot | null> {
  const outcome = applyMatchStep(current, response);
  if (outcome.kind === "applied") return outcome.snapshot;
  if (outcome.kind === "ignored") return null;
  return (await getMatchSnapshot()) ?? null;
}
