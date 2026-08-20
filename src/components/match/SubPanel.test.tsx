import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SubPanel } from "./SubPanel";
import type { EnginePlayerData, EngineTeamData, MatchSnapshot } from "./types";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, arg?: unknown) => {
            if (typeof arg === "string") {
                return arg;
            }

            if (
                typeof arg === "object" &&
                arg !== null &&
                "used" in arg &&
                "max" in arg
            ) {
                return `${key}:${String((arg as { used: number }).used)}/${String((arg as { max: number }).max)}`;
            }

            if (key === "common.cancel") {
                return "Cancel";
            }

            if (key === "match.selectToTakeOff") {
                return "Select to take off";
            }

            if (key === "match.clearReplacementSelection") {
                return "Clear replacement";
            }

            if (key === "match.selectReplacementMenu") {
                return "Select replacement";
            }

            if (key === "match.selectPlayerToTakeOffFirst") {
                return "Select player to take off first";
            }

            if (key === "match.confirmSubstitution") {
                return "Confirm substitution";
            }

            return key;
        },
    }),
}));

const makePlayer = (overrides: Partial<EnginePlayerData> = {}): EnginePlayerData => {
    const { ovr = 70, ...rest } = overrides;

    return {
        id: "player-1",
        name: "Player One",
        position: "Midfielder",
        ovr,
        condition: 78,
        pace: 70,
        stamina: 70,
        strength: 70,
        agility: 70,
        passing: 70,
        shooting: 70,
        tackling: 70,
        dribbling: 70,
        defending: 70,
        positioning: 70,
        vision: 70,
        decisions: 70,
        composure: 70,
        aggression: 60,
        teamwork: 70,
        leadership: 60,
        handling: 20,
        reflexes: 20,
        aerial: 60,
        traits: [],
        role: "Standard",
        ...rest,
    };
};

const makeTeam = (overrides: Partial<EngineTeamData> = {}): EngineTeamData => ({
    id: "team-1",
    name: "Alpha FC",
    formation: "4-4-2",
    play_style: "Balanced",
    players: [
        makePlayer({ id: "starter-1", name: "Starter One", position: "Midfielder" }),
        makePlayer({ id: "starter-2", name: "Starter Two", position: "Forward", shooting: 80 }),
    ],
    ...overrides,
});

function createSnapshot(): MatchSnapshot {
    return {
        phase: "first_half",
        current_minute: 32,
        home_score: 1,
        away_score: 0,
        possession: "Home",
        ball_zone: "MiddleThird",
        home_team: makeTeam(),
        away_team: makeTeam({
            id: "team-2",
            name: "Beta FC",
            players: [makePlayer({ id: "opp-1", name: "Opponent One" })],
        }),
        home_bench: [
            makePlayer({ id: "bench-1", name: "Bench One", position: "Midfielder", condition: 92 }),
            makePlayer({ id: "bench-2", name: "Bench Two", position: "Forward", shooting: 76 }),
        ],
        away_bench: [makePlayer({ id: "opp-bench-1", name: "Opponent Bench" })],
        home_possession_pct: 56,
        away_possession_pct: 44,
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
    };
}

describe("SubPanel", () => {
    const createProps = () => ({
        snapshot: createSnapshot(),
        side: "Home" as const,
        onSubmitDraft: vi.fn(),
        onClose: vi.fn(),
    });

    it("shows a disabled bench context menu action until a player is selected to come off", () => {
        const props = createProps();

        render(
            <SubPanel {...props} />,
        );

        fireEvent.contextMenu(screen.getByTestId("sub-panel-bench-bench-1"));

        expect(
            screen.getByRole("menuitem", { name: "Select player to take off first" }),
        ).toBeDisabled();
    });

    it("supports the substitution selection flow through context menus", () => {
        const props = createProps();

        render(
            <SubPanel {...props} />,
        );

        fireEvent.contextMenu(screen.getByTestId("sub-panel-off-starter-1"));
        fireEvent.click(screen.getByRole("menuitem", { name: "Select to take off" }));

        fireEvent.contextMenu(screen.getByTestId("sub-panel-bench-bench-1"));
        fireEvent.click(screen.getByRole("menuitem", { name: "Select replacement" }));

        const queue = screen.getByRole("region", {
            name: "match.pendingChanges",
        });

        // Step 11 moved substitutions from immediate dispatch into the atomic
        // pending queue: nothing leaves the panel until Apply.
        expect(props.onSubmitDraft).not.toHaveBeenCalled();
        expect(queue).toHaveTextContent("match.pendingSubstitution");
        expect(
            screen.getByRole("button", { name: "match.applyPendingChanges" }),
        ).toBeEnabled();
    });

    it("allows clearing the selected off-player through the context menu", () => {
        const props = createProps();

        render(
            <SubPanel {...props} />,
        );

        fireEvent.contextMenu(screen.getByTestId("sub-panel-off-starter-1"));
        fireEvent.click(screen.getByRole("menuitem", { name: "Select to take off" }));

        expect(screen.getByText("match.selectBenchToCompare")).toBeInTheDocument();

        fireEvent.contextMenu(screen.getByTestId("sub-panel-off-starter-1"));
        fireEvent.click(screen.getByRole("menuitem", { name: "Cancel" }));

        expect(screen.queryByText("match.selectBenchToCompare")).not.toBeInTheDocument();
    });

    it("surfaces recommendations and applies the recommended play style", () => {
        const props = createProps();

        render(<SubPanel {...props} />);

        expect(
            screen.getByTestId("recommended-sub-starter-1-bench-1"),
        ).toBeInTheDocument();

        fireEvent.click(screen.getByTestId("recommended-plan-cta"));

        // Step 11 moved tactical tweaks into the same atomic draft as lineup changes.
        expect(props.onSubmitDraft).not.toHaveBeenCalled();
        expect(
            screen.getByRole("button", { name: "match.applyPendingChanges" }),
        ).toBeEnabled();
    });

    it("applies formation from quick tactical tweaks", () => {
        const props = createProps();

        render(<SubPanel {...props} />);

        fireEvent.click(screen.getByRole("combobox", { name: "tactics.formation" }));
        fireEvent.click(screen.getByRole("option", { name: "4-3-3" }));

        // Step 11 moved formation changes into the one atomic in-match change set.
        expect(props.onSubmitDraft).not.toHaveBeenCalled();
        expect(
            screen.getByRole("button", { name: "match.applyPendingChanges" }),
        ).toBeEnabled();
    });

    it("lets a recommendation prefill the swap flow", () => {
        const props = createProps();

        render(<SubPanel {...props} />);

        fireEvent.click(
            screen.getByTestId("recommended-sub-starter-1-bench-1"),
        );

        expect(screen.getAllByText("Starter One").length).toBeGreaterThan(0);
        expect(screen.getAllByText("Bench One").length).toBeGreaterThan(0);
        // Step 11 moved a recommended swap from a prefilled immediate action into the queue.
        expect(
            screen.getByRole("region", { name: "match.pendingChanges" }),
        ).toHaveTextContent("match.pendingSubstitution");
    });
});
