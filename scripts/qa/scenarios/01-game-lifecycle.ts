// Scenario 01: Game Lifecycle
//
// Verifies the core turn-loop: create a seeded game, advance 7 days, confirm
// the clock advanced exactly 7 days.  Mirrors the Rust integration test
// `scenario_seeded_game_lifecycle_advances_7_days` but exercises the full
// MCP transport stack end-to-end.

import type { McpClient } from "../mcp-client.ts";

// Seed 42 is the canonical QA fixture. The first team ID is deterministic for
// this seed — captured once from the Rust test output and recorded here.
const QA_SEED = 42;
const QA_TEAM_ID = "672200a5-a676-44be-bf10-8450f98f8b63";

interface GameState {
  clock: { current_date: string };
  manager: { team_id: string | null };
}

export async function runGameLifecycleScenario(client: McpClient): Promise<void> {
  // Step 1: create a deterministic game
  console.log("  creating game (seed=42, team=%s)...", QA_TEAM_ID);
  await client.callToolText("game_new", {
    first_name: "QA",
    last_name: "Test",
    nationality: "England",
    team_id: QA_TEAM_ID,
    seed: QA_SEED,
  });

  // Step 2: check initial state
  const before = JSON.parse(await client.callToolText("info_game_state")) as GameState;
  if (!before.manager.team_id) throw new Error("manager has no team after game_new");
  const initialDate = new Date(before.clock.current_date);
  console.log("  initial date: %s", before.clock.current_date);

  // Step 3: advance 7 days
  console.log("  advancing 7 days...");
  for (let day = 1; day <= 7; day++) {
    await client.callToolText("time_advance");
  }

  // Step 4: verify clock advanced
  const after = JSON.parse(await client.callToolText("info_game_state")) as GameState;
  const elapsed = Math.round(
    (new Date(after.clock.current_date).getTime() - initialDate.getTime()) / 86_400_000,
  );
  if (elapsed !== 7) {
    throw new Error(
      `expected 7 days elapsed, got ${elapsed} (${before.clock.current_date} → ${after.clock.current_date})`,
    );
  }
  console.log("  PASS  %s → %s (+%d days)", before.clock.current_date, after.clock.current_date, elapsed);
}
