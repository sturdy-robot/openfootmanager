import type { JSX, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { Star } from "lucide-react";
import { useTranslation } from "react-i18next";

import { getPlayerOvr } from "../../lib/helpers";
import type { PlayerData } from "../../store/gameStore";
import { Badge, Card } from "../ui";
import {
  isPlayerExactForSlot,
  isPlayerOutOfPosition,
  translatePositionAbbreviation,
  type DragState,
  type SquadSection,
} from "../squad/SquadTab.helpers";
import type {
  TacticsPitchSlot,
  TacticsSlotAdjustment,
} from "./TacticsTab.helpers";

interface TacticsPitchProps {
  benchPlayers: PlayerData[];
  comparePlayerId: string | null;
  formation: string;
  hasCustomShape: boolean;
  isShapeEditorEnabled: boolean;
  onClearSelection: () => void;
  onLineupPlayerClick: (playerId: string, section: SquadSection) => void;
  onPlayerDrop: (
    dragState: DragState,
    playerId: string,
    slotIndex: number,
  ) => void;
  onResetShape: () => void;
  onSlotAdjustmentChange: (
    slotIndex: number,
    adjustment: TacticsSlotAdjustment,
  ) => void;
  onToggleShapeEditor: () => void;
  outOfPositionCount: number;
  pitchSlots: TacticsPitchSlot[];
  selectedPlayer: PlayerData | null;
  selectedPlayerId: string | null;
}

interface ActiveShapeDrag {
  initialAdjustment: TacticsSlotAdjustment;
  originClientX: number;
  originClientY: number;
  slotIndex: number;
}

const DRAG_THRESHOLD = 6;

function getFitTone(player: PlayerData | null, slotPosition: string): "exact" | "adapted" | "out" | "empty" {
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

function getPitchMarkerClassName(options: {
  comparePlayerId: string | null;
  hoveredSlot: number | null;
  isDragging: boolean;
  player: PlayerData;
  selectedPlayerId: string | null;
  slot: TacticsPitchSlot;
}): string {
  const { comparePlayerId, hoveredSlot, isDragging, player, selectedPlayerId, slot } =
    options;
  const fitTone = getFitTone(player, slot.position);
  const isSelected = player.id === selectedPlayerId;
  const isComparing = player.id === comparePlayerId;
  const isHovered = hoveredSlot === slot.index;
  let className =
    "absolute z-20 flex w-24 -translate-x-1/2 -translate-y-1/2 cursor-pointer flex-col items-center rounded-2xl border px-2 py-2 text-center shadow-lg transition-all sm:w-[6.5rem]";

  if (isDragging) {
    className = `${className} opacity-35`;
  } else {
    className = `${className} hover:-translate-y-[52%]`;
  }

  if (isSelected) {
    return `${className} border-accent-300 bg-accent-500/20 ring-2 ring-accent-300/40`;
  }

  if (isComparing) {
    return `${className} border-primary-300 bg-primary-500/15 ring-2 ring-primary-300/35`;
  }

  if (isHovered) {
    return `${className} border-primary-300 bg-primary-500/12`;
  }

  if (fitTone === "exact") {
    return `${className} border-success-300/80 bg-success-500/18`;
  }

  if (fitTone === "adapted") {
    return `${className} border-accent-300/80 bg-accent-500/18`;
  }

  return `${className} border-red-300/80 bg-red-500/20`;
}

function getBenchPlayerButtonClassName(options: {
  comparePlayerId: string | null;
  isDragging: boolean;
  player: PlayerData;
  selectedPlayerId: string | null;
}): string {
  const { comparePlayerId, isDragging, player, selectedPlayerId } = options;
  const isComparing = comparePlayerId === player.id;
  const isSelected = selectedPlayerId === player.id;
  let className =
    "flex min-h-20 min-w-0 cursor-pointer flex-col rounded-xl border px-3 py-2 text-left shadow-sm transition-all";

  if (isDragging) {
    className = `${className} opacity-50`;
  } else {
    className = `${className} hover:-translate-y-0.5 hover:shadow-md`;
  }

  if (isSelected) {
    return `${className} border-accent-300 bg-accent-600/80 dark:bg-accent-500/15 ring-2 ring-accent-300/40`;
  }

  if (isComparing) {
    return `${className} border-primary-300 bg-primary-500/12 ring-2 ring-primary-300/30`;
  }

  return `${className} border-white/10 bg-gray-500/70 dark:bg-navy-800`;
}

function getSlotTargetClassName(options: {
  hasPlayer: boolean;
  hoveredSlot: number | null;
  isShapeEditorEnabled: boolean;
  slot: TacticsPitchSlot;
}): string {
  const { hasPlayer, hoveredSlot, isShapeEditorEnabled, slot } = options;
  const isHovered = hoveredSlot === slot.index;

  if (isShapeEditorEnabled) {
    return "absolute z-10 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-white/30 bg-white/5";
  }

  if (isHovered) {
    return "absolute z-10 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary-300 bg-primary-500/12";
  }

  if (hasPlayer) {
    return "absolute z-10 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-transparent";
  }

  return "absolute z-10 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-white/25 bg-black/10";
}

function PointerGhost({
  player,
  pointerPosition,
}: {
  player: PlayerData | null;
  pointerPosition: { x: number; y: number } | null;
}): JSX.Element | null {
  if (!player || !pointerPosition) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed z-50 w-20 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/15 bg-navy-900/95 px-2 py-2 text-center shadow-xl"
      style={{ left: pointerPosition.x, top: pointerPosition.y }}
    >
      <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full border border-primary-200 bg-primary-500/80 text-xs font-heading font-bold text-white">
        {getPlayerOvr(player)}
      </div>
      <div className="mt-1 truncate text-[10px] font-heading font-bold uppercase tracking-wider text-white/85">
        {player.match_name}
      </div>
    </div>
  );
}

export default function TacticsPitch({
  benchPlayers,
  comparePlayerId,
  formation,
  hasCustomShape,
  isShapeEditorEnabled,
  onClearSelection,
  onLineupPlayerClick,
  onPlayerDrop,
  onResetShape,
  onSlotAdjustmentChange,
  onToggleShapeEditor,
  outOfPositionCount,
  pitchSlots,
  selectedPlayer,
  selectedPlayerId,
}: TacticsPitchProps): JSX.Element {
  const { t } = useTranslation();
  const pitchRef = useRef<HTMLDivElement | null>(null);
  const suppressClickRef = useRef<string | null>(null);
  const dragMovedRef = useRef(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [shapeDragState, setShapeDragState] = useState<ActiveShapeDrag | null>(
    null,
  );
  const [hoveredSlot, setHoveredSlot] = useState<number | null>(null);
  const [pointerPosition, setPointerPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const draggedPlayer = dragState
    ? pitchSlots.find((slot) => slot.player?.id === dragState.playerId)?.player ??
      benchPlayers.find((player) => player.id === dragState.playerId) ??
      null
    : null;

  // These refs intentionally stay outside the dependency array because the effect
  // needs stable mutable click/drag bookkeeping across pointer events.
  useEffect(() => {
    function handlePointerMove(event: PointerEvent): void {
      if (dragState) {
        setPointerPosition({ x: event.clientX, y: event.clientY });
        if (
          pointerPosition &&
          Math.hypot(
            event.clientX - pointerPosition.x,
            event.clientY - pointerPosition.y,
          ) > DRAG_THRESHOLD
        ) {
          dragMovedRef.current = true;
        }
      }

      if (!shapeDragState || !pitchRef.current) {
        return;
      }

      const rect = pitchRef.current.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        return;
      }

      const deltaX = ((event.clientX - shapeDragState.originClientX) / rect.width) * 100;
      const deltaY =
        ((event.clientY - shapeDragState.originClientY) / rect.height) * 100;

      onSlotAdjustmentChange(shapeDragState.slotIndex, {
        dx: shapeDragState.initialAdjustment.dx + deltaX,
        dy: shapeDragState.initialAdjustment.dy + deltaY,
      });
    }

    function handlePointerUp(): void {
      if (dragState && dragMovedRef.current) {
        suppressClickRef.current = dragState.playerId;
      }

      setDragState(null);
      setHoveredSlot(null);
      setPointerPosition(null);
      setShapeDragState(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [benchPlayers, dragState, onSlotAdjustmentChange, pitchSlots, pointerPosition, shapeDragState]);

  function handlePlayerPointerDown(
    event: ReactPointerEvent<HTMLElement>,
    playerId: string,
    from: SquadSection,
    slotIndex: number | null,
  ): void {
    if (isShapeEditorEnabled) {
      return;
    }

    dragMovedRef.current = false;
    setPointerPosition({ x: event.clientX, y: event.clientY });
    setDragState({ playerId, from, slotIndex });
  }

  function handlePlayerClick(playerId: string, section: SquadSection): void {
    if (suppressClickRef.current === playerId) {
      suppressClickRef.current = null;
      return;
    }

    onLineupPlayerClick(playerId, section);
  }

  function handleSlotPointerUp(slotIndex: number): void {
    if (!dragState) {
      return;
    }

    onPlayerDrop(dragState, dragState.playerId, slotIndex);
    setDragState(null);
    setHoveredSlot(null);
    setPointerPosition(null);
  }

  function handleShapeHandlePointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
    slot: TacticsPitchSlot,
  ): void {
    if (!isShapeEditorEnabled) {
      return;
    }

    event.preventDefault();
    setShapeDragState({
      initialAdjustment: {
        dx: slot.x - slot.baseX,
        dy: slot.y - slot.baseY,
      },
      originClientX: event.clientX,
      originClientY: event.clientY,
      slotIndex: slot.index,
    });
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-t-xl border-b border-gray-100 bg-linear-to-r from-navy-700 to-navy-800 p-4 dark:border-navy-600">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-heading font-bold uppercase tracking-wide text-white">
            <Star className="h-4 w-4 fill-current text-accent-400" />
            {t("preMatch.startingXI")} — {formation}
          </h3>
          <p className="mt-0.5 text-xs text-gray-400">
            {isShapeEditorEnabled
              ? t(
                "tactics.shapeEditorActiveHint",
                "Drag slot markers on the pitch to reshape your formation for this session.",
              )
              : t(
                "tactics.pitchInteractionHint",
                "Drag players between the pitch and bench, click one player to inspect them, click a second player to compare them, then confirm the swap in the compare panel.",
              )}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Badge
            variant={outOfPositionCount > 0 ? "danger" : "success"}
            size="sm"
          >
            {outOfPositionCount} {t("squad.outOfPosition")}
          </Badge>
          <span className="rounded-full bg-success-500/15 px-2.5 py-1 text-[10px] font-heading font-bold uppercase tracking-widest text-success-300">
            {t("tactics.naturalFit", "Natural")}
          </span>
          <span className="rounded-full bg-accent-500/15 px-2.5 py-1 text-[10px] font-heading font-bold uppercase tracking-widest text-accent-300">
            {t("tactics.adaptedFit", "Adapted")}
          </span>
          <span className="rounded-full bg-red-500/15 px-2.5 py-1 text-[10px] font-heading font-bold uppercase tracking-widest text-red-300">
            {t("squad.outOfPosition")}
          </span>
          {selectedPlayer ? (
            <button
              type="button"
              onClick={onClearSelection}
              className="text-xs font-heading font-bold uppercase tracking-wider text-accent-400 hover:text-accent-300"
            >
              {t("common.clear")}
            </button>
          ) : null}
        </div>
      </div>
      <div className="p-4 sm:p-6">
        <div
          ref={pitchRef}
          className="relative overflow-hidden rounded-xl border border-primary-500/20 bg-linear-to-b from-primary-500 to-primary-700 shadow-inner"
        >
          <div className="aspect-[7/10] min-h-[29.5rem] w-full">
            <svg
              viewBox="0 0 100 140"
              preserveAspectRatio="none"
              className="absolute inset-0 h-full w-full"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="pitch-surface" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="rgba(68, 176, 99, 0.92)" />
                  <stop offset="100%" stopColor="rgba(33, 111, 61, 0.96)" />
                </linearGradient>
                <pattern
                  id="pitch-stripes"
                  width="100"
                  height="20"
                  patternUnits="userSpaceOnUse"
                >
                  <rect width="100" height="10" fill="rgba(255,255,255,0.04)" />
                </pattern>
              </defs>
              <rect x="0" y="0" width="100" height="140" fill="url(#pitch-surface)" />
              <rect x="0" y="0" width="100" height="140" fill="url(#pitch-stripes)" />
              <rect
                x="4"
                y="4"
                width="92"
                height="132"
                fill="none"
                stroke="rgba(255,255,255,0.55)"
                strokeWidth="0.6"
              />
              <line
                x1="4"
                y1="70"
                x2="96"
                y2="70"
                stroke="rgba(255,255,255,0.55)"
                strokeWidth="0.6"
              />
              <circle
                cx="50"
                cy="70"
                r="11"
                fill="none"
                stroke="rgba(255,255,255,0.55)"
                strokeWidth="0.6"
              />
              <circle cx="50" cy="70" r="0.8" fill="rgba(255,255,255,0.75)" />
              <rect
                x="18"
                y="4"
                width="64"
                height="18"
                fill="none"
                stroke="rgba(255,255,255,0.55)"
                strokeWidth="0.6"
              />
              <rect
                x="31"
                y="4"
                width="38"
                height="8"
                fill="none"
                stroke="rgba(255,255,255,0.55)"
                strokeWidth="0.6"
              />
              <rect
                x="18"
                y="118"
                width="64"
                height="18"
                fill="none"
                stroke="rgba(255,255,255,0.55)"
                strokeWidth="0.6"
              />
              <rect
                x="31"
                y="128"
                width="38"
                height="8"
                fill="none"
                stroke="rgba(255,255,255,0.55)"
                strokeWidth="0.6"
              />
              <path
                d="M 38 22 A 12 12 0 0 0 62 22"
                fill="none"
                stroke="rgba(255,255,255,0.55)"
                strokeWidth="0.6"
              />
              <path
                d="M 38 118 A 12 12 0 0 1 62 118"
                fill="none"
                stroke="rgba(255,255,255,0.55)"
                strokeWidth="0.6"
              />
            </svg>

            {pitchSlots.map((slot) => {
              const player = slot.player;
              const fitTone = getFitTone(player, slot.position);
              const isDragging = dragState?.playerId === player?.id;

              return (
                <div
                  key={slot.index}
                  className="absolute"
                  style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                >
                  <button
                    type="button"
                    data-testid={`pitch-slot-${slot.index}`}
                    aria-label={`${t("squad.dropPlayerHere")} ${translatePositionAbbreviation(t, slot.position)}`}
                    className={getSlotTargetClassName({
                      hasPlayer: !!player,
                      hoveredSlot,
                      isShapeEditorEnabled,
                      slot,
                    })}
                    onPointerEnter={() => {
                      if (dragState && !isShapeEditorEnabled) {
                        setHoveredSlot(slot.index);
                      }
                    }}
                    onPointerLeave={() => {
                      if (hoveredSlot === slot.index) {
                        setHoveredSlot(null);
                      }
                    }}
                    onPointerUp={() => handleSlotPointerUp(slot.index)}
                  />

                  {player ? (
                    <button
                      type="button"
                      data-testid={`pitch-player-${player.id}`}
                      aria-label={t(
                        "tactics.pitchPlayerButton",
                        `Select or move ${player.match_name}`,
                      )}
                      className={getPitchMarkerClassName({
                        comparePlayerId,
                        hoveredSlot,
                        isDragging: Boolean(isDragging),
                        player,
                        selectedPlayerId,
                        slot,
                      })}
                      style={{ left: 0, top: 0 }}
                      onClick={() => handlePlayerClick(player.id, "xi")}
                      onPointerDown={(event) =>
                        handlePlayerPointerDown(event, player.id, "xi", slot.index)
                      }
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-navy-900/70 text-xs font-heading font-bold text-white">
                        {getPlayerOvr(player)}
                      </div>
                      <div className="mt-1 text-[9px] font-heading font-bold uppercase tracking-[0.18em] text-white/70">
                        {translatePositionAbbreviation(t, slot.position)}
                      </div>
                      <div className="mt-1 truncate text-[11px] font-semibold leading-none text-white">
                        {player.match_name}
                      </div>
                      <div className="mt-1 text-[10px] text-white/70">
                        {player.condition}%
                      </div>
                      <div
                        className={`mt-1 rounded-full px-2 py-0.5 text-[9px] font-heading font-bold uppercase tracking-widest ${
                          fitTone === "exact"
                            ? "bg-success-500/20 text-success-200"
                            : fitTone === "adapted"
                              ? "bg-accent-500/20 text-accent-200"
                              : "bg-red-500/20 text-red-200"
                        }`}
                      >
                        {fitTone === "exact"
                          ? t("tactics.naturalFit", "Natural")
                          : fitTone === "adapted"
                            ? t("tactics.adaptedFit", "Adapted")
                            : t("squad.outOfPosition")}
                      </div>
                    </button>
                  ) : (
                    <div
                      className="absolute z-20 flex w-[5.5rem] -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-2xl border border-dashed border-white/25 bg-black/10 px-2 py-2 text-center"
                      style={{ left: 0, top: 0 }}
                    >
                      <div className="text-[9px] font-heading font-bold uppercase tracking-[0.18em] text-white/70">
                        {translatePositionAbbreviation(t, slot.position)}
                      </div>
                      <div className="mt-1 text-[9px] leading-tight text-white/55">
                        {t("squad.dropPlayerHere")}
                      </div>
                    </div>
                  )}

                  {isShapeEditorEnabled ? (
                    <button
                      type="button"
                      aria-label={t("tactics.editShapeHandle", "Move slot")}
                      className="absolute z-30 flex h-6 w-6 -translate-x-1/2 translate-y-8 items-center justify-center rounded-full border border-white/30 bg-navy-900/75 text-[10px] font-heading font-bold text-white shadow"
                      style={{ left: 0, top: 0 }}
                      onPointerDown={(event) =>
                        handleShapeHandlePointerDown(event, slot)
                      }
                    >
                      +
                    </button>
                  ) : null}
                </div>
              );
            })}

            {isShapeEditorEnabled ? (
              <div className="absolute inset-x-4 bottom-4 z-30 rounded-xl border border-white/12 bg-navy-900/72 px-4 py-3 text-xs text-white/75 backdrop-blur">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p>
                    {t(
                      "tactics.shapeEditorActiveHint",
                      "Drag the small slot handles to make the shape narrower, wider, higher, or deeper for this session.",
                    )}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={onToggleShapeEditor}
                      className="rounded-lg bg-white/8 px-3 py-2 text-[11px] font-heading font-bold uppercase tracking-wider text-white transition-colors hover:bg-white/12"
                    >
                      {t("common.done", "Done")}
                    </button>
                    <button
                      type="button"
                      onClick={onResetShape}
                      disabled={!hasCustomShape}
                      className="rounded-lg bg-white/8 px-3 py-2 text-[11px] font-heading font-bold uppercase tracking-wider text-white transition-colors hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {t("common.reset", "Reset")}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-4 border-t border-white/10 pt-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-white/80">
                {t("preMatch.substitutes")}
              </h4>
              <p className="mt-1 text-sm text-black dark:text-white/50">
                {benchPlayers.length} {t("squad.playersLabel", "players")}
              </p>
            </div>
          </div>
          {benchPlayers.length > 0 ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {benchPlayers.map((player) => {
                const benchRating = getPlayerOvr(player);
                const isDragging = dragState?.playerId === player.id;

                return (
                  <button
                    key={player.id}
                    type="button"
                    data-testid={`pitch-bench-player-${player.id}`}
                    aria-label={t(
                      "tactics.benchPlayerButton",
                      `Select or move bench player ${player.match_name}`,
                    )}
                    onClick={() => handlePlayerClick(player.id, "bench")}
                    onPointerDown={(event) =>
                      handlePlayerPointerDown(event, player.id, "bench", null)
                    }
                    className={getBenchPlayerButtonClassName({
                      comparePlayerId,
                      isDragging: Boolean(isDragging),
                      player,
                      selectedPlayerId,
                    })}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-heading font-bold text-white">
                          {player.match_name}
                        </div>
                        <div className="mt-1 text-sm uppercase tracking-wider text-white/60">
                          {translatePositionAbbreviation(
                            t,
                            player.natural_position || player.position,
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 rounded-full border border-primary-200 bg-primary-500/80 px-2 py-1 text-xs font-heading font-bold text-white">
                        {benchRating}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 text-sm text-white/60">
                      <span>{player.condition}%</span>
                      <span>{player.morale}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-white/15 bg-black/10 px-3 py-4 text-sm text-white/50">
              {t("preMatch.noBench")}
            </div>
          )}
        </div>
      </div>
      <PointerGhost player={draggedPlayer} pointerPosition={pointerPosition} />
    </Card>
  );
}
