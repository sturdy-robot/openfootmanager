#!/usr/bin/env node
// L4: AI QA agent — screenshot-based UX defect analysis for OpenFoot Manager.
//
// Prerequisites:
//   1. Game running with GUI + MCP:
//        cargo tauri dev --features mcp -- -- --mcp-mode sandbox --mcp-port 3033
//      (omit --no-gui so the window is visible for screenshots)
//   2. ANTHROPIC_API_KEY set in environment
//
// Usage:
//   node --experimental-transform-types scripts/qa/l4-agent.ts [--port N] [--probe]
//
// --probe: take one screenshot and save it without calling Claude (verify display capture works).

import Anthropic from "@anthropic-ai/sdk";
import { execSync } from "child_process";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { McpClient } from "./mcp-client.ts";

const QA_SEED = 42;
const QA_TEAM_ID = "672200a5-a676-44be-bf10-8450f98f8b63";
const SCREENSHOT_DIR = "/tmp/ofm-qa-screenshots";
const SETTLE_MS = 2500;

interface Finding {
  severity: "critical" | "major" | "minor" | "info";
  area: string;
  description: string;
  recommendation: string;
}

interface StateAnalysis {
  state: string;
  screenshotPath: string;
  findings: Finding[];
  overallScore: number;
  summary: string;
}

function parseArgs(): { port: number; probe: boolean } {
  const args = process.argv.slice(2);
  const portIdx = args.indexOf("--port");
  const port = portIdx !== -1 ? parseInt(args[portIdx + 1] ?? "3033", 10) : 3033;
  const probe = args.includes("--probe");
  return { port, probe };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function takeScreenshot(name: string): string {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const path = join(SCREENSHOT_DIR, `${name}.png`);
  // spectacle is KDE's screenshot tool and works correctly under Wayland.
  // -f fullscreen  -b background (no UI)  -n no notification  -o output file
  execSync(`WAYLAND_DISPLAY=wayland-0 spectacle -f -b -n -o "${path}"`, { timeout: 10_000 });
  return path;
}

async function analyzeScreenshot(
  anthropic: Anthropic,
  stateName: string,
  screenshotPath: string,
  context: string,
): Promise<StateAnalysis> {
  const base64 = readFileSync(screenshotPath).toString("base64");

  const response = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: "image/png", data: base64 },
          },
          {
            type: "text",
            text: `You are a UX QA expert analyzing a screenshot of OpenFoot Manager, a Tauri+React football management game.

Current game state: ${stateName}
Context: ${context}

Inspect this screenshot for:
- UX defects (missing/broken elements, confusing flows, unclear feedback)
- Visual bugs (layout breaks, overflow, misalignment, unexpected blank areas)
- Accessibility issues (low contrast, tiny text, unlabelled controls)
- Data display problems (truncated text, wrong number formats, stale/missing data)
- Design inconsistencies (spacing, typography, colour use)

Respond with ONLY a raw JSON object (no markdown fences, no prose before or after):
{
  "findings": [
    {
      "severity": "critical|major|minor|info",
      "area": "short label for the UI area",
      "description": "what exactly is wrong and where",
      "recommendation": "specific, actionable fix"
    }
  ],
  "overallScore": <integer 1-10, 10 = no visible issues>,
  "summary": "2-3 sentence overall assessment of this screen"
}

Rules:
- If the screenshot is blank, entirely black, or does not show the game UI at all, that is a critical finding.
- Only report real, observable issues — not style preferences.
- If the screen looks correct, return an empty findings array and a high score.`,
          },
        ],
      },
    ],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  let parsed: { findings: Finding[]; overallScore: number; summary: string };
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("no JSON in response");
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return {
      state: stateName,
      screenshotPath,
      findings: [
        {
          severity: "critical",
          area: "l4-parse",
          description: `Could not parse Claude response: ${text.slice(0, 300)}`,
          recommendation: "Re-run agent; check model response format",
        },
      ],
      overallScore: 0,
      summary: "Analysis parsing failed.",
    };
  }

  return {
    state: stateName,
    screenshotPath,
    findings: parsed.findings ?? [],
    overallScore: typeof parsed.overallScore === "number" ? parsed.overallScore : 5,
    summary: parsed.summary ?? "",
  };
}

function printReport(analyses: StateAnalysis[]): void {
  const line70 = "═".repeat(70);
  const thin70 = "─".repeat(70);
  console.log(`\n${line70}`);
  console.log("L4 AI QA REPORT — OpenFoot Manager");
  console.log(line70);

  const allFindings = analyses.flatMap((a) => a.findings);
  const counts = { critical: 0, major: 0, minor: 0, info: 0 };
  for (const f of allFindings) counts[f.severity]++;
  const avgScore =
    analyses.reduce((s, a) => s + a.overallScore, 0) / Math.max(1, analyses.length);

  console.log(`\nStates analyzed  : ${analyses.length}`);
  console.log(`Avg UX score     : ${avgScore.toFixed(1)}/10`);
  console.log(
    `Findings         : ${counts.critical} critical  ${counts.major} major  ${counts.minor} minor  ${counts.info} info`,
  );

  for (const a of analyses) {
    console.log(`\n${thin70}`);
    console.log(`State : ${a.state}  (score: ${a.overallScore}/10)`);
    console.log(`Shot  : ${a.screenshotPath}`);
    if (a.summary) console.log(`\n${a.summary}`);
    if (a.findings.length === 0) {
      console.log("\n  (no issues found)");
    } else {
      for (const f of a.findings) {
        const icon = { critical: "✗✗", major: "✗ ", minor: "△ ", info: "ℹ " }[f.severity];
        console.log(`\n  ${icon} [${f.severity.toUpperCase()}] ${f.area}`);
        console.log(`     ${f.description}`);
        console.log(`     → ${f.recommendation}`);
      }
    }
  }

  console.log(`\n${line70}`);

  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const reportPath = join(SCREENSHOT_DIR, "report.json");
  writeFileSync(
    reportPath,
    JSON.stringify({ generatedAt: new Date().toISOString(), analyses }, null, 2),
  );
  console.log(`\nJSON report saved : ${reportPath}`);
  console.log(`Screenshots       : ${SCREENSHOT_DIR}/`);
}

async function runProbe(): Promise<void> {
  console.log("Probe mode — taking one screenshot without Claude analysis.");
  const path = takeScreenshot("probe");
  console.log(`Saved: ${path}`);
  console.log("Open the file to verify the Tauri window is captured correctly.");
}

async function runAgent(port: number): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY is not set. Export it before running.");
    process.exit(1);
  }

  console.log(`L4 AI QA agent  port=${port}  screenshots → ${SCREENSHOT_DIR}`);

  const anthropic = new Anthropic({ apiKey });
  const client = new McpClient(port);

  try {
    await client.initialize();
    console.log("Connected to MCP server.\n");
  } catch (err) {
    console.error("MCP connection failed:", err instanceof Error ? err.message : err);
    console.error(
      `Start the game first:\n  cargo tauri dev --features mcp -- -- --mcp-mode sandbox --mcp-port ${port}`,
    );
    process.exit(1);
  }

  const analyses: StateAnalysis[] = [];

  async function capture(name: string, state: string, context: string): Promise<void> {
    let screenshotPath: string;
    process.stdout.write(`  → screenshot ${name} ... `);
    try {
      screenshotPath = takeScreenshot(name);
      console.log("ok");
    } catch (e) {
      console.log("FAILED");
      console.error(`    ${e instanceof Error ? e.message : e}`);
      analyses.push({
        state,
        screenshotPath: "(capture failed)",
        findings: [
          {
            severity: "critical",
            area: "screenshot",
            description: "Screenshot capture failed",
            recommendation:
              "Ensure spectacle is installed and WAYLAND_DISPLAY=wayland-0 is set",
          },
        ],
        overallScore: 0,
        summary: "Screenshot capture failed; cannot analyze.",
      });
      return;
    }
    process.stdout.write(`  → analyzing with Claude ... `);
    const analysis = await analyzeScreenshot(anthropic, state, screenshotPath, context);
    analyses.push(analysis);
    console.log(`score ${analysis.overallScore}/10  findings ${analysis.findings.length}`);
  }

  // ── 1: New game — GUI navigates to dashboard via game-state-changed event ──
  console.log("[1/4] Creating game via MCP...");
  await client.callToolText("game_new", {
    first_name: "QA",
    last_name: "Tester",
    nationality: "England",
    team_id: QA_TEAM_ID,
    seed: QA_SEED,
  });
  await sleep(SETTLE_MS);
  await capture(
    "01-dashboard",
    "Initial game dashboard",
    "A new game was just started. The UI should show the main manager dashboard: club overview, finances, next fixture, date.",
  );

  // ── 2: After 3 days — date and news should update ──────────────────────────
  console.log("[2/4] Advancing 3 days...");
  for (let i = 0; i < 3; i++) await client.callToolText("time_advance");
  await sleep(SETTLE_MS);
  await capture(
    "02-after-3-days",
    "Dashboard after 3 days",
    "3 days have passed. Date should be updated, news feed may have new items, next fixture countdown should change.",
  );

  // ── 3: After 7 days total — more activity visible ─────────────────────────
  console.log("[3/4] Advancing 4 more days (7 total)...");
  for (let i = 0; i < 4; i++) await client.callToolText("time_advance");
  await sleep(SETTLE_MS);
  await capture(
    "03-after-7-days",
    "Dashboard after 7 days",
    "7 days into the season. The dashboard should reflect league standings, upcoming fixtures, and any recent news.",
  );

  // ── 4: Match day — UI should signal match preparation ─────────────────────
  console.log("[4/4] Skipping to first match day...");
  await client.callToolText("time_skip_to_match_day");
  await sleep(SETTLE_MS);
  await capture(
    "04-match-day",
    "Match day screen",
    "It's match day. The dashboard should prominently show the upcoming fixture, team selection or match preview, and match-day controls.",
  );

  printReport(analyses);
}

async function main(): Promise<void> {
  const { port, probe } = parseArgs();
  if (probe) {
    await runProbe();
  } else {
    await runAgent(port);
  }
}

main().catch((err) => {
  console.error("L4 agent failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
