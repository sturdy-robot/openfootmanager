import type { GameStateData } from "../../store/gameStore";
import type {
  PlayerRole,
  TacticsPhaseSettings,
  TeamData,
  TeamMatchRolesData,
  TeamTacticsDraft,
} from "../../store/types";
import { buildPitchRows } from "../squad/SquadTab.helpers";
import type { TacticsLibraryEntry } from "./TacticsCommandBar";
import {
  findTacticsPresetBySetup,
  type TacticsPresetDefinition,
} from "./TacticsTab.helpers";

const TACTICS_STORAGE_KEY_PREFIX = "ofm:tactics:custom";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function getDefaultStorage(): StorageLike | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function buildCustomTacticsStorageKey(
  gameState: GameStateData,
): string {
  return [
    TACTICS_STORAGE_KEY_PREFIX,
    gameState.manager.id,
    gameState.clock.start_date,
    gameState.manager.team_id ?? "no-team",
  ].join(":");
}

function isCustomTacticEntry(value: unknown): value is TacticsLibraryEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<TacticsLibraryEntry>;

  return (
    candidate.type === "custom" &&
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.description === "string" &&
    typeof candidate.formation === "string" &&
    typeof candidate.playStyle === "string"
  );
}

export function loadCustomTactics(
  gameState: GameStateData,
  storage: StorageLike | null = getDefaultStorage(),
): TacticsLibraryEntry[] {
  if (!storage) {
    return [];
  }

  try {
    const storedValue = storage.getItem(buildCustomTacticsStorageKey(gameState));

    if (!storedValue) {
      return [];
    }

    const parsedValue: unknown = JSON.parse(storedValue);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue.filter(isCustomTacticEntry);
  } catch {
    return [];
  }
}

/**
 * Returns whether the tactics actually reached storage.
 *
 * A quota or a privacy setting can refuse the write, and the caller announces
 * a successful save — so swallowing the failure here would confirm something
 * that then vanishes on the next launch.
 */
export function saveCustomTactics(
  gameState: GameStateData,
  customTactics: readonly TacticsLibraryEntry[],
  storage: StorageLike | null = getDefaultStorage(),
): boolean {
  if (!storage) {
    return false;
  }

  const persistedTactics = customTactics.filter(
    (entry): entry is TacticsLibraryEntry => entry.type === "custom",
  );

  try {
    storage.setItem(
      buildCustomTacticsStorageKey(gameState),
      JSON.stringify(persistedTactics),
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Which library entry the command bar should show as active.
 *
 * An explicitly chosen tactic wins even when its setup happens to coincide with
 * a preset — the manager picked that entry and it should keep its name. Only
 * when nothing is chosen does the setup itself decide, and a setup matching no
 * preset shows as the custom current setup rather than an arbitrary neighbour.
 */
export function resolveActiveTactic(
  tacticLibrary: readonly TacticsLibraryEntry[],
  activeTacticId: string | null,
  formation: string,
  playStyle: string,
  currentSetupFallbackTactic: TacticsLibraryEntry,
): TacticsLibraryEntry {
  if (activeTacticId) {
    const explicit = tacticLibrary.find((entry) => entry.id === activeTacticId);
    if (explicit) {
      return explicit;
    }
  }

  const matchingPreset = findTacticsPresetBySetup(formation, playStyle);
  if (matchingPreset) {
    const presetEntry = tacticLibrary.find(
      (entry) => entry.id === `preset:${matchingPreset.id}`,
    );
    if (presetEntry) {
      return presetEntry;
    }
  }

  return currentSetupFallbackTactic;
}

export interface IsTacticsCommandBarDirtyOptions {
  activeTactic: TacticsLibraryEntry;
  draftTacticName: string;
  formation: string;
  playStyle: string;
  presetAnchor: TacticsPresetDefinition | null;
}

/**
 * Whether the command bar has unsaved changes.
 *
 * A preset is dirty when the live setup has drifted from the preset it was
 * anchored to. Its display name is translated, so a language change moves the
 * name without the manager having edited anything — which is why only a custom
 * tactic's name participates, and only when it is not blank.
 */
export function isTacticsCommandBarDirty({
  activeTactic,
  draftTacticName,
  formation,
  playStyle,
  presetAnchor,
}: IsTacticsCommandBarDirtyOptions): boolean {
  if (
    formation !== activeTactic.formation ||
    playStyle !== activeTactic.playStyle
  ) {
    return true;
  }

  if (activeTactic.type === "preset") {
    if (!presetAnchor) {
      return false;
    }

    return (
      formation !== presetAnchor.formation ||
      playStyle !== presetAnchor.playStyle
    );
  }

  const trimmedName = draftTacticName.trim();

  return trimmedName.length > 0 && trimmedName !== activeTactic.name;
}

/**
 * The parts of a team's tactics the command strip stages locally.
 *
 * Deliberately a *patch*, not a whole draft. `TeamTacticsDraft` is total — the
 * backend replaces the team's entire tactical state with it — but the manager
 * is only editing a corner of that at any moment. Storing the corner and
 * merging the rest at Apply time is what keeps a starting-XI swap made while
 * the draft was dirty from being silently undone.
 */
export type TacticsDraftPatch = Partial<
  Pick<
    TeamTacticsDraft,
    "formation" | "play_style" | "slot_roles" | "tactics_phase"
  >
>;

export interface TacticsDraftState {
  draft: TacticsDraftPatch;
  /** Translation key for the last thing worth telling the manager, if any. */
  feedbackKey: string | null;
  isApplying: boolean;
  /** The preset `Reset` returns to. Null until one is chosen. */
  presetAnchor: TacticsPresetDefinition | null;
}

export type TacticsDraftAction =
  | { type: "formationChanged"; formation: string }
  | { type: "playStyleChanged"; playStyle: string }
  | { type: "phaseChanged"; patch: Partial<TacticsPhaseSettings> }
  | { type: "presetSelected"; preset: TacticsPresetDefinition }
  | { type: "reset" }
  | { type: "revert" };

export interface TacticsDraftControls {
  canApply: boolean;
  canReset: boolean;
  canRevert: boolean;
  isDraftDirty: boolean;
}

export const EMPTY_TACTICS_DRAFT_STATE: TacticsDraftState = {
  draft: {},
  feedbackKey: null,
  isApplying: false,
  presetAnchor: null,
};

/**
 * Mirrors `TacticsPhaseSettings::default()` in `domain/src/team.rs`.
 *
 * A team saved before the phase dials existed has no blueprint at all, and the
 * draft sent to the backend must carry all nine — so the frontend needs the same
 * starting point the backend would have used.
 */
const DEFAULT_TACTICS_PHASE: TacticsPhaseSettings = {
  build_up_style: "Mixed",
  width: "Normal",
  tempo: "Direct",
  defensive_line: "Medium",
  pressing_intensity: "Medium",
  defensive_shape: "Normal",
  marking_style: "Zonal",
  counter_press_duration: "None",
  break_speed: "Medium",
};

const NO_MATCH_ROLES: TeamMatchRolesData = {
  captain: null,
  vice_captain: null,
  penalty_taker: null,
  free_kick_taker: null,
  corner_taker: null,
};

function slotCountForFormation(formation: string): number {
  return buildPitchRows(formation).reduce(
    (total, row) => total + row.positions.length,
    0,
  );
}

/**
 * Roles for a shape the manager has not assigned roles for yet.
 *
 * Slot index is a deployed-position contract, so carrying a specialist role
 * across a shape change can leave, say, a full-back role sitting in what is now
 * an attacking-midfield slot. The backend rejects the *whole* draft over one
 * such mismatch, so a shape change would make Apply impossible rather than
 * merely odd. `Standard` is the one role valid at every position.
 */
function defaultSlotRoles(formation: string): PlayerRole[] {
  return Array.from(
    { length: slotCountForFormation(formation) },
    () => "Standard" as PlayerRole,
  );
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function effectiveFormation(
  state: TacticsDraftState,
  appliedTeam: TeamData,
): string {
  return state.draft.formation ?? appliedTeam.formation;
}

function effectivePhase(
  state: TacticsDraftState,
  appliedTeam: TeamData,
): TacticsPhaseSettings {
  return (
    state.draft.tactics_phase ??
    appliedTeam.tactics_phase ??
    DEFAULT_TACTICS_PHASE
  );
}

/**
 * Stage one edit.
 *
 * Nothing here talks to the backend: every action produces a new local draft
 * and the manager decides when it lands. `appliedTeam` is the state on the
 * server, which the reducer reads to know what an edit is relative to.
 */
export function reduceTacticsDraft(
  state: TacticsDraftState,
  action: TacticsDraftAction,
  appliedTeam: TeamData,
): TacticsDraftState {
  switch (action.type) {
    case "formationChanged": {
      if (action.formation === effectiveFormation(state, appliedTeam)) {
        return state;
      }

      return {
        ...state,
        draft: {
          ...state.draft,
          formation: action.formation,
          slot_roles: defaultSlotRoles(action.formation),
        },
      };
    }

    case "playStyleChanged":
      return {
        ...state,
        draft: { ...state.draft, play_style: action.playStyle },
      };

    case "phaseChanged":
      return {
        ...state,
        draft: {
          ...state.draft,
          tactics_phase: {
            ...effectivePhase(state, appliedTeam),
            ...action.patch,
          },
        },
      };

    case "presetSelected":
      // A preset is a wholesale choice — it owns the shape, the style and all
      // nine dials — so it replaces the roles too rather than leaving the
      // previous tactic's specialists behind in a shape that did not ask for
      // them (#365).
      return {
        ...state,
        draft: {
          formation: action.preset.formation,
          play_style: action.preset.playStyle,
          slot_roles: defaultSlotRoles(action.preset.formation),
          tactics_phase: action.preset.phaseBlueprint,
        },
        presetAnchor: action.preset,
      };

    case "reset": {
      const anchor = state.presetAnchor;

      if (!anchor) {
        return state;
      }

      return {
        ...state,
        draft: {
          formation: anchor.formation,
          play_style: anchor.playStyle,
          slot_roles: defaultSlotRoles(anchor.formation),
          tactics_phase: anchor.phaseBlueprint,
        },
      };
    }

    case "revert": {
      if (Object.keys(state.draft).length === 0 && state.feedbackKey === null) {
        return state;
      }

      return { ...state, draft: {}, feedbackKey: null };
    }
  }
}

function isDraftDirty(
  state: TacticsDraftState,
  appliedTeam: TeamData,
): boolean {
  const { draft } = state;

  return (
    (draft.formation !== undefined &&
      draft.formation !== appliedTeam.formation) ||
    (draft.play_style !== undefined &&
      draft.play_style !== appliedTeam.play_style) ||
    (draft.slot_roles !== undefined &&
      !sameValue(draft.slot_roles, appliedTeam.slot_roles)) ||
    (draft.tactics_phase !== undefined &&
      !sameValue(draft.tactics_phase, appliedTeam.tactics_phase))
  );
}

/**
 * What the command strip may offer right now.
 *
 * Note this is draft dirtiness — staged against applied — and not the library
 * dirtiness `isTacticsCommandBarDirty` computes, which asks whether the applied
 * setup still matches the tactic whose name is on it. The two answer different
 * questions and drive different buttons.
 */
export function getTacticsDraftControls(
  state: TacticsDraftState,
  appliedTeam: TeamData,
): TacticsDraftControls {
  const dirty = isDraftDirty(state, appliedTeam);
  const anchor = state.presetAnchor;
  const canReset = Boolean(
    anchor &&
      !state.isApplying &&
      (effectiveFormation(state, appliedTeam) !== anchor.formation ||
        (state.draft.play_style ?? appliedTeam.play_style) !==
          anchor.playStyle ||
        !sameValue(effectivePhase(state, appliedTeam), anchor.phaseBlueprint) ||
        !sameValue(
          state.draft.slot_roles ?? appliedTeam.slot_roles,
          defaultSlotRoles(anchor.formation),
        )),
  );

  return {
    canApply: dirty && !state.isApplying,
    canReset,
    canRevert: dirty && !state.isApplying,
    isDraftDirty: dirty,
  };
}

export interface TacticsDraftApplyResult {
  gameState?: GameStateData;
  kind: "applied" | "blocked" | "failed" | "noop";
  reason?: "alreadyApplying" | "invalidLatestLineup" | "noManagedTeam";
  /**
   * What was actually sent, when anything was.
   *
   * The caller needs it to tell an edit made *during* the request from one the
   * request has now applied — dropping the whole draft on success would throw
   * away work the manager did while waiting.
   */
  sent?: TeamTacticsDraft;
  state: TacticsDraftState;
}

/**
 * Send the staged draft as one atomic change.
 *
 * The old path called `set_formation` and then `set_play_style`, so a rejection
 * on the second left the first standing and the team playing a shape nobody
 * chose. One call cannot half-succeed.
 *
 * Everything the manager did *not* stage is read from `gameState` here, at the
 * moment Apply is pressed, rather than from a snapshot taken when the draft
 * first became dirty — otherwise a substitution made mid-edit would be quietly
 * rolled back by the very draft meant to change something else.
 */
/**
 * The XI and the responsibilities as the screen currently has them.
 *
 * The draft is total — the backend replaces the team's whole tactical state —
 * so these travel with it even though neither is staged. Reading them off the
 * last `gameState` instead was wrong twice over: an XI write still in flight
 * would be undone by the Apply that followed it, and a responsibility whose
 * holder had just left the XI would make the backend reject the whole request.
 */
export interface TacticsDraftLineup {
  matchRoles: TeamMatchRolesData;
  startingXiIds: string[];
}

export async function applyTacticsDraft({
  applyTeamTactics,
  gameState,
  lineup,
  state,
}: {
  applyTeamTactics: (draft: TeamTacticsDraft) => Promise<GameStateData>;
  gameState: GameStateData;
  lineup?: TacticsDraftLineup;
  state: TacticsDraftState;
}): Promise<TacticsDraftApplyResult> {
  if (state.isApplying) {
    return { kind: "blocked", reason: "alreadyApplying", state };
  }

  const managedTeamId = gameState.manager.team_id;
  const team = managedTeamId
    ? gameState.teams.find((candidate) => candidate.id === managedTeamId)
    : undefined;

  if (!team) {
    return {
      kind: "blocked",
      reason: "noManagedTeam",
      state: { ...state, feedbackKey: "common.noTeam" },
    };
  }

  if (Object.keys(state.draft).length === 0) {
    return { kind: "noop", state };
  }

  const formation = state.draft.formation ?? team.formation;
  const draft: TeamTacticsDraft = {
    formation,
    play_style: state.draft.play_style ?? team.play_style,
    slot_roles:
      state.draft.slot_roles ?? team.slot_roles ?? defaultSlotRoles(formation),
    tactics_phase:
      state.draft.tactics_phase ?? team.tactics_phase ?? DEFAULT_TACTICS_PHASE,
    // Never staged — they have their own immediate paths — but sent as the
    // screen has them, not as the server last reported them.
    starting_xi_ids: lineup?.startingXiIds ?? team.starting_xi_ids,
    match_roles: lineup?.matchRoles ?? team.match_roles ?? NO_MATCH_ROLES,
  };

  // The backend rejects the whole draft for a lineup it cannot honour. Catching
  // it here lets the manager see *why* instead of a generic failure, and keeps
  // their staged work intact to retry.
  const rosterIds = new Set(
    gameState.players
      .filter((player) => player.team_id === team.id)
      .map((player) => player.id),
  );
  const lineupIsStale =
    draft.starting_xi_ids.length !== slotCountForFormation(draft.formation) ||
    new Set(draft.starting_xi_ids).size !== draft.starting_xi_ids.length ||
    draft.starting_xi_ids.some((playerId) => !rosterIds.has(playerId));

  if (lineupIsStale) {
    return {
      kind: "blocked",
      reason: "invalidLatestLineup",
      state: { ...state, feedbackKey: "tactics.lineupChangedBeforeApply" },
    };
  }

  try {
    const updatedGameState = await applyTeamTactics(draft);

    return {
      gameState: updatedGameState,
      kind: "applied",
      sent: draft,
      state: {
        ...state,
        draft: {},
        feedbackKey: "tactics.applySuccess",
        isApplying: false,
      },
    };
  } catch {
    return {
      kind: "failed",
      state: { ...state, feedbackKey: "tactics.applyError", isApplying: false },
    };
  }
}

/**
 * What is still staged once `sent` has landed.
 *
 * An Apply is a round trip, and the manager can keep working during it. Only
 * the values that were actually applied drop out of the draft; anything they
 * changed while waiting is still their intent and survives.
 */
export function remainingDraftAfterApply(
  currentDraft: TacticsDraftPatch,
  sent: TeamTacticsDraft,
): TacticsDraftPatch {
  const remaining: TacticsDraftPatch = {};

  if (
    currentDraft.formation !== undefined &&
    currentDraft.formation !== sent.formation
  ) {
    remaining.formation = currentDraft.formation;
  }

  if (
    currentDraft.play_style !== undefined &&
    currentDraft.play_style !== sent.play_style
  ) {
    remaining.play_style = currentDraft.play_style;
  }

  if (
    currentDraft.slot_roles !== undefined &&
    !sameValue(currentDraft.slot_roles, sent.slot_roles)
  ) {
    remaining.slot_roles = currentDraft.slot_roles;
  }

  if (
    currentDraft.tactics_phase !== undefined &&
    !sameValue(currentDraft.tactics_phase, sent.tactics_phase)
  ) {
    remaining.tactics_phase = currentDraft.tactics_phase;
  }

  return remaining;
}

/**
 * The state of the custom library's "Update tactic" button.
 *
 * It used to stay enabled with nothing to update, so pressing it did nothing
 * and said nothing — which read as a broken feature rather than a no-op (#377).
 */
export function getCustomTacticUpdateControls({
  activeTactic,
  didSave,
  isLibraryDirty,
  isSaving,
}: {
  activeTactic: TacticsLibraryEntry;
  didSave: boolean;
  isLibraryDirty: boolean;
  isSaving: boolean;
}): { disabled: boolean; feedbackKey: string | null } {
  return {
    // Only *updating* an existing tactic can have nothing to do. On a preset the
    // same button means "save this as a new tactic", which is worth offering
    // whether or not the setup has drifted.
    disabled:
      isSaving || (activeTactic.type === "custom" && !isLibraryDirty),
    feedbackKey: didSave ? "tactics.customTacticUpdated" : null,
  };
}
