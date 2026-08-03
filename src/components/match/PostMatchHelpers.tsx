import { useTranslation } from "react-i18next";
import { MatchSnapshot, MatchEvent, MatchPlayerStatsRow } from "./types";
import { getPlayerName } from "./helpers";
import { Badge } from "../ui";
import { Circle, Star } from "lucide-react";
import { translatePositionAbbreviation } from "../squad/SquadTab.helpers";

// ---------------------------------------------------------------------------
// QuickStat bar
// ---------------------------------------------------------------------------

export function QuickStat({
  label,
  home,
  away,
  homePct,
  withoutBar,
}: {
  label: string;
  home: number | string;
  away: number | string;
  homePct?: number;
  /// For stats that are not two shares of one total — two independent
  /// percentages, say — where a proportion bar would state something untrue.
  withoutBar?: boolean;
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
      {!withoutBar && (
        <div
          aria-hidden="true"
          className="flex h-1 bg-gray-300 dark:bg-navy-700 rounded-full overflow-hidden transition-colors duration-300"
        >
          <div className="h-full bg-primary-500" style={{ width: `${pct}%` }} />
          <div
            className="h-full bg-indigo-500"
            style={{ width: `${100 - pct}%` }}
          />
        </div>
      )}
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

export function PlayerRatingsPanel({
  stats,
  side,
  teamName,
  teamColor,
  userSide,
}: {
  stats: MatchPlayerStatsRow[];
  side: "Home" | "Away";
  teamName: string;
  teamColor: string;
  userSide: "Home" | "Away" | null;
}) {
  const { t } = useTranslation();
  // Ratings come from the engine now. They used to be recomputed here from the
  // event log, which meant the number a player saw and the number that moved
  // his squad's morale were produced by two different models — and only the
  // engine's reaches the save.
  const sorted = [...stats]
    .filter((row) => row.side === side)
    .sort((a, b) => b.rating - a.rating);
  const motm = sorted[0];

  return (
    <div className="min-w-0 bg-white dark:bg-navy-800 rounded-xl border border-gray-200 dark:border-navy-700 shadow-sm p-4 transition-colors duration-300">
      <div className="flex items-center gap-2 mb-3">
        <Star className="w-4 h-4 text-accent-700 dark:text-accent-400" />
        <h3 className="text-xs font-heading font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
          {t("match.ratings", { team: teamName })}
        </h3>
        <div
          className="w-2 h-2 rounded-full ml-auto"
          style={{ backgroundColor: teamColor }}
        />
      </div>
      {motm && side === (userSide || "Home") && (
        <div className="flex items-center gap-3 mb-3 p-2 bg-accent-50 dark:bg-accent-500/10 rounded-lg border border-accent-200 dark:border-accent-500/20 transition-colors duration-300">
          <div className="w-8 h-8 rounded-lg bg-accent-100 dark:bg-accent-500/20 flex items-center justify-center transition-colors duration-300">
            <span className="text-sm font-heading font-bold text-accent-700 dark:text-accent-400">
              {motm.rating.toFixed(1)}
            </span>
          </div>
          <div>
            <p className="text-xs font-heading font-bold text-accent-700 dark:text-accent-400 uppercase tracking-wider">
              {t("match.motm")}
            </p>
            <p className="text-sm text-gray-800 dark:text-gray-200 font-medium">{motm.name}</p>
          </div>
        </div>
      )}
      {/* Focusable so a keyboard user can actually reach the columns that are
          off-screen when the panel is narrow. A scroll container with nothing
          tabbable inside it is unreachable without a pointer. */}
      <div
        className="overflow-x-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-navy-800 rounded"
        tabIndex={0}
        role="region"
        aria-label={t("match.ratings", { team: teamName })}
      >
        <table className="w-full text-xs">
          <caption className="sr-only">
            {t("match.ratings", { team: teamName })}
          </caption>
          <thead>
            <tr className="text-gray-500 dark:text-gray-400 font-heading uppercase tracking-wider text-[10px]">
              <th scope="col" className="text-left font-bold py-1 pr-2">
                {t("match.statTable.player")}
              </th>
              <th scope="col" className="text-right font-bold py-1 px-1">
                {t("match.statTable.rating")}
              </th>
              <th scope="col" className="text-right font-bold py-1 px-1">
                <abbr title={t("match.statTable.goalsFull")} className="no-underline">
                  {t("match.statTable.goalsShort")}
                </abbr>
              </th>
              <th scope="col" className="text-right font-bold py-1 px-1">
                <abbr title={t("match.statTable.assistsFull")} className="no-underline">
                  {t("match.statTable.assistsShort")}
                </abbr>
              </th>
              <th scope="col" className="text-right font-bold py-1 px-1">
                <abbr title={t("match.statTable.shotsFull")} className="no-underline">
                  {t("match.statTable.shotsShort")}
                </abbr>
              </th>
              <th scope="col" className="text-right font-bold py-1 px-1">
                <abbr title={t("match.statTable.passesFull")} className="no-underline">
                  {t("match.statTable.passesShort")}
                </abbr>
              </th>
              <th scope="col" className="text-right font-bold py-1 px-1">
                <abbr title={t("match.statTable.xgFull")} className="no-underline">
                  {t("match.statTable.xg")}
                </abbr>
              </th>
              <th scope="col" className="text-right font-bold py-1 px-1">
                <abbr title={t("match.statTable.xaFull")} className="no-underline">
                  {t("match.statTable.xa")}
                </abbr>
              </th>
              <th scope="col" className="text-right font-bold py-1 pl-1">
                <abbr title={t("match.statTable.distanceEstimated")} className="no-underline">
                  {t("match.statTable.distance")}
                </abbr>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr
                key={p.player_id}
                className="border-t border-gray-100 dark:border-navy-700/60"
              >
                <th scope="row" className="text-left font-normal py-1 pr-2">
                  <span className="text-gray-700 dark:text-gray-300">{p.name}</span>
                  <span className="text-gray-500 dark:text-gray-400 text-[10px] font-heading uppercase ml-1">
                    {translatePositionAbbreviation(t, p.position)}
                  </span>
                </th>
                <td
                  className={`text-right tabular-nums font-heading font-bold py-1 px-1 ${ratingTone(
                    p.rating,
                  )}`}
                >
                  {p.rating.toFixed(1)}
                </td>
                <td className="text-right tabular-nums py-1 px-1 text-gray-700 dark:text-gray-300">
                  {p.goals}
                </td>
                <td className="text-right tabular-nums py-1 px-1 text-gray-700 dark:text-gray-300">
                  {p.assists}
                </td>
                <td className="text-right tabular-nums py-1 px-1 text-gray-600 dark:text-gray-400">
                  {p.shots_on_target}/{p.shots}
                </td>
                <td className="text-right tabular-nums py-1 px-1 text-gray-600 dark:text-gray-400">
                  {p.passes_completed}/{p.passes_attempted}
                </td>
                <td className="text-right tabular-nums py-1 px-1 text-gray-600 dark:text-gray-400">
                  {p.xg.toFixed(2)}
                </td>
                <td className="text-right tabular-nums py-1 px-1 text-gray-600 dark:text-gray-400">
                  {p.xa.toFixed(2)}
                </td>
                <td className="text-right tabular-nums py-1 pl-1 text-gray-600 dark:text-gray-400">
                  {p.distance_km.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] text-gray-500 dark:text-gray-400">
        {t("match.statTable.distanceFootnote")}
      </p>
    </div>
  );
}

/// Rating colour, matching the scale used elsewhere in the match screens.
function ratingTone(rating: number): string {
  if (rating >= 8) return "text-accent-700 dark:text-accent-400";
  if (rating >= 7) return "text-primary-700 dark:text-primary-400";
  if (rating >= 6) return "text-gray-600 dark:text-gray-300";
  if (rating >= 5) return "text-yellow-700 dark:text-yellow-400";
  return "text-red-700 dark:text-red-400";
}
