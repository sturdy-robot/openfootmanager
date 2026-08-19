import { describe, expect, it, vi } from "vitest";

import type { GameStateData } from "../../store/gameStore";
import type {
  PlayerRole,
  TacticsPhaseSettings,
  TeamData,
  TeamTacticsDraft,
} from "../../store/types";
import type { TacticsLibraryEntry } from "./TacticsCommandBar";
import * as tacticsDraftHelpers from "./TacticsCustomTactics.helpers";
import {
  TACTICS_PRESETS,
  type TacticsPresetDefinition,
} from "./TacticsTab.helpers";

type PresetWithBlueprint = TacticsPresetDefinition & {
  phaseBlueprint: TacticsPhaseSettings;
};

type TacticsDraftPatch = Partial<
  Pick<
    TeamTacticsDraft,
    "formation" | "play_style" | "slot_roles" | "tactics_phase"
  >
>;

interface TacticsDraftState {
  draft: TacticsDraftPatch;
  feedbackKey: string | null;
  isApplying: boolean;
  presetAnchor: PresetWithBlueprint | null;
}

type TacticsDraftAction =
  | { type: "formationChanged"; formation: string }
  | { type: "playStyleChanged"; playStyle: string }
  | { type: "phaseChanged"; patch: Partial<TacticsPhaseSettings> }
  | { type: "presetSelected"; preset: PresetWithBlueprint }
  | { type: "reset" }
  | { type: "revert" };

interface TacticsDraftControls {
  canApply: boolean;
  canReset: boolean;
  canRevert: boolean;
  isDraftDirty: boolean;
}

interface TacticsDraftApplyResult {
  gameState?: GameStateData;
  kind: "applied" | "blocked" | "failed" | "noop";
  reason?: "alreadyApplying" | "invalidLatestLineup" | "noManagedTeam";
  state: TacticsDraftState;
}

interface CustomTacticUpdateControls {
  disabled: boolean;
  feedbackKey: string | null;
}

interface TacticsDraftContract {
  applyTacticsDraft(options: {
    applyTeamTactics: (draft: TeamTacticsDraft) => Promise<GameStateData>;
    gameState: GameStateData;
    state: TacticsDraftState;
  }): Promise<TacticsDraftApplyResult>;
  getCustomTacticUpdateControls(options: {
    activeTactic: TacticsLibraryEntry;
    didSave: boolean;
    isLibraryDirty: boolean;
    isSaving: boolean;
  }): CustomTacticUpdateControls;
  getTacticsDraftControls(
    state: TacticsDraftState,
    appliedTeam: TeamData,
  ): TacticsDraftControls;
  reduceTacticsDraft(
    state: TacticsDraftState,
    action: TacticsDraftAction,
    appliedTeam: TeamData,
  ): TacticsDraftState;
}

const contract = tacticsDraftHelpers as typeof tacticsDraftHelpers &
  Partial<TacticsDraftContract>;

function requireHelper<Name extends keyof TacticsDraftContract>(
  name: Name,
): TacticsDraftContract[Name] {
  const helper = contract[name];
  expect(
    helper,
    `${name} must be exported from TacticsCustomTactics.helpers.ts`,
  ).toBeTypeOf("function");
  return helper as TacticsDraftContract[Name];
}

const DEFAULT_PHASE: TacticsPhaseSettings = {
  build_up_style: "Mixed",
  width: "Normal",
  tempo: "Direct",
  defensive_line: "Medium",
  pressing_intensity: "Medium",
  defensive_shape: "Normal",
  marking_style: "Mixed",
  counter_press_duration: "Short",
  break_speed: "Medium",
};

const AGGRESSIVE_PHASE: TacticsPhaseSettings = {
  build_up_style: "Short",
  width: "Wide",
  tempo: "Patient",
  defensive_line: "High",
  pressing_intensity: "Aggressive",
  defensive_shape: "Compact",
  marking_style: "ManToMan",
  counter_press_duration: "Long",
  break_speed: "Fast",
};

const XI_IDS = Array.from({ length: 11 }, (_, index) => `player-${index + 1}`);
const STANDARD_ROLES: PlayerRole[] = Array.from(
  { length: 11 },
  () => "Standard",
);
const MATCH_ROLES = {
  captain: XI_IDS[0],
  vice_captain: XI_IDS[1],
  penalty_taker: XI_IDS[8],
  free_kick_taker: XI_IDS[7],
  corner_taker: XI_IDS[6],
};

function makeTeam(overrides: Partial<TeamData> = {}): TeamData {
  return {
    id: "team-1",
    name: "Test United",
    short_name: "TST",
    country: "GB",
    city: "Teston",
    stadium_name: "Test Ground",
    stadium_capacity: 20_000,
    finance: 1_000_000,
    manager_id: "manager-1",
    reputation: 50,
    wage_budget: 100_000,
    transfer_budget: 1_000_000,
    season_income: 0,
    season_expenses: 0,
    formation: "4-4-2",
    play_style: "Balanced",
    training_focus: "Balanced",
    training_intensity: "Normal",
    training_schedule: "Balanced",
    founded_year: 1900,
    colors: { primary: "navy", secondary: "white" },
    starting_xi_ids: [...XI_IDS],
    slot_roles: [...STANDARD_ROLES],
    tactics_phase: { ...DEFAULT_PHASE },
    match_roles: { ...MATCH_ROLES },
    form: [],
    history: [],
    ...overrides,
  };
}

function makeGameState({
  managedTeamId = "team-1",
  rosterIds = XI_IDS,
  team = makeTeam(),
}: {
  managedTeamId?: string | null;
  rosterIds?: readonly string[];
  team?: TeamData;
} = {}): GameStateData {
  return {
    clock: { current_date: "2026-08-19", start_date: "2026-08-01" },
    manager: { id: "manager-1", team_id: managedTeamId },
    teams: [team],
    players: rosterIds.map((id) => ({ id, team_id: team.id })),
    staff: [],
    messages: [],
    news: [],
    league: null,
    scouting_assignments: [],
    board_objectives: [],
  } as unknown as GameStateData;
}

function makeState(
  overrides: Partial<TacticsDraftState> = {},
): TacticsDraftState {
  return {
    draft: {},
    feedbackKey: null,
    isApplying: false,
    presetAnchor: null,
    ...overrides,
  };
}

function presetWithBlueprint(id: string): PresetWithBlueprint {
  const preset = TACTICS_PRESETS.find((candidate) => candidate.id === id) as
    | Partial<PresetWithBlueprint>
    | undefined;

  expect(preset, `preset ${id} must exist`).toBeDefined();
  expect(
    preset?.phaseBlueprint,
    `preset ${id} must define its own phase blueprint`,
  ).toBeDefined();
  return preset as PresetWithBlueprint;
}

function makeCustomTactic(
  overrides: Partial<TacticsLibraryEntry> = {},
): TacticsLibraryEntry {
  return {
    id: "custom:mine",
    type: "custom",
    name: "My tactic",
    description: "A custom tactic",
    formation: "4-4-2",
    playStyle: "Balanced",
    sourcePresetName: null,
    ...overrides,
  };
}

describe("preset phase-blueprint contract", () => {
  it("[#365] gives every shipped preset a complete nine-field phase blueprint", () => {
    expect(TACTICS_PRESETS).toHaveLength(5);

    for (const preset of TACTICS_PRESETS as Partial<PresetWithBlueprint>[]) {
      expect(
        Object.keys(preset.phaseBlueprint ?? {}).sort(),
        `${preset.id} must own a complete phase blueprint`,
      ).toEqual(Object.keys(DEFAULT_PHASE).sort());
    }
  });

  it("[#365] selecting a preset replaces the previous phase with that preset's blueprint", () => {
    const reduceTacticsDraft = requireHelper("reduceTacticsDraft");
    const preset = presetWithBlueprint("high-press");
    const previousPhase: TacticsPhaseSettings = {
      ...preset.phaseBlueprint,
      width: preset.phaseBlueprint.width === "Wide" ? "Narrow" : "Wide",
    };
    const typeDefault: TacticsPhaseSettings = {
      ...preset.phaseBlueprint,
      tempo: preset.phaseBlueprint.tempo === "Direct" ? "Patient" : "Direct",
    };
    const team = makeTeam({ tactics_phase: previousPhase });

    const next = reduceTacticsDraft(
      makeState(),
      { type: "presetSelected", preset },
      team,
    );

    expect(next).toMatchObject({
      draft: {
        formation: preset.formation,
        play_style: preset.playStyle,
        tactics_phase: preset.phaseBlueprint,
      },
      presetAnchor: preset,
    });
    expect(next.draft.tactics_phase).not.toEqual(previousPhase);
    expect(next.draft.tactics_phase).not.toEqual(typeDefault);
  });
});

describe("staged tactics draft", () => {
  it("stages preset, formation, play-style, and phase edits without a backend call", () => {
    const reduceTacticsDraft = requireHelper("reduceTacticsDraft");
    const applyTeamTactics = vi.fn();
    const preset = presetWithBlueprint("wing-play");
    const team = makeTeam();

    let state = reduceTacticsDraft(
      makeState(),
      { type: "presetSelected", preset },
      team,
    );
    state = reduceTacticsDraft(
      state,
      { type: "formationChanged", formation: "4-2-3-1" },
      team,
    );
    state = reduceTacticsDraft(
      state,
      { type: "playStyleChanged", playStyle: "Counter" },
      team,
    );
    state = reduceTacticsDraft(
      state,
      { type: "phaseChanged", patch: { break_speed: "Fast" } },
      team,
    );

    expect(state.draft).toMatchObject({
      formation: "4-2-3-1",
      play_style: "Counter",
      tactics_phase: expect.objectContaining({ break_speed: "Fast" }),
    });
    expect(applyTeamTactics).not.toHaveBeenCalled();
  });

  it("keeps draft dirtiness separate from named-library dirtiness", () => {
    const getTacticsDraftControls = requireHelper("getTacticsDraftControls");
    const getCustomTacticUpdateControls = requireHelper(
      "getCustomTacticUpdateControls",
    );
    const team = makeTeam();
    const state = makeState({ draft: { play_style: "Counter" } });

    expect(getTacticsDraftControls(state, team).isDraftDirty).toBe(true);
    expect(
      getCustomTacticUpdateControls({
        activeTactic: makeCustomTactic(),
        didSave: false,
        isLibraryDirty: false,
        isSaving: false,
      }).disabled,
    ).toBe(true);
  });

  it("enables Apply and Revert only when the draft differs from applied state", () => {
    const getTacticsDraftControls = requireHelper("getTacticsDraftControls");
    const team = makeTeam();

    expect(getTacticsDraftControls(makeState(), team)).toMatchObject({
      canApply: false,
      canRevert: false,
      isDraftDirty: false,
    });
    expect(
      getTacticsDraftControls(
        makeState({ draft: { play_style: "Counter" } }),
        team,
      ),
    ).toMatchObject({
      canApply: true,
      canRevert: true,
      isDraftDirty: true,
    });
  });

  it("reverts a dirty draft to the latest applied state", () => {
    const reduceTacticsDraft = requireHelper("reduceTacticsDraft");
    const team = makeTeam({ play_style: "Defensive" });
    const state = makeState({
      draft: {
        formation: "3-4-3",
        play_style: "HighPress",
        tactics_phase: AGGRESSIVE_PHASE,
      },
      feedbackKey: "tactics.applyError",
    });

    const reverted = reduceTacticsDraft(state, { type: "revert" }, team);

    expect(reverted).toMatchObject({ draft: {}, feedbackKey: null });
  });

  it("treats Revert with nothing staged as a no-op", () => {
    const reduceTacticsDraft = requireHelper("reduceTacticsDraft");
    const state = makeState();

    expect(reduceTacticsDraft(state, { type: "revert" }, makeTeam())).toBe(
      state,
    );
  });
});

describe("formation and reset role safety", () => {
  it("replaces slot roles with one universally valid Standard role per new-formation slot", () => {
    const reduceTacticsDraft = requireHelper("reduceTacticsDraft");
    const oldRoles: PlayerRole[] = [
      "BallPlayingKeeper",
      "AttackingFB",
      "Stopper",
      "CoverCB",
      "DefensiveFB",
      "WideForward",
      "BoxToBox",
      "Mezzala",
      "InvertedWinger",
      "Poacher",
      "TargetMan",
    ];
    const team = makeTeam({ slot_roles: oldRoles });

    const next = reduceTacticsDraft(
      makeState(),
      { type: "formationChanged", formation: "4-2-3-1" },
      team,
    );

    expect(next.draft.slot_roles).toEqual(STANDARD_ROLES);
    expect(next.draft.slot_roles).not.toEqual(oldRoles);
  });

  it("[#366] Reset stages every anchored preset default and is enabled only after drift", () => {
    const getTacticsDraftControls = requireHelper("getTacticsDraftControls");
    const reduceTacticsDraft = requireHelper("reduceTacticsDraft");
    const preset = presetWithBlueprint("balanced-control");
    const driftedTeam = makeTeam({
      formation: "3-4-3",
      play_style: "HighPress",
      tactics_phase: AGGRESSIVE_PHASE,
      slot_roles: ["SweeperKeeper", ...STANDARD_ROLES.slice(1)],
    });
    const state = makeState({ presetAnchor: preset });

    expect(getTacticsDraftControls(state, driftedTeam).canReset).toBe(true);

    const reset = reduceTacticsDraft(state, { type: "reset" }, driftedTeam);
    expect(reset.draft).toEqual({
      formation: preset.formation,
      play_style: preset.playStyle,
      tactics_phase: preset.phaseBlueprint,
      slot_roles: STANDARD_ROLES,
    });
    expect(
      getTacticsDraftControls(
        makeState({ presetAnchor: preset }),
        makeTeam({
          formation: preset.formation,
          play_style: preset.playStyle,
          tactics_phase: preset.phaseBlueprint,
          slot_roles: [...STANDARD_ROLES],
        }),
      ).canReset,
    ).toBe(false);
  });

  it("[#366] leaves Reset disabled and makes it a no-op without an anchored preset", () => {
    const getTacticsDraftControls = requireHelper("getTacticsDraftControls");
    const reduceTacticsDraft = requireHelper("reduceTacticsDraft");
    const state = makeState();
    const team = makeTeam({ play_style: "Counter" });

    expect(getTacticsDraftControls(state, team).canReset).toBe(false);
    expect(reduceTacticsDraft(state, { type: "reset" }, team)).toBe(state);
  });
});

describe("atomic draft application", () => {
  it("calls applyTeamTactics exactly once with the complete total draft", async () => {
    const applyTacticsDraft = requireHelper("applyTacticsDraft");
    const current = makeGameState();
    const updated = makeGameState({
      team: makeTeam({ formation: "4-2-3-1", play_style: "Counter" }),
    });
    const applyTeamTactics = vi
      .fn<(draft: TeamTacticsDraft) => Promise<GameStateData>>()
      .mockResolvedValue(updated);
    const state = makeState({
      draft: {
        formation: "4-2-3-1",
        play_style: "Counter",
        slot_roles: [...STANDARD_ROLES],
        tactics_phase: AGGRESSIVE_PHASE,
      },
    });

    const result = await applyTacticsDraft({
      applyTeamTactics,
      gameState: current,
      state,
    });

    expect(applyTeamTactics).toHaveBeenCalledTimes(1);
    const invokedDraft = applyTeamTactics.mock.calls[0]?.[0];
    expect(Object.keys(invokedDraft ?? {}).sort()).toEqual(
      [
        "formation",
        "match_roles",
        "play_style",
        "slot_roles",
        "starting_xi_ids",
        "tactics_phase",
      ].sort(),
    );
    expect(invokedDraft).toEqual({
      formation: "4-2-3-1",
      play_style: "Counter",
      starting_xi_ids: XI_IDS,
      slot_roles: STANDARD_ROLES,
      tactics_phase: AGGRESSIVE_PHASE,
      match_roles: MATCH_ROLES,
    });
    expect(result).toMatchObject({
      kind: "applied",
      gameState: updated,
      state: {
        draft: {},
        feedbackKey: "tactics.applySuccess",
        isApplying: false,
      },
    });
  });

  it("reads the post-swap XI from the latest game state at Apply time", async () => {
    const applyTacticsDraft = requireHelper("applyTacticsDraft");
    const postSwapXi = [...XI_IDS];
    [postSwapXi[2], postSwapXi[9]] = [postSwapXi[9], postSwapXi[2]];
    const latest = makeGameState({
      team: makeTeam({ starting_xi_ids: postSwapXi }),
    });
    const applyTeamTactics = vi
      .fn<(draft: TeamTacticsDraft) => Promise<GameStateData>>()
      .mockResolvedValue(latest);
    const state = makeState({
      draft: {
        formation: "4-2-3-1",
        slot_roles: [...STANDARD_ROLES],
      },
    });

    await applyTacticsDraft({ applyTeamTactics, gameState: latest, state });

    expect(applyTeamTactics).toHaveBeenCalledTimes(1);
    expect(applyTeamTactics.mock.calls[0]?.[0].starting_xi_ids).toEqual(
      postSwapXi,
    );
    expect(applyTeamTactics.mock.calls[0]?.[0].starting_xi_ids).not.toEqual(
      XI_IDS,
    );
  });

  it("reads immediate role and match-role edits from the latest state when they were not staged", async () => {
    const applyTacticsDraft = requireHelper("applyTacticsDraft");
    const latestSlotRoles: PlayerRole[] = [
      "SweeperKeeper",
      ...STANDARD_ROLES.slice(1),
    ];
    const latestMatchRoles = { ...MATCH_ROLES, captain: XI_IDS[4] };
    const latest = makeGameState({
      team: makeTeam({
        slot_roles: latestSlotRoles,
        match_roles: latestMatchRoles,
      }),
    });
    const applyTeamTactics = vi
      .fn<(draft: TeamTacticsDraft) => Promise<GameStateData>>()
      .mockResolvedValue(latest);

    await applyTacticsDraft({
      applyTeamTactics,
      gameState: latest,
      state: makeState({ draft: { play_style: "Possession" } }),
    });

    expect(applyTeamTactics.mock.calls[0]?.[0]).toMatchObject({
      slot_roles: latestSlotRoles,
      match_roles: latestMatchRoles,
    });
  });

  it("does not submit a second Apply while one is already running", async () => {
    const applyTacticsDraft = requireHelper("applyTacticsDraft");
    const applyTeamTactics = vi.fn();
    const state = makeState({
      draft: { play_style: "Counter" },
      isApplying: true,
    });

    const result = await applyTacticsDraft({
      applyTeamTactics,
      gameState: makeGameState(),
      state,
    });

    expect(applyTeamTactics).not.toHaveBeenCalled();
    expect(result).toMatchObject({ kind: "blocked", reason: "alreadyApplying" });
    expect(result.state).toBe(state);
  });

  it("reports backend failure while preserving the dirty draft for retry", async () => {
    const applyTacticsDraft = requireHelper("applyTacticsDraft");
    const applyTeamTactics = vi
      .fn<(draft: TeamTacticsDraft) => Promise<GameStateData>>()
      .mockRejectedValue(new Error("be.error.roleNotValidForPosition"));
    const state = makeState({ draft: { play_style: "Counter" } });

    const result = await applyTacticsDraft({
      applyTeamTactics,
      gameState: makeGameState(),
      state,
    });

    expect(applyTeamTactics).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      kind: "failed",
      state: {
        draft: state.draft,
        feedbackKey: "tactics.applyError",
        isApplying: false,
      },
    });
    expect(
      requireHelper("getTacticsDraftControls")(
        result.state,
        makeTeam(),
      ).isDraftDirty,
    ).toBe(true);
  });

  it("does not call the backend when there is no managed team", async () => {
    const applyTacticsDraft = requireHelper("applyTacticsDraft");
    const applyTeamTactics = vi.fn();

    const result = await applyTacticsDraft({
      applyTeamTactics,
      gameState: makeGameState({ managedTeamId: null }),
      state: makeState({ draft: { play_style: "Counter" } }),
    });

    expect(applyTeamTactics).not.toHaveBeenCalled();
    expect(result).toMatchObject({ kind: "blocked", reason: "noManagedTeam" });
  });

  it("blocks a stale XI when a player leaves the roster between staging and Apply", async () => {
    const applyTacticsDraft = requireHelper("applyTacticsDraft");
    const applyTeamTactics = vi.fn();
    const state = makeState({ draft: { play_style: "Counter" } });
    const latestWithoutStarter = makeGameState({
      rosterIds: XI_IDS.slice(0, -1),
    });

    const result = await applyTacticsDraft({
      applyTeamTactics,
      gameState: latestWithoutStarter,
      state,
    });

    expect(applyTeamTactics).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      kind: "blocked",
      reason: "invalidLatestLineup",
      state: {
        draft: state.draft,
        feedbackKey: "tactics.lineupChangedBeforeApply",
      },
    });
  });
});

describe("custom-library update feedback", () => {
  it("[#377] disables Update tactic when the named custom tactic is not dirty", () => {
    const getControls = requireHelper("getCustomTacticUpdateControls");

    expect(
      getControls({
        activeTactic: makeCustomTactic(),
        didSave: false,
        isLibraryDirty: false,
        isSaving: false,
      }),
    ).toEqual({ disabled: true, feedbackKey: null });
  });

  it("[#377] enables a dirty custom update and reports visible success after save", () => {
    const getControls = requireHelper("getCustomTacticUpdateControls");

    expect(
      getControls({
        activeTactic: makeCustomTactic(),
        didSave: false,
        isLibraryDirty: true,
        isSaving: false,
      }).disabled,
    ).toBe(false);
    expect(
      getControls({
        activeTactic: makeCustomTactic(),
        didSave: true,
        isLibraryDirty: false,
        isSaving: false,
      }),
    ).toEqual({
      disabled: true,
      feedbackKey: "tactics.customTacticUpdated",
    });
  });
});
