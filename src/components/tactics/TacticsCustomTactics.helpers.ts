import type { GameStateData } from "../../store/gameStore";
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

export function saveCustomTactics(
  gameState: GameStateData,
  customTactics: readonly TacticsLibraryEntry[],
  storage: StorageLike | null = getDefaultStorage(),
): void {
  if (!storage) {
    return;
  }

  const persistedTactics = customTactics.filter(
    (entry): entry is TacticsLibraryEntry => entry.type === "custom",
  );

  try {
    storage.setItem(
      buildCustomTacticsStorageKey(gameState),
      JSON.stringify(persistedTactics),
    );
  } catch {
    // Storage quota exceeded or access denied — skip persist
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

export type TacticsApplicationStep =
  | { kind: "formation"; value: string }
  | { kind: "playStyle"; value: string };

/**
 * The persistence calls applying `nextTactic` actually requires.
 *
 * Formation always precedes play style: the backend validates a play style
 * against the formation in place, so reversing them can reject a pair that is
 * valid once both have landed.
 */
export function buildTacticApplicationPlan(
  currentSetup: { formation: string; playStyle: string },
  nextTactic: TacticsLibraryEntry,
): TacticsApplicationStep[] {
  const steps: TacticsApplicationStep[] = [];

  if (currentSetup.formation !== nextTactic.formation) {
    steps.push({ kind: "formation", value: nextTactic.formation });
  }

  if (currentSetup.playStyle !== nextTactic.playStyle) {
    steps.push({ kind: "playStyle", value: nextTactic.playStyle });
  }

  return steps;
}

export interface TacticsApplicationOutcome {
  formation: "unchanged" | "succeeded" | "failed";
  playStyle: "unchanged" | "succeeded" | "failed" | "not-attempted";
}

export interface TacticsLibrarySelectionState {
  activeTacticId: string | null;
  draftTacticName: string;
  presetAnchorId: string | null;
}

/**
 * Selection state after an application attempt.
 *
 * A tactic becomes active only once every step it needed has landed. Marking it
 * active on a partial application would show a name the team is not playing —
 * the bug behind "does not mark a preset as active when applying it fails".
 */
export function resolveTacticsSelectionAfterPersistence(
  currentState: TacticsLibrarySelectionState,
  nextTactic: TacticsLibraryEntry,
  outcome: TacticsApplicationOutcome,
): TacticsLibrarySelectionState {
  const settled = (step: string): boolean =>
    step === "unchanged" || step === "succeeded";

  if (!settled(outcome.formation) || !settled(outcome.playStyle)) {
    return currentState;
  }

  return {
    activeTacticId: nextTactic.id,
    draftTacticName: nextTactic.name,
    presetAnchorId:
      nextTactic.type === "preset"
        ? nextTactic.id.replace(/^preset:/, "")
        : currentState.presetAnchorId,
  };
}
