import { afterEach, beforeAll, describe, expect, it } from "vitest";
import i18n, { i18nReady } from "../i18n";
import { resolveNewsArticle } from "./backendI18n";
import type { NewsArticle } from "../store/gameStore";

const makeNewsArticle = (overrides: Partial<NewsArticle> = {}): NewsArticle => ({
  id: "news_1",
  headline: "raw headline",
  body: "raw body",
  source: "raw source",
  date: "2026-08-01",
  category: "match",
  team_ids: [],
  player_ids: [],
  match_score: null,
  read: false,
  ...overrides,
});

/** The season preview article the backend writes, with the division params it carries. */
const previewOf = (params: Record<string, string>) =>
  resolveNewsArticle(
    makeNewsArticle({
      headline: "",
      headline_key: "be.news.seasonPreview.headline1",
      body: "",
      body_key: "be.news.seasonPreview.body",
      source: "",
      source_key: "be.source.footballHerald",
      i18n_params: {
        teamCount: "20",
        favourite: "Alpha FC",
        darkHorse: "Beta FC",
        teamList: "Alpha FC, Beta FC",
        ...params,
      },
    }),
  );

const previousLanguage = i18n.language;

beforeAll(async () => {
  await i18nReady;
});

afterEach(async () => {
  await i18n.changeLanguage(previousLanguage);
});

describe("the season preview names its division (#1226)", () => {
  // Given a season preview of a generated division, whose stored name is the English template
  // "Germany First Division", when it is resolved in German,
  // then the headline and the body name the division the way every other screen does, from its key.
  it("names the division a season preview is of from its name key", async () => {
    const previousLanguage = i18n.language;
    await i18n.changeLanguage("de");

    try {
      const article = makeNewsArticle({
        headline: "",
        headline_key: "be.news.seasonPreview.headline1",
        body: "",
        body_key: "be.news.seasonPreview.body",
        source: "",
        source_key: "be.source.footballHerald",
        i18n_params: {
          teamCount: "20",
          favourite: "Alpha FC",
          darkHorse: "Beta FC",
          teamList: "Alpha FC, Beta FC",
          competition: "Germany First Division",
          competitionKey: "tournaments.competitions.firstDivision",
          competitionCountry: "DE",
          competitionSeason: "2027",
        },
      });

      const result = resolveNewsArticle(article);

      expect(result.headline).toBe("Deutschland Erste Division: Die Saison steht bevor");
      expect(result.body).toContain("Deutschland Erste Division steht vor dem Start mit 20 Teams");
      expect(result.body).not.toContain("Germany First Division");
    } finally {
      await i18n.changeLanguage(previousLanguage);
    }
  });

  // Given a season preview of a hand-made division (no name key) and one from a save written before
  // the preview carried a division at all,
  // when they are resolved in English,
  // then the first names the division by its stored name, the second says "The league", and neither
  // shows an unfilled placeholder or a fixed "Premier Division".
  it("names a hand-made division by its stored name, and an old preview by a generic word", async () => {
    const handmade = previewOf({ teamCount: "8", competition: "Sunday League" });
    const old = previewOf({ teamCount: "8" });

    expect(handmade.headline).toBe("Sunday League: Season Set to Begin");
    expect(handmade.body).toContain("Sunday League is set to kick off with 8 teams");
    expect(old.headline).toBe("The league: Season Set to Begin");
    expect(old.body).toContain("The league is set to kick off with 8 teams");
    for (const text of [handmade.headline, handmade.body, old.headline, old.body]) {
      expect(text).not.toContain("{{");
      expect(text).not.toContain("Premier Division");
    }
  });

  // Given a season preview of a generated third-tier division, whose stored name is the English
  // template and whose key, country, edition and tier it carries, when it is resolved in German,
  // then the division reads "Deutschland 3. Liga": the tier is what the name is made of.
  it("names a third-tier division by its tier in the player's language", async () => {
    await i18n.changeLanguage("de");

    const result = previewOf({
      competition: "Germany Division 3",
      competitionKey: "tournaments.competitions.tierDivision",
      competitionCountry: "DE",
      competitionSeason: "2027",
      competitionTier: "3",
    });

    expect(result.headline).toBe("Deutschland 3. Liga: Die Saison steht bevor");
    expect(result.body).toContain("Deutschland 3. Liga steht vor dem Start mit 20 Teams");
    expect(result.body).not.toContain("Germany Division 3");
  });

  // Given a season preview of a split-season division (a closing phase), when it is resolved in
  // German, then the name carries the phase's own word, as the standings and the fixtures name it.
  it("adds the split-season phase to the division's name", async () => {
    await i18n.changeLanguage("de");

    const closing = previewOf({
      competition: "Germany First Division",
      competitionKey: "tournaments.competitions.firstDivision",
      competitionCountry: "DE",
      competitionSeason: "2027",
      competitionPhase: "closing",
    });
    const annual = previewOf({
      competition: "Germany First Division",
      competitionKey: "tournaments.competitions.firstDivision",
      competitionCountry: "DE",
      competitionSeason: "2027",
    });

    expect(closing.headline).toBe(
      "Deutschland Erste Division Abschlussturnier: Die Saison steht bevor",
    );
    expect(annual.headline).toBe("Deutschland Erste Division: Die Saison steht bevor");
  });
});
