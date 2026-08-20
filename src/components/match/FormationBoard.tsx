import {
  useState,
  useRef,
  type DragEvent,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";

import {
  buildFormationBoardCoordinates,
  nextSlotInDirection,
  type FormationBoardDirection,
  type FormationBoardGeometrySlot,
  type FormationBoardOrientation,
} from "./FormationBoard.helpers";

export type FormationBoardVariant = "full" | "compact";

export type { FormationBoardOrientation };

export interface FormationBoardSlot<T> extends FormationBoardGeometrySlot {
  occupant: T | null;
  /** Overrides the host's name — an empty slot, or a status such as injury. */
  ariaLabel?: string;
  disabled?: boolean;
  /** Keeps the slot's index and geometry but renders nothing in it. */
  hidden?: boolean;
}

export interface FormationBoardRenderState {
  index: number;
  position: string;
  variant: FormationBoardVariant;
  orientation: FormationBoardOrientation;
  isSelected: boolean;
  isCompared: boolean;
  isDragged: boolean;
  isDropTarget: boolean;
}

export interface FormationBoardInteraction {
  selectedSlotIndex?: number | null;
  comparedSlotIndex?: number | null;
  draggedSlotIndex?: number | null;
  hoveredSlotIndex?: number | null;
  onSlotActivate?: (slotIndex: number) => void;
  onSlotAssign?: (slotIndex: number) => void;
  onSlotFocus?: (slotIndex: number) => void;
  onSlotDragStart?: (event: DragEvent<HTMLElement>, slotIndex: number) => void;
  onSlotDragEnd?: () => void;
  onSlotDragOver?: (event: DragEvent<HTMLElement>, slotIndex: number) => void;
  onSlotDragLeave?: (slotIndex: number) => void;
  onSlotDrop?: (event: DragEvent<HTMLElement>, slotIndex: number) => void;
}

export interface FormationBoardProps<T> {
  formation: string;
  slots: readonly FormationBoardSlot<T>[];
  variant: FormationBoardVariant;
  orientation: FormationBoardOrientation;
  /** SVG children in the same 0 0 100 140 space as the markings. */
  overlays?: ReactNode;
  interaction?: FormationBoardInteraction;
  renderToken: (occupant: T, state: FormationBoardRenderState) => ReactNode;
  renderEmptySlot?: (state: FormationBoardRenderState) => ReactNode;
  /** Already-localized name for the board region. */
  label: string;
  className?: string;
}

const SLOT_SIZE: Record<FormationBoardVariant, string> = {
  full: "h-[4.5rem] w-[4.5rem]",
  compact: "h-12 w-12",
};

// Offset against the turf, which is the surface actually behind a slot — and
// the same green in both themes, so there is no dark variant to give it.
const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-turf-far";

/**
 * The only pitch in the app.
 *
 * There were two: one here and one inlined in the tactics board, drawing the
 * same markings at the same viewBox and disagreeing about where the slots in a
 * five-wide row belong. Rows have always come from `buildPitchRows`; now the
 * across-the-row spacing has one answer too.
 *
 * The core owns geometry, markings, orientation and what a slot *is*. What a
 * slot looks like stays with the caller, because a tactics token, a scouting
 * token and a live token show different things about the same player.
 */
export function FormationBoard<T>({
  formation,
  slots,
  variant,
  orientation,
  overlays,
  interaction,
  renderToken,
  renderEmptySlot,
  label,
  className,
}: FormationBoardProps<T>): ReactElement {
  const coordinates = buildFormationBoardCoordinates(
    formation,
    slots,
    orientation,
  );
  const navigableCoordinates = coordinates.filter(
    (coordinate) => !slots[coordinate.index]?.hidden,
  );
  // Slot 0, because entry 0 of the XI is where every other list of this team
  // starts — the roster rail, the array the server stores, the engine's own
  // order. Arrows take it from there.
  const defaultRovingSlotIndex = navigableCoordinates.length
    ? Math.min(...navigableCoordinates.map((coordinate) => coordinate.index))
    : null;
  const [rovingSlotIndex, setRovingSlotIndex] = useState(
    defaultRovingSlotIndex,
  );
  const activeRovingSlotIndex = navigableCoordinates.some(
    (coordinate) => coordinate.index === rovingSlotIndex,
  )
    ? rovingSlotIndex
    : defaultRovingSlotIndex;
  const slotElements = useRef(new Map<number, HTMLButtonElement>()).current;

  const moveFocus = (
    fromIndex: number,
    direction: FormationBoardDirection,
  ) => {
    const nextIndex = nextSlotInDirection(
      navigableCoordinates,
      fromIndex,
      direction,
    );
    if (nextIndex === null) {
      return;
    }
    setRovingSlotIndex(nextIndex);
    slotElements.get(nextIndex)?.focus();
  };

  return (
    <section
      aria-label={label}
      className={`relative aspect-[10/14] w-full ${className ?? ""}`}
    >
      <svg
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
        viewBox="0 0 100 140"
      >
        <defs>
          <linearGradient id="ofm-pitch-turf" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-turf-near)" />
            <stop offset="100%" stopColor="var(--color-turf-far)" />
          </linearGradient>
        </defs>
        <rect fill="url(#ofm-pitch-turf)" height="140" width="100" x="0" y="0" />
        <g
          fill="none"
          stroke="var(--color-pitch-line)"
          strokeWidth="0.6"
        >
          <rect height="132" width="92" x="4" y="4" />
          <line x1="4" x2="96" y1="70" y2="70" />
          <circle cx="50" cy="70" r="12" />
          <rect height="20" width="48" x="26" y="4" />
          <rect height="8" width="24" x="38" y="4" />
          <rect height="20" width="48" x="26" y="116" />
          <rect height="8" width="24" x="38" y="128" />
        </g>
        {overlays}
      </svg>

      <div className="absolute inset-0">
        {coordinates.map((coordinate) => {
          const slot = slots[coordinate.index];
          if (!slot || slot.hidden) {
            return null;
          }

          const state: FormationBoardRenderState = {
            index: coordinate.index,
            position: coordinate.position,
            variant,
            orientation,
            isSelected: interaction?.selectedSlotIndex === coordinate.index,
            isCompared: interaction?.comparedSlotIndex === coordinate.index,
            isDragged: interaction?.draggedSlotIndex === coordinate.index,
            isDropTarget: interaction?.hoveredSlotIndex === coordinate.index,
          };

          return (
            <FormationBoardSlotHost
              key={coordinate.index}
              coordinate={coordinate}
              interaction={interaction}
              isRovingTabStop={coordinate.index === activeRovingSlotIndex}
              onMoveFocus={moveFocus}
              registerSlot={(element) => {
                if (element) {
                  slotElements.set(coordinate.index, element);
                } else {
                  slotElements.delete(coordinate.index);
                }
              }}
              onSlotFocus={(slotIndex) => {
                // Focus is what makes a slot the tab stop, whether it arrived
                // by arrow key, by Tab, or from assistive technology.
                setRovingSlotIndex(slotIndex);
                interaction?.onSlotFocus?.(slotIndex);
              }}
              slot={slot}
              state={state}
            >
              {slot.occupant
                ? renderToken(slot.occupant, state)
                : renderEmptySlot?.(state)}
            </FormationBoardSlotHost>
          );
        })}
      </div>
    </section>
  );
}

interface SlotHostProps<T> {
  children: ReactNode;
  coordinate: { index: number; x: number; y: number };
  interaction?: FormationBoardInteraction;
  isRovingTabStop: boolean;
  onMoveFocus: (
    fromIndex: number,
    direction: FormationBoardDirection,
  ) => void;
  onSlotFocus: (slotIndex: number) => void;
  registerSlot: (element: HTMLButtonElement | null) => void;
  slot: FormationBoardSlot<T>;
  state: FormationBoardRenderState;
}

function FormationBoardSlotHost<T>({
  children,
  coordinate,
  interaction,
  isRovingTabStop,
  onMoveFocus,
  onSlotFocus,
  registerSlot,
  slot,
  state,
}: SlotHostProps<T>): ReactElement {
  const isInteractive = Boolean(
    interaction?.onSlotActivate ||
      interaction?.onSlotAssign ||
      interaction?.onSlotFocus ||
      interaction?.onSlotDragStart ||
      interaction?.onSlotDrop,
  );
  const isDisabled = slot.disabled === true;

  const positioning = {
    left: `${coordinate.x}%`,
    top: `${coordinate.y}%`,
  };
  const shell = `absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center ${SLOT_SIZE[state.variant]}`;

  // A board with no callbacks is a picture. Handing it button semantics would
  // promise an interaction that does not exist — which is what a scouting or
  // live board is: information, not controls.
  if (!isInteractive) {
    return (
      <div className={shell} style={positioning}>
        {children}
      </div>
    );
  }

  const activate = () => {
    if (isDisabled) {
      return;
    }
    interaction?.onSlotActivate?.(coordinate.index);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const directionByKey: Partial<
      Record<string, FormationBoardDirection>
    > = {
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
      ArrowUp: "up",
    };
    const direction = directionByKey[event.key];
    if (direction) {
      event.preventDefault();
      onMoveFocus(coordinate.index, direction);
      return;
    }

    if (
      interaction?.onSlotAssign &&
      (event.key === "Enter" || event.key === " ")
    ) {
      event.preventDefault();
      if (!isDisabled) {
        interaction.onSlotAssign(coordinate.index);
      }
    }
  };

  return (
    // A real button, now that no token embeds a control. It was a div with
    // button semantics for exactly as long as the role combobox lived inside
    // the token, because nesting a control in a button is invalid — that is
    // what issue #322 was. `aria-disabled` rather than `disabled`, because a
    // slot the manager cannot use is still a slot they should be able to read.
    <button
      aria-disabled={isDisabled || undefined}
      aria-label={slot.ariaLabel}
      className={`${shell} rounded-2xl ${FOCUS_RING} ${isDisabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
      draggable={!isDisabled && Boolean(interaction?.onSlotDragStart)}
      onFocus={() => onSlotFocus(coordinate.index)}
      onClick={activate}
      onDragEnd={() => interaction?.onSlotDragEnd?.()}
      onDragLeave={() => interaction?.onSlotDragLeave?.(coordinate.index)}
      onDragOver={(event) => interaction?.onSlotDragOver?.(event, coordinate.index)}
      onDragStart={(event) => {
        if (isDisabled) {
          event.preventDefault();
          return;
        }
        interaction?.onSlotDragStart?.(event, coordinate.index);
      }}
      onDrop={(event) => interaction?.onSlotDrop?.(event, coordinate.index)}
      onKeyDown={handleKeyDown}
      ref={registerSlot}
      style={positioning}
      tabIndex={isRovingTabStop ? 0 : -1}
      type="button"
    >
      {children}
    </button>
  );
}
