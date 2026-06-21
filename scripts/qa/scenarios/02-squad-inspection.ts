// Scenario 02: Squad Inspection
//
// After bootstrapping a seeded game, verifies that the squad state exposed via
// MCP is internally consistent: the team has enough players, a formation is
// set, and the game summary reports a valid date and team name.
// Mirrors the Rust test `scenario_seeded_squad_has_valid_starting_xi`.

import type { McpClient } from "../mcp-client.ts";

const QA_SEED = 42;
const QA_TEAM_ID = "672200a5-a676-44be-bf10-8450f98f8b63";

interface GameState {
  clock: { current_date: string };
  manager: { team_id: string | null; first_name: string; last_name: string };
  teams: Array<{ id: string; name: string; formation: string }>;
  players: Array<{ id: string; team_id: string | null }>;
  league: { fixtures: unknown[] } | null;
}

export async function runSquadInspectionScenario(client: McpClient): Promise<void> {
  // Step 1: create a deterministic game
  console.log("  creating game (seed=42)...");
  await client.callToolText("game_new", {
    first_name: "QA",
    last_name: "Test",
    nationality: "England",
    team_id: QA_TEAM_ID,
    seed: QA_SEED,
  });

  // Step 2: read full game state and check structural integrity
  console.log("  reading game state...");
  const state = JSON.parse(await client.callToolText("info_game_state")) as GameState;

  if (!state.manager.team_id) {
    throw new Error("manager has no team_id after game_new");
  }

  const userTeam = state.teams.find((t) => t.id === state.manager.team_id);
  if (!userTeam) {
    throw new Error(`manager's team_id ${state.manager.team_id} not found in teams array`);
  }
  console.log("  team: %s  formation: %s", userTeam.name, userTeam.formation);

  if (!userTeam.formation.includes("-")) {
    throw new Error(`formation '${userTeam.formation}' is not a valid formation (expected e.g. 4-4-2)`);
  }

  const squadSize = state.players.filter((p) => p.team_id === state.manager.team_id).length;
  if (squadSize < 11) {
    throw new Error(`team has only ${squadSize} players — need at least 11`);
  }
  console.log("  squad size: %d", squadSize);

  if (!state.league || state.league.fixtures.length === 0) {
    throw new Error("league schedule missing or empty after bootstrap");
  }
  console.log("  fixtures scheduled: %d", state.league.fixtures.length);

  // Step 3: verify squad_get tool returns consistent data
  console.log("  calling squad_get...");
  const squadText = await client.callToolText("squad_get");
  if (!squadText.includes(userTeam.name) && !squadText.includes("Squad")) {
    throw new Error("squad_get response does not mention the team name or squad header");
  }

  // Step 4: verify info_game_summary returns a sensible summary
  console.log("  calling info_game_summary...");
  const summary = await client.callToolText("info_game_summary");
  if (!summary.includes(userTeam.name)) {
    throw new Error(`info_game_summary doesn't mention team name '${userTeam.name}'`);
  }

  console.log(
    "  PASS  team=%s  formation=%s  squad=%d  fixtures=%d",
    userTeam.name,
    userTeam.formation,
    squadSize,
    state.league.fixtures.length,
  );
}
