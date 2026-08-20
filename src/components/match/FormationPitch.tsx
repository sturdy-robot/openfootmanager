import type { ReactNode } from "react";

import {
  FormationBoard,
  type FormationBoardRenderState,
  type FormationBoardSlot,
} from "./FormationBoard";
import {
  buildFormationBoardCoordinates,
  nextSlotInDirection,
  rowSlotXCoordinates,
  type FormationBoardFallbackGroup,
  type FormationBoardOrientation,
} from "./FormationBoard.helpers";
import type { EnginePlayerData } from "./types";

export { FormationBoard };
export type {
  FormationBoardInteraction,
  FormationBoardProps,
  FormationBoardRenderState,
  FormationBoardSlot,
  FormationBoardVariant,
} from "./FormationBoard";
export {
  buildFormationBoardCoordinates,
  nextSlotInDirection,
  rowSlotXCoordinates,
};
export type {
  FormationBoardCoordinate,
  FormationBoardDirection,
  FormationBoardFallbackGroup,
  FormationBoardGeometrySlot,
  FormationBoardOrientation,
} from "./FormationBoard.helpers";

interface FormationPitchProps {
  formation: string;
  players: EnginePlayerData[];
  sentOff?: string[];
  selectedId?: string | null;
  subbedOnIds?: Set<string>;
  onPlayerClick?: (id: string) => void;
  className?: string;
  /** Region name for the board; already localized by the caller. */
  label?: string;
  /** Turns the board for a side attacking towards the opposite goal. */
  orientation?: FormationBoardOrientation;
  /**
   * Optional custom token renderer. When provided it replaces the default
   * initials token, letting callers (e.g. the pre-match screen) render a richer
   * token while reusing the shared board's geometry and slot wiring.
   */
  renderToken?: (
    player: EnginePlayerData,
    state: { isSelected: boolean; isSubOn: boolean; slotPosition?: string },
  ) => ReactNode;
}

/** Coarse group for the legacy path where the XI does not fill the formation. */
function fallbackGroupFor(
  player: EnginePlayerData,
): FormationBoardFallbackGroup {
  const position = player.position ?? "";

  if (position === "Goalkeeper") return "Goalkeeper";
  if (position.includes("Back") || position.includes("Defender")) {
    return "Defender";
  }
  if (position.includes("Striker") || position.includes("Forward")) {
    return "Forward";
  }
  if (position.includes("Winger")) return "Forward";

  return "Midfielder";
}

/**
 * The slot each XI entry is deployed in, index-aligned with `players`.
 *
 * The board already works this out to place the tokens; a caller that needs to
 * name a player's slot outside the token — a role picker in an inspector, say —
 * asks the same question rather than re-deriving the answer from the formation
 * string and hoping the two agree.
 */
export function formationSlotPositions(
  formation: string,
  players: EnginePlayerData[],
): string[] {
  const slots = players.map((player) => ({
    occupant: player,
    fallbackGroup: fallbackGroupFor(player),
  }));
  const positions: string[] = [];
  for (const coordinate of buildFormationBoardCoordinates(
    formation,
    slots,
    "normal",
  )) {
    positions[coordinate.index] = coordinate.position;
  }
  return positions;
}

/**
 * The engine XI drawn on the shared board.
 *
 * Entry `i` of the XI is formation slot `i`, so the board is handed the players
 * in order and does the placing. A sent-off player is hidden rather than
 * filtered out, because removing him from the array would slide everyone behind
 * him into the wrong slot.
 */
export function FormationPitch({
  formation,
  players,
  sentOff = [],
  selectedId,
  subbedOnIds,
  onPlayerClick,
  className,
  label,
  orientation = "normal",
  renderToken,
}: FormationPitchProps) {
  const slots: FormationBoardSlot<EnginePlayerData>[] = players.map(
    (player) => ({
      occupant: player,
      fallbackGroup: fallbackGroupFor(player),
      hidden: sentOff.includes(player.id),
      ariaLabel: player.name,
    }),
  );

  const selectedIndex = players.findIndex((player) => player.id === selectedId);

  return (
    <FormationBoard
      className={className}
      formation={formation}
      interaction={
        onPlayerClick
          ? {
              onSlotActivate: (slotIndex) => {
                const player = players[slotIndex];
                if (player) {
                  onPlayerClick(player.id);
                }
              },
              selectedSlotIndex: selectedIndex >= 0 ? selectedIndex : null,
            }
          : undefined
      }
      label={label ?? formation}
      orientation={orientation}
      renderToken={(player, state) =>
        renderToken
          ? renderToken(player, {
              isSelected: selectedId === player.id,
              isSubOn: subbedOnIds?.has(player.id) ?? false,
              slotPosition: state.position,
            })
          : defaultToken(player, state, {
              isSelected: selectedId === player.id,
              isSubOn: subbedOnIds?.has(player.id) ?? false,
            })
      }
      slots={slots}
      variant="full"
    />
  );
}

function defaultToken(
  player: EnginePlayerData,
  _state: FormationBoardRenderState,
  flags: { isSelected: boolean; isSubOn: boolean },
): ReactNode {
  const initials = player.name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex flex-col items-center gap-0.5">
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-heading font-bold text-white ring-2 transition-transform ${flags.isSelected ? "scale-110 ring-accent-400 dark:ring-accent-400" : "ring-white/40 dark:ring-white/30"} ${flags.isSubOn ? "bg-primary-600 dark:bg-primary-500" : "bg-navy-800 dark:bg-navy-900"}`}
      >
        {initials}
      </span>
      <span className="max-w-[5rem] truncate text-[10px] font-heading font-bold uppercase tracking-wide text-white drop-shadow">
        {player.name}
      </span>
    </div>
  );
}
