import { useCallback, useMemo, useRef, useState } from "react";

import { useGameStore, type GameStateData } from "../../store/gameStore";
import { applyTeamTactics } from "../../services/squadService";
import type { TacticsPhaseSettings } from "../../store/types";
import {
  EMPTY_TACTICS_DRAFT_STATE,
  applyTacticsDraft,
  getTacticsDraftControls,
  reduceTacticsDraft,
  remainingDraftAfterApply,
  type TacticsDraftAction,
  type TacticsDraftControls,
  type TacticsDraftState,
} from "./TacticsCustomTactics.helpers";
import {
  findTacticsPresetBySetup,
  type TacticsPresetDefinition,
} from "./TacticsTab.helpers";

interface UseTacticsDraftArgs {
  gameState: GameStateData | null;
  onGameUpdate: (gameState: GameStateData) => void;
}

/**
 * The tactical changes the manager is considering, before they are committed.
 *
 * Every dial on this screen used to write straight to the backend, one call per
 * control, which made a half-applied tactic an ordinary outcome rather than a
 * bug. Here the edits accumulate locally and land together, or not at all.
 *
 * Only shape, style and the phase dials are staged. Lineup changes keep their
 * own immediate path, so the draft never holds a stale copy of the XI.
 */
export function useTacticsDraft({
  gameState,
  onGameUpdate,
}: UseTacticsDraftArgs) {
  const { sessionState } = useGameStore();
  const [draftState, setDraftState] = useState<TacticsDraftState>(
    EMPTY_TACTICS_DRAFT_STATE,
  );
  const applyingRef = useRef(false);

  const teamId =
    sessionState?.manager?.team_id ?? gameState?.manager?.team_id ?? null;
  const appliedTeam =
    sessionState?.team ??
    gameState?.teams?.find((team) => team.id === teamId) ??
    null;

  const stage = useCallback(
    (action: TacticsDraftAction) => {
      if (!appliedTeam) {
        return;
      }

      setDraftState((current) =>
        reduceTacticsDraft(
          {
            ...current,
            presetAnchor:
              current.presetAnchor ??
              findTacticsPresetBySetup(
                appliedTeam.formation,
                appliedTeam.play_style,
              ),
          },
          action,
          appliedTeam,
        ),
      );
    },
    [appliedTeam],
  );

  // A team already playing a preset is anchored to it from the start. Waiting
  // for the manager to reselect what they are visibly already using would leave
  // Reset dead exactly when they first want it — right after the first change.
  const appliedPreset = appliedTeam
    ? findTacticsPresetBySetup(appliedTeam.formation, appliedTeam.play_style)
    : null;
  const presetAnchor = draftState.presetAnchor ?? appliedPreset;

  const controls: TacticsDraftControls = useMemo(
    () =>
      appliedTeam
        ? getTacticsDraftControls({ ...draftState, presetAnchor }, appliedTeam)
        : {
            canApply: false,
            canReset: false,
            canRevert: false,
            isDraftDirty: false,
          },
    [appliedTeam, draftState, presetAnchor],
  );

  const apply = useCallback(async () => {
    // A ref rather than the rendered `isApplying`: two clicks in the same tick
    // both read the state from before the first one, so state cannot be what
    // stops the second request from going out.
    if (!gameState || applyingRef.current) {
      return;
    }

    applyingRef.current = true;
    setDraftState((current) => ({ ...current, isApplying: true }));

    try {
      const result = await applyTacticsDraft({
        applyTeamTactics,
        gameState,
        state: draftState,
      });

      setDraftState((current) => {
        // Read `current`, not the state the request was built from: the manager
        // can keep editing while it is in flight, and replacing the draft
        // wholesale would throw those edits away.
        const sent = result.sent;

        return {
          ...current,
          draft: sent ? remainingDraftAfterApply(current.draft, sent) : current.draft,
          feedbackKey: result.state.feedbackKey,
          isApplying: false,
        };
      });

      if (result.gameState) {
        onGameUpdate(result.gameState);
      }
    } finally {
      applyingRef.current = false;
    }
  }, [draftState, gameState, onGameUpdate]);

  return {
    appliedTeam,
    controls,
    feedbackKey: draftState.feedbackKey,
    formation:
      draftState.draft.formation ?? appliedTeam?.formation ?? "4-4-2",
    isApplying: draftState.isApplying,
    playStyle:
      draftState.draft.play_style ?? appliedTeam?.play_style ?? "Balanced",
    presetAnchor,
    tacticsPhase: draftState.draft.tactics_phase ?? appliedTeam?.tactics_phase,

    apply,
    reset: useCallback(() => stage({ type: "reset" }), [stage]),
    revert: useCallback(() => stage({ type: "revert" }), [stage]),
    stageFormation: useCallback(
      (formation: string) => stage({ type: "formationChanged", formation }),
      [stage],
    ),
    stagePhase: useCallback(
      (patch: Partial<TacticsPhaseSettings>) =>
        stage({ type: "phaseChanged", patch }),
      [stage],
    ),
    stagePlayStyle: useCallback(
      (playStyle: string) => stage({ type: "playStyleChanged", playStyle }),
      [stage],
    ),
    stagePreset: useCallback(
      (preset: TacticsPresetDefinition) =>
        stage({ type: "presetSelected", preset }),
      [stage],
    ),
  };
}
