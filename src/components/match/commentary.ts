import type { TFunction } from "i18next";
import type {
  MatchEvent,
  MatchSnapshot,
  EventDetail,
  DangerBand,
  SaveQuality,
  FoulSeverity,
  GoalContext,
  ShotTechnique,
} from "./types";
import { getPlayerName } from "./helpers";

/**
 * Build-up events, and how much of each reaches the feed.
 *
 * These used to be silent — thirteen of the engine's thirty event types
 * produced no prose at all, so the most common thing in a match, players
 * passing the ball to each other, was narrated as nothing happening.
 *
 * They cannot all be shown. A match now resolves hundreds of actions, so
 * narrating every pass would bury the goals. Each type is sampled instead, at a
 * rate reflecting how interesting it is: a set piece always earns a mention, a
 * completed pass in midfield rarely does.
 *
 * Sampling uses the same stable hash as variant selection, so a given event is
 * always either shown or not — the feed never changes under a re-render.
 */
const SAMPLED_EVENTS: Record<string, number> = {
  Corner: 1.0,
  FreeKick: 0.45,
  GoalKick: 0.14,
  PassIntercepted: 0.22,
  DribbleTackled: 0.2,
  Dribble: 0.14,
  Cross: 0.14,
  Tackle: 0.1,
  Interception: 0.1,
  Clearance: 0.08,
  PassCompleted: 0.02,
};

/** Event types that get the full headline + prose treatment. */
const COMMENTARY_EVENTS = new Set([
  "Goal",
  "PenaltyGoal",
  "PenaltyMiss",
  "PenaltyAwarded",
  "ShotSaved",
  "ShotOffTarget",
  "ShotBlocked",
  "Foul",
  "YellowCard",
  "RedCard",
  "SecondYellow",
  "Injury",
  "Substitution",
  "KickOff",
  "HalfTime",
  "SecondHalfStart",
  "FullTime",
]);

export interface Commentary {
  headline: string;
  line: string;
}

/**
 * Stable, RNG-free hash so a given event always renders the same variant.
 *
 * The event's position in the feed is part of the key. Without it, a player
 * who does the same thing twice in a minute — which the possession chain makes
 * routine, since it resolves several actions per minute — hashes identically
 * both times, so the sampler keeps or drops them together and renders the same
 * sentence twice in a row.
 */
function hashEvent(evt: MatchEvent, ordinal: number): number {
  const key = `${ordinal}|${evt.minute}|${evt.event_type}|${evt.player_id ?? ""}`;
  let h = 5381;
  for (let i = 0; i < key.length; i++) {
    h = ((h << 5) + h + key.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Map an event's truthful detail to a commentary sub-key (camelCase to match
 * the i18n keys). Returns null when the base key should be used.
 */
/**
 * How a shot was struck, as a commentary sub-key — or null when it was struck
 * the ordinary way and has nothing to add.
 *
 * Technique lines *replace* the ones keyed on danger, save quality or goal
 * context rather than combining with them. Crossing six techniques with four
 * goal contexts would be twenty-four keys in eleven locales for the Goal event
 * alone, and a commentator does not say both things anyway: an overhead kick is
 * an overhead kick before it is a consolation.
 */
function techniqueVariant(technique: ShotTechnique | undefined): string | null {
  switch (technique) {
    case "Header":
      return "header";
    case "Volley":
      return "volley";
    case "Curler":
      return "curler";
    case "Backheel":
      return "backheel";
    case "BicycleKick":
      return "bicycleKick";
    default:
      // `Simple`, or an older feed that carries no technique at all.
      return null;
  }
}

function detailVariant(detail: EventDetail | null | undefined): string | null {
  if (!detail) return null;
  if ("Shot" in detail) {
    const technique = techniqueVariant(detail.Shot.technique);
    if (technique) return technique;
    const map: Record<DangerBand, string> = {
      Speculative: "speculative",
      Decent: "decent",
      BigChance: "bigChance",
    };
    return map[detail.Shot.danger] ?? null;
  }
  if ("Save" in detail) {
    const technique = techniqueVariant(detail.Save.technique);
    if (technique) return technique;
    const map: Record<SaveQuality, string> = {
      Routine: "routine",
      Strong: "strong",
      WorldClass: "worldClass",
    };
    return map[detail.Save.quality] ?? null;
  }
  if ("Foul" in detail) {
    const map: Record<FoulSeverity, string | null> = {
      Soft: null,
      Hard: "hard",
      Reckless: "reckless",
    };
    const val = map[detail.Foul.severity];
    return val !== undefined ? val : null;
  }
  if ("Goal" in detail) {
    const technique = techniqueVariant(detail.Goal.technique);
    if (technique) return technique;
    const map: Record<GoalContext, string> = {
      Opener: "opener",
      Equaliser: "equaliser",
      Extends: "extends",
      Consolation: "consolation",
    };
    return map[detail.Goal.context] ?? null;
  }
  return null;
}

/** Count goals scored by a player up to and including this event. */
function goalTally(evt: MatchEvent, snapshot: MatchSnapshot): number {
  if (!evt.player_id) return 0;
  // `minute <=` (not an index/identity comparison) is intentional: the rendered
  // event is not always reference-identical to the entry in snapshot.events, so
  // indexOf would fail. The engine resolves at most one shot per minute, so a
  // same-minute same-player double goal cannot occur and this cannot overcount.
  return snapshot.events.filter(
    (e) =>
      (e.event_type === "Goal" || e.event_type === "PenaltyGoal") &&
      e.player_id === evt.player_id &&
      e.minute <= evt.minute,
  ).length;
}

/**
 * Resolve the variant sub-key, with goal tally (hat-trick/brace) taking
 * precedence over goal context.
 */
function variantKey(evt: MatchEvent, snapshot: MatchSnapshot): string | null {
  if (evt.event_type === "Goal" || evt.event_type === "PenaltyGoal") {
    const tally = goalTally(evt, snapshot);
    if (tally === 3) return "hattrick";
    if (tally === 2) return "brace";
  }
  return detailVariant(evt.detail);
}

/** Manual interpolation since the variant string is a value, not a key. */
function interpolate(template: string, tokens: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => tokens[name] ?? "");
}

function pickLine(
  t: TFunction,
  baseKey: string,
  variant: string | null,
  hash: number,
  tokens: Record<string, string>,
): Commentary | null {
  // Try the refined variant first, then fall back to the base key.
  const candidates = variant ? [`${baseKey}.${variant}`, baseKey] : [baseKey];
  for (const key of candidates) {
    const lines = t(`${key}.lines`, { returnObjects: true }) as
      | Record<string, string>
      | string;
    if (!lines || typeof lines !== "object") continue;
    const values = Object.values(lines);
    if (values.length === 0) continue;
    const template = values[hash % values.length];
    if (typeof template !== "string") continue;
    const headline = t(`${key}.headline`, { defaultValue: "" });
    return { headline, line: interpolate(template, tokens) };
  }
  return null;
}

export function getCommentary(
  evt: MatchEvent,
  snapshot: MatchSnapshot,
  t: TFunction,
): Commentary | null {
  // `indexOf` falls back to -1 for an event not in the snapshot (tests build
  // events standalone); that is still a stable key for that call.
  const hash = hashEvent(evt, snapshot.events.indexOf(evt));
  if (!COMMENTARY_EVENTS.has(evt.event_type)) {
    const rate = SAMPLED_EVENTS[evt.event_type];
    if (rate === undefined) return null;
    // Deterministic sample: the same event is always kept or always dropped.
    if (hash % 1000 >= rate * 1000) return null;
  }

  const isHome = evt.side === "Home";
  const team = isHome ? snapshot.home_team.name : snapshot.away_team.name;
  const opponent = isHome ? snapshot.away_team.name : snapshot.home_team.name;
  const player = getPlayerName(snapshot, evt.player_id);
  const victim = getPlayerName(snapshot, evt.secondary_player_id);

  const tokens: Record<string, string> = { team, opponent, player, victim };
  const baseKey = `match.commentary.${evt.event_type}`;
  const variant = variantKey(evt, snapshot);

  return pickLine(t, baseKey, variant, hash, tokens);
}
