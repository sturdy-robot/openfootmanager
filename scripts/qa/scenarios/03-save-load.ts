// Scenario 03: Save/Load Round-Trip
//
// Bootstraps a seeded game, advances 3 days, saves via the MCP `game_save`
// tool, then loads it back via `game_load_save` and asserts the restored date
// matches the pre-save date.  Mirrors the Rust test
// `scenario_save_load_round_trip_preserves_date`.

import type { McpClient } from "../mcp-client.ts";

const QA_SEED = 42;
const QA_TEAM_ID = "672200a5-a676-44be-bf10-8450f98f8b63";

interface GameState {
  clock: { current_date: string };
  manager: { team_id: string | null };
}

function parseSaveId(gameNewText: string): string {
  const match = /Save ID:\s*(\S+)/.exec(gameNewText);
  if (!match) throw new Error(`Could not parse Save ID from game_new response:\n${gameNewText}`);
  return match[1];
}

export async function runSaveLoadScenario(client: McpClient): Promise<void> {
  // Step 1: create game and capture save ID
  console.log("  creating game (seed=42)...");
  const newText = await client.callToolText("game_new", {
    first_name: "QA",
    last_name: "Test",
    nationality: "England",
    team_id: QA_TEAM_ID,
    seed: QA_SEED,
  });
  const saveId = parseSaveId(newText);
  console.log("  save ID: %s", saveId);

  // Step 2: advance 3 days
  console.log("  advancing 3 days...");
  for (let day = 1; day <= 3; day++) {
    await client.callToolText("time_advance");
  }

  // Step 3: capture date before saving
  const beforeState = JSON.parse(await client.callToolText("info_game_state")) as GameState;
  const expectedDate = beforeState.clock.current_date;
  console.log("  date before save: %s", expectedDate);

  // Step 4: save to disk
  console.log("  saving game...");
  const saveText = await client.callToolText("game_save");
  if (!saveText.includes(saveId)) {
    throw new Error(`game_save response doesn't mention expected save ID ${saveId}:\n${saveText}`);
  }

  // Step 5: reload from disk
  console.log("  loading save %s...", saveId);
  await client.callToolText("game_load_save", { save_id: saveId });

  // Step 6: verify restored date
  const afterState = JSON.parse(await client.callToolText("info_game_state")) as GameState;
  if (afterState.clock.current_date !== expectedDate) {
    throw new Error(
      `date mismatch after load: expected ${expectedDate}, got ${afterState.clock.current_date}`,
    );
  }
  if (!afterState.manager.team_id) {
    throw new Error("manager lost team assignment after save/load");
  }

  console.log("  PASS  date=%s  team=%s", afterState.clock.current_date, afterState.manager.team_id);
}
