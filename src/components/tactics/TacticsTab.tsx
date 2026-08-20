import { useRef, useState, type JSX } from "react";
import type {
  GameStateData,
  PlayerData,
  PlayerSelectionOptions,
} from "../../store/gameStore";
import { useTranslation } from "react-i18next";
import { setPlayerRole } from "../../services/squadService";
import { rolesByStartingPlayer } from "../../lib/playerRoles";

import TacticsPitch from "./TacticsPitch";
import TacticsPlayerList from "./TacticsPlayerList";
import TacticsInspector from "./TacticsInspector";
import TacticsCommandBar from "./TacticsCommandBar";
import { useTacticsDraft } from "./useTacticsDraft";
import { useTacticsLibrary } from "./useTacticsLibrary";
import { useTacticsFilters } from "./useTacticsFilters";
import { useTacticsLineup } from "./useTacticsLineup";
import { TACTICS_PRESETS } from "./TacticsTab.helpers";
import TacticsAssignmentDialog from "./TacticsAssignmentDialog";
import { translatePositionLabel } from "../squad/SquadTab.helpers";

interface AssignmentSlot {
  occupant: PlayerData | null;
  slotIndex: number;
  slotPosition: string;
}

interface TacticsTabProps {
  gameState: GameStateData | null;
  onSelectPlayer: (id: string, options?: PlayerSelectionOptions) => void;
  onGameUpdate: (g: GameStateData) => void;
}

export default function TacticsTab({
  gameState,
  onSelectPlayer,
  onGameUpdate,
}: TacticsTabProps): JSX.Element {
  const { t } = useTranslation();
  const [focusedSlotIndex, setFocusedSlotIndex] = useState<number | null>(null);
  const [assignmentSlot, setAssignmentSlot] = useState<AssignmentSlot | null>(
    null,
  );
  const [assignmentAnnouncement, setAssignmentAnnouncement] = useState("");
  const assignmentOriginRef = useRef<HTMLElement | null>(null);

  const {
    apply,
    controls: draftControls,
    feedbackKey: draftFeedbackKey,
    formation,
    isApplying,
    playStyle: activePlayStyle,
    reset,
    revert,
    stageFormation,
    stagePhase,
    stagePlayStyle,
    stagePreset,
    tacticsPhase,
  } = useTacticsDraft({ gameState, onGameUpdate });

  const {
    team,
    initialPreset,
    roster,
    startingXI,
    startingXiIds,
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
  } = useTacticsLineup({ formation, gameState, onGameUpdate });

  const {
    playerSearch,
    setPlayerSearch,
    positionFilter,
    setPositionFilter,
    filteredStartingXI,
    filteredBench,
    handleClearFilters,
  } = useTacticsFilters({ startingXI, bench, xiActivePosition });

  const {
    activeTactic,
    tacticLibrary,
    isCommandBarDirty,
    applyTacticSelection,
    handleCreateCustomTactic,
    handleDuplicateTactic,
    handleSaveTactic,
    saveControls,
  } = useTacticsLibrary({
    gameState,
    formation,
    activePlayStyle,
    initialPreset,
    onStageTactic: (nextTactic) => {
      const preset = TACTICS_PRESETS.find(
        (candidate) => `preset:${candidate.id}` === nextTactic.id,
      );

      if (preset) {
        stagePreset(preset);
        return;
      }

      // A custom tactic records only a shape and a style — it has no blueprint
      // of its own, so the phase dials stay where the manager left them.
      stageFormation(nextTactic.formation);
      stagePlayStyle(nextTactic.playStyle);
    },
  });

  if (!team) {
    return (
      <p className="text-gray-500 dark:text-gray-400">{t("common.noTeam")}</p>
    );
  }

  const focusedSlot =
    focusedSlotIndex === null ? null : (pitchSlots[focusedSlotIndex] ?? null);
  const focusedPlayer = focusedSlot?.player ?? null;
  const isComparing = selectedPlayer !== null && comparePlayer !== null;
  const inspectorPlayer = isComparing
    ? selectedPlayer
    : (focusedPlayer ?? selectedPlayer);
  const inspectorComparePlayer = isComparing ? comparePlayer : null;
  const inspectorDeployedPosition =
    !isComparing && focusedPlayer
      ? focusedSlot?.position
      : inspectorPlayer
        ? xiActivePosition.get(inspectorPlayer.id)
        : undefined;

  const closeAssignmentDialog = () => {
    setAssignmentSlot(null);
    assignmentOriginRef.current?.focus();
  };

  const assignPlayerToOpenSlot = async (playerId: string) => {
    if (!assignmentSlot) {
      return;
    }
    const incoming = roster.find((player) => player.id === playerId);
    if (!incoming) {
      return;
    }

    const slot = assignmentSlot;
    const position = translatePositionLabel(t, slot.slotPosition);
    closeAssignmentDialog();

    // Announced once the write is acknowledged. Saying it on the way out told
    // a screen-reader user the move had happened, and a rejected command then
    // rolled the pitch back with nothing said about it.
    const persisted = await handleAssignToSlot(playerId, slot.slotIndex);

    if (!persisted) {
      setAssignmentAnnouncement(t("tactics.assignFailed", { position }));
      return;
    }

    setAssignmentAnnouncement(
      slot.occupant
        ? t("tactics.replacedInSlot", {
            incoming: incoming.match_name || incoming.full_name,
            outgoing: slot.occupant.match_name || slot.occupant.full_name,
            position,
          })
        : t("tactics.assignedToSlot", {
            player: incoming.match_name || incoming.full_name,
            position,
          }),
    );
  };

  return (
    <div className="@container/tactics flex h-full min-h-0 w-full flex-col gap-5">
      <div
        ref={dragPreviewRef}
        aria-hidden="true"
        className="pointer-events-none fixed -left-20 top-0 h-8 w-8 rounded-full border border-white/15 bg-navy-900/90 shadow-lg"
      />
      <p aria-live="polite" className="sr-only">
        {assignmentAnnouncement}
      </p>
      <TacticsCommandBar
        activeTactic={activeTactic}
        activePlayStyle={activePlayStyle}
        draftControls={draftControls}
        feedbackKey={draftFeedbackKey ?? saveControls.feedbackKey}
        formation={formation}
        isApplying={isApplying}
        isDirty={isCommandBarDirty}
        outOfPositionCount={outOfPositionCount}
        onApply={() => {
          // What the manager is looking at, not what the server last said. An
          // XI write can still be in flight, and a responsibility can have been
          // handed to someone since the last snapshot arrived.
          void apply({
            matchRoles: effectiveMatchRoles,
            startingXiIds,
          });
        }}
        onCreateNew={handleCreateCustomTactic}
        onDuplicate={handleDuplicateTactic}
        onFormationChange={stageFormation}
        onPlayStyleChange={stagePlayStyle}
        onReset={reset}
        onRevert={revert}
        onSave={handleSaveTactic}
        saveDisabled={saveControls.disabled}
        onSelectTactic={(id) => {
          const nextTactic = tacticLibrary.find((entry) => entry.id === id);
          if (!nextTactic) {
            return;
          }

          applyTacticSelection(nextTactic);
        }}
        tacticLibrary={tacticLibrary}
      />

      <div
        className="grid min-h-0 flex-1 grid-cols-1 gap-5 overflow-auto @3xl/tactics:grid-cols-3 @5xl/tactics:grid-cols-4 @5xl/tactics:grid-rows-1 @5xl/tactics:overflow-hidden"
        onBlur={(event) => {
          // The board and the pane it feeds are one scope. Clearing the
          // focused slot the moment focus left the board unmounted the role
          // picker a keyboard user was tabbing towards, and dropped their
          // focus with it.
          const next = event.relatedTarget;
          if (next instanceof Node && event.currentTarget.contains(next)) {
            return;
          }
          setFocusedSlotIndex(null);
        }}
      >
        {/* Left: player list */}
        <TacticsPlayerList
          bench={filteredBench}
          comparePlayerId={comparePlayerId}
          dragState={dragState}
          matchRoles={effectiveMatchRoles}
          onAssignMatchRole={(role, playerId) => {
            void handleAssignMatchRole(role, playerId);
          }}
          onClearFilters={handleClearFilters}
          onDemoteStarter={(playerId) => {
            void handleDemoteStarter(playerId);
          }}
          onDragEnd={resetDragState}
          onDragStart={handleDragStart}
          onOpenPlayerProfile={onSelectPlayer}
          onPlayerSearchChange={setPlayerSearch}
          onPositionFilterChange={setPositionFilter}
          onPromoteBench={(playerId) => {
            void handlePromoteBenchPlayer(playerId);
          }}
          onTacticalSelect={(playerId, section) => {
            void handleLineupPlayerClick(playerId, section);
          }}
          playerSearch={playerSearch}
          positionFilter={positionFilter}
          selectedPlayerId={selectedPlayerId}
          starters={filteredStartingXI}
          xiActivePosition={xiActivePosition}
        />

        {/* Center: pitch */}
        <div className="min-h-0 @3xl/tactics:col-span-2">
          <TacticsPitch
            dragState={dragState}
            formation={formation}
            comparePlayerId={comparePlayerId}
            hoveredSlot={hoveredSlot}
            matchRoles={effectiveMatchRoles}
            tacticsPhase={tacticsPhase}
            teamKitPattern={team?.kit_pattern}
            teamPrimaryColor={team?.colors?.primary}
            teamSecondaryColor={team?.colors?.secondary}
            onAssignBestFit={(playerId) => {
              void handleAssignBestFit(playerId);
            }}
            onAssignMatchRole={(role, playerId) => {
              void handleAssignMatchRole(role, playerId);
            }}
            onClearSelection={clearLineupSelection}
            onDemoteStarter={(playerId) => {
              void handleDemoteStarter(playerId);
            }}
            onDragEnd={resetDragState}
            onDragStart={handleDragStart}
            onLineupPlayerClick={(playerId, section) => {
              void handleLineupPlayerClick(playerId, section);
            }}
            onOpenPlayerProfile={(playerId) => {
              onSelectPlayer(playerId);
            }}
            onPromoteBench={(playerId) => {
              void handlePromoteBenchPlayer(playerId);
            }}
            onSlotDragLeave={handleSlotDragLeave}
            onSlotDragOver={handleSlotDragOver}
            onSlotDrop={(event, slotIndex) => {
              void handleSlotDrop(event, slotIndex);
            }}
            onSlotAssign={(slotIndex) => {
              const slot = pitchSlots[slotIndex];
              if (!slot) {
                return;
              }
              assignmentOriginRef.current =
                document.activeElement instanceof HTMLElement
                  ? document.activeElement
                  : null;
              setAssignmentSlot({
                occupant: slot.player,
                slotIndex,
                slotPosition: slot.position,
              });
            }}
            onSlotFocus={setFocusedSlotIndex}
            pitchSlots={pitchSlots}
            selectedPlayerId={selectedPlayerId}
          />
        </div>

        {/* Right: whatever is selected — the team, one player, or two */}
        <TacticsInspector
          allSquad={roster}
          canConfirmSwap={canConfirmSwap}
          comparePlayer={inspectorComparePlayer}
          deployedPosition={inspectorDeployedPosition}
          isShapeSettled={formation === team.formation}
          isSelectedPlayerInSavedXi={
            inspectorPlayer
              ? (team.starting_xi_ids ?? []).includes(inspectorPlayer.id)
              : false
          }
          matchRoles={team.match_roles}
          onAssignBestFit={(playerId) => {
            void handleAssignBestFit(playerId);
          }}
          onClearSelection={clearLineupSelection}
          onConfirmSwap={() => {
            void handleConfirmSwap();
          }}
          onGameUpdate={onGameUpdate}
          onOpenPlayerProfile={onSelectPlayer}
          onPlayerRoleChange={(playerId, role) => {
            void setPlayerRole(playerId, role)
              .then(onGameUpdate)
              .catch((error: unknown) => {
                console.error("Failed to set player role:", error);
              });
          }}
          onTacticsPhaseChange={stagePhase}
          playerRoles={rolesByStartingPlayer(
            team.starting_xi_ids,
            team.slot_roles,
            team.player_roles,
          )}
          selectedPlayer={inspectorPlayer}
          startingPlayers={startingXI}
          tacticsPhase={tacticsPhase}
        />
      </div>
      {assignmentSlot ? (
        <TacticsAssignmentDialog
          candidates={roster}
          occupant={assignmentSlot.occupant}
          onAssign={(playerId) => {
            void assignPlayerToOpenSlot(playerId);
          }}
          onClose={closeAssignmentDialog}
          slotIndex={assignmentSlot.slotIndex}
          slotPosition={assignmentSlot.slotPosition}
        />
      ) : null}
    </div>
  );
}
