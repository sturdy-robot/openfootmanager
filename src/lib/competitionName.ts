type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

/** The fields needed to render a competition's display name. */
export interface NamedCompetition {
  name?: string;
  name_key?: string | null;
  season?: number;
  country_id?: string | null;
}

/**
 * Display name for a competition. When a `name_key` is present it is translated
 * with the competition's season and nation interpolated, so generic templates
 * like `"{{country}} First Division"` render as "Argentina First Division".
 * Falls back to the raw `name` when there is no key.
 */
export function competitionDisplayName(
  comp: NamedCompetition,
  t: TranslateFn,
): string {
  if (!comp.name_key) {
    return comp.name ?? "";
  }
  const country = comp.country_id
    ? t(`nations.${comp.country_id.toLowerCase()}`, {
        defaultValue: comp.country_id,
      })
    : "";
  // Keep using name_key even without a country (e.g. the World Cup, which has a
  // key but no country_id) so its localized name still resolves. A missing key
  // or an absent `{{country}}` value falls back to the stored name and trims the
  // stray space a blank country would otherwise leave.
  return t(comp.name_key, {
    year: comp.season,
    country,
    defaultValue: comp.name ?? comp.name_key,
  }).trim();
}


/** What the matchday chrome shows: which competition, and which round of it. */
export interface MatchdayIdentity {
  competitionName: string | null;
  roundLabel: string;
}

/** The fixture fields the identity is derived from. */
interface IdentityFixture {
  competition: string;
  competition_id?: string;
  matchday: number;
}

/** The slice of game state that can name a competition. */
interface IdentityGameState {
  competitions?: NamedCompetition[] | null;
  league?: NamedCompetition | null;
}

/**
 * Competitions that are not part of a season's structure. A friendly is not
 * "matchday 3 of the league", and borrowing the domestic league's name for one
 * would be a plain lie — a pre-season tournament is not the league either.
 */
const UNSTRUCTURED_ROUND_LABELS: Record<string, string> = {
  Friendly: "season.friendly",
  PreseasonTournament: "season.preseasonTournament",
};

/**
 * Name the competition and round behind a fixture, for the matchday chrome.
 *
 * Answers issue #369: the competition was only ever visible inside the Schedule
 * tab, so a player could reach kick-off without seeing which trophy was at
 * stake. Deriving it once here lets every stage show it from shared chrome.
 */
export function matchdayIdentity(
  gameState: IdentityGameState,
  fixture: IdentityFixture | null,
  t: TranslateFn,
): MatchdayIdentity {
  if (!fixture) {
    return { competitionName: null, roundLabel: t("match.matchDay") };
  }

  const unstructuredLabel = UNSTRUCTURED_ROUND_LABELS[fixture.competition];
  if (unstructuredLabel) {
    return { competitionName: null, roundLabel: t(unstructuredLabel) };
  }

  const roundLabel = t("common.matchday", { n: fixture.matchday });

  // A save written before fixtures carried a competition id has only the
  // domestic league to go on; a modern one names its competition exactly. An
  // id that resolves to nothing keeps the round and stays honest about the
  // competition rather than falling back to whatever league is lying around.
  const competition = fixture.competition_id
    ? (gameState.competitions ?? []).find(
        (entry) => (entry as { id?: string }).id === fixture.competition_id,
      ) ?? null
    : gameState.league ?? null;

  return {
    competitionName: competition ? competitionDisplayName(competition, t) : null,
    roundLabel,
  };
}
