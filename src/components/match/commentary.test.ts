import { afterAll, beforeAll, describe, expect, it } from "vitest";
import i18n, { i18nReady } from "../../i18n";
import { getCommentary } from "./commentary";
import type { MatchEvent, MatchSnapshot, EnginePlayerData } from "./types";

const makePlayer = (id: string, name: string): EnginePlayerData =>
  ({ id, name, position: "FW" } as unknown as EnginePlayerData);

const snapshot = (events: MatchEvent[] = []): MatchSnapshot =>
  ({
    home_team: { id: "h", name: "Home FC", players: [makePlayer("p1", "Haaland")] },
    away_team: { id: "a", name: "Away FC", players: [makePlayer("p2", "Mbappe"), makePlayer("p3", "Marquinhos")] },
    home_bench: [],
    away_bench: [],
    events,
  } as unknown as MatchSnapshot);

const goal = (minute: number, player_id: string): MatchEvent => ({
  minute,
  event_type: "Goal",
  side: "Home",
  zone: "AwayBox",
  player_id,
  secondary_player_id: null,
  detail: { Goal: { context: "Extends" } },
});

let previousLanguage: string;

beforeAll(async () => {
  await i18nReady;
  previousLanguage = i18n.language;
  await i18n.changeLanguage("en");
});

afterAll(async () => {
  await i18n.changeLanguage(previousLanguage);
});

describe("getCommentary", () => {
  it("returns null for non-key events", () => {
    const evt: MatchEvent = {
      minute: 5,
      event_type: "PassCompleted",
      side: "Home",
      zone: "Midfield",
      player_id: "p1",
      secondary_player_id: null,
    };
    expect(getCommentary(evt, snapshot(), i18n.t.bind(i18n))).toBeNull();
  });

  it("produces a non-empty headline and line for a goal", () => {
    const evt = goal(10, "p1");
    const result = getCommentary(evt, snapshot([evt]), i18n.t.bind(i18n));
    expect(result).not.toBeNull();
    expect(result!.headline.length).toBeGreaterThan(0);
    expect(result!.line.length).toBeGreaterThan(0);
    expect(result!.line).toContain("Haaland");
  });

  it("is deterministic — same event yields the same line", () => {
    const evt = goal(10, "p1");
    const a = getCommentary(evt, snapshot([evt]), i18n.t.bind(i18n));
    const b = getCommentary(evt, snapshot([evt]), i18n.t.bind(i18n));
    expect(a).toEqual(b);
  });

  it("uses the brace variant for a player's second goal", () => {
    const g1 = goal(10, "p1");
    const g2 = goal(40, "p1");
    const result = getCommentary(g2, snapshot([g1, g2]), i18n.t.bind(i18n));
    expect(result!.line.toLowerCase()).toMatch(/brace|two/);
  });

  it("never leaks unresolved interpolation tokens", () => {
    const evt: MatchEvent = {
      minute: 22,
      event_type: "Foul",
      side: "Away",
      zone: "Midfield",
      player_id: "p3",
      secondary_player_id: "p2",
      detail: { Foul: { severity: "Hard" } },
    };
    const result = getCommentary(evt, snapshot([evt]), i18n.t.bind(i18n));
    expect(result!.line).not.toMatch(/\{\{.*?\}\}/);
  });

  it("falls back to the base key when detail is absent (penalty goal)", () => {
    const evt: MatchEvent = {
      minute: 50,
      event_type: "PenaltyGoal",
      side: "Home",
      zone: "AwayBox",
      player_id: "p1",
      secondary_player_id: null,
    };
    const result = getCommentary(evt, snapshot([evt]), i18n.t.bind(i18n));
    expect(result).not.toBeNull();
    expect(result!.line.length).toBeGreaterThan(0);
  });

  it("uses the hat-trick variant and headline for a player's third goal", () => {
    const g1 = goal(10, "p1");
    const g2 = goal(40, "p1");
    const g3 = goal(70, "p1");
    const result = getCommentary(g3, snapshot([g1, g2, g3]), i18n.t.bind(i18n));
    expect(result!.headline).toBe("HAT-TRICK!");
    expect(result!.line.toLowerCase()).toMatch(/hat-trick|three/);
  });

  it("only uses the hat-trick variant on the third goal", () => {
    const g1 = goal(10, "p1");
    const g2 = goal(40, "p1");
    const g3 = goal(70, "p1");
    const g4 = goal(82, "p1");
    const result = getCommentary(g4, snapshot([g1, g2, g3, g4]), i18n.t.bind(i18n));
    expect(result!.headline).not.toBe("HAT-TRICK!");
    expect(result!.line.toLowerCase()).not.toContain("hat-trick");
  });

  it("falls back from a missing variant key to the base key", () => {
    // ShotBlocked has a "bigChance" variant in en.json but NO "speculative"
    // variant, so a Speculative-danger blocked shot must fall back to the base
    // ShotBlocked commentary rather than returning null.
    const evt: MatchEvent = {
      minute: 33,
      event_type: "ShotBlocked",
      side: "Home",
      zone: "AwayBox",
      player_id: "p1",
      secondary_player_id: null,
      detail: { Shot: { danger: "Speculative" } },
    };
    const result = getCommentary(evt, snapshot([evt]), i18n.t.bind(i18n));
    expect(result).not.toBeNull();
    expect(result!.line.length).toBeGreaterThan(0);
    expect(result!.line).not.toMatch(/\{\{.*?\}\}/);
  });
});

describe("build-up commentary", () => {
  const buildUp = (minute: number, type: string): MatchEvent =>
    ({
      minute,
      event_type: type,
      side: "Home",
      zone: "Midfield",
      player_id: "p1",
      secondary_player_id: null,
      detail: null,
    }) as unknown as MatchEvent;

  it("narrates set pieces that used to be silent", () => {
    const corner = buildUp(12, "Corner");
    const result = getCommentary(corner, snapshot([corner]), i18n.t.bind(i18n));
    expect(result).not.toBeNull();
    expect(result?.line.length).toBeGreaterThan(0);
  });

  it("shows only a fraction of the passes, or the feed would bury the goals", () => {
    // A match resolves hundreds of actions. Narrating every one is worse than
    // narrating none, so completed passes are sampled.
    const passes = Array.from({ length: 400 }, (_, index) =>
      buildUp(index % 90, "PassCompleted"),
    );
    const shown = passes.filter(
      (evt) => getCommentary(evt, snapshot(passes), i18n.t.bind(i18n)) !== null,
    ).length;
    expect(shown).toBeGreaterThan(0);
    expect(shown).toBeLessThan(passes.length * 0.15);
  });

  it("keeps the same events every time it is asked", () => {
    // The feed re-renders constantly; a line that appears and disappears would
    // be worse than no line at all.
    const events = Array.from({ length: 60 }, (_, index) =>
      buildUp(index, "Tackle"),
    );
    const first = events.map(
      (evt) => getCommentary(evt, snapshot(events), i18n.t.bind(i18n)) !== null,
    );
    const second = events.map(
      (evt) => getCommentary(evt, snapshot(events), i18n.t.bind(i18n)) !== null,
    );
    expect(second).toEqual(first);
  });
});

describe("commentary sampling is per-event, not per-minute", () => {
  it("does not show the same line twice for a player's repeated actions", () => {
    // The chain resolves several actions a minute, so a midfielder can pass
    // three times inside one minute. If the sampler cannot tell those events
    // apart, it keeps or drops all of them together and renders the identical
    // sentence back to back.
    const repeated = Array.from({ length: 3 }, () =>
      ({
        minute: 34,
        // Corners are always shown, so this cannot pass by everything being
        // sampled out — which is exactly how the first version of this test
        // passed while proving nothing.
        event_type: "Corner",
        side: "Home",
        zone: "Midfield",
        player_id: "p1",
        secondary_player_id: null,
        detail: null,
      }) as unknown as MatchEvent,
    );
    const lines = repeated
      .map((evt) => getCommentary(evt, snapshot(repeated), i18n.t.bind(i18n)))
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .map((c) => c.line);
    expect(lines.length).toBe(repeated.length);
    // Two templates cannot produce three distinct sentences, so the thing that
    // matters is that the feed never prints the same line twice in a row.
    for (let index = 1; index < lines.length; index++) {
      expect(lines[index]).not.toBe(lines[index - 1]);
    }
  });
});
