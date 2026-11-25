import type { GoldenCase } from "./backendTextGolden.types";

/**
 * The golden cases for a news article's structured params (#1388, B): the lines the screen lays
 * out from a `*Data` param, and what it keeps when the data cannot be read. They run after the
 * cases of `backendTextGolden.test.ts` and before the names, and the order is the golden file's.
 */
export const NEWS_CASES: GoldenCase[] = [
  // The structured params the screen lays out (#1388): each article carries a `*Data` JSON param
  // the frontend expands into the lines of the body, and the backend's own plain `results` /
  // `scorers` / `quotes` params for them are empty or only English fallbacks.
  {
    name: "a roundup lays out its results and names the biggest winner",
    kind: "article",
    input: {
      id: "roundup_1",
      headline_key: "be.news.roundup.headline0",
      body_key: "be.news.roundup.body",
      source_key: "be.source.leagueWire",
      i18n_params: {
        matchday: "12",
        totalGoals: "9",
        matchCount: "3",
        results: "",
        resultsData: JSON.stringify([
          { home: "North", home_goals: 4, away: "South", away_goals: 1 },
          { home: "East", home_goals: 0, away: "West", away_goals: 0 },
          { home: "Hill", home_goals: 2, away: "Vale", away_goals: 2 },
        ]),
        biggestWinner: "North",
      },
    },
  },
  {
    name: "a roundup with no biggest winner leaves that sentence out",
    kind: "article",
    input: {
      id: "roundup_2",
      headline_key: "be.news.roundup.headline1",
      body_key: "be.news.roundup.body",
      source_key: "be.source.footballHerald",
      i18n_params: {
        matchday: "3",
        totalGoals: "0",
        matchCount: "1",
        results: "",
        resultsData: JSON.stringify([{ home: "East", home_goals: 0, away: "West", away_goals: 0 }]),
        biggestWinner: "",
      },
    },
  },
  {
    name: "a roundup whose results data cannot be read keeps the results the backend wrote",
    kind: "article",
    input: {
      id: "roundup_3",
      headline_key: "be.news.roundup.headline0",
      body_key: "be.news.roundup.body",
      source_key: "be.source.leagueWire",
      i18n_params: {
        matchday: "5",
        totalGoals: "3",
        matchCount: "1",
        results: "  North 3 - 0 South",
        resultsData: '[{"home":"North","home_goals":3',
        biggestWinner: "North",
      },
    },
  },
  // An empty list is a list: it lays out nothing, and replaces the backend's own `results` (which a
  // resolver that took an empty list for no list would keep).
  {
    name: "a roundup whose results data is an empty list lays out no results",
    kind: "article",
    input: {
      id: "roundup_5",
      headline_key: "be.news.roundup.headline0",
      body_key: "be.news.roundup.body",
      source_key: "be.source.leagueWire",
      i18n_params: {
        matchday: "5",
        totalGoals: "0",
        matchCount: "0",
        results: "  North 3 - 0 South",
        resultsData: "[]",
        biggestWinner: "",
      },
    },
  },
  // A list with a null entry parses, but the screen reads a field of every entry, so it throws and
  // keeps the params as the backend wrote them: its own `results`, `standings`, `scorers`, ...
  {
    name: "a roundup whose results data holds a null entry keeps the results the backend wrote",
    kind: "article",
    input: {
      id: "roundup_4",
      headline_key: "be.news.roundup.headline0",
      body_key: "be.news.roundup.body",
      source_key: "be.source.leagueWire",
      i18n_params: {
        matchday: "5",
        totalGoals: "3",
        matchCount: "1",
        results: "  North 3 - 0 South",
        resultsData: "[null]",
        biggestWinner: "North",
      },
    },
  },
  {
    name: "a standings update whose data holds a null entry keeps the standings the backend wrote",
    kind: "article",
    input: {
      id: "standings_2",
      headline_key: "be.news.standings.headline0",
      body_key: "be.news.standings.body",
      source_key: "be.source.leagueWire",
      i18n_params: {
        matchday: "8",
        leader: "North",
        standings: "  1. North — 19 pts (GD: +9)",
        standingsData: JSON.stringify([
          { rank: 1, team: "North", points: 19, goal_difference: "+9" },
          null,
        ]),
      },
    },
  },
  {
    name: "a match report whose scorers data holds a null entry keeps the scorers the backend wrote",
    kind: "article",
    input: {
      id: "report_4",
      headline_key: "be.news.matchReport.headline.homeWin.0",
      body_key: "be.news.matchReport.body0",
      source_key: "be.source.sportsGazette",
      i18n_params: {
        home: "North",
        away: "South",
        homeGoals: "2",
        awayGoals: "1",
        matchday: "5",
        winner: "North",
        loser: "South",
        scorers: "J. Doe (12', North)",
        scorersData: "[null]",
      },
    },
  },
  {
    name: "a press conference whose quotes data holds a null entry keeps the quote the backend wrote",
    kind: "article",
    input: {
      id: "press_4",
      headline_key: "be.news.pressConference.headlineManagerQuote",
      body_key: "be.news.pressConference.bodySingle",
      source_key: "be.source.leagueWire",
      i18n_params: {
        team: "South",
        result: "0-3",
        quote: "A tough afternoon",
        quotesData: JSON.stringify([{ fallback: "Another quote" }, null]),
      },
    },
  },
  {
    name: "a transfer roundup whose deals data holds a null entry keeps the deals the backend wrote",
    kind: "article",
    input: {
      id: "roundup_deals_2",
      headline_key: "be.news.transferRoundup.headline",
      body_key: "be.news.transferRoundup.body",
      source_key: "be.source.transferIntelligence",
      i18n_params: {
        weekStart: "2026-08-03",
        transferCount: "1",
        deals: "  J. Doe: North -> South (€12.5M)",
        dealsData: JSON.stringify([null]),
      },
    },
  },
  {
    name: "a preseason digest lays out its friendlies and one unbeaten club",
    kind: "article",
    input: {
      id: "preseason_1",
      headline_key: "be.news.preseasonDigest.headline",
      body_key: "be.news.preseasonDigest.bodyWithResults",
      source_key: "be.source.leagueChronicle",
      i18n_params: {
        weekStart: "2026-07-06",
        resultCount: "2",
        totalGoals: "5",
        results: "",
        resultsData: JSON.stringify([
          { home: "North", home_goals: 3, away: "South", away_goals: 1 },
          { home: "East", home_goals: 1, away: "West", away_goals: 0 },
        ]),
        unbeatenLine: "",
        unbeatenTeamsData: JSON.stringify(["North"]),
      },
    },
  },
  {
    name: "a preseason digest with no friendlies names two unbeaten clubs",
    kind: "article",
    input: {
      id: "preseason_2",
      headline_key: "be.news.preseasonDigest.headline",
      body_key: "be.news.preseasonDigest.bodyNoResults",
      source_key: "be.source.leagueChronicle",
      i18n_params: {
        weekStart: "2026-07-13",
        resultCount: "0",
        totalGoals: "0",
        results: "",
        unbeatenLine: "",
        unbeatenTeamsData: JSON.stringify(["North", "East"]),
      },
    },
  },
  {
    name: "a preseason digest lists three or more unbeaten clubs as a sentence",
    kind: "article",
    input: {
      id: "preseason_3",
      headline_key: "be.news.preseasonDigest.headline",
      body_key: "be.news.preseasonDigest.bodyNoResults",
      source_key: "be.source.leagueChronicle",
      i18n_params: {
        weekStart: "2026-07-20",
        resultCount: "0",
        totalGoals: "0",
        results: "",
        unbeatenLine: "",
        unbeatenTeamsData: JSON.stringify(["North", "East", "Hill", "Vale"]),
      },
    },
  },
  {
    name: "a standings update lays out its table",
    kind: "article",
    input: {
      id: "standings_1",
      headline_key: "be.news.standings.headline0",
      body_key: "be.news.standings.body",
      source_key: "be.source.leagueWire",
      i18n_params: {
        matchday: "8",
        leader: "North",
        standings: "",
        standingsData: JSON.stringify([
          { rank: 1, team: "North", points: 19, goal_difference: "+9" },
          { rank: 2, team: "East", points: 17, goal_difference: "+4" },
          { rank: 3, team: "Hill", points: 14, goal_difference: "-1" },
        ]),
      },
    },
  },
  {
    name: "a match report lists its scorers",
    kind: "article",
    input: {
      id: "report_1",
      headline_key: "be.news.matchReport.headline.homeWin.0",
      body_key: "be.news.matchReport.body0",
      source_key: "be.source.sportsGazette",
      i18n_params: {
        home: "North",
        away: "South",
        homeGoals: "2",
        awayGoals: "1",
        matchday: "5",
        winner: "North",
        loser: "South",
        scorers: "",
        scorersData: JSON.stringify([
          { player: "J. Doe", minute: 12, team: "North" },
          { player: "A. Roe", minute: 55, team: "South" },
          { player: "J. Doe", minute: 88, team: "North" },
        ]),
      },
    },
  },
  {
    name: "a match report with no scorers has no goals section",
    kind: "article",
    input: {
      id: "report_2",
      headline_key: "be.news.matchReport.headline.draw.1",
      body_key: "be.news.matchReport.body1.noScorers",
      source_key: "be.source.matchDayPress",
      i18n_params: {
        home: "East",
        away: "West",
        homeGoals: "0",
        awayGoals: "0",
        matchday: "6",
        scorers: "",
        scorersData: "[]",
      },
    },
  },
  {
    name: "a friendly report lists its scorers in a goals section",
    kind: "article",
    input: {
      id: "report_3",
      headline_key: "be.news.matchReport.reportFriendly.title",
      body_key: "be.news.matchReport.reportFriendly.body",
      source_key: "be.source.footballHerald",
      i18n_params: {
        home: "North",
        away: "South",
        homeGoals: "1",
        awayGoals: "0",
        scorers: "",
        scorersSection: "",
        scorersData: JSON.stringify([{ player: "J. Doe", minute: 33, team: "North" }]),
      },
    },
  },
  {
    name: "a press conference with several quotes lists them",
    kind: "article",
    input: {
      id: "press_1",
      headline_key: "be.news.pressConference.headlinePressConf",
      body_key: "be.news.pressConference.bodyMultiple",
      source_key: "be.source.leagueWire",
      i18n_params: {
        team: "North",
        result: "2-1",
        quote: "We never stopped believing",
        quotesData: JSON.stringify([
          { fallback: "We never stopped believing" },
          { fallback: "The lads showed real character" },
        ]),
      },
    },
  },
  {
    name: "a press conference with one quote shows it",
    kind: "article",
    input: {
      id: "press_2",
      headline_key: "be.news.pressConference.headlineManagerQuote",
      body_key: "be.news.pressConference.bodySingle",
      source_key: "be.source.leagueWire",
      i18n_params: {
        team: "South",
        result: "0-3",
        quote: "A tough afternoon",
        quotesData: JSON.stringify([{ fallback: "A tough afternoon" }]),
      },
    },
  },
  {
    name: "a friendly report with no scorers has no goals section",
    kind: "article",
    input: {
      id: "report_4",
      headline_key: "be.news.matchReport.reportFriendly.title",
      body_key: "be.news.matchReport.reportFriendly.body",
      source_key: "be.source.footballHerald",
      i18n_params: {
        home: "East",
        away: "West",
        homeGoals: "0",
        awayGoals: "0",
        scorers: "",
        scorersSection: "",
        scorersData: "[]",
      },
    },
  },
  {
    // The stored section is stale text the backend wrote before the data said there were no goals:
    // an empty list is a list, and clears it. A resolver that took the empty list for no list
    // would keep the section.
    name: "a friendly report whose scorers data is an empty list clears the goals section the backend wrote",
    kind: "article",
    input: {
      id: "report_5",
      headline_key: "be.news.matchReport.reportFriendly.title",
      body_key: "be.news.matchReport.reportFriendly.body",
      source_key: "be.source.footballHerald",
      i18n_params: {
        home: "East",
        away: "West",
        homeGoals: "0",
        awayGoals: "0",
        scorers: "J. Doe (12', East)",
        scorersSection: "\n\nGoals: J. Doe (12', East)",
        scorersData: "[]",
      },
    },
  },
  {
    // The quotes are what the manager picked, as the backend stores them: the response's own key
    // and params, and the text in the language it was written in (here Portuguese) as the fallback
    // and as `quote`. The screen resolves each quote from its key, so the English is the key's.
    name: "a press conference whose quotes carry response keys reads them in English, not in the fallback's language",
    kind: "article",
    input: {
      id: "press_3",
      headline_key: "be.news.pressConference.headlinePressConf",
      body_key: "be.news.pressConference.bodyMultiple",
      source_key: "be.source.leagueWire",
      i18n_params: {
        team: "North",
        result: "2-1",
        quote: "Os jogadores trabalharam muito. Preparámos bem e executámos o plano de jogo.",
        quotesData: JSON.stringify([
          {
            key: "match.press.result.responses.win.humble.text",
            fallback:
              "Os jogadores trabalharam muito. Preparámos bem e executámos o plano de jogo.",
          },
          {
            key: "match.press.playerFocus.responses.praise.text",
            fallback: "J. Doe tem sido fantástico. É um jogador-chave para nós.",
            params: { playerName: "J. Doe" },
          },
        ]),
      },
    },
  },
  // What else throws on the screen when a list's entries are not what the backend writes. Each is
  // caught there and the article keeps the params the backend wrote, so each is a case:
  // `parseMoneyValue(fee)` calls `.trim()`, which a missing, null or numeric fee does not have;
  // `resolveParamValues(quote.params)` calls `.includes` on every value, which only a string (or an
  // array) has; `Intl.ListFormat.format` throws on a team that is not a string.
  ...(
    [
      ["missing", { player: "A. Roe", fromTeam: "East", toTeam: "West" }],
      ["null", { player: "A. Roe", fromTeam: "East", toTeam: "West", fee: null }],
      ["a number", { player: "A. Roe", fromTeam: "East", toTeam: "West", fee: 800000 }],
    ] as const
  ).map(([what, deal], index) => ({
    name: `a transfer roundup with a deal whose fee is ${what} keeps the deals the backend wrote`,
    kind: "article" as const,
    input: {
      id: `roundup_deals_fee_${index}`,
      headline_key: "be.news.transferRoundup.headline",
      body_key: "be.news.transferRoundup.body",
      source_key: "be.source.transferIntelligence",
      i18n_params: {
        weekStart: "2026-08-03",
        transferCount: "2",
        // Not the line a fee of 800000 lays out (`(€800K)`), or a resolver that read the number as
        // a fee would write the same text as one that kept this.
        deals: "  J. Doe: North -> South (€12.5M)\n  A. Roe: East -> West (fee withheld)",
        dealsData: JSON.stringify([
          { player: "J. Doe", fromTeam: "North", toTeam: "South", fee: "12500000" },
          deal,
        ]),
      },
    },
  })),
  ...(
    [
      ["a number", 5],
      ["null", null],
    ] as const
  ).map(([what, value], index) => ({
    name: `a press conference with a quote whose param is ${what} keeps the quote the backend wrote`,
    kind: "article" as const,
    input: {
      id: `press_param_${index}`,
      headline_key: "be.news.pressConference.headlineManagerQuote",
      body_key: "be.news.pressConference.bodySingle",
      source_key: "be.source.leagueWire",
      i18n_params: {
        team: "South",
        result: "0-3",
        quote: "A tough afternoon",
        quotesData: JSON.stringify([
          {
            key: "match.press.playerFocus.responses.praise.text",
            fallback: "A tough afternoon",
            params: { playerName: value },
          },
        ]),
      },
    },
  })),
  {
    // An array has `.includes`, so it gets past the key check, but a param named like a money
    // figure is then read with `.trim()`, which an array does not have: the screen throws and keeps
    // the quote the backend stored, where laying the key out would read "J. Doe has been fantastic".
    name: "a press conference with a quote whose money param is an array keeps the quote the backend wrote",
    kind: "article",
    input: {
      id: "press_param_array",
      headline_key: "be.news.pressConference.headlineManagerQuote",
      body_key: "be.news.pressConference.bodySingle",
      source_key: "be.source.leagueWire",
      i18n_params: {
        team: "South",
        result: "0-3",
        quote: "A tough afternoon",
        quotesData: JSON.stringify([
          {
            key: "match.press.playerFocus.responses.praise.text",
            fallback: "A tough afternoon",
            params: { playerName: "J. Doe", fee: [] },
          },
        ]),
      },
    },
  },
  {
    // The screen spreads a list of params into an object (`{ ...params }`), so its values are read
    // one by one like an object's, and a number throws at `.includes` the same way.
    name: "a press conference with a quote whose params are a list holding a number keeps the quote the backend wrote",
    kind: "article",
    input: {
      id: "press_param_list",
      headline_key: "be.news.pressConference.headlineManagerQuote",
      body_key: "be.news.pressConference.bodySingle",
      source_key: "be.source.leagueWire",
      i18n_params: {
        team: "South",
        result: "0-3",
        quote: "A tough afternoon",
        quotesData: JSON.stringify([
          {
            key: "match.press.playerFocus.responses.praise.text",
            fallback: "A tough afternoon",
            params: [5],
          },
        ]),
      },
    },
  },
  {
    name: "a preseason digest with an unbeaten club that is no name keeps the lines the backend wrote",
    kind: "article",
    input: {
      id: "preseason_5",
      headline_key: "be.news.preseasonDigest.headline",
      body_key: "be.news.preseasonDigest.bodyWithResults",
      source_key: "be.source.leagueChronicle",
      i18n_params: {
        weekStart: "2026-07-06",
        resultCount: "1",
        totalGoals: "4",
        results: "  North 3 - 1 South",
        resultsData: JSON.stringify([
          { home: "North", home_goals: 3, away: "South", away_goals: 1 },
        ]),
        unbeatenLine: "\n\nNorth and East remain unbeaten in preseason.",
        unbeatenTeamsData: JSON.stringify(["North", 5]),
      },
    },
  },
  {
    name: "a transfer roundup lays out its deals with the fee compact",
    kind: "article",
    input: {
      id: "roundup_deals_1",
      headline_key: "be.news.transferRoundup.headline",
      body_key: "be.news.transferRoundup.body",
      source_key: "be.source.transferIntelligence",
      i18n_params: {
        weekStart: "2026-08-03",
        transferCount: "2",
        deals: "",
        dealsData: JSON.stringify([
          { player: "J. Doe", fromTeam: "North", toTeam: "South", fee: "12500000" },
          { player: "A. Roe", fromTeam: "East", toTeam: "West", fee: "800000" },
        ]),
      },
    },
  },
];
