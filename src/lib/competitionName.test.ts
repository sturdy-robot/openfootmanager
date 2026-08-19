import { describe, expect, it } from "vitest";

import type { FixtureData, GameStateData } from "../store/gameStore";
import * as competitionNames from "./competitionName";

interface MatchdayIdentity {
  competitionName: string | null;
  roundLabel: string;
}

type Translate = (key: string, options?: Record<string, unknown>) => string;
type ResolveMatchdayIdentity = (
  gameState: Pick<GameStateData, "competitions" | "league">,
  fixture: FixtureData | null,
  t: Translate,
) => MatchdayIdentity;

function matchdayIdentity(): ResolveMatchdayIdentity {
  const candidate = (
    competitionNames as Record<string, unknown>
  ).matchdayIdentity;

  expect(
    candidate,
    "competitionName.ts must export matchdayIdentity",
  ).toBeTypeOf("function");

  return candidate as ResolveMatchdayIdentity;
}

function translate(
  key: string,
  options?: Record<string, unknown>,
): string {
  if (key === "nations.br") return "Brazil";
  if (key === "competitionNames.firstDivision") {
    return `${options?.country} First Division`;
  }
  if (key === "common.matchday") return `Matchday ${options?.n}`;
  if (key === "season.friendly") return "Friendly";
  if (key === "season.preseasonTournament") return "Pre-season Tournament";
  if (key === "match.matchDay") return "Match Day";
  return String(options?.defaultValue ?? key);
}

function fixture(overrides: Partial<FixtureData> = {}): FixtureData {
  return {
    id: "fixture-12",
    competition_id: "brazil-1",
    matchday: 12,
    date: "2026-08-19",
    home_team_id: "home",
    away_team_id: "away",
    competition: "League",
    status: "Scheduled",
    result: null,
    ...overrides,
  };
}

const competition = {
  id: "brazil-1",
  name: "Stored Division Name",
  name_key: "competitionNames.firstDivision",
  season: 2026,
  country_id: "BR",
  fixtures: [],
  standings: [],
};

describe("matchday identity", () => {
  it("uses the localized competition display name and fixture round", () => {
    const resolve = matchdayIdentity();

    expect(
      resolve({ competitions: [competition], league: null }, fixture(), translate),
    ).toEqual({
      competitionName: "Brazil First Division",
      roundLabel: "Matchday 12",
    });
  });

  it("uses the legacy league when an old fixture has no competition id", () => {
    const resolve = matchdayIdentity();

    expect(
      resolve(
        { competitions: undefined, league: competition },
        fixture({ competition_id: undefined, matchday: 3 }),
        translate,
      ),
    ).toEqual({
      competitionName: "Brazil First Division",
      roundLabel: "Matchday 3",
    });
  });

  it("names a friendly without inventing a competition", () => {
    const resolve = matchdayIdentity();

    expect(
      resolve(
        { competitions: [competition], league: competition },
        fixture({ competition: "Friendly", competition_id: undefined }),
        translate,
      ),
    ).toEqual({
      competitionName: null,
      roundLabel: "Friendly",
    });
  });

  it("names a pre-season tournament without borrowing the league name", () => {
    const resolve = matchdayIdentity();

    expect(
      resolve(
        { competitions: [competition], league: competition },
        fixture({
          competition: "PreseasonTournament",
          competition_id: undefined,
        }),
        translate,
      ),
    ).toEqual({
      competitionName: null,
      roundLabel: "Pre-season Tournament",
    });
  });

  it("falls back to a generic match-day label when no fixture can be resolved", () => {
    const resolve = matchdayIdentity();

    expect(
      resolve({ competitions: [], league: null }, null, translate),
    ).toEqual({
      competitionName: null,
      roundLabel: "Match Day",
    });
  });
});
