import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { GameStateData } from "../../store/gameStore";
import {
  TACTICS_PRESETS,
  findTacticsPresetBySetup,
  type TacticsPresetDefinition,
} from "./TacticsTab.helpers";
import {
  buildCustomTacticsStorageKey,
  getCustomTacticUpdateControls,
  loadCustomTactics,
  retireLegacyCustomTactics,
} from "./TacticsCustomTactics.helpers";
import {
  listCustomTactics,
  saveCustomTactic,
  toCustomTacticData,
  toLibraryEntry,
} from "../../services/tacticsService";
import type { TacticsLibraryEntry } from "./TacticsCommandBar";

interface UseTacticsLibraryArgs {
  gameState: GameStateData | null;
  formation: string;
  activePlayStyle: string;
  initialPreset: TacticsPresetDefinition | null;
  /** The screen's one voice — see `useAnnouncer`. */
  onAnnounce: (feedbackKey: string) => void;
  /**
   * Put the chosen tactic into the draft. Choosing a tactic is an edit like any
   * other now — it is staged and lands with the rest on Apply, rather than
   * writing itself to the server the moment it is clicked.
   */
  onStageTactic: (nextTactic: TacticsLibraryEntry) => void;
}

export function useTacticsLibrary({
  gameState,
  formation,
  activePlayStyle,
  initialPreset,
  onAnnounce,
  onStageTactic,
}: UseTacticsLibraryArgs) {
  const { t } = useTranslation();
  const [customTactics, setCustomTactics] = useState<TacticsLibraryEntry[]>([]);
  const [activeTacticId, setActiveTacticId] = useState<string | null>(
    initialPreset ? `preset:${initialPreset.id}` : null,
  );
  const [draftTacticName, setDraftTacticName] = useState(
    initialPreset?.id
      ? t(`tactics.presetNames.${initialPreset.id}`, initialPreset.id)
      : t("tactics.customTactic"),
  );
  const [presetAnchorId, setPresetAnchorId] = useState<string | null>(
    initialPreset?.id ?? null,
  );
  // Which tactic the last save wrote. Kept as an id rather than a timer so the
  // "saved" cue disappears the moment the tactic drifts again or another one is
  // chosen — the manager should never read a confirmation that has gone stale.
  const [savedTacticId, setSavedTacticId] = useState<string | null>(null);
  const hydratedCustomTacticsScopeRef = useRef<string | null>(null);

  const customTacticsStorageKey = gameState
    ? buildCustomTacticsStorageKey(gameState)
    : null;

  /*
    The library lives in the save now. It used to live in the browser under a
    key that included the team id, so it never travelled with the save and a
    move to another club silently emptied it (#390).

    A career that still has a browser library gets it brought across the first
    time this screen opens: the save is empty, the browser is not, so the
    entries are written and the old key is set aside rather than deleted — if
    anything goes wrong between the import and the next save being written, the
    data is still on disk.
  */
  useEffect(() => {
    if (!gameState || !customTacticsStorageKey) return;
    hydratedCustomTacticsScopeRef.current = null;

    let cancelled = false;
    void (async () => {
      try {
        const saved = await listCustomTactics();
        if (cancelled) return;

        if (saved.length > 0) {
          setCustomTactics(saved.map(toLibraryEntry));
          return;
        }

        const legacy = loadCustomTactics(gameState);
        if (legacy.length === 0) {
          setCustomTactics([]);
          return;
        }

        let imported = saved;
        for (const entry of legacy) {
          imported = await saveCustomTactic(toCustomTacticData(entry));
        }
        if (cancelled) return;
        setCustomTactics(imported.map(toLibraryEntry));
        retireLegacyCustomTactics(gameState);
      } catch {
        // A career with no active save, or a backend that refused. The screen
        // shows an empty library rather than a stale browser one.
        if (!cancelled) setCustomTactics([]);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Keyed on the career, not on the game-state object: that gets a new
    // identity after any command that returns game state, and re-listing on
    // every one of them can land on top of an in-flight save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customTacticsStorageKey]);

  const matchedPreset = findTacticsPresetBySetup(formation, activePlayStyle);
  const anchoredPreset = presetAnchorId
    ? TACTICS_PRESETS.find((preset) => preset.id === presetAnchorId) ?? null
    : null;
  const isPresetDirty = Boolean(
    anchoredPreset &&
      (formation !== anchoredPreset.formation ||
        activePlayStyle !== anchoredPreset.playStyle),
  );
  const translatedPresetLibrary = useMemo<TacticsLibraryEntry[]>(
    () =>
      TACTICS_PRESETS.map((preset) => ({
        description: t(preset.descriptionKey),
        formation: preset.formation,
        id: `preset:${preset.id}`,
        name: t(`tactics.presetNames.${preset.id}`, preset.id),
        playStyle: preset.playStyle,
        sourcePresetName: null,
        type: "preset",
      })),
    [t],
  );
  const tacticLibrary = useMemo(
    () => [...customTactics, ...translatedPresetLibrary],
    [customTactics, translatedPresetLibrary],
  );
  const currentSetupFallbackTactic = useMemo<TacticsLibraryEntry>(
    () => ({
      description: t("tactics.customTacticDescription"),
      formation,
      id: "current:setup",
      name: t("tactics.customTactic"),
      playStyle: activePlayStyle,
      sourcePresetName: null,
      type: "custom",
    }),
    [activePlayStyle, formation, t],
  );
  const activeTactic =
    tacticLibrary.find((entry) => entry.id === activeTacticId) ??
    translatedPresetLibrary.find((entry) => entry.id === `preset:${matchedPreset?.id}`) ??
    currentSetupFallbackTactic;
  const isActiveCustomTactic = activeTactic?.type === "custom";
  const isActiveTacticDirty = Boolean(
    activeTactic &&
      (formation !== activeTactic.formation ||
        activePlayStyle !== activeTactic.playStyle ||
        (isActiveCustomTactic &&
          draftTacticName.trim().length > 0 &&
          draftTacticName.trim() !== activeTactic.name)),
  );
  const isCommandBarDirty = isActiveCustomTactic
    ? isActiveTacticDirty
    : isActiveTacticDirty || isPresetDirty;

  useEffect(() => {
    if (!matchedPreset) {
      return;
    }

    if (matchedPreset.id !== presetAnchorId) {
      setPresetAnchorId(matchedPreset.id);
    }

    const nextActivePresetId = `preset:${matchedPreset.id}`;
    setActiveTacticId((current) =>
      current?.startsWith("custom:") || current === nextActivePresetId
        ? current
        : nextActivePresetId,
    );
  }, [matchedPreset, presetAnchorId]);

  useEffect(() => {
    if (!activeTactic) {
      return;
    }

    const nextName =
      activeTactic.type === "custom"
        ? activeTactic.name
        : t(`tactics.presetNames.${activeTactic.id.replace("preset:", "")}`);
    setDraftTacticName(nextName);
  }, [activeTactic?.id, activeTactic?.name, activeTactic?.type, t]);

  function createCustomTacticEntry(
    overrides: Partial<TacticsLibraryEntry> = {},
  ): TacticsLibraryEntry {
    const customCount = customTactics.length + 1;
    const sourcePresetName =
      matchedPreset
        ? t(`tactics.presetNames.${matchedPreset.id}`, matchedPreset.id)
        : null;

    return {
      description:
        overrides.description ??
        t("tactics.customTacticDescription"),
      formation: overrides.formation ?? formation,
      id:
        overrides.id ??
        `custom:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name:
        overrides.name ??
        t("tactics.customTacticNumber", { count: customCount }),
      playStyle: overrides.playStyle ?? activePlayStyle,
      sourcePresetName:
        overrides.sourcePresetName === undefined
          ? sourcePresetName
          : overrides.sourcePresetName,
      type: "custom",
    };
  }

  function applyTacticSelection(nextTactic: TacticsLibraryEntry): void {
    onStageTactic(nextTactic);
    setActiveTacticId(nextTactic.id);
    setDraftTacticName(nextTactic.name);

    if (nextTactic.id.startsWith("preset:")) {
      setPresetAnchorId(nextTactic.id.replace("preset:", ""));
    }
  }

  /**
   * Add a tactic to the library and write it to the save.
   *
   * Creating and duplicating used to persist as a side effect of the library
   * changing at all. They still persist, but they now say so — and a refusal
   * is reported rather than leaving a tactic on screen that is not anywhere.
   */
  async function addToLibrary(nextTactic: TacticsLibraryEntry): Promise<void> {
    setCustomTactics((current) => [nextTactic, ...current]);
    setActiveTacticId(nextTactic.id);
    setDraftTacticName(nextTactic.name);

    try {
      const saved = await saveCustomTactic(toCustomTacticData(nextTactic));
      setCustomTactics(saved.map(toLibraryEntry));
    } catch {
      // Take it back off the screen. Telling the manager nothing was saved
      // while they are looking at the thing that was not saved is worse than
      // either message on its own.
      setCustomTactics((current) =>
        current.filter((entry) => entry.id !== nextTactic.id),
      );
      onAnnounce("tactics.customTacticSaveError");
    }
  }

  async function handleCreateCustomTactic(): Promise<void> {
    await addToLibrary(createCustomTacticEntry());
  }

  async function handleDuplicateTactic(): Promise<void> {
    await addToLibrary(
      createCustomTacticEntry({
        description: activeTactic?.description,
        formation,
        name: t("tactics.copyOfTactic", {
          name: draftTacticName.trim() || activeTactic?.name || t("tactics.customTactic"),
        }),
        playStyle: activePlayStyle,
        sourcePresetName: activeTactic?.sourcePresetName ?? activeTactic?.name ?? null,
      }),
    );
  }

  async function handleSaveTactic(): Promise<void> {
    const nextName = draftTacticName.trim() || t("tactics.customTactic");
    const isUpdate =
      isActiveCustomTactic &&
      activeTactic &&
      customTactics.some((entry) => entry.id === activeTactic.id);

    const nextTactic: TacticsLibraryEntry = isUpdate
      ? {
          ...activeTactic,
          formation,
          name: nextName,
          playStyle: activePlayStyle,
        }
      : createCustomTacticEntry({
          description: activeTactic?.description,
          formation,
          name: nextName,
          playStyle: activePlayStyle,
          sourcePresetName: activeTactic?.name ?? null,
        });

    try {
      const saved = await saveCustomTactic(toCustomTacticData(nextTactic));
      setCustomTactics(saved.map(toLibraryEntry));
      setSavedTacticId(nextTactic.id);
      onAnnounce("tactics.customTacticUpdated");
      if (!isUpdate) {
        setActiveTacticId(nextTactic.id);
        setDraftTacticName(nextTactic.name);
      }
    } catch {
      // Nothing was written, so nothing is confirmed. The old code told the
      // manager it had saved before it knew, and swallowed the failure.
      setSavedTacticId(null);
      onAnnounce("tactics.customTacticSaveError");
    }
  }

  const saveControls = getCustomTacticUpdateControls({
    activeTactic,
    didSave: savedTacticId === activeTactic.id && !isCommandBarDirty,
    isLibraryDirty: isCommandBarDirty,
    isSaving: false,
  });

  return {
    activeTactic,
    tacticLibrary,
    isCommandBarDirty,
    applyTacticSelection,
    handleCreateCustomTactic,
    handleDuplicateTactic,
    handleSaveTactic,
    saveControls,
  };
}
