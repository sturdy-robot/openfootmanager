#!/usr/bin/env node
// Run every QA scenario in order and summarise results.
//
// Usage:
//   node --experimental-transform-types scripts/qa/run-all.ts [--port N]
//
// The game must already be running in MCP/sandbox mode:
//   cargo tauri dev --features mcp -- -- --no-gui --mcp-mode sandbox --mcp-port 3033

import { McpClient } from "./mcp-client.ts";
import { runGameLifecycleScenario } from "./scenarios/01-game-lifecycle.ts";
import { runSquadInspectionScenario } from "./scenarios/02-squad-inspection.ts";
import { runSaveLoadScenario } from "./scenarios/03-save-load.ts";
import { runMatchDayScenario } from "./scenarios/04-match-day.ts";

const ALL_SCENARIOS: Array<{ name: string; run: (client: McpClient) => Promise<void> }> = [
  { name: "01-game-lifecycle", run: runGameLifecycleScenario },
  { name: "02-squad-inspection", run: runSquadInspectionScenario },
  { name: "03-save-load", run: runSaveLoadScenario },
  { name: "04-match-day", run: runMatchDayScenario },
];

function parsePort(): number {
  const args = process.argv.slice(2);
  const idx = args.indexOf("--port");
  return idx !== -1 ? parseInt(args[idx + 1] ?? "3033", 10) : 3033;
}

async function main(): Promise<void> {
  const port = parsePort();
  console.log("Connecting to MCP server at port %d...\n", port);

  const results: Array<{ name: string; passed: boolean; error?: string }> = [];

  for (const scenario of ALL_SCENARIOS) {
    console.log("━".repeat(60));
    console.log("Scenario: %s", scenario.name);
    const client = new McpClient(port);
    try {
      await client.initialize();
      await scenario.run(client);
      results.push({ name: scenario.name, passed: true });
      console.log("");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ name: scenario.name, passed: false, error: message });
      console.error("FAILED:", message, "\n");
    }
  }

  console.log("━".repeat(60));
  console.log("Results:\n");
  let anyFailed = false;
  for (const r of results) {
    const icon = r.passed ? "✓" : "✗";
    console.log("  %s  %s%s", icon, r.name, r.error ? `  — ${r.error}` : "");
    if (!r.passed) anyFailed = true;
  }
  console.log("");

  if (anyFailed) {
    console.error("Some scenarios failed.");
    process.exit(1);
  }
  console.log("All scenarios passed.");
}

main();
