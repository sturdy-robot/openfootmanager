import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTranslation } from "react-i18next";
import type { MatchEvent } from "./types";
import { useChartTheme } from "../ui/charts/chartTheme";

interface PossessionDonutProps {
  homePct: number;
  awayPct: number;
  homeTeamName: string;
  awayTeamName: string;
  homeColor: string;
  awayColor: string;
  label: string;
}

export function PossessionDonut({
  homePct,
  awayPct,
  homeTeamName,
  awayTeamName,
  homeColor,
  awayColor,
  label,
}: PossessionDonutProps) {
  const theme = useChartTheme();
  const total = homePct + awayPct;
  const normalizedHome = total > 0 ? (homePct / total) * 100 : 50;
  const roundedHome = Math.round(normalizedHome);
  const roundedAway = 100 - roundedHome;
  const data = [
    { name: homeTeamName, value: roundedHome },
    { name: awayTeamName, value: roundedAway },
  ];

  return (
    <div className="flex flex-col items-center gap-1">
      <p className="text-[10px] font-heading uppercase tracking-widest text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <div className="relative" style={{ width: 72, height: 72 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={22}
              outerRadius={32}
              dataKey="value"
              strokeWidth={0}
            >
              <Cell fill={homeColor} />
              <Cell fill={awayColor} />
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: theme.tooltipBg,
                border: `1px solid ${theme.tooltipBorder}`,
                borderRadius: 6,
                fontSize: 11,
                color: theme.tooltipText,
              }}
              formatter={(value, name) => [`${value ?? 0}%`, String(name ?? "")]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[10px] font-heading font-bold text-gray-700 dark:text-gray-300 tabular-nums">
            {roundedHome}%
          </span>
        </div>
      </div>
      <div className="flex gap-3 text-[9px] font-heading uppercase tracking-wider">
        <span style={{ color: homeColor }}>{roundedHome}%</span>
        <span style={{ color: awayColor }}>{roundedAway}%</span>
      </div>
    </div>
  );
}


// ---------------------------------------------------------------------------
// Expected-goals race
// ---------------------------------------------------------------------------

interface XgPoint {
  minute: number;
  home: number;
  away: number;
}

/**
 * Cumulative expected goals by minute, for both sides.
 *
 * Every shot carries what the chance was worth, so the running total is a
 * reading of how the match actually went — a side that lost 1-0 having built
 * twice the danger looks quite different from one that was outplayed, and the
 * scoreline alone cannot tell you which happened.
 */
export function buildXgRace(events: MatchEvent[], totalMinutes: number): XgPoint[] {
  const points: XgPoint[] = [{ minute: 0, home: 0, away: 0 }];
  let home = 0;
  let away = 0;

  for (const evt of events) {
    const detail = evt.detail;
    if (!detail) continue;
    const xg =
      "Shot" in detail
        ? detail.Shot.xg
        : "Save" in detail
          ? detail.Save.xg
          : "Goal" in detail
            ? detail.Goal.xg
            : undefined;
    if (xg === undefined || xg <= 0) continue;

    if (evt.side === "Home") home += xg;
    else away += xg;
    points.push({ minute: evt.minute, home, away });
  }

  // Carry the final totals to the whistle so the line does not stop early.
  points.push({ minute: Math.max(totalMinutes, points[points.length - 1].minute), home, away });
  return points;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function XgRaceChart({
  events,
  totalMinutes,
  homeTeamName,
  awayTeamName,
  homeColor,
  awayColor,
}: {
  events: MatchEvent[];
  totalMinutes: number;
  homeTeamName: string;
  awayTeamName: string;
  homeColor: string;
  awayColor: string;
}) {
  const { t } = useTranslation();
  const theme = useChartTheme();
  const data = buildXgRace(events, totalMinutes);
  const final = data[data.length - 1];

  if (data.length <= 2) {
    return (
      <p className="text-xs text-gray-600 dark:text-gray-400">
        {t("match.charts.noChances")}
      </p>
    );
  }

  return (
    <figure className="m-0">
      <figcaption className="text-xs font-heading font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">
        {t("match.charts.xgRace")}
      </figcaption>
      {/* The chart is one image to assistive technology, with the outcome
          stated outright — a screen reader user should not have to infer the
          story from a list of coordinates. The table below carries the detail
          for anyone who wants it. */}
      <div
        role="img"
        aria-label={t("match.charts.xgRaceSummary", {
          home: homeTeamName,
          away: awayTeamName,
          homeXg: final.home.toFixed(2),
          awayXg: final.away.toFixed(2),
        })}
        style={{ width: "100%", height: 180 }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid stroke={theme.gridColor} strokeDasharray="3 3" />
            <XAxis
              dataKey="minute"
              stroke={theme.axisColor}
              tick={{ fontSize: 10, fill: theme.axisColor }}
              unit="'"
            />
            <YAxis
              stroke={theme.axisColor}
              tick={{ fontSize: 10, fill: theme.axisColor }}
              width={30}
              // Expected goals accumulates as a float, so without this the
              // axis reads 1.8400000000000003.
              tickFormatter={(value: number) => value.toFixed(1)}
            />
            <Tooltip
              contentStyle={{
                background: theme.tooltipBg,
                border: `1px solid ${theme.tooltipBorder}`,
                borderRadius: 8,
                fontSize: 12,
              }}
              labelFormatter={(minute) => `${minute}'`}
              formatter={(value) =>
                typeof value === "number" ? value.toFixed(2) : String(value)
              }
            />
            <Line
              type="stepAfter"
              dataKey="home"
              name={homeTeamName}
              stroke={homeColor}
              strokeWidth={2}
              dot={false}
              isAnimationActive={!prefersReducedMotion()}
            />
            {/* Dashed as well as differently coloured: colour alone would leave
                the two sides indistinguishable to a good share of players. */}
            <Line
              type="stepAfter"
              dataKey="away"
              name={awayTeamName}
              stroke={awayColor}
              strokeWidth={2}
              strokeDasharray="5 3"
              dot={false}
              isAnimationActive={!prefersReducedMotion()}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-center gap-4 mt-1 text-[10px] font-heading uppercase tracking-wider">
        <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
          <svg width="18" height="4" aria-hidden="true">
            <line x1="0" y1="2" x2="18" y2="2" stroke={homeColor} strokeWidth="2" />
          </svg>
          {homeTeamName} {final.home.toFixed(2)}
        </span>
        <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
          <svg width="18" height="4" aria-hidden="true">
            <line
              x1="0"
              y1="2"
              x2="18"
              y2="2"
              stroke={awayColor}
              strokeWidth="2"
              strokeDasharray="5 3"
            />
          </svg>
          {awayTeamName} {final.away.toFixed(2)}
        </span>
      </div>
    </figure>
  );
}
