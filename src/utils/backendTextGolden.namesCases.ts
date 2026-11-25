import type { GoldenCase } from "./backendTextGolden.types";

/** What a nationality param can be, as the backend and the old saves wrote it. */
const NATIONALITIES: ReadonlyArray<readonly [what: string, value: string]> = [
  ["an ISO country code", "BR"],
  ["a football identity code", "ENG"],
  ["an alias in lower case", "england"],
  ["an alias in mixed case", "united Kingdom"],
  ["an English country name", "Germany"],
  ["a demonym written as the old saves wrote it", "Argentine"],
  ["a demonym in a case the screen does not read", "brazilian"],
  ["a value that is no country", "Atlantis"],
];

/**
 * The golden cases for the names the screen works out before it resolves a text (#1388, C): a
 * country, a division or competition, and the club of a season award. They run last, in the
 * order of the golden file.
 */
export const NAMES_CASES: GoldenCase[] = [
  // Names (#1388, C): a country or nationality param is the country's name (the screen's
  // `countryName`), a division or competition is named from its key, country and season, and a
  // season-awards winner at no club carries the free-agent key.
  ...NATIONALITIES.map(
    ([what, nationality], index): GoldenCase => ({
      name: `a nationality param that is ${what} reads as the country's name`,
      kind: "message",
      input: {
        id: `intl_callup_${index}`,
        subject_key: "be.msg.intlCallup.subject",
        body_key: "be.msg.intlCallup.body",
        i18n_params: { player: "J. Doe", nationality },
      },
    }),
  ),
  {
    name: "a promotion names the division from its key, country and season",
    kind: "message",
    input: {
      id: "promotion_2027",
      subject_key: "be.msg.promotion.subject",
      body_key: "be.msg.promotion.body",
      i18n_params: {
        division: "Germany Second Division",
        season: "2027",
        divisionKey: "tournaments.competitions.secondDivision",
        divisionSeason: "2027",
        divisionCountry: "DE",
      },
    },
  },
  {
    name: "a relegation names a numbered division, and one whose country has no name of its own",
    kind: "message",
    input: {
      id: "relegation_2027",
      subject_key: "be.msg.relegation.subject",
      body_key: "be.msg.relegation.body",
      i18n_params: {
        division: "Xland League",
        season: "2027",
        divisionKey: "tournaments.competitions.league",
        divisionSeason: "2027",
        divisionCountry: "XL",
      },
    },
  },
  {
    name: "a promotion whose division has no key keeps the stored name",
    kind: "message",
    input: {
      id: "promotion_2028",
      subject_key: "be.msg.promotion.subject",
      body_key: "be.msg.promotion.body",
      i18n_params: { division: "The Premier Division", season: "2028" },
    },
  },
  {
    name: "a promotion to a numbered division with no tier keeps the stored name",
    kind: "message",
    input: {
      id: "promotion_2029",
      subject_key: "be.msg.promotion.subject",
      body_key: "be.msg.promotion.body",
      i18n_params: {
        division: "Spain Division 3",
        season: "2029",
        divisionKey: "tournaments.competitions.tierDivision",
        divisionSeason: "2029",
        divisionCountry: "ES",
      },
    },
  },
  // The tier and the phase of a division: a `tierDivision` name is built from the tier the notice
  // carries, and a split-season phase follows the four names that have a tier in them.
  ...(
    [
      [
        "a promotion names a numbered division from the tier the notice carries",
        "tournaments.competitions.tierDivision",
        { divisionTier: "3" },
      ],
      [
        "a promotion into an opening-tournament division says so after its name",
        "tournaments.competitions.tierDivision",
        { divisionTier: "3", divisionPhase: "opening" },
      ],
      [
        "a promotion into a closing-tournament division says so after its name",
        "tournaments.competitions.league",
        { divisionPhase: "closing" },
      ],
      [
        "a promotion into an annual division says nothing of a phase",
        "tournaments.competitions.secondDivision",
        { divisionPhase: "annual" },
      ],
      [
        "a phase after a name with no tier in it is left out",
        "tournaments.competitions.nationalCup",
        { divisionPhase: "opening" },
      ],
      [
        "a tier that is no whole number above zero names nothing, and the stored name stands",
        "tournaments.competitions.tierDivision",
        { divisionTier: "2.5", divisionPhase: "opening" },
      ],
    ] as const
  ).map(([name, divisionKey, extra], index) => ({
    name,
    kind: "message" as const,
    input: {
      id: `division_tier_${index}`,
      subject_key: "be.msg.promotion.subject",
      body_key: "be.msg.promotion.body",
      i18n_params: {
        division: "Stored Name",
        season: "2029",
        divisionKey,
        divisionSeason: "2029",
        divisionCountry: "ES",
        ...extra,
      },
    },
  })),
  {
    name: "a competition report names the competition from its key, country and season",
    kind: "article",
    input: {
      id: "report_cup_1",
      headline_key: "be.news.matchReport.reportCompetition.title",
      body_key: "be.news.matchReport.reportCompetition.body",
      source_key: "be.source.footballHerald",
      i18n_params: {
        home: "North",
        away: "South",
        homeGoals: "3",
        awayGoals: "2",
        competition: "Germany Cup",
        competitionKey: "tournaments.competitions.nationalCup",
        competitionCountry: "DE",
        competitionSeason: "2026",
        scorers: "",
        scorersSection: "",
        scorersData: "[]",
      },
    },
  },
  {
    name: "a competition report with no key keeps the stored competition name",
    kind: "article",
    input: {
      id: "report_cup_2",
      headline_key: "be.news.matchReport.reportCompetition.title",
      body_key: "be.news.matchReport.reportCompetition.body",
      source_key: "be.source.footballHerald",
      i18n_params: {
        home: "East",
        away: "West",
        homeGoals: "1",
        awayGoals: "1",
        competition: "The Shield",
        scorers: "",
        scorersSection: "",
        scorersData: "[]",
      },
    },
  },
  // No competition name in the locale file reads the season yet, so these use the one template that
  // has a year in it (`hallOfFameWorld.worldCupEdition`) as the name key: what the season text
  // makes of a number, of nothing written, and of no season at all.
  ...[
    ["a season", "2026"],
    ["a blank season", ""],
    ["no season", undefined],
  ].map(([what, season], index) => ({
    name: `a competition report whose name key reads the year, with ${what}, names the year as the screen reads it`,
    kind: "article" as const,
    input: {
      id: `report_year_${index}`,
      headline_key: "be.news.matchReport.reportCompetition.title",
      body_key: "be.news.matchReport.reportCompetition.body",
      source_key: "be.source.footballHerald",
      i18n_params: {
        home: "North",
        away: "South",
        homeGoals: "0",
        awayGoals: "0",
        competition: "Stored Cup",
        competitionKey: "hallOfFameWorld.worldCupEdition",
        ...(season === undefined ? {} : { competitionSeason: season }),
        scorers: "",
        scorersSection: "",
        scorersData: "[]",
      },
    },
  })),
  {
    name: "a season-awards winner at no club, by any of its spellings, is a free agent",
    kind: "article",
    input: {
      id: "awards_1",
      headline_key: "be.news.seasonAwards.headline",
      body_key: "be.news.seasonAwards.bodyBoth",
      source_key: "be.source.leagueChronicle",
      i18n_params: {
        season: "2026",
        goldenBootWinner: "J. Doe",
        goldenBootTeam: "",
        goldenBootGoals: "24",
        potyWinner: "A. Roe",
        potyTeam: "Free Agent",
        potyRating: "7.9",
      },
    },
  },
  {
    name: "a season-awards winner at a club keeps the club's name",
    kind: "article",
    input: {
      id: "awards_2",
      headline_key: "be.news.seasonAwards.headline",
      body_key: "be.news.seasonAwards.bodyBoth",
      source_key: "be.source.leagueChronicle",
      i18n_params: {
        season: "2026",
        goldenBootWinner: "J. Doe",
        goldenBootTeam: "North",
        goldenBootGoals: "24",
        potyWinner: "A. Roe",
        potyTeam: "common.freeAgent",
        potyRating: "7.9",
      },
    },
  },
];
