import { useTranslation } from "react-i18next";
import { MatchSnapshot, MatchEvent } from "./types";
import { getPlayerName } from "./helpers";
import { Badge } from "../ui";
import { Circle, Star } from "lucide-react";
import { translatePositionAbbreviation } from "../squad/SquadTab.helpers";
import { buildPerformanceScores } from "./PostMatchHelpers.scores";

// ---------------------------------------------------------------------------
// QuickStat bar
// ---------------------------------------------------------------------------

export function QuickStat({
  label,
  home,
  away,
  homePct,
}: {
  label: string;
  home: number | string;
  away: number | string;
  homePct?: number;
}) {
  const hv = typeof home === "number" ? home : 0;
  const av = typeof away === "number" ? away : 0;
  const total = hv + av || 1;
  const pct = homePct ?? (hv / total) * 100;

  return (
    <div className="mb-2 last:mb-0">
      <div className="flex justify-between text-xs mb-0.5">
        <span className="font-heading font-bold text-primary-400 tabular-nums">
          {home}
        </span>
        <span className="text-gray-600 dark:text-gray-500 font-heading uppercase tracking-wider text-[10px]">
          {label}
        </span>
        <span className="font-heading font-bold text-indigo-400 tabular-nums">
          {away}
        </span>
      </div>
      <div className="flex h-1 bg-gray-300 dark:bg-navy-700 rounded-full overflow-hidden transition-colors duration-300">
        <div className="h-full bg-primary-500" style={{ width: `${pct}%` }} />
        <div
          className="h-full bg-indigo-500"
          style={{ width: `${100 - pct}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scorer list per side
// ---------------------------------------------------------------------------

export function renderScorers(
  snapshot: MatchSnapshot,
  events: MatchEvent[],
  side: "Home" | "Away",
) {
  const goals = events.filter(
    (e) =>
      e.side === side &&
      (e.event_type === "Goal" || e.event_type === "PenaltyGoal"),
  );
  if (goals.length === 0) return null;

  const team = side === "Home" ? snapshot.home_team : snapshot.away_team;
  return (
    <div className="mb-3 last:mb-0">
      <p
        className={`text-[10px] font-heading uppercase tracking-widest mb-1 ${
          side === "Home" ? "text-primary-400" : "text-indigo-400"
        }`}
      >
        {team.name}
      </p>
      {goals.map((g, i) => (
        <div key={i} className="flex items-center gap-2 text-xs py-0.5">
          <span className="text-gray-600 dark:text-gray-500 tabular-nums w-6 text-right font-heading">
            {g.minute}'
          </span>
          <Circle className="w-3 h-3 fill-current text-accent-400" />
          <span className="text-gray-800 dark:text-gray-200 font-medium">
            {getPlayerName(snapshot, g.player_id)}
          </span>
          {g.event_type === "PenaltyGoal" && (
            <Badge variant="accent" size="sm">
              PEN
            </Badge>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Player Ratings panel for one side
// ---------------------------------------------------------------------------

/**
 * A side's players, scored on what the engine recorded.
 *
 * Deliberately not called a rating. The match engine produces no player rating
 * on this branch, so every number here comes from a weight applied to match
 * events — see `buildPerformanceScores`. Calling it a rating would present a
 * heuristic as an engine reading, and the two are not the same thing.
 */
export function PerformanceScorePanel({
  snapshot,
  side,
  teamColor,
  userSide,
}: {
  snapshot: MatchSnapshot;
  side: "Home" | "Away";
  teamColor: string;
  userSide: "Home" | "Away" | null;
}) {
  const { t } = useTranslation();
  const team = side === "Home" ? snapshot.home_team : snapshot.away_team;
  const nameById = new Map(team.players.map((player) => [player.id, player.name]));
  const positionById = new Map(
    team.players.map((player) => [player.id, player.position]),
  );
  const scores = buildPerformanceScores(snapshot, side);
  const best = scores[0];
  const explainerId = `performance-scores-${side.toLowerCase()}-explainer`;

  return (
    <div className="bg-white dark:bg-navy-800 rounded-xl border border-gray-200 dark:border-navy-700 shadow-sm p-4 transition-colors duration-300">
      <div className="flex items-center gap-2 mb-3">
        <Star className="w-4 h-4 text-accent-700 dark:text-accent-400" />
        <h3 className="text-xs font-heading font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
          {t("match.performanceScores", { team: team.name })}
        </h3>
        <div
          className="w-2 h-2 rounded-full ml-auto"
          style={{ backgroundColor: teamColor }}
        />
      </div>
      {/*
        Said out loud rather than left to a tooltip. The number is built from
        match events, and a manager reading it as an engine's verdict on how
        someone played would be reading something that does not exist yet.
      */}
      <p
        className="mb-3 text-[11px] text-gray-500 dark:text-gray-400"
        id={explainerId}
      >
        {t("match.performanceScoreExplainer")}
      </p>
      {best && side === (userSide || "Home") && (
        <div className="flex items-center gap-3 mb-3 p-2 bg-accent-50 dark:bg-accent-500/10 rounded-lg border border-accent-200 dark:border-accent-500/20 transition-colors duration-300">
          <div className="w-8 h-8 rounded-lg bg-accent-100 dark:bg-accent-500/20 flex items-center justify-center transition-colors duration-300">
            <span className="text-sm font-heading font-bold text-accent-700 dark:text-accent-400">
              {best.score.toFixed(1)}
            </span>
          </div>
          <div>
            <p className="text-xs font-heading font-bold text-accent-700 dark:text-accent-400 uppercase tracking-wider">
              {t("match.topPerformer")}
            </p>
            <p className="text-sm text-gray-800 dark:text-gray-200 font-medium">
              {nameById.get(best.playerId)}
            </p>
          </div>
        </div>
      )}
      <ul
        aria-describedby={explainerId}
        className="flex flex-col gap-0.5 max-h-40 overflow-auto"
      >
        {scores.map((entry) => (
          <li
            key={entry.playerId}
            className="flex items-center gap-2 px-1 py-0.5 text-xs"
          >
            <span
              className={`font-heading font-bold tabular-nums w-8 ${
                entry.score >= 8
                  ? "text-accent-700 dark:text-accent-400"
                  : entry.score >= 7
                    ? "text-green-700 dark:text-green-400"
                  : entry.score >= 6
                      ? "text-gray-600 dark:text-gray-300"
                  : entry.score >= 5
                        ? "text-yellow-700 dark:text-yellow-400"
                        : "text-red-700 dark:text-red-400"
              }`}
            >
              {entry.score.toFixed(1)}
            </span>
            <span className="text-gray-600 dark:text-gray-400 truncate flex-1">
              {nameById.get(entry.playerId)}
            </span>
            <span className="text-gray-600 dark:text-gray-500 text-[10px] font-heading uppercase">
              {translatePositionAbbreviation(
                t,
                positionById.get(entry.playerId) ?? "",
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
