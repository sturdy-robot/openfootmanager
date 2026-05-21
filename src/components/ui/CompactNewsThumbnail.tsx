import { useTranslation } from "react-i18next";
import {
    ArrowLeftRight,
    BarChart3,
    FileText,
    Newspaper,
    Trophy,
    TrendingUp,
} from "lucide-react";

import type {
    ManagerData,
    NewsArticle,
    PlayerData,
    TeamData,
} from "../../store/gameStore";
import { PersonPortrait, TeamLogo } from "./EntityMedia";

function cx(...values: Array<string | false | null | undefined>) {
    return values.filter(Boolean).join(" ");
}

const NEWS_CATEGORY_ICON: Record<string, typeof FileText> = {
    MatchReport: Newspaper,
    LeagueRoundup: Trophy,
    StandingsUpdate: BarChart3,
    TransferRumour: TrendingUp,
    TransferRoundup: ArrowLeftRight,
    InjuryNews: FileText,
    SeasonPreview: FileText,
    Editorial: FileText,
    ManagerialChange: FileText,
};

export function CompactNewsThumbnail({
    article,
    teams,
    players,
    managers,
    className,
    testId,
}: {
    article: NewsArticle;
    teams: TeamData[];
    players: PlayerData[];
    managers?: ManagerData[];
    className?: string;
    testId?: string;
}) {
    const { t } = useTranslation();
    const categoryLabel = t(`news.categories.${article.category}`, {
        defaultValue: article.category,
    });
    const Icon = NEWS_CATEGORY_ICON[article.category] ?? FileText;
    const primaryTeamId = article.match_score?.home_team_id ?? article.team_ids[0];
    const secondaryTeamId = article.match_score?.away_team_id ?? article.team_ids[1];
    const primaryTeam = primaryTeamId
        ? teams.find((team) => team.id === primaryTeamId)
        : undefined;
    const secondaryTeam = secondaryTeamId
        ? teams.find((team) => team.id === secondaryTeamId)
        : undefined;
    const featuredPlayer = players.find((player) => article.player_ids.includes(player.id));
    const playerTeam = featuredPlayer?.team_id
        ? teams.find((team) => team.id === featuredPlayer.team_id)
        : primaryTeam;
    const featuredManager = primaryTeam?.manager_id
        ? managers?.find((manager) => manager.id === primaryTeam.manager_id)
        : undefined;
    const cardLabel = `${categoryLabel}: ${article.headline}`;
    const baseCardClass = "relative flex h-full flex-col overflow-hidden rounded-[22px] border border-white/8 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]";

    if (article.match_score && primaryTeam && secondaryTeam) {
        return (
            <div
                className={cx(
                    baseCardClass,
                    "bg-gradient-to-br from-[#1f3f8d] via-[#1b295c] to-[#101a3c]",
                    className,
                )}
                data-testid={testId}
                aria-label={cardLabel}
            >
                <div className="flex flex-1 items-center justify-center gap-2 px-3 py-6">
                    <TeamLogo team={primaryTeam} className="h-5 w-5 shrink-0" />
                    <div className="flex min-w-[2.5rem] flex-row items-center rounded-2xl bg-slate-950/30 px-2 py-2">
                        <span className="font-heading font-bold leading-none">
                            {article.match_score.home_goals}
                        </span>
                        <span className="mx-1 h-px w-full bg-white/15" />
                        <span className="font-heading font-bold leading-none">
                            {article.match_score.away_goals}
                        </span>
                    </div>
                    <TeamLogo team={secondaryTeam} className="h-5 w-5 shrink-0" />
                </div>
            </div>
        );
    }

    if (featuredPlayer) {
        return (
            <div
                className={cx(
                    baseCardClass,
                    "bg-gradient-to-br from-[#159f73] via-[#1c2d64] to-[#121936]",
                    className,
                )}
                data-testid={testId}
                aria-label={cardLabel}
            >
                <div className="flex flex-1 items-end justify-between px-3 py-5">
                    <div className="">
                        {playerTeam ? (
                            <TeamLogo team={playerTeam} className="h-8 w-8 shrink-0" />
                        ) : (
                            <div className="h-8 w-8 shrink-0 rounded-xl bg-white/10" />
                        )}
                    </div>
                    <PersonPortrait
                        id={featuredPlayer.id}
                        name={featuredPlayer.full_name}
                        media={featuredPlayer.media}
                        teamColors={playerTeam?.colors}
                        className="h-8 w-8 shrink-0"
                        fallbackLabel={featuredPlayer.match_name.slice(0, 2).toUpperCase()}
                    />
                </div>
            </div>
        );
    }

    if (article.category === "ManagerialChange" && primaryTeam && featuredManager) {
        return (
            <div
                className={cx(
                    baseCardClass,
                    "bg-gradient-to-br from-[#ef7a3a] via-[#5e2749] to-[#171933]",
                    className,
                )}
                data-testid={testId}
                aria-label={cardLabel}
            >
                <div className="flex flex-1 items-end justify-between px-3 py-5">
                    <div className="">
                        <TeamLogo team={primaryTeam} className="h-8 w-8 shrink-0" />
                    </div>
                    <PersonPortrait
                        id={featuredManager.id}
                        name={`${featuredManager.first_name} ${featuredManager.last_name}`}
                        media={featuredManager.media}
                        teamColors={primaryTeam.colors}
                        className="h-8 w-8 shrink-0"
                    />
                </div>
            </div>
        );
    }

    if (primaryTeam) {
        return (
            <div
                className={cx(
                    baseCardClass,
                    "bg-gradient-to-br from-[#1f2f63] via-[#213a78] to-[#3c315e]",
                    className,
                )}
                data-testid={testId}
                aria-label={cardLabel}
            >
                <div className="flex flex-1 items-center justify-center px-3 py-5">
                    <TeamLogo team={primaryTeam} className="h-8 w-8 shrink-0" />
                </div>
            </div>
        );
    }

    return (
        <div
            className={cx(
                baseCardClass,
                article.category === "LeagueRoundup"
                    ? "bg-gradient-to-br from-[#d4a112] via-[#705921] to-[#1e233f]"
                    : article.category === "StandingsUpdate"
                        ? "bg-gradient-to-br from-[#2f66c8] via-[#34457a] to-[#1a203c]"
                        : "bg-gradient-to-br from-[#3b476e] via-[#283150] to-[#171c34]",
                className,
            )}
            data-testid={testId}
            aria-label={cardLabel}
        >
            <div className="flex flex-1 flex-col items-center justify-center px-3 pb-3 pt-1">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950/20 text-white/85">
                    <Icon className="h-6 w-6" />
                </div>
                <div className="mt-3 text-center text-[8px] font-heading font-bold uppercase tracking-[0.18em] text-white/78 line-clamp-2">
                    {categoryLabel}
                </div>
            </div>
        </div>
    );
}