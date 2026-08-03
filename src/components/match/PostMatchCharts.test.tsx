import { describe, expect, it } from "vitest";
import { buildXgRace } from "./PostMatchCharts";
import type { MatchEvent } from "./types";

const shot = (
  minute: number,
  side: "Home" | "Away",
  xg: number,
  kind: "Shot" | "Goal" = "Shot",
): MatchEvent =>
  ({
    minute,
    event_type: kind === "Goal" ? "Goal" : "ShotOffTarget",
    side,
    zone: "AwayBox",
    player_id: "p1",
    secondary_player_id: null,
    detail:
      kind === "Goal"
        ? { Goal: { context: "Opener", technique: "Simple", xg } }
        : { Shot: { danger: "Decent", technique: "Simple", xg } },
  }) as unknown as MatchEvent;

describe("buildXgRace", () => {
  it("accumulates each side separately and never decreases", () => {
    const points = buildXgRace(
      [shot(10, "Home", 0.2), shot(20, "Away", 0.5), shot(30, "Home", 0.3, "Goal")],
      90,
    );
    const home = points.map((p) => p.home);
    const away = points.map((p) => p.away);

    expect(home[home.length - 1]).toBeCloseTo(0.5);
    expect(away[away.length - 1]).toBeCloseTo(0.5);
    // A cumulative total that dips would mean a chance had been un-created.
    for (let i = 1; i < points.length; i++) {
      expect(home[i]).toBeGreaterThanOrEqual(home[i - 1]);
      expect(away[i]).toBeGreaterThanOrEqual(away[i - 1]);
    }
  });

  it("starts at nil-nil and runs to the final whistle", () => {
    const points = buildXgRace([shot(10, "Home", 0.4)], 94);
    expect(points[0]).toEqual({ minute: 0, home: 0, away: 0 });
    expect(points[points.length - 1].minute).toBe(94);
  });

  it("ignores events that carry no chance value", () => {
    const foul = {
      minute: 5,
      event_type: "Foul",
      side: "Home",
      zone: "Midfield",
      player_id: "p1",
      secondary_player_id: null,
      detail: { Foul: { severity: "Hard" } },
    } as unknown as MatchEvent;
    // Only the opening and closing points survive, so the chart knows to say
    // nothing rather than drawing two flat lines at zero.
    expect(buildXgRace([foul], 90)).toHaveLength(2);
  });

  it("reads a feed from before shots carried a value", () => {
    const legacy = {
      minute: 12,
      event_type: "Goal",
      side: "Home",
      zone: "AwayBox",
      player_id: "p1",
      secondary_player_id: null,
      detail: { Goal: { context: "Opener" } },
    } as unknown as MatchEvent;
    expect(() => buildXgRace([legacy], 90)).not.toThrow();
  });
});
