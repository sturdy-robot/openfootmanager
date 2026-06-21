#!/usr/bin/env node
// QA scenario runner for OpenFoot Manager.
//
// Usage:
//   node --experimental-transform-types scripts/qa/run-scenario.ts <scenario> [--port N]
//
// The game must already be running in MCP/sandbox mode:
//   cargo tauri dev --features mcp -- -- --no-gui --mcp-mode sandbox --mcp-port 3033
//
// Scenarios:
//   01  game-lifecycle   Create game, advance 7 days, verify clock

import { McpClient } from "./mcp-client.ts";
import { runGameLifecycleScenario } from "./scenarios/01-game-lifecycle.ts";
import { runSquadInspectionScenario } from "./scenarios/02-squad-inspection.ts";
import { runSaveLoadScenario } from "./scenarios/03-save-load.ts";
import { runMatchDayScenario } from "./scenarios/04-match-day.ts";

const SCENARIOS: Record<string, (client: McpClient) => Promise<void>> = {
  "01": runGameLifecycleScenario,
  "game-lifecycle": runGameLifecycleScenario,
  "02": runSquadInspectionScenario,
  "squad-inspection": runSquadInspectionScenario,
  "03": runSaveLoadScenario,
  "save-load": runSaveLoadScenario,
  "04": runMatchDayScenario,
  "match-day": runMatchDayScenario,
};

function parseArgs(): { scenario: string; port: number } {
  const args = process.argv.slice(2);
  let scenario = args.find((a) => !a.startsWith("--")) ?? "01";
  const portIdx = args.indexOf("--port");
  const port = portIdx !== -1 ? parseInt(args[portIdx + 1] ?? "3033", 10) : 3033;
  return { scenario, port };
}

async function main(): Promise<void> {
  const { scenario, port } = parseArgs();

  const run = SCENARIOS[scenario];
  if (!run) {
    console.error("Unknown scenario: %s", scenario);
    console.error("Available:", Object.keys(SCENARIOS).join(", "));
    process.exit(1);
  }

  console.log("Connecting to MCP server at port %d...", port);
  const client = new McpClient(port);

  try {
    await client.initialize();
    console.log("Connected. Running scenario: %s", scenario);
    await run(client);
    console.log("\nAll assertions passed.");
  } catch (err) {
    console.error("\nScenario FAILED:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
