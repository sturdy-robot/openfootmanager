import type { DragEvent, JSX } from "react";
import { useTranslation } from "react-i18next";

import { getPlayerOvr } from "../../lib/helpers";
import type { PlayerData, TeamMatchRolesData } from "../../store/gameStore";
import ContextMenu from "../ContextMenu";
import { Card, PitchToken } from "../ui";
import { FormationBoard } from "../match/FormationBoard";
import {
  isPlayerExactForSlot,
  isPlayerOutOfPosition,
  translatePositionAbbreviation,
  type DragState,
  type SquadSection,
} from "../squad/SquadTab.helpers";
import type { TacticsPitchSlot } from "./TacticsTab.helpers";
import { buildTacticsPlayerContextMenuItems } from "./TacticsContextMenu.helpers";
import type { KitPattern, TacticsPhaseSettings } from "../../store/types";

interface TacticsPitchProps {
  benchPlayers?: PlayerData[];
  dragState: DragState | null;
  formation: string;
  matchRoles?: TeamMatchRolesData;
  tacticsPhase?: TacticsPhaseSettings;
  teamKitPattern?: KitPattern;
  teamPrimaryColor?: string;
  teamSecondaryColor?: string;
  comparePlayerId: string | null;
  hoveredSlot: number | null;
  onAssignBestFit?: (playerId: string) => void;
  onAssignMatchRole?: (
    role: keyof TeamMatchRolesData,
    playerId: string,
  ) => void;
  onClearSelection: () => void;
  onDemoteStarter?: (playerId: string) => void;
  onDragStart: (
    event: DragEvent<HTMLElement>,
    playerId: string,
    from: SquadSection,
    slotIndex: number | null,
  ) => void;
  onDragEnd: () => void;
  onLineupPlayerClick: (playerId: string, section: SquadSection) => void;
  onOpenPlayerProfile?: (playerId: string) => void;
  onPromoteBench?: (playerId: string) => void;
  onSlotDragOver: (event: DragEvent<HTMLElement>, slotIndex: number) => void;
  onSlotDragLeave: (slotIndex: number) => void;
  onSlotDrop: (event: DragEvent<HTMLElement>, slotIndex: number) => void;
  onSlotAssign?: (slotIndex: number) => void;
  onSlotFocus?: (slotIndex: number) => void;
  pitchSlots: TacticsPitchSlot[];
  selectedPlayerId: string | null;
}

type FitTone = "exact" | "adapted" | "out" | "empty";

interface RoleMarker {
  key: keyof TeamMatchRolesData;
  shortLabel: string;
  toneClassName: string;
}

function getFitTone(player: PlayerData | null, slotPosition: string): FitTone {
  if (!player) {
    return "empty";
  }

  if (isPlayerExactForSlot(player, slotPosition)) {
    return "exact";
  }

  if (isPlayerOutOfPosition(player, slotPosition)) {
    return "out";
  }

  return "adapted";
}

function getRoleMarkers(
  matchRoles: TeamMatchRolesData | undefined,
  playerId: string,
): RoleMarker[] {
  if (!matchRoles) {
    return [];
  }

  const markers: RoleMarker[] = [];

  if (matchRoles.captain === playerId) {
    markers.push({
      key: "captain",
      shortLabel: "C",
      toneClassName: "border-accent-500 bg-accent-500 text-white",
    });
  }

  if (matchRoles.vice_captain === playerId) {
    markers.push({
      key: "vice_captain",
      shortLabel: "VC",
      toneClassName: "border-white/60 bg-gray-800/85 text-white",
    });
  }

  if (matchRoles.penalty_taker === playerId) {
    markers.push({
      key: "penalty_taker",
      shortLabel: "PK",
      toneClassName: "border-primary-500 bg-primary-500 text-white",
    });
  }

  if (matchRoles.free_kick_taker === playerId) {
    markers.push({
      key: "free_kick_taker",
      shortLabel: "FK",
      toneClassName: "border-success-600 bg-success-600 text-white",
    });
  }

  if (matchRoles.corner_taker === playerId) {
    markers.push({
      key: "corner_taker",
      shortLabel: "CK",
      toneClassName: "border-orange-500 bg-orange-500 text-white",
    });
  }

  return markers;
}




function getPitchDisplayName(player: PlayerData): string {
  return (player.match_name || player.full_name).toUpperCase();
}

// SVG viewBox is 0 0 100 140; pitch bounds x=[4,96] y=[4,136]; midfield at y=70.
// Team attacks upward (toward y=4). Defensive line sits in the lower half.
function getDefensiveLineY(line: TacticsPhaseSettings["defensive_line"]): number {
  switch (line) {
    case "High": return 77;
    case "Low": return 105;
    case "VeryLow": return 118;
    default: return 91; // Medium
  }
}

function getPressingZoneOpacity(intensity: TacticsPhaseSettings["pressing_intensity"]): number {
  switch (intensity) {
    case "Aggressive": return 0.13;
    case "Passive": return 0;
    default: return 0.07; // Medium
  }
}

function getPressingZoneTop(intensity: TacticsPhaseSettings["pressing_intensity"]): number {
  // Aggressive: press from opponent's half; Medium: press from 35m line; Passive: no zone
  switch (intensity) {
    case "Aggressive": return 4;
    case "Passive": return 70;
    default: return 35;
  }
}

function TacticalOverlays({ phase }: { phase: TacticsPhaseSettings }): JSX.Element {
  const lineY = getDefensiveLineY(phase.defensive_line);
  const pressOpacity = getPressingZoneOpacity(phase.pressing_intensity);
  const pressTop = getPressingZoneTop(phase.pressing_intensity);

  return (
    <>
      {/* Pressing zone: shaded band in the opponent's half */}
      {pressOpacity > 0 && (
        <rect
          x="4"
          y={pressTop}
          width="92"
          height={70 - pressTop}
          fill={`rgba(255,220,100,${pressOpacity})`}
          pointerEvents="none"
        />
      )}

      {/* Defensive line: dashed horizontal line */}
      <line
        x1="4"
        y1={lineY}
        x2="96"
        y2={lineY}
        stroke="rgba(255,80,80,0.75)"
        strokeWidth="0.8"
        strokeDasharray="3,2"
        pointerEvents="none"
      />

    </>
  );
}

export default function TacticsPitch({
  dragState,
  formation,
  matchRoles,
  tacticsPhase,
  teamKitPattern,
  teamPrimaryColor,
  teamSecondaryColor,
  comparePlayerId,
  hoveredSlot,
  onAssignBestFit,
  onAssignMatchRole,
  onClearSelection,
  onDemoteStarter,
  onDragEnd,
  onDragStart,
  onLineupPlayerClick,
  onOpenPlayerProfile,
  onPromoteBench,
  onSlotDragLeave,
  onSlotDragOver,
  onSlotDrop,
  onSlotAssign,
  onSlotFocus,
  pitchSlots,
  selectedPlayerId,
}: TacticsPitchProps): JSX.Element {
  const { t } = useTranslation();
  const draggedPlayerId = dragState?.playerId ?? null;

  const boardSlots = pitchSlots.map((slot) => ({
    occupant: slot.player,
    ariaLabel: slot.player ? undefined : `${translatePositionAbbreviation(t, slot.position)} · ${t("squad.dropPlayerHere")}`,
  }));

  const findSlotIndex = (playerId: string | null): number | null => {
    if (!playerId) {
      return null;
    }
    const index = pitchSlots.findIndex((slot) => slot.player?.id === playerId);
    return index >= 0 ? index : null;
  };

  /** What the board already knows about a slot, drawn where it can be seen. */
  const slotStateClassName = (state: {
    isCompared: boolean;
    isDragged: boolean;
    isDropTarget: boolean;
    isSelected: boolean;
  }): string => {
    if (state.isDragged) {
      return "opacity-60";
    }
    if (state.isSelected) {
      return "rounded-2xl bg-accent-500/20 ring-2 ring-accent-300/70 dark:bg-accent-500/20 dark:ring-accent-300/70";
    }
    if (state.isCompared) {
      return "rounded-2xl bg-primary-500/20 ring-2 ring-primary-300/60 dark:bg-primary-500/20 dark:ring-primary-300/60";
    }
    if (state.isDropTarget) {
      return "rounded-2xl bg-primary-500/15 ring-2 ring-primary-200/60 dark:bg-primary-500/15 dark:ring-primary-200/60";
    }
    return "";
  };

  const renderPitchToken = (
    player: PlayerData,
    slotPosition: string,
    stateClassName: string,
  ) => (
    <ContextMenu
      items={buildTacticsPlayerContextMenuItems({
        isSelected: selectedPlayerId === player.id,
        matchRoles,
        onAssignBestFit,
        onAssignMatchRole,
        onClearSelection,
        onDemoteStarter,
        onOpenProfile: (playerId) => {
          if (onOpenPlayerProfile) {
            onOpenPlayerProfile(playerId);
          } else {
            onLineupPlayerClick(playerId, "xi");
          }
        },
        onPromoteBench,
        onTacticalSelect: onLineupPlayerClick,
        player,
        section: "xi",
        selectedPlayerId,
        t,
      })}
    >
      {/* ContextMenu injects its handler by cloning this child, so it has to be
          a DOM element — cloning a component drops the prop silently. */}
      <div className={stateClassName || "contents"}>
      <PitchToken
        avatar={player}
        condition={player.condition}
        fitTone={getFitTone(player, slotPosition)}
        jersey={
          teamSecondaryColor
            ? {
                primaryColor: teamPrimaryColor ?? "#1a3a6b",
                secondaryColor: teamSecondaryColor,
                pattern: teamKitPattern ?? "Solid",
                number: player.jersey_number,
              }
            : undefined
        }
        jerseyNumber={player.jersey_number}
        markers={getRoleMarkers(matchRoles, player.id)}
        name={getPitchDisplayName(player)}
        ovr={getPlayerOvr(player)}
        position={slotPosition}
        positionAbbr={translatePositionAbbreviation(t, slotPosition)}
      />
      </div>
    </ContextMenu>
  );

  return (
    <Card className="min-h-0 overflow-hidden @5xl/tactics:h-full">
      <div className="flex min-h-0 items-center p-5 sm:p-6 lg:p-7 @5xl/tactics:h-full">
        <div className="relative mx-auto w-full overflow-hidden rounded-3xl border border-primary-500/20 shadow-inner dark:border-primary-400/20 @5xl/tactics:aspect-5/7 @5xl/tactics:h-full @5xl/tactics:w-auto">
          <FormationBoard
            formation={formation}
            interaction={{
              comparedSlotIndex: findSlotIndex(comparePlayerId),
              draggedSlotIndex: findSlotIndex(draggedPlayerId),
              hoveredSlotIndex: hoveredSlot,
              onSlotActivate: (slotIndex) => {
                const slotPlayer = pitchSlots[slotIndex]?.player;
                if (slotPlayer) {
                  onLineupPlayerClick(slotPlayer.id, "xi");
                }
              },
              onSlotDragEnd: onDragEnd,
              onSlotDragLeave,
              onSlotDragOver,
              onSlotDragStart: (event, slotIndex) => {
                const slotPlayer = pitchSlots[slotIndex]?.player;
                if (slotPlayer) {
                  onDragStart(event, slotPlayer.id, "xi", slotIndex);
                }
              },
              onSlotDrop,
              onSlotAssign,
              onSlotFocus,
              selectedSlotIndex: findSlotIndex(selectedPlayerId),
            }}
            label={t("tactics.startingXI", { formation })}
            orientation="normal"
            overlays={
              tacticsPhase ? <TacticalOverlays phase={tacticsPhase} /> : undefined
            }
            renderEmptySlot={(state) => (
              <div
                className={`flex w-[4.5rem] flex-col items-center text-center ${
                  state.isDropTarget
                    ? "rounded-2xl bg-primary-500/25 ring-2 ring-primary-200/70"
                    : ""
                }`}
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-dashed border-white/28 bg-black/12 text-[10px] font-heading font-bold uppercase tracking-[0.18em] text-white/70">
                  {translatePositionAbbreviation(t, state.position)}
                </div>
                <div className="mt-1 max-w-full text-[9px] font-heading font-bold uppercase tracking-[0.16em] text-white/45">
                  {t("squad.dropPlayerHere")}
                </div>
              </div>
            )}
            renderToken={(player, state) =>
              renderPitchToken(
                player,
                state.position,
                slotStateClassName(state),
              )
            }
            slots={boardSlots}
            variant="full"
          />
        </div>
      </div>
    </Card>
  );
}
