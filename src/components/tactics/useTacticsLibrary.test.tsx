import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameStateData } from "../../store/gameStore";
import { buildCustomTacticsStorageKey } from "./TacticsCustomTactics.helpers";
import { makeGameState } from "./tacticsTestFixtures";
import { useTacticsLibrary } from "./useTacticsLibrary";

const tauriMocks = vi.hoisted(() => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: tauriMocks.invoke,
}));

const translate = (key: string, fallback?: string | Record<string, unknown>) =>
  typeof fallback === "string" ? fallback : key;

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: translate,
    i18n: { language: "en" },
  }),
}));

interface BackendCustomTactic {
  id: string;
  name: string;
  description: string;
  formation: string;
  play_style: string;
  source_preset_name: string | null;
}

const backendTactic: BackendCustomTactic = {
  id: "custom:away-counter",
  name: "Away-day counter",
  description: "Compact without the ball",
  formation: "4-2-3-1",
  play_style: "Counter",
  source_preset_name: "Balanced Control",
};

function TacticsLibraryHarness({ gameState }: { gameState: GameStateData }) {
  const [announcement, setAnnouncement] = useState("");
  const library = useTacticsLibrary({
    gameState,
    formation: "4-4-2",
    activePlayStyle: "Balanced",
    initialPreset: null,
    onAnnounce: setAnnouncement,
    onStageTactic: vi.fn(),
  });

  return (
    <>
      <div role="status">{announcement}</div>
      <button type="button" onClick={() => void library.handleSaveTactic()}>
        Save tactic
      </button>
      <div role="group" aria-label="Custom tactics">
        {library.tacticLibrary
          .filter((entry) => entry.type === "custom")
          .map((entry) => (
            <button type="button" key={entry.id}>
              {entry.name}
            </button>
          ))}
      </div>
    </>
  );
}

function callsFor(command: string): unknown[][] {
  return tauriMocks.invoke.mock.calls.filter(
    ([calledCommand]) => calledCommand === command,
  );
}

describe("useTacticsLibrary save-backed custom tactics", () => {
  beforeEach(() => {
    localStorage.clear();
    tauriMocks.invoke.mockReset();
  });

  it("loads the custom tactics library from the active save", async () => {
    tauriMocks.invoke.mockImplementation(async (command: string) => {
      if (command === "list_custom_tactics") {
        return [backendTactic];
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    render(<TacticsLibraryHarness gameState={makeGameState()} />);

    await waitFor(() => {
      expect(callsFor("list_custom_tactics")).toHaveLength(1);
    });
    expect(
      await screen.findByRole("button", { name: "Away-day counter" }),
    ).toBeInTheDocument();
  });

  it("announces a rejected save instead of confirming a tactic that vanished", async () => {
    tauriMocks.invoke.mockImplementation(async (command: string) => {
      if (command === "list_custom_tactics") {
        return [];
      }
      if (command === "save_custom_tactic") {
        throw new Error("save refused");
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    render(<TacticsLibraryHarness gameState={makeGameState()} />);
    fireEvent.click(screen.getByRole("button", { name: "Save tactic" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "tactics.customTacticSaveError",
      );
    });
    expect(callsFor("save_custom_tactic")).toHaveLength(1);
  });

  it("imports the legacy localStorage library into the save only once", async () => {
    const gameState = makeGameState();
    const legacyStorageKey = buildCustomTacticsStorageKey(gameState);
    localStorage.setItem(
      legacyStorageKey,
      JSON.stringify([
        {
          id: backendTactic.id,
          name: backendTactic.name,
          description: backendTactic.description,
          formation: backendTactic.formation,
          playStyle: backendTactic.play_style,
          sourcePresetName: backendTactic.source_preset_name,
          type: "custom",
        },
      ]),
    );

    let savedBackendTactics: BackendCustomTactic[] = [];
    tauriMocks.invoke.mockImplementation(async (command: string) => {
      if (command === "list_custom_tactics") {
        return savedBackendTactics;
      }
      if (command === "save_custom_tactic") {
        savedBackendTactics = [backendTactic];
        return backendTactic;
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    const firstMount = render(
      <TacticsLibraryHarness gameState={gameState} />,
    );
    await waitFor(() => {
      expect(callsFor("save_custom_tactic")).toHaveLength(1);
    });
    firstMount.unmount();

    render(<TacticsLibraryHarness gameState={gameState} />);
    await waitFor(() => {
      expect(callsFor("list_custom_tactics")).toHaveLength(2);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(callsFor("save_custom_tactic")).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "Away-day counter" }),
    ).toBeInTheDocument();
  });
});
