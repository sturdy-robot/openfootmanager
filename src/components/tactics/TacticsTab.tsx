import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";

import type {
  GameStateData,
  PlayerData,
  PlayerSelectionOptions,
} from "../../store/gameStore";
import {
  applyLineupDrop,
  applyLineupSwap,
  buildActivePositionMap,
  buildPitchRows,
  buildPitchSlotRows,
  type SquadSection,
} from "../squad/SquadTab.helpers";
import TacticsFilters from "./TacticsFilters";
import {
  buildTacticsPitchSlots,
  buildTacticsRoster,
  clampSlotAdjustment,
  countOutOfPositionPlayers,
  filterAndSortTacticsPlayers,
  getSelectedAndComparePlayers,
  resolveStartingXiIds,
  type SortKey,
  type TacticsSlotAdjustments,
} from "./TacticsTab.helpers";
import TacticsPitch from "./TacticsPitch";
import TacticsPlayerFocusPanel from "./TacticsPlayerFocusPanel";
import TacticsPlayerTable from "./TacticsPlayerTable";
import TacticsRolesPanel from "./TacticsRolesPanel";
import TacticsSetupPanel from "./TacticsSetupPanel";

interface TacticsTabProps {
  gameState: GameStateData;
  onSelectPlayer: (id: string, options?: PlayerSelectionOptions) => void;
  onGameUpdate: (g: GameStateData) => void;
}

export default function TacticsTab({
  gameState,
  onSelectPlayer,
  onGameUpdate,
}: TacticsTabProps): JSX.Element {
  const { t } = useTranslation();
  const myTeam = gameState.teams.find(
    (team) => team.id === gameState.manager.team_id,
  );
  const [playerSearch, setPlayerSearch] = useState("");
  const [positionFilter, setPositionFilter] = useState("All");
  const [sortKey, setSortKey] = useState<SortKey>("pos");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [pendingStartingXiIds, setPendingStartingXiIds] = useState<
    string[] | null
  >(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [selectedPlayerSection, setSelectedPlayerSection] =
    useState<SquadSection | null>(null);
  const [comparePlayerId, setComparePlayerId] = useState<string | null>(null);
  const [comparePlayerSection, setComparePlayerSection] =
    useState<SquadSection | null>(null);
  const [activeTab, setActiveTab] = useState<"lineup" | "roles">("lineup");
  const [slotAdjustments, setSlotAdjustments] = useState<TacticsSlotAdjustments>(
    {},
  );
  const [isShapeEditorEnabled, setIsShapeEditorEnabled] = useState(false);

  if (!myTeam) {
    return (
      <p className="text-gray-500 dark:text-gray-400">{t("common.noTeam")}</p>
    );
  }

  const roster = buildTacticsRoster(gameState.players, myTeam.id);
  const formation = myTeam.formation || "4-4-2";
  const activePlayStyle = myTeam.play_style || "Balanced";
  const savedStartingXiKey = (myTeam.starting_xi_ids || []).join(",");
  const playersById = useMemo(
    () => new Map(roster.map((player) => [player.id, player])),
    [roster],
  );
  const available = roster.filter((player) => !player.injury);
  const pitchRows = useMemo(() => buildPitchRows(formation), [formation]);

  const startingXiIds = useMemo(
    () =>
      resolveStartingXiIds({
        availablePlayers: available,
        formation,
        pendingStartingXiIds,
        playersById,
        savedStartingXiIds: myTeam.starting_xi_ids || [],
      }),
    [
      available.map((player) => player.id).join(","),
      formation,
      (myTeam.starting_xi_ids || []).join(","),
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
    if (savedStartingXiKey === pendingStartingXiIds.join(",")) {
      setPendingStartingXiIds(null);
    }
  }, [pendingStartingXiIds, savedStartingXiKey]);

  useEffect(() => {
    setSlotAdjustments({});
    setIsShapeEditorEnabled(false);
  }, [formation]);

  const pitchSlotRows = useMemo(
    () => buildPitchSlotRows(pitchRows, startingXiIds, playersById),
    [pitchRows, playersById, startingXiIds],
  );
  const pitchSlots = useMemo(
    () => buildTacticsPitchSlots(pitchSlotRows, slotAdjustments),
    [pitchSlotRows, slotAdjustments],
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

  const canConfirmSwap = useMemo(() => {
    if (
      !selectedPlayerId ||
      !selectedPlayerSection ||
      !comparePlayerId ||
      !comparePlayerSection
    ) {
      return false;
    }

    const nextXiIds = applyLineupSwap(
      startingXiIds,
      { id: selectedPlayerId, from: selectedPlayerSection },
      comparePlayerId,
      comparePlayerSection,
    );

    return !!nextXiIds && nextXiIds.join(",") !== startingXiIds.join(",");
  }, [
    comparePlayerId,
    comparePlayerSection,
    selectedPlayerId,
    selectedPlayerSection,
    startingXiIds,
  ]);

  const filteredStartingXI = useMemo(
    () =>
      filterAndSortTacticsPlayers(
        startingXI,
        {
          playerSearch,
          positionFilter,
          section: "xi",
          xiActivePosition,
        },
        {
          section: "xi",
          sortDir,
          sortKey,
          xiActivePosition,
        },
      ),
    [
      startingXI,
      playerSearch,
      positionFilter,
      sortKey,
      sortDir,
      xiActivePosition,
    ],
  );
  const filteredBench = useMemo(
    () =>
      filterAndSortTacticsPlayers(
        bench,
        {
          playerSearch,
          positionFilter,
          section: "bench",
          xiActivePosition,
        },
        {
          section: "bench",
          sortDir,
          sortKey,
          xiActivePosition,
        },
      ),
    [bench, playerSearch, positionFilter, sortKey, sortDir, xiActivePosition],
  );

  const outOfPositionCount = countOutOfPositionPlayers(
    startingXI,
    xiActivePosition,
  );
  const hasCustomShape = Object.values(slotAdjustments).some(
    (adjustment) => adjustment.dx !== 0 || adjustment.dy !== 0,
  );

  function toggleSort(key: SortKey): void {
    if (sortKey === key) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDir(key === "ovr" ? "desc" : "asc");
  }

  async function persistStartingXI(playerIds: string[]): Promise<void> {
    setPendingStartingXiIds(playerIds);
    try {
      const updated = await invoke<GameStateData>("set_starting_xi", {
        playerIds,
      });
      onGameUpdate(updated);
    } catch (error) {
      setPendingStartingXiIds(null);
      console.error("Failed to set starting XI:", error);
    }
  }

  async function handleFormationChange(nextFormation: string): Promise<void> {
    try {
      const updated = await invoke<GameStateData>("set_formation", {
        formation: nextFormation,
      });
      onGameUpdate(updated);
    } catch (error) {
      console.error("Failed to set formation:", error);
    }
  }

  async function handlePlayStyleChange(playStyle: string): Promise<void> {
    try {
      const updated = await invoke<GameStateData>("set_play_style", {
        playStyle,
      });
      onGameUpdate(updated);
    } catch (error) {
      console.error("Failed to set play style:", error);
    }
  }

  function clearLineupSelection(): void {
    setSelectedPlayerId(null);
    setSelectedPlayerSection(null);
    setComparePlayerId(null);
    setComparePlayerSection(null);
  }

  async function handlePitchDrop(
    dragState: {
      from: SquadSection;
      playerId: string;
      slotIndex: number | null;
    },
    playerId: string,
    slotIndex: number,
  ): Promise<void> {
    const nextXiIds = applyLineupDrop(
      startingXiIds,
      { ...dragState, playerId },
      slotIndex,
    );

    if (nextXiIds.join(",") === startingXiIds.join(",")) {
      return;
    }

    await persistStartingXI(nextXiIds);
    clearLineupSelection();
  }

  async function handleLineupPlayerClick(
    playerId: string,
    section: SquadSection,
  ): Promise<void> {
    if (!selectedPlayerId || !selectedPlayerSection) {
      setSelectedPlayerId(playerId);
      setSelectedPlayerSection(section);
      return;
    }

    if (selectedPlayerId === playerId && selectedPlayerSection === section) {
      if (comparePlayerId && comparePlayerSection) {
        setSelectedPlayerId(comparePlayerId);
        setSelectedPlayerSection(comparePlayerSection);
        setComparePlayerId(null);
        setComparePlayerSection(null);
        return;
      }

      clearLineupSelection();
      return;
    }

    if (comparePlayerId === playerId && comparePlayerSection === section) {
      setComparePlayerId(null);
      setComparePlayerSection(null);
      return;
    }

    setComparePlayerId(playerId);
    setComparePlayerSection(section);
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

  function handleClearFilters(): void {
    setPlayerSearch("");
    setPositionFilter("All");
  }

  function handleSlotAdjustmentChange(
    slotIndex: number,
    adjustment: { dx: number; dy: number },
  ): void {
    const slot = pitchSlots.find((candidate) => candidate.index === slotIndex);
    if (!slot) {
      return;
    }

    setSlotAdjustments((current) => ({
      ...current,
      [slotIndex]: clampSlotAdjustment(slot.baseX, slot.baseY, adjustment),
    }));
  }

  function handleResetShape(): void {
    setSlotAdjustments({});
    setIsShapeEditorEnabled(false);
  }

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-4">
      <div className="flex gap-1 self-start rounded-lg bg-gray-100 p-1 dark:bg-navy-800">
        <button
          type="button"
          onClick={() => setActiveTab("lineup")}
          className={`rounded-md px-4 py-2 text-xs font-heading font-bold uppercase tracking-wider transition-colors ${
            activeTab === "lineup"
              ? "bg-white text-gray-900 shadow-sm dark:bg-navy-700 dark:text-white"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
        >
          {t("tactics.lineupTab")}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("roles")}
          className={`rounded-md px-4 py-2 text-xs font-heading font-bold uppercase tracking-wider transition-colors ${
            activeTab === "roles"
              ? "bg-white text-gray-900 shadow-sm dark:bg-navy-700 dark:text-white"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
        >
          {t("tactics.rolesTab")}
        </button>
      </div>

      {activeTab === "lineup" ? (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.95fr)] gap-4 items-start">
            <TacticsPitch
              benchPlayers={bench}
              formation={formation}
              comparePlayerId={comparePlayerId}
              hasCustomShape={hasCustomShape}
              isShapeEditorEnabled={isShapeEditorEnabled}
              onClearSelection={clearLineupSelection}
              onLineupPlayerClick={(playerId, section) => {
                void handleLineupPlayerClick(playerId, section);
              }}
              onPlayerDrop={(dragState, playerId, slotIndex) => {
                void handlePitchDrop(dragState, playerId, slotIndex);
              }}
              onResetShape={handleResetShape}
              onSlotAdjustmentChange={handleSlotAdjustmentChange}
              onToggleShapeEditor={() =>
                setIsShapeEditorEnabled((current) => !current)
              }
              outOfPositionCount={outOfPositionCount}
              pitchSlots={pitchSlots}
              selectedPlayer={selectedPlayer}
              selectedPlayerId={selectedPlayerId}
            />

            <div className="flex flex-col gap-4">
              <TacticsPlayerFocusPanel
                canConfirmSwap={canConfirmSwap}
                onConfirmSwap={() => {
                  void handleConfirmSwap();
                }}
                selectedPlayer={selectedPlayer}
                comparePlayer={comparePlayer}
              />
              <TacticsSetupPanel
                activePlayStyle={activePlayStyle}
                formation={formation}
                hasCustomShape={hasCustomShape}
                isShapeEditorEnabled={isShapeEditorEnabled}
                onFormationChange={(nextFormation) => {
                  void handleFormationChange(nextFormation);
                }}
                onPlayStyleChange={(playStyle) => {
                  void handlePlayStyleChange(playStyle);
                }}
                onResetShape={handleResetShape}
                onToggleShapeEditor={() =>
                  setIsShapeEditorEnabled((current) => !current)
                }
              />
            </div>
          </div>

          <TacticsFilters
            onClear={handleClearFilters}
            onPlayerSearchChange={setPlayerSearch}
            onPositionFilterChange={setPositionFilter}
            playerSearch={playerSearch}
            positionFilter={positionFilter}
          />

          <TacticsPlayerTable
            emptyMessage={t("squad.noLineupMatches")}
            highlightedPlayerId={selectedPlayerId}
            onSelectPlayer={onSelectPlayer}
            players={filteredStartingXI}
            section="xi"
            sortDir={sortDir}
            sortKey={sortKey}
            title={t("preMatch.startingXI")}
            toggleSort={toggleSort}
            totalCount={startingXI.length}
            xiActivePosition={xiActivePosition}
          />

          <TacticsPlayerTable
            emptyMessage={t("squad.noBenchMatches")}
            highlightedPlayerId={selectedPlayerId}
            onSelectPlayer={onSelectPlayer}
            players={filteredBench}
            section="bench"
            sortDir={sortDir}
            sortKey={sortKey}
            title={t("preMatch.substitutes")}
            toggleSort={toggleSort}
            totalCount={bench.length}
            xiActivePosition={xiActivePosition}
          />
        </>
      ) : (
        <TacticsRolesPanel
          allSquad={roster}
          matchRoles={myTeam.match_roles}
          onGameUpdate={onGameUpdate}
          startingPlayers={startingXI}
        />
      )}
    </div>
  );
}
