// Scenario 04: Match Day
//
// After bootstrapping a seeded game, uses `time_skip_to_match_day` to jump to
// the first fixture the user's team plays, then advances through it and
// confirms via `info_game_state` that the fixture is now Completed with a
// result.  Mirrors the Rust test `scenario_first_match_day_produces_result`.

import type { McpClient } from "../mcp-client.ts";

const QA_SEED = 42;
const QA_TEAM_ID = "672200a5-a676-44be-bf10-8450f98f8b63";

interface MatchResult {
  home_goals: number;
  away_goals: number;
}

interface Fixture {
  id: string;
  date: string;
  home_team_id: string;
  away_team_id: string;
  status: "Scheduled" | "InProgress" | "Completed";
  result: MatchResult | null;
}

interface GameState {
  clock: { current_date: string };
  manager: { team_id: string | null };
  league: { fixtures: Fixture[] } | null;
}

export async function runMatchDayScenario(client: McpClient): Promise<void> {
  // Step 1: create game
  console.log("  creating game (seed=42)...");
  await client.callToolText("game_new", {
    first_name: "QA",
    last_name: "Test",
    nationality: "England",
    team_id: QA_TEAM_ID,
    seed: QA_SEED,
  });

  // Step 2: skip to the first match day for the user's team
  console.log("  skipping to first match day...");
  const skipText = await client.callToolText("time_skip_to_match_day");
  console.log("  skip result: %s", skipText.slice(0, 80).replace(/\n/g, " "));

  // Step 3: check what fixtures are scheduled for today
  const beforeState = JSON.parse(await client.callToolText("info_game_state")) as GameState;
  const today = beforeState.clock.current_date.slice(0, 10); // ISO date part only
  const teamId = beforeState.manager.team_id;
  if (!teamId) throw new Error("manager has no team after game_new");

  const todayFixture = beforeState.league?.fixtures.find(
    (f) =>
      f.date === today &&
      f.status === "Scheduled" &&
      (f.home_team_id === teamId || f.away_team_id === teamId),
  );
  if (!todayFixture) {
    throw new Error(
      `no scheduled fixture found for team ${teamId} on ${today} — skip may not have landed on a match day`,
    );
  }
  console.log("  match day: %s  fixture id: %s", today, todayFixture.id);

  // Step 4: advance through the match day
  console.log("  advancing through match day...");
  await client.callToolText("time_advance");

  // Step 5: verify the fixture is Completed with a result
  const afterState = JSON.parse(await client.callToolText("info_game_state")) as GameState;
  const fixture = afterState.league?.fixtures.find((f) => f.id === todayFixture.id);
  if (!fixture) throw new Error(`fixture ${todayFixture.id} disappeared from league after advance`);

  if (fixture.status !== "Completed") {
    throw new Error(`fixture status is '${fixture.status}' — expected 'Completed'`);
  }
  if (!fixture.result) {
    throw new Error("fixture is Completed but has no result");
  }

  const { home_goals, away_goals } = fixture.result;
  console.log(
    "  PASS  %s vs %s  %d-%d  (fixture %s)",
    fixture.home_team_id === teamId ? "us" : fixture.home_team_id,
    fixture.away_team_id === teamId ? "us" : fixture.away_team_id,
    home_goals,
    away_goals,
    fixture.id,
  );
}
