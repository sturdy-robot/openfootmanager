import type { DragEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import type {
  GameStateData,
  PlayerData,
  TeamMatchRolesData,
} from "../../store/gameStore";
import { useGameStore } from "../../store/gameStore";
import {
  getSquad,
  setStartingXi,
  setTeamMatchRoles,
} from "../../services/squadService";

import {
  applyLineupDrop,
  applyLineupSwap,
  buildAssignBestFitSlot,
  buildActivePositionMap,
  buildDemoteFromStartingXi,
  buildPitchRows,
  buildPitchSlotRows,
  buildPromoteToStartingXi,
  type DragState,
  type PitchSlotRow,
  type SquadSection,
} from "../squad/SquadTab.helpers";
import {
  flattenPitchSlotRows,
  buildTacticsRoster,
  canConfirmTacticsLineupSwap,
  isPlayerEligibleForTacticsLineup,
  reconcilePendingStartingXiIds,
  resolveTacticsStartingXiIds,
  updateTacticsLineupSelection,
  countOutOfPositionPlayers,
  findTacticsPresetBySetup,
  getSelectedAndComparePlayers,
} from "./TacticsTab.helpers";
import {
  buildUpdatedMatchRolesForAssignment,
  resolveEffectiveMatchRoles,
} from "./TacticsRoles.helpers";

interface UseTacticsLineupArgs {
  /**
   * The shape the pitch should draw — the staged formation when one is pending,
   * otherwise the team's own. The lineup is laid out against what the manager
   * is looking at, not against what the server last stored.
   */
  formation: string;
  gameState: GameStateData | null;
  onGameUpdate: (g: GameStateData) => void;
}

export function useTacticsLineup({
  formation,
  gameState,
  onGameUpdate,
}: UseTacticsLineupArgs) {
  const { sessionState } = useGameStore();
  const [fetchedSquad, setFetchedSquad] = useState<PlayerData[] | null>(null);
  const teamId = sessionState?.manager?.team_id ?? gameState?.manager?.team_id ?? null;
  const initialTeam = sessionState?.team ?? gameState?.teams?.find((t) => t.id === teamId) ?? null;
  const initialPreset = initialTeam
    ? findTacticsPresetBySetup(
        initialTeam.formation || "4-4-2",
        initialTeam.play_style || "Balanced",
      )
    : null;
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [hoveredSlot, setHoveredSlot] = useState<number | null>(null);
  const [pendingStartingXiIds, setPendingStartingXiIds] = useState<
    string[] | null
  >(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [selectedPlayerSection, setSelectedPlayerSection] =
    useState<SquadSection | null>(null);
  const [comparePlayerId, setComparePlayerId] = useState<string | null>(null);
  const [comparePlayerSection, setComparePlayerSection] =
    useState<SquadSection | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const hoveredSlotRef = useRef<number | null>(null);
  const dragPreviewRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!teamId) return;
    void getSquad(teamId).then(setFetchedSquad).catch(() => {});
  }, [teamId]);

  const team = sessionState?.team ?? gameState?.teams?.find((t) => t.id === teamId) ?? null;
  const players = fetchedSquad ?? gameState?.players ?? [];
  const roster = buildTacticsRoster(players, team?.id ?? null);

  const savedStartingXiKey = (team?.starting_xi_ids || []).join(",");
  const playersById = useMemo(
    () => new Map(roster.map((player) => [player.id, player])),
    [roster],
  );
  const available = roster.filter((player) => !player.injury);
  const pitchRows = useMemo(() => buildPitchRows(formation), [formation]);

  const startingXiIds = useMemo(
    () =>
      resolveTacticsStartingXiIds({
        formation,
        pendingStartingXiIds,
        roster,
        savedStartingXiIds: team?.starting_xi_ids || [],
      }),
    [
      available.map((player) => player.id).join(","),
      formation,
      (team?.starting_xi_ids || []).join(","),
      (pendingStartingXiIds || []).join(","),
      roster.map((player) => player.id).join(","),
    ],
  );

  const startingXI = useMemo(
    () =>
      startingXiIds
        .map((id) => playersById.get(id))
        .filter((player): player is PlayerData => player != null),
    [playersById, startingXiIds],
  );

  useEffect(() => {
    if (!pendingStartingXiIds) return;
    // Only the acknowledgement is acted on. Writing the pending XI back when it
    // has *not* been acknowledged would store a fresh array each pass, and this
    // effect depends on that array — an endless re-render.
    if (
      reconcilePendingStartingXiIds(
        pendingStartingXiIds,
        team?.starting_xi_ids || [],
      ) === null
    ) {
      setPendingStartingXiIds(null);
    }
  }, [pendingStartingXiIds, savedStartingXiKey]);

  const pitchSlotRows = useMemo<PitchSlotRow[]>(
    () => buildPitchSlotRows(pitchRows, startingXiIds, playersById),
    [pitchRows, playersById, startingXiIds],
  );
  const pitchSlots = useMemo(
    () => flattenPitchSlotRows(pitchSlotRows),
    [pitchSlotRows],
  );
  const xiIds = new Set(startingXiIds);
  const bench = roster.filter((player) => !xiIds.has(player.id));
  const xiActivePosition = useMemo(
    () => buildActivePositionMap(pitchSlotRows),
    [pitchSlotRows],
  );

  const { comparePlayer, selectedPlayer } = getSelectedAndComparePlayers(
    comparePlayerId,
    playersById,
    selectedPlayerId,
  );

  const canConfirmSwap = useMemo(
    () =>
      canConfirmTacticsLineupSwap(startingXiIds, playersById, {
        comparePlayerId,
        comparePlayerSection,
        selectedPlayerId,
        selectedPlayerSection,
      }),
    [
      comparePlayerId,
      comparePlayerSection,
      playersById,
      selectedPlayerId,
      selectedPlayerSection,
      startingXiIds,
    ],
  );

  const outOfPositionCount = countOutOfPositionPlayers(
    startingXI,
    xiActivePosition,
  );
  const effectiveMatchRoles = useMemo(
    () => resolveEffectiveMatchRoles(startingXI, team?.match_roles),
    [team?.match_roles, startingXI],
  );

  async function persistStartingXI(playerIds: string[]): Promise<void> {
    setPendingStartingXiIds(playerIds);
    try {
      const updated = await setStartingXi(playerIds);
      onGameUpdate(updated);
    } catch (error) {
      setPendingStartingXiIds(null);
      console.error("Failed to set starting XI:", error);
    }
  }

  async function handleAssignBestFit(playerId: string): Promise<void> {
    const nextXiIds = buildAssignBestFitSlot(
      startingXiIds,
      playersById,
      formation,
      playerId,
    );

    if (!nextXiIds || nextXiIds.join(",") === startingXiIds.join(",")) {
      return;
    }

    await persistStartingXI(nextXiIds);
    clearLineupSelection();
  }

  async function handlePromoteBenchPlayer(playerId: string): Promise<void> {
    if (!isPlayerEligibleForTacticsLineup(playersById.get(playerId))) {
      return;
    }

    const nextXiIds = buildPromoteToStartingXi(
      startingXiIds,
      playersById,
      formation,
      playerId,
    );

    if (!nextXiIds || nextXiIds.join(",") === startingXiIds.join(",")) {
      return;
    }

    await persistStartingXI(nextXiIds);
    clearLineupSelection();
  }

  async function handleDemoteStarter(playerId: string): Promise<void> {
    const nextXiIds = buildDemoteFromStartingXi(
      startingXiIds,
      available,
      formation,
      playerId,
    );

    if (!nextXiIds || nextXiIds.join(",") === startingXiIds.join(",")) {
      return;
    }

    await persistStartingXI(nextXiIds);
    clearLineupSelection();
  }

  function clearLineupSelection(): void {
    setSelectedPlayerId(null);
    setSelectedPlayerSection(null);
    setComparePlayerId(null);
    setComparePlayerSection(null);
  }

  function setHoveredSlotValue(slotIndex: number | null): void {
    if (hoveredSlotRef.current === slotIndex) {
      return;
    }

    hoveredSlotRef.current = slotIndex;
    setHoveredSlot(slotIndex);
  }

  function resetDragState(): void {
    dragStateRef.current = null;
    setDragState(null);
    setHoveredSlotValue(null);
  }

  function applyLightweightDragPreview(event: DragEvent<HTMLElement>): void {
    if (!dragPreviewRef.current) {
      return;
    }

    if (typeof event.dataTransfer.setDragImage !== "function") {
      return;
    }

    event.dataTransfer.setDragImage(dragPreviewRef.current, 16, 16);
  }

  function handleDragStart(
    event: DragEvent<HTMLElement>,
    playerId: string,
    from: SquadSection,
    slotIndex: number | null = null,
  ): void {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", playerId);
    applyLightweightDragPreview(event);
    const nextDragState = { playerId, from, slotIndex };
    dragStateRef.current = nextDragState;
    setDragState(nextDragState);
  }

  function handleSlotDragOver(
    event: DragEvent<HTMLElement>,
    slotIndex: number,
  ): void {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setHoveredSlotValue(slotIndex);
  }

  function handleSlotDragLeave(slotIndex: number): void {
    if (hoveredSlotRef.current !== slotIndex) {
      return;
    }

    setHoveredSlotValue(null);
  }

  async function handleSlotDrop(
    event: DragEvent<HTMLElement>,
    slotIndex: number,
  ): Promise<void> {
    event.preventDefault();
    const draggedPlayerId = event.dataTransfer.getData("text/plain");
    const currentDragState = dragStateRef.current ?? dragState;
    const resolvedDragState =
      currentDragState ??
      (draggedPlayerId
        ? {
            playerId: draggedPlayerId,
            from: xiIds.has(draggedPlayerId) ? "xi" : "bench",
            slotIndex: xiIds.has(draggedPlayerId)
              ? startingXiIds.indexOf(draggedPlayerId)
              : null,
          }
        : null);

    if (!resolvedDragState) return;

    if (
      resolvedDragState.from === "bench" &&
      !isPlayerEligibleForTacticsLineup(playersById.get(resolvedDragState.playerId))
    ) {
      resetDragState();
      return;
    }

    const nextXiIds = applyLineupDrop(
      startingXiIds,
      resolvedDragState,
      slotIndex,
    );
    if (nextXiIds.join(",") === startingXiIds.join(",")) {
      resetDragState();
      return;
    }

    await persistStartingXI(nextXiIds);
    clearLineupSelection();
    resetDragState();
  }

  function handleAssignToSlot(
    playerId: string,
    slotIndex: number,
  ): boolean {
    if (!isPlayerEligibleForTacticsLineup(playersById.get(playerId))) {
      return false;
    }

    const fromIndex = startingXiIds.indexOf(playerId);
    const nextXiIds = applyLineupDrop(
      startingXiIds,
      {
        playerId,
        from: fromIndex >= 0 ? "xi" : "bench",
        slotIndex: fromIndex >= 0 ? fromIndex : null,
      },
      slotIndex,
    );
    if (nextXiIds.join(",") === startingXiIds.join(",")) {
      return false;
    }

    void persistStartingXI(nextXiIds);
    clearLineupSelection();
    return true;
  }

  async function handleLineupPlayerClick(
    playerId: string,
    section: SquadSection,
  ): Promise<void> {
    const next = updateTacticsLineupSelection(
      {
        comparePlayerId,
        comparePlayerSection,
        selectedPlayerId,
        selectedPlayerSection,
      },
      playerId,
      section,
    );

    setSelectedPlayerId(next.selectedPlayerId);
    setSelectedPlayerSection(next.selectedPlayerSection);
    setComparePlayerId(next.comparePlayerId);
    setComparePlayerSection(next.comparePlayerSection);
  }

  async function handleConfirmSwap(): Promise<void> {
    if (
      !selectedPlayerId ||
      !selectedPlayerSection ||
      !comparePlayerId ||
      !comparePlayerSection
    ) {
      return;
    }

    if (
      (selectedPlayerSection === "bench" &&
        !isPlayerEligibleForTacticsLineup(
          selectedPlayerId ? playersById.get(selectedPlayerId) : null,
        )) ||
      (comparePlayerSection === "bench" &&
        !isPlayerEligibleForTacticsLineup(
          comparePlayerId ? playersById.get(comparePlayerId) : null,
        ))
    ) {
      return;
    }

    const nextXiIds = applyLineupSwap(
      startingXiIds,
      { id: selectedPlayerId, from: selectedPlayerSection },
      comparePlayerId,
      comparePlayerSection,
    );

    if (!nextXiIds || nextXiIds.join(",") === startingXiIds.join(",")) {
      return;
    }

    await persistStartingXI(nextXiIds);
    clearLineupSelection();
  }

  async function persistMatchRoles(
    nextRoles: TeamMatchRolesData,
  ): Promise<void> {
    try {
      const updated = await setTeamMatchRoles(nextRoles);
      onGameUpdate(updated);
    } catch (error) {
      console.error("Failed to set team match roles:", error);
    }
  }

  async function handleAssignMatchRole(
    role: keyof TeamMatchRolesData,
    playerId: string,
  ): Promise<void> {
    await persistMatchRoles(
      buildUpdatedMatchRolesForAssignment(
        effectiveMatchRoles,
        startingXI,
        role,
        playerId,
      ),
    );
  }

  return {
    team,
    initialPreset,
    roster,
    startingXI,
    bench,
    xiActivePosition,
    pitchSlots,
    outOfPositionCount,
    effectiveMatchRoles,
    selectedPlayer,
    comparePlayer,
    selectedPlayerId,
    comparePlayerId,
    canConfirmSwap,
    dragState,
    hoveredSlot,
    dragPreviewRef,
    handleAssignBestFit,
    handlePromoteBenchPlayer,
    handleDemoteStarter,
    clearLineupSelection,
    handleDragStart,
    handleSlotDragOver,
    handleSlotDragLeave,
    handleSlotDrop,
    handleAssignToSlot,
    handleLineupPlayerClick,
    handleConfirmSwap,
    resetDragState,
    handleAssignMatchRole,
  };
}
