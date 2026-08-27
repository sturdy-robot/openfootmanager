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
import type { EnginePlayerData, MatchSnapshot } from "./types";
import PressConference from "./PressConference";

const matchServiceMocks = vi.hoisted(() => ({
  submitPressConference: vi.fn(),
}));

vi.mock("../../services/matchService", () => ({
  submitPressConference: matchServiceMocks.submitPressConference,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: unknown) => {
      const values =
        typeof options === "object" && options !== null
          ? (options as Record<string, unknown>)
          : {};
      const translations: Record<string, string> = {
        "match.leaveConference": "Leave Conference",
        "match.nextQuestion": "Next Question",
        "match.press.ahead.question": "What is your focus for the next match?",
        "match.press.ahead.responses.focused.text":
          "We take it one game at a time.",
        "match.press.ahead.responses.focused.tone": "Focused",
        "match.press.fans.questions.win":
          "What does the supporters' backing mean to you?",
        "match.press.fans.responses.win.grateful.text":
          "The supporters drive us forward.",
        "match.press.fans.responses.win.grateful.tone": "Grateful",
        "match.press.playerFocus.responses.demanding.text":
          "Alice can give us even more.",
        "match.press.playerFocus.responses.demanding.tone": "Demanding",
        "match.press.playerFocus.responses.deflect.text":
          "It is about the whole team.",
        "match.press.playerFocus.responses.deflect.tone": "Deflect",
        "match.press.playerFocus.responses.praise.text":
          "Alice was fantastic today.",
        "match.press.playerFocus.responses.praise.tone": "Praise",
        "match.press.result.responses.win.confident.text":
          "We were the better side from start to finish.",
        "match.press.result.responses.win.confident.tone": "Confident",
        "match.press.result.responses.win.deflect.text":
          "It is just three points.",
        "match.press.result.responses.win.deflect.tone": "Deflect",
        "match.press.result.responses.win.humble.text":
          "The players worked hard.",
        "match.press.result.responses.win.humble.tone": "Humble",
        "match.press.tactics.question":
          "Can you explain your tactical approach?",
        "match.press.tactics.responses.detailed.text":
          "We set up to control midfield.",
        "match.press.tactics.responses.detailed.tone": "Detailed",
        "match.pressConference": "Press Conference",
        "match.skipConference": "Skip Conference",
        "match.submitting": "Submitting...",
        "settings.switchToDarkMode": "Switch to dark mode",
      };

      if (key === "match.pressSubtitle") {
        return `Post-match press conference — ${String(values.team)}`;
      }
      if (key === "match.pressQuestionProgress") {
        return `Question ${String(values.current)} of ${String(values.total)}`;
      }
      if (key === "match.press.result.questions.win") {
        return `A ${String(values.userScore)}-${String(values.oppScore)} win against ${String(values.oppName)}. How pleased are you?`;
      }
      if (key === "match.press.playerFocus.questions.default") {
        return `How did ${String(values.playerName)} perform?`;
      }
      if (key in translations) return translations[key];
      return key;
    },
    i18n: { language: "en" },
  }),
}));

vi.mock("../../context/ThemeContext", () => ({
  useTheme: () => ({ isDark: false, toggleTheme: vi.fn() }),
}));

function player(overrides: Partial<EnginePlayerData>): EnginePlayerData {
  return {
    id: "player",
    name: "Player",
    position: "Forward",
    ovr: 70,
    condition: 90,
    pace: 70,
    stamina: 70,
    strength: 70,
    agility: 70,
    passing: 70,
    shooting: 70,
    tackling: 40,
    dribbling: 70,
    defending: 40,
    positioning: 70,
    vision: 70,
    decisions: 70,
    composure: 70,
    aggression: 50,
    teamwork: 70,
    leadership: 60,
    handling: 20,
    reflexes: 20,
    aerial: 50,
    traits: [],
    role: "Standard",
    ...overrides,
  };
}

function snapshot(): MatchSnapshot {
  return {
    phase: "FullTime",
    current_minute: 90,
    home_score: 2,
    away_score: 1,
    possession: "Home",
    ball_zone: "Midfield",
    home_team: {
      id: "alpha",
      name: "Alpha FC",
      formation: "4-4-2",
      play_style: "Balanced",
      players: [player({ id: "alice", name: "Alice" })],
    },
    away_team: {
      id: "beta",
      name: "Beta FC",
      formation: "4-4-2",
      play_style: "Balanced",
      players: [player({ id: "bob", name: "Bob" })],
    },
    home_bench: [],
    away_bench: [],
    home_possession_pct: 52,
    away_possession_pct: 48,
    events: [],
    home_subs_made: 0,
    away_subs_made: 0,
    max_subs: 5,
    home_set_pieces: {
      free_kick_taker: null,
      corner_taker: null,
      penalty_taker: null,
      captain: null,
    },
    away_set_pieces: {
      free_kick_taker: null,
      corner_taker: null,
      penalty_taker: null,
      captain: null,
    },
    substitutions: [],
    allows_extra_time: false,
    home_yellows: {},
    away_yellows: {},
    sent_off: [],
    revision: 0,
  };
}

function gameState(): GameStateData {
  return {
    clock: {
      current_date: "2026-08-27",
      start_date: "2026-08-01",
    },
    teams: [
      { id: "alpha", name: "Alpha FC" },
      { id: "beta", name: "Beta FC" },
    ],
    players: [],
    staff: [],
    messages: [],
    news: [],
    league: null,
    scouting_assignments: [],
    board_objectives: [],
  } as unknown as GameStateData;
}

function renderConference() {
  const onFinish = vi.fn();
  const onGameUpdate = vi.fn();
  render(
    <PressConference
      gameState={gameState()}
      matchdayIdentity={{
        competitionName: "Premier League",
        roundLabel: "Match Day 12",
      }}
      onFinish={onFinish}
      onGameUpdate={onGameUpdate}
      snapshot={snapshot()}
      userSide="Home"
    />,
  );
  return { onFinish, onGameUpdate };
}

beforeEach(() => {
  matchServiceMocks.submitPressConference.mockReset();
});

describe("press conference matchday shell", () => {
  it("puts the stage identity in the named shell header and keeps it out of the question body", () => {
    renderConference();

    const header = screen.getByRole("banner", {
      name: "Premier League · Match Day 12",
    });
    const headerText = [
      "Press Conference",
      "Post-match press conference — Alpha FC",
    ];
    const missingFromHeader = headerText.filter(
      (text) => within(header).queryByText(text, { exact: true }) === null,
    );
    const duplicatedInBody = headerText.filter((text) =>
      screen
        .getAllByText(text, { exact: true })
        .some((node) => !header.contains(node)),
    );
    const questionBody = header.nextElementSibling;
    const footer = screen.getByRole("contentinfo");
    const skipButton = screen.getByRole("button", {
      name: "Skip Conference",
    });

    expect(
      {
        duplicatedInBody,
        footerIsOutsideBody: !questionBody?.contains(footer),
        footerOwnsSkipControl: footer.contains(skipButton),
        missingFromHeader,
      },
      "the shell header must own the stage identity and the shell body must contain only the question flow",
    ).toEqual({
      duplicatedInBody: [],
      footerIsOutsideBody: true,
      footerOwnsSkipControl: true,
      missingFromHeader: [],
    });
  });

  it("announces question progress while preserving every answer and the complete submit flow", async () => {
    const updatedGame = gameState();
    let resolveSubmission!: (result: {
      game: GameStateData;
      morale_delta: number;
    }) => void;
    matchServiceMocks.submitPressConference.mockReturnValue(
      new Promise((resolve) => {
        resolveSubmission = resolve;
      }),
    );
    const { onFinish, onGameUpdate } = renderConference();
    const header = screen.getByRole("banner", {
      name: "Premier League · Match Day 12",
    });
    const progressStates: Array<{
      current: string | null;
      inHeader: boolean;
      label: string;
      segments: number | null;
      total: string | null;
    }> = [];
    const recordProgress = (current: number) => {
      const label = `Question ${current} of 5`;
      const progress = screen.queryByRole("progressbar", { name: label });
      progressStates.push({
        current: progress?.getAttribute("aria-valuenow") ?? null,
        inHeader: progress !== null && header.contains(progress),
        label,
        segments: progress?.childElementCount ?? null,
        total: progress?.getAttribute("aria-valuemax") ?? null,
      });
    };

    recordProgress(1);
    expect(screen.getByText("David Thomson")).toBeInTheDocument();
    expect(screen.getByText("Sports Daily")).toBeInTheDocument();
    expect(
      screen.getByText('"A 2-1 win against Beta FC. How pleased are you?"'),
    ).toBeInTheDocument();
    for (const answerName of [
      /Humble.*The players worked hard/,
      /Confident.*We were the better side from start to finish/,
      /Deflect.*It is just three points/,
    ]) {
      expect(
        screen.getByRole("button", { name: answerName }),
      ).toBeInTheDocument();
    }

    fireEvent.click(
      screen.getByRole("button", {
        name: /Humble.*The players worked hard/,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Next Question" }));
    recordProgress(2);
    expect(screen.getByText("Rachel Cooper")).toBeInTheDocument();
    expect(screen.getByText('"How did Alice perform?"')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: /Praise.*Alice was fantastic today/,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Next Question" }));
    recordProgress(3);
    fireEvent.click(
      screen.getByRole("button", {
        name: /Detailed.*We set up to control midfield/,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Next Question" }));
    recordProgress(4);
    fireEvent.click(
      screen.getByRole("button", {
        name: /Grateful.*The supporters drive us forward/,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Next Question" }));
    recordProgress(5);
    fireEvent.click(
      screen.getByRole("button", {
        name: /Focused.*We take it one game at a time/,
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Leave Conference" }),
    );

    expect(
      screen.getByRole("button", { name: "Submitting..." }),
    ).toBeInTheDocument();
    expect(matchServiceMocks.submitPressConference).toHaveBeenCalledOnce();
    expect(
      matchServiceMocks.submitPressConference.mock.calls[0][0].answers,
    ).toHaveLength(5);

    await act(async () => {
      resolveSubmission({ game: updatedGame, morale_delta: 2 });
    });
    await waitFor(() => {
      expect(onGameUpdate).toHaveBeenCalledWith(updatedGame);
      expect(onFinish).toHaveBeenCalledOnce();
    });

    expect(
      progressStates,
      "each question must expose its translated position from the shell header",
    ).toEqual(
      [1, 2, 3, 4, 5].map((current) => ({
        current: String(current),
        inHeader: true,
        label: `Question ${current} of 5`,
        segments: 5,
        total: "5",
      })),
    );
  });
});
