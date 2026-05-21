import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ManagerData, NewsArticle, PlayerData, TeamData } from "../../store/gameStore";
import { CompactNewsThumbnail } from "./CompactNewsThumbnail";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, options?: { defaultValue?: string }) => {
            const labels: Record<string, string> = {
                "news.categories.MatchReport": "Relato de Partida",
                "news.categories.LeagueRoundup": "Resumo da Rodada",
                "news.categories.Editorial": "Editorial",
                "news.categories.ManagerialChange": "Treinador",
            };

            return labels[key] ?? options?.defaultValue ?? key;
        },
    }),
}));

function makeTeam(overrides: Partial<TeamData> = {}): TeamData {
    return {
        id: "team-1",
        name: "London FC",
        short_name: "LFC",
        country: "GB",
        city: "London",
        stadium_name: "London Arena",
        stadium_capacity: 50000,
        finance: 0,
        manager_id: "manager-1",
        reputation: 70,
        wage_budget: 0,
        transfer_budget: 0,
        season_income: 0,
        season_expenses: 0,
        formation: "4-4-2",
        play_style: "Balanced",
        training_focus: "Physical",
        training_intensity: "Medium",
        training_schedule: "Balanced",
        founded_year: 1900,
        colors: { primary: "#10b981", secondary: "#0f172a" },
        starting_xi_ids: [],
        form: [],
        history: [],
        ...overrides,
    };
}

function makePlayer(overrides: Partial<PlayerData> = {}): PlayerData {
    return {
        id: "player-1",
        match_name: "J. Doe",
        full_name: "John Doe",
        date_of_birth: "2000-01-01",
        nationality: "GB",
        position: "Midfielder",
        natural_position: "Midfielder",
        alternate_positions: [],
        attributes: {
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
            aggression: 70,
            teamwork: 70,
            leadership: 70,
            handling: 20,
            reflexes: 20,
            aerial: 50,
        },
        condition: 100,
        morale: 100,
        injury: null,
        team_id: "team-1",
        retired: false,
        training_focus: null,
        contract_end: null,
        wage: 0,
        market_value: 0,
        stats: {
            appearances: 0,
            goals: 0,
            assists: 0,
            clean_sheets: 0,
            yellow_cards: 0,
            red_cards: 0,
            avg_rating: 0,
            minutes_played: 0,
        },
        career: [],
        transfer_listed: false,
        loan_listed: false,
        transfer_offers: [],
        traits: [],
        ...overrides,
    };
}

function makeManager(overrides: Partial<ManagerData> = {}): ManagerData {
    return {
        id: "manager-1",
        first_name: "Jane",
        last_name: "Smith",
        date_of_birth: "1980-01-01",
        nationality: "GB",
        reputation: 80,
        satisfaction: 60,
        fan_approval: 60,
        team_id: "team-1",
        career_stats: {
            matches_managed: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            trophies: 0,
            best_finish: null,
        },
        career_history: [],
        ...overrides,
    };
}

describe("CompactNewsThumbnail", () => {
    it("renders a dedicated match thumbnail layout", () => {
        const article: NewsArticle = {
            id: "news-1",
            headline: "Lyon Olympique 1-3 Lisbon Sporting",
            body: "A dramatic match report.",
            source: "Cronica da Liga",
            date: "2026-12-11",
            category: "MatchReport",
            team_ids: ["team-1", "team-2"],
            player_ids: [],
            match_score: {
                home_team_id: "team-1",
                away_team_id: "team-2",
                home_goals: 1,
                away_goals: 3,
            },
            read: false,
        };

        render(
            <CompactNewsThumbnail
                article={article}
                teams={[
                    makeTeam({ id: "team-1", name: "Lyon Olympique", short_name: "LO" }),
                    makeTeam({ id: "team-2", name: "Lisbon Sporting", short_name: "LS" }),
                ]}
                players={[]}
                managers={[]}
                testId="compact-news-thumbnail"
                className="h-24 w-28"
            />,
        );

        expect(screen.getByTestId("compact-news-thumbnail")).toBeInTheDocument();
        expect(screen.getByLabelText("Lyon Olympique")).toBeInTheDocument();
        expect(screen.getByLabelText("Lisbon Sporting")).toBeInTheDocument();
        expect(screen.getByText("1")).toBeInTheDocument();
        expect(screen.getByText("3")).toBeInTheDocument();
    });

    it("renders a portrait-led thumbnail when the article highlights a player", () => {
        const article: NewsArticle = {
            id: "news-2",
            headline: "Javier Alvarez press conference",
            body: "The players worked well.",
            source: "Diario Esportivo",
            date: "2026-12-12",
            category: "Editorial",
            team_ids: ["team-1"],
            player_ids: ["player-1"],
            match_score: null,
            read: false,
        };

        render(
            <CompactNewsThumbnail
                article={article}
                teams={[makeTeam({ name: "Madrid Real", short_name: "MR" })]}
                players={[makePlayer({ full_name: "Javier Alvarez", match_name: "J. Alvarez" })]}
                managers={[]}
                testId="compact-player-thumbnail"
                className="h-24 w-28"
            />,
        );

        expect(screen.getByTestId("compact-player-thumbnail")).toBeInTheDocument();
        expect(screen.getByLabelText("Madrid Real")).toBeInTheDocument();
        expect(screen.getByLabelText("Javier Alvarez")).toBeInTheDocument();
    });

    it("renders a manager-led thumbnail when the article highlights a managerial change", () => {
        const article: NewsArticle = {
            id: "news-3",
            headline: "Jane Smith appointed",
            body: "A new era begins.",
            source: "OpenFoot Times",
            date: "2026-12-12",
            category: "ManagerialChange",
            team_ids: ["team-1"],
            player_ids: [],
            match_score: null,
            read: false,
        };

        render(
            <CompactNewsThumbnail
                article={article}
                teams={[makeTeam({ name: "London FC", short_name: "LFC" })]}
                players={[]}
                managers={[makeManager()]}
                testId="compact-manager-thumbnail"
                className="h-24 w-28"
            />,
        );

        expect(screen.getByTestId("compact-manager-thumbnail")).toBeInTheDocument();
        expect(screen.getByLabelText("London FC")).toBeInTheDocument();
        expect(screen.getByLabelText("Jane Smith")).toBeInTheDocument();
    });
});