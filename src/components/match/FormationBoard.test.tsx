import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentType, DragEvent, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import * as formationPitchModule from "./FormationPitch";

type FormationBoardVariant = "full" | "compact";
type FormationBoardOrientation = "normal" | "mirrored";

interface BoardOccupant {
  id: string;
  name: string;
}

interface FormationBoardSlot<T> {
  occupant: T | null;
  fallbackGroup?: "Goalkeeper" | "Defender" | "Midfielder" | "Forward";
  ariaLabel?: string;
  disabled?: boolean;
  hidden?: boolean;
}

interface FormationBoardRenderState {
  index: number;
  position: string;
  variant: FormationBoardVariant;
  orientation: FormationBoardOrientation;
  isSelected: boolean;
  isCompared: boolean;
  isDragged: boolean;
  isDropTarget: boolean;
}

interface FormationBoardInteraction {
  selectedSlotIndex?: number | null;
  comparedSlotIndex?: number | null;
  draggedSlotIndex?: number | null;
  hoveredSlotIndex?: number | null;
  onSlotActivate?: (slotIndex: number) => void;
  onSlotDragStart?: (event: DragEvent<HTMLElement>, slotIndex: number) => void;
  onSlotDragEnd?: () => void;
  onSlotDragOver?: (event: DragEvent<HTMLElement>, slotIndex: number) => void;
  onSlotDragLeave?: (slotIndex: number) => void;
  onSlotDrop?: (event: DragEvent<HTMLElement>, slotIndex: number) => void;
}

interface FormationBoardProps<T> {
  formation: string;
  slots: readonly FormationBoardSlot<T>[];
  variant: FormationBoardVariant;
  orientation: FormationBoardOrientation;
  overlays?: ReactNode;
  interaction?: FormationBoardInteraction;
  renderToken: (occupant: T, state: FormationBoardRenderState) => ReactNode;
  renderEmptySlot?: (state: FormationBoardRenderState) => ReactNode;
  label: string;
  className?: string;
}

function requireFormationBoard(): ComponentType<FormationBoardProps<BoardOccupant>> {
  const candidate = (formationPitchModule as unknown as Record<string, unknown>)[
    "FormationBoard"
  ];

  expect(
    candidate,
    "FormationPitch.tsx must re-export the shared FormationBoard component",
  ).toBeTypeOf("function");

  return candidate as ComponentType<FormationBoardProps<BoardOccupant>>;
}

const player = (id: string, name: string): BoardOccupant => ({ id, name });

function token(occupant: BoardOccupant): ReactNode {
  return <div role="group" aria-label={occupant.name}>{occupant.name}</div>;
}

describe("FormationBoard rendering and interaction", () => {
  it("exposes a labelled board and passes full and compact variants to token renderers", () => {
    const FormationBoard = requireFormationBoard();
    const seenVariants: FormationBoardVariant[] = [];
    let overlayRenderCount = 0;
    const OverlayProbe = () => {
      overlayRenderCount += 1;
      return <g aria-hidden="true" />;
    };
    const renderToken = (
      occupant: BoardOccupant,
      state: FormationBoardRenderState,
    ) => {
      seenVariants.push(state.variant);
      return token(occupant);
    };
    const { rerender } = render(
      <FormationBoard
        formation="4-4-2"
        slots={[{ occupant: player("gk", "Alex Lane") }]}
        variant="full"
        orientation="normal"
        overlays={<OverlayProbe />}
        renderToken={renderToken}
        label="Home formation"
      />,
    );

    expect(screen.getByRole("region", { name: "Home formation" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Alex Lane" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Alex Lane" }),
    ).not.toBeInTheDocument();
    expect(overlayRenderCount).toBeGreaterThan(0);

    rerender(
      <FormationBoard
        formation="4-4-2"
        slots={[{ occupant: player("gk", "Alex Lane") }]}
        variant="compact"
        orientation="normal"
        renderToken={renderToken}
        label="Substitution formation"
      />,
    );

    expect(
      screen.getByRole("region", { name: "Substitution formation" }),
    ).toBeInTheDocument();
    expect(seenVariants).toEqual(["full", "compact"]);
  });

  it("makes an empty slot independently nameable and activatable", () => {
    const FormationBoard = requireFormationBoard();
    const onSlotActivate = vi.fn();

    render(
      <FormationBoard
        formation="4-4-2"
        slots={[{ occupant: null, ariaLabel: "Goalkeeper · Drop player here" }]}
        variant="full"
        orientation="normal"
        interaction={{ onSlotActivate }}
        renderToken={token}
        renderEmptySlot={() => <span aria-hidden="true">GK</span>}
        label="Tactics formation"
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Goalkeeper · Drop player here" }),
    );

    expect(onSlotActivate).toHaveBeenCalledWith(0);
  });

  it("routes drag lifecycle events through slot indexes", () => {
    const FormationBoard = requireFormationBoard();
    const onSlotDragStart = vi.fn();
    const onSlotDragEnd = vi.fn();
    const onSlotDragOver = vi.fn();
    const onSlotDrop = vi.fn();

    render(
      <FormationBoard
        formation="4-4-2"
        slots={[
          { occupant: player("gk", "Alex Lane") },
          { occupant: null, ariaLabel: "Left back · Drop player here" },
        ]}
        variant="full"
        orientation="normal"
        interaction={{
          onSlotDragStart,
          onSlotDragEnd,
          onSlotDragOver,
          onSlotDrop,
        }}
        renderToken={token}
        renderEmptySlot={() => <span aria-hidden="true">LB</span>}
        label="Tactics formation"
      />,
    );

    const occupied = screen.getByRole("button", { name: "Alex Lane" });
    const empty = screen.getByRole("button", {
      name: "Left back · Drop player here",
    });
    fireEvent.dragStart(occupied);
    fireEvent.dragOver(empty);
    fireEvent.drop(empty);
    fireEvent.dragEnd(occupied);

    expect(onSlotDragStart).toHaveBeenCalledWith(expect.any(Object), 0);
    expect(onSlotDragOver).toHaveBeenCalledWith(expect.any(Object), 1);
    expect(onSlotDrop).toHaveBeenCalledWith(expect.any(Object), 1);
    expect(onSlotDragEnd).toHaveBeenCalledTimes(1);
  });

  it("pins the interim rich-token host name, keyboard activation, and visible focus ring", () => {
    const FormationBoard = requireFormationBoard();
    const onSlotActivate = vi.fn();

    render(
      <FormationBoard
        formation="4-4-2"
        slots={[{ occupant: player("gk", "Alex Lane · Condition 74% · Adapted to slot") }]}
        variant="full"
        orientation="normal"
        interaction={{ onSlotActivate }}
        renderToken={token}
        label="Pre-match formation"
      />,
    );

    const control = screen.getByRole("button", {
      name: "Alex Lane · Condition 74% · Adapted to slot",
    });
    fireEvent.keyDown(control, { key: "Enter" });
    fireEvent.keyDown(control, { key: " " });

    expect(control.tagName).toBe("DIV");
    expect(control).toHaveAttribute("tabindex", "0");
    expect(control.className).toContain("focus-visible:ring-2");
    expect(control.className).toMatch(/dark:focus-visible:ring-offset-/);
    expect(onSlotActivate).toHaveBeenNthCalledWith(1, 0);
    expect(onSlotActivate).toHaveBeenNthCalledWith(2, 0);
  });

  it("signals an injured slot as disabled by more than colour and blocks activation", () => {
    const FormationBoard = requireFormationBoard();
    const onSlotActivate = vi.fn();

    render(
      <FormationBoard
        formation="4-4-2"
        slots={[
          {
            occupant: player("gk", "Alex Lane"),
            ariaLabel: "Alex Lane · Condition 74% · Natural fit · Injured",
            disabled: true,
          },
        ]}
        variant="full"
        orientation="normal"
        interaction={{ onSlotActivate }}
        renderToken={token}
        label="Tactics formation"
      />,
    );

    const control = screen.getByRole("button", {
      name: "Alex Lane · Condition 74% · Natural fit · Injured",
    });
    fireEvent.click(control);
    fireEvent.keyDown(control, { key: "Enter" });

    expect(control).toHaveAttribute("aria-disabled", "true");
    expect(control).not.toHaveAttribute("draggable", "true");
    expect(onSlotActivate).not.toHaveBeenCalled();
  });

  it("omits a sent-off occupant without shifting the following formation slot", () => {
    const FormationBoard = requireFormationBoard();
    const renderToken = vi.fn((occupant: BoardOccupant) => token(occupant));

    render(
      <FormationBoard
        formation="4-4-2"
        slots={[
          { occupant: player("sent-off", "Dismissed Player"), hidden: true },
          { occupant: player("left-back", "Remaining Player") },
        ]}
        variant="compact"
        orientation="normal"
        renderToken={renderToken}
        label="Live formation"
      />,
    );

    expect(
      screen.queryByRole("group", { name: "Dismissed Player" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Remaining Player" }),
    ).toBeInTheDocument();
    expect(renderToken).toHaveBeenCalledWith(
      expect.objectContaining({ id: "left-back" }),
      expect.objectContaining({ index: 1, position: "LeftBack" }),
    );
  });
});
