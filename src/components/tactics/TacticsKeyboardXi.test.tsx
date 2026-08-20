import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameStateData } from "../../store/gameStore";
import TacticsTab from "./TacticsTab";
import { makeGameState } from "./tacticsTestFixtures";

/**
 * The tactics pitch has been drag-only. A keyboard user could tab onto a slot
 * and read it, and that was the end of what they could do — there was no way to
 * put a bench player into the XI at all. This is the contract for the way in.
 */

const squadServiceMocks = vi.hoisted(() => ({
  applyTeamTactics: vi.fn(),
  getSquad: vi.fn(),
  setFormation: vi.fn(),
  setPlayerRole: vi.fn(),
  setPlayStyle: vi.fn(),
  setStartingXi: vi.fn(),
  setTacticsPhase: vi.fn(),
  setTeamMatchRoles: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    // Echoes the key, and — unlike the other suites here — the interpolated
    // values with it, because what a live region actually says is the point of
    // half these tests.
    t: (key: string, options?: string | Record<string, unknown>) => {
      if (key.startsWith("pitchToken.accessibleName")) {
        const values = options as Record<string, unknown> | undefined;
        // The token gains a duties segment when a player wears the armband or
        // takes the set pieces; the same mock answers both keys.
        const duties = values?.duties ? ` · ${String(values.duties)}` : "";
        return `${String(values?.name)} · ${String(values?.condition)} · ${String(values?.fit)}${duties}`;
      }
      if (key === "pitchToken.conditionValue") {
        const values = options as Record<string, unknown> | undefined;
        return `Condition ${String(values?.condition)}%`;
      }
      if (options && typeof options === "object") {
        const entries = Object.entries(options).filter(
          ([name]) => name !== "defaultValue",
        );
        if (entries.length > 0) {
          return `${key}(${entries
            .map(([name, value]) => `${name}=${String(value)}`)
            .sort()
            .join(",")})`;
        }
      }
      return key;
    },
    i18n: { language: "en" },
  }),
}));

vi.mock("../../services/squadService", () => ({
  applyTeamTactics: squadServiceMocks.applyTeamTactics,
  getSquad: squadServiceMocks.getSquad,
  setFormation: squadServiceMocks.setFormation,
  setPlayerRole: squadServiceMocks.setPlayerRole,
  setPlayStyle: squadServiceMocks.setPlayStyle,
  setStartingXi: squadServiceMocks.setStartingXi,
  setTacticsPhase: squadServiceMocks.setTacticsPhase,
  setTeamMatchRoles: squadServiceMocks.setTeamMatchRoles,
}));

const SAVED_XI = [
  "gk1",
  "d1",
  "d2",
  "d3",
  "d4",
  "m1",
  "m2",
  "m3",
  "m4",
  "f1",
  "f2",
];

function renderTactics(gameState: GameStateData = makeGameState()) {
  const onSelectPlayer = vi.fn();
  render(
    <TacticsTab
      gameState={gameState}
      onGameUpdate={vi.fn()}
      onSelectPlayer={onSelectPlayer}
    />,
  );
  return { onSelectPlayer };
}

function board(): HTMLElement {
  return screen.getByRole("region", { name: /^tactics\.startingXI/ });
}

/** Every slot host, in slot order. */
function slotButtons(): HTMLElement[] {
  return within(board()).getAllByRole("button");
}

function slotFor(playerId: string): HTMLElement {
  return within(board()).getByRole("button", {
    name: new RegExp(`^${playerId.toUpperCase()} · `),
  });
}

/**
 * Move real focus the way the browser would.
 *
 * `fireEvent.focus` dispatches the event without moving `document.activeElement`,
 * which half these tests read; a bare `.focus()` moves it but leaves React's
 * resulting render unflushed. `act` is the part RTL cannot infer.
 */
function focusSlot(slot: HTMLElement): HTMLElement {
  act(() => {
    slot.focus();
  });
  return slot;
}

/** Stands in for tabbing onto the board, which RTL does not simulate. */
function tabOntoBoard(): HTMLElement {
  const tabStop = slotButtons().find(
    (slot) => slot.getAttribute("tabindex") === "0",
  );
  expect(tabStop, "the board must expose exactly one tab stop").toBeDefined();
  return focusSlot(tabStop as HTMLElement);
}

function press(key: string): HTMLElement {
  const active = document.activeElement as HTMLElement;
  fireEvent.keyDown(active, { key });
  return document.activeElement as HTMLElement;
}

function dialog(): HTMLElement {
  return screen.getByRole("dialog");
}

function focusableIn(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  );
}

describe("building a starting XI with the keyboard", () => {
  beforeEach(() => {
    const gameState = makeGameState();
    Object.values(squadServiceMocks).forEach((mock) => {
      mock.mockReset();
    });
    squadServiceMocks.applyTeamTactics.mockResolvedValue(gameState);
    squadServiceMocks.getSquad.mockResolvedValue(
      gameState.players.filter((player) => player.team_id === "team1"),
    );
    squadServiceMocks.setFormation.mockResolvedValue(gameState);
    squadServiceMocks.setPlayerRole.mockResolvedValue(gameState);
    squadServiceMocks.setPlayStyle.mockResolvedValue(gameState);
    squadServiceMocks.setStartingXi.mockResolvedValue(gameState);
    squadServiceMocks.setTacticsPhase.mockResolvedValue(gameState);
    squadServiceMocks.setTeamMatchRoles.mockResolvedValue(gameState);
  });

  it("offers the board as a single tab stop that the arrows move", () => {
    renderTactics();

    const slots = slotButtons();
    const tabStops = slots.filter(
      (slot) => slot.getAttribute("tabindex") === "0",
    );

    // Eleven tab stops would mean eleven presses of Tab to leave the pitch.
    expect(tabStops).toHaveLength(1);
    expect(
      slots.filter((slot) => slot.getAttribute("tabindex") === "-1"),
    ).toHaveLength(slots.length - 1);

    const start = tabOntoBoard();
    const moved = press("ArrowUp");

    expect(moved).not.toBe(start);
    expect(slots).toContain(moved);
    expect(moved.getAttribute("tabindex")).toBe("0");
    expect(start.getAttribute("tabindex")).toBe("-1");
  });

  it("changes nothing on the server while the manager is only looking", () => {
    renderTactics();

    tabOntoBoard();
    press("ArrowUp");
    press("ArrowRight");
    press("ArrowDown");

    expect(squadServiceMocks.setStartingXi).not.toHaveBeenCalled();
    expect(squadServiceMocks.applyTeamTactics).not.toHaveBeenCalled();
  });

  it("describes whichever slot has focus, without being asked to select it", () => {
    renderTactics();

    focusSlot(slotFor("d1"));

    const pane = screen.getByRole("region", { name: "tactics.detailsPane" });

    expect(within(pane).getByText("Player d1")).toBeInTheDocument();
    expect(within(pane).getByText("tactics.deployedSlot")).toBeInTheDocument();
  });

  it("builds the XI: arrow to a slot, Enter, choose, and the player lands in it", async () => {
    renderTactics();

    focusSlot(slotFor("d2"));
    press("Enter");

    const assignment = dialog();

    expect(assignment).toHaveAttribute("aria-modal", "true");
    expect(assignment).toHaveAccessibleName(
      "tactics.assignSlot(position=common.positions.CenterBack)",
    );

    // The dialog opens with the search focused, so the next thing typed
    // narrows the squad rather than falling on the floor.
    expect(document.activeElement).toBe(
      within(assignment).getByRole("searchbox"),
    );

    fireEvent.change(within(assignment).getByRole("searchbox"), {
      target: { value: "Bench" },
    });

    const candidate = within(assignment).getByRole("button", {
      name: /Bench DEF/,
    });

    // A real button, so a browser turns the manager's Enter into this click;
    // jsdom does not, which is the one keystroke this test has to stand in for.
    expect(candidate.tagName).toBe("BUTTON");
    fireEvent.click(candidate);

    await waitFor(() => {
      expect(squadServiceMocks.setStartingXi).toHaveBeenCalledTimes(1);
    });

    // The vacated index, not the end of the list: entry i of the XI *is*
    // formation slot i, everywhere.
    expect(squadServiceMocks.setStartingXi).toHaveBeenCalledWith([
      "gk1",
      "d1",
      "d5",
      "d3",
      "d4",
      "m1",
      "m2",
      "m3",
      "m4",
      "f1",
      "f2",
    ]);
    expect(SAVED_XI[2]).toBe("d2");
  });

  it("says out loud who went in and who came out", async () => {
    renderTactics();

    focusSlot(slotFor("d2"));
    press("Enter");
    fireEvent.click(
      within(dialog()).getByRole("button", { name: /Bench DEF/ }),
    );

    await waitFor(() => {
      expect(squadServiceMocks.setStartingXi).toHaveBeenCalled();
    });

    const liveRegion = screen.getByRole("status");

    expect(liveRegion.textContent).toContain("tactics.replacedInSlot");
    expect(liveRegion.textContent).toContain("incoming=Bench DEF");
    expect(liveRegion.textContent).toContain("outgoing=D2");
  });

  it("closes on Escape and puts focus back where it came from", () => {
    renderTactics();

    const slot = focusSlot(slotFor("d2"));
    press("Enter");

    expect(screen.queryByRole("dialog")).not.toBeNull();

    fireEvent.keyDown(document.activeElement as HTMLElement, {
      key: "Escape",
    });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(slot);
    expect(squadServiceMocks.setStartingXi).not.toHaveBeenCalled();
  });

  it("keeps Tab inside the dialog while it is open", () => {
    renderTactics();

    focusSlot(slotFor("d2"));
    press("Enter");

    const assignment = dialog();
    const focusable = focusableIn(assignment);

    expect(focusable.length).toBeGreaterThan(1);

    const last = focusable[focusable.length - 1];
    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });

    expect(document.activeElement).toBe(focusable[0]);

    fireEvent.keyDown(focusable[0], { key: "Tab", shiftKey: true });

    expect(document.activeElement).toBe(last);
  });

  it("puts the players who fit the slot above the ones who do not", () => {
    renderTactics();

    // A centre-back slot. A defender belongs in it; a forward is a last
    // resort, and a list that makes the manager scroll past the forwards to
    // find the defenders has sorted by nothing useful.
    focusSlot(slotFor("d2"));
    press("Enter");

    const names = within(dialog())
      .getAllByRole("button")
      .map((button) => button.textContent ?? "");
    const positionOf = (fragment: string) =>
      names.findIndex((name) => name.includes(fragment));

    expect(positionOf("Bench DEF")).toBeGreaterThanOrEqual(0);
    expect(positionOf("F1")).toBeGreaterThanOrEqual(0);
    expect(positionOf("Bench DEF")).toBeLessThan(positionOf("F1"));
  });

  it("lists an injured player without letting them be picked", () => {
    const gameState = makeGameState();
    gameState.players = gameState.players.map((player) =>
      player.id === "d5"
        ? {
            ...player,
            injury: { name: "Hamstring strain", days_remaining: 7 },
          }
        : player,
    );
    squadServiceMocks.getSquad.mockResolvedValue(
      gameState.players.filter((player) => player.team_id === "team1"),
    );
    renderTactics(gameState);

    focusSlot(slotFor("d2"));
    press("Enter");

    expect(
      within(dialog()).getByRole("button", { name: /Bench DEF/ }),
    ).toBeDisabled();
  });

  it("keeps describing the focused player while focus moves into the pane", () => {
    renderTactics();

    focusSlot(slotFor("d1"));

    const pane = screen.getByRole("region", { name: "tactics.detailsPane" });
    const rolePicker = within(pane).getByRole("combobox");

    // Tabbing from the board towards the role picker used to unmount the role
    // picker — the pane fell back to the team view mid-Tab and took the
    // manager's focus with it. The board and the pane it feeds are one scope.
    act(() => {
      rolePicker.focus();
    });

    expect(document.activeElement).toBe(rolePicker);
    expect(within(pane).getByText("Player d1")).toBeInTheDocument();
  });

  it("does not claim a move happened when the server refused it", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    squadServiceMocks.setStartingXi.mockRejectedValue(new Error("refused"));
    renderTactics();

    focusSlot(slotFor("d2"));
    press("Enter");
    fireEvent.click(
      within(dialog()).getByRole("button", { name: /Bench DEF/ }),
    );

    await waitFor(() => {
      // A refusal interrupts; a success waits its turn.
      expect(screen.getByRole("alert").textContent).toContain(
        "tactics.assignFailed",
      );
    });

    expect(screen.getByRole("status").textContent).not.toContain(
      "tactics.replacedInSlot",
    );

    consoleError.mockRestore();
  });

  it("opens the same way on Space as on Enter", () => {
    renderTactics();

    focusSlot(slotFor("d1"));
    press(" ");

    expect(screen.queryByRole("dialog")).not.toBeNull();
  });
});
