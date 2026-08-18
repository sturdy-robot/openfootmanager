import { describe, expect, it, vi } from "vitest";

import type { GameStateData } from "../../store/gameStore";
import type { TacticsLibraryEntry } from "./TacticsCommandBar";
import {
  buildCustomTacticsStorageKey,
  buildTacticApplicationPlan,
  isTacticsCommandBarDirty,
  loadCustomTactics,
  resolveActiveTactic,
  resolveTacticsSelectionAfterPersistence,
  saveCustomTactics,
  type TacticsApplicationOutcome,
  type TacticsLibrarySelectionState,
} from "./TacticsCustomTactics.helpers";
import {
  findTacticsPresetBySetup,
  TACTICS_PRESETS,
} from "./TacticsTab.helpers";

const makeGameState = ({
  managerId = "manager-1",
  startDate = "2026-08-01",
  teamId = "team-1",
}: {
  managerId?: string;
  startDate?: string;
  teamId?: string | null;
} = {}): GameStateData => ({
  clock: {
    current_date: startDate,
    start_date: startDate,
  },
  manager: {
    id: managerId,
    first_name: "Test",
    last_name: "Manager",
    date_of_birth: "1980-01-01",
    nationality: "GB",
    reputation: 50,
    satisfaction: 50,
    fan_approval: 50,
    team_id: teamId,
    career_stats: {
      matches_managed: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      trophies: 0,
      best_finish: null,
    },
    career_history: [],
  },
  teams: [],
  players: [],
  staff: [],
  messages: [],
  news: [],
  league: null,
  scouting_assignments: [],
  board_objectives: [],
});

const makeTactic = (
  id: string,
  type: TacticsLibraryEntry["type"],
  overrides: Partial<TacticsLibraryEntry> = {},
): TacticsLibraryEntry => ({
  id,
  type,
  name: id,
  description: `${id} description`,
  formation: "4-4-2",
  playStyle: "Balanced",
  sourcePresetName: null,
  ...overrides,
});

const balancedPreset = makeTactic("preset:balanced-control", "preset");
const highPressPreset = makeTactic("preset:high-press", "preset", {
  formation: "3-4-3",
  playStyle: "HighPress",
});
const currentSetupFallback = makeTactic("current:setup", "custom", {
  name: "Custom current setup",
});

describe("tactics preset matching and active tactic resolution", () => {
  it("matches a preset only when both formation and play style match", () => {
    expect(findTacticsPresetBySetup("4-4-2", "Balanced")?.id).toBe(
      "balanced-control",
    );
    expect(findTacticsPresetBySetup("4-4-2", "Counter")).toBeNull();
    expect(findTacticsPresetBySetup("3-4-3", "Balanced")).toBeNull();
  });

  it("selects the matching preset when no explicit tactic is active", () => {
    expect(
      resolveActiveTactic(
        [balancedPreset, highPressPreset],
        null,
        "3-4-3",
        "HighPress",
        currentSetupFallback,
      ),
    ).toBe(highPressPreset);
  });

  it("falls back to the custom current setup when no preset matches", () => {
    expect(
      resolveActiveTactic(
        [balancedPreset, highPressPreset],
        null,
        "4-4-2",
        "Counter",
        currentSetupFallback,
      ),
    ).toBe(currentSetupFallback);
  });

  it("keeps an explicitly active custom tactic ahead of an incidental preset match", () => {
    const custom = makeTactic("custom:mine", "custom");

    expect(
      resolveActiveTactic(
        [custom, balancedPreset, highPressPreset],
        custom.id,
        "4-4-2",
        "Balanced",
        currentSetupFallback,
      ),
    ).toBe(custom);
  });
});

describe("tactics command-bar dirty tracking", () => {
  const balancedAnchor =
    TACTICS_PRESETS.find((preset) => preset.id === "balanced-control") ?? null;

  it("is clean when the active preset still matches its anchored setup", () => {
    expect(
      isTacticsCommandBarDirty({
        activeTactic: balancedPreset,
        draftTacticName: balancedPreset.name,
        formation: "4-4-2",
        playStyle: "Balanced",
        presetAnchor: balancedAnchor,
      }),
    ).toBe(false);
  });

  it("is dirty when formation or play style diverges from the active preset", () => {
    expect(
      isTacticsCommandBarDirty({
        activeTactic: balancedPreset,
        draftTacticName: balancedPreset.name,
        formation: "4-3-3",
        playStyle: "Balanced",
        presetAnchor: balancedAnchor,
      }),
    ).toBe(true);
    expect(
      isTacticsCommandBarDirty({
        activeTactic: balancedPreset,
        draftTacticName: balancedPreset.name,
        formation: "4-4-2",
        playStyle: "Counter",
        presetAnchor: balancedAnchor,
      }),
    ).toBe(true);
  });

  it("tracks custom tactic setup and non-blank name changes", () => {
    const custom = makeTactic("custom:mine", "custom", { name: "Mine" });

    expect(
      isTacticsCommandBarDirty({
        activeTactic: custom,
        draftTacticName: "Mine",
        formation: "4-4-2",
        playStyle: "Balanced",
        presetAnchor: balancedAnchor,
      }),
    ).toBe(false);
    expect(
      isTacticsCommandBarDirty({
        activeTactic: custom,
        draftTacticName: "Renamed",
        formation: "4-4-2",
        playStyle: "Balanced",
        presetAnchor: balancedAnchor,
      }),
    ).toBe(true);
    expect(
      isTacticsCommandBarDirty({
        activeTactic: custom,
        draftTacticName: "   ",
        formation: "4-4-2",
        playStyle: "Balanced",
        presetAnchor: balancedAnchor,
      }),
    ).toBe(false);
  });
});

describe("preset persistence decisions", () => {
  const previousState: TacticsLibrarySelectionState = {
    activeTacticId: balancedPreset.id,
    draftTacticName: balancedPreset.name,
    presetAnchorId: "balanced-control",
  };

  it("plans only required persistence calls and keeps formation before play style", () => {
    expect(
      buildTacticApplicationPlan(
        { formation: "4-4-2", playStyle: "Balanced" },
        highPressPreset,
      ),
    ).toEqual([
      { kind: "formation", value: "3-4-3" },
      { kind: "playStyle", value: "HighPress" },
    ]);
    expect(
      buildTacticApplicationPlan(
        { formation: "3-4-3", playStyle: "Balanced" },
        highPressPreset,
      ),
    ).toEqual([{ kind: "playStyle", value: "HighPress" }]);
    expect(
      buildTacticApplicationPlan(
        { formation: "3-4-3", playStyle: "HighPress" },
        highPressPreset,
      ),
    ).toEqual([]);
  });

  it("marks a preset active only after every required persistence call succeeds", () => {
    const outcome: TacticsApplicationOutcome = {
      formation: "succeeded",
      playStyle: "succeeded",
    };

    expect(
      resolveTacticsSelectionAfterPersistence(
        previousState,
        highPressPreset,
        outcome,
      ),
    ).toEqual({
      activeTacticId: highPressPreset.id,
      draftTacticName: highPressPreset.name,
      presetAnchorId: "high-press",
    });
  });

  it("leaves selection state unchanged when the first persistence call fails", () => {
    const outcome: TacticsApplicationOutcome = {
      formation: "failed",
      playStyle: "not-attempted",
    };

    expect(
      resolveTacticsSelectionAfterPersistence(
        previousState,
        highPressPreset,
        outcome,
      ),
    ).toBe(previousState);
  });

  it("leaves selection state unchanged when the second persistence call fails", () => {
    const outcome: TacticsApplicationOutcome = {
      formation: "succeeded",
      playStyle: "failed",
    };

    expect(
      resolveTacticsSelectionAfterPersistence(
        previousState,
        highPressPreset,
        outcome,
      ),
    ).toBe(previousState);
  });
});

describe("custom tactic persistence scope", () => {
  it("scopes storage by manager, save start date, and assigned team", () => {
    const original = makeGameState();
    const originalKey = buildCustomTacticsStorageKey(original);

    expect(
      buildCustomTacticsStorageKey(makeGameState({ managerId: "manager-2" })),
    ).not.toBe(originalKey);
    expect(
      buildCustomTacticsStorageKey(makeGameState({ teamId: "team-2" })),
    ).not.toBe(originalKey);
    expect(
      buildCustomTacticsStorageKey(makeGameState({ startDate: "2026-09-01" })),
    ).not.toBe(originalKey);
    expect(
      buildCustomTacticsStorageKey(makeGameState({ teamId: null })),
    ).toContain(":no-team");
  });

  it("survives a remount-equivalent load using a new game-state object", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    const firstMountState = makeGameState();
    const custom = makeTactic("custom:mine", "custom");

    saveCustomTactics(firstMountState, [custom], storage);

    const remountedState = makeGameState();
    expect(remountedState).not.toBe(firstMountState);
    expect(loadCustomTactics(remountedState, storage)).toEqual([custom]);
  });

  it("keeps scopes isolated across a second save and load", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    const first = makeTactic("custom:first", "custom");
    const second = makeTactic("custom:second", "custom");
    const firstScope = makeGameState({ managerId: "manager-1", teamId: "team-1" });
    const secondScope = makeGameState({ managerId: "manager-2", teamId: "team-2" });

    saveCustomTactics(firstScope, [first], storage);
    saveCustomTactics(secondScope, [second], storage);

    expect(loadCustomTactics(firstScope, storage)).toEqual([first]);
    expect(loadCustomTactics(secondScope, storage)).toEqual([second]);
  });

  it("leaves previously persisted tactics unchanged when storage rejects a write", () => {
    const state = makeGameState();
    const previous = makeTactic("custom:previous", "custom");
    const next = makeTactic("custom:next", "custom");
    const key = buildCustomTacticsStorageKey(state);
    const values = new Map([[key, JSON.stringify([previous])]]);
    const storage = {
      getItem: (storageKey: string) => values.get(storageKey) ?? null,
      setItem: vi.fn(() => {
        throw new Error("quota exceeded");
      }),
    };

    expect(() => saveCustomTactics(state, [next], storage)).not.toThrow();
    expect(loadCustomTactics(state, storage)).toEqual([previous]);
  });
});
