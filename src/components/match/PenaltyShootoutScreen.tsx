import { useEffect, useRef, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { GameStateData } from "../../store/gameStore";
import type { MatchdayIdentity } from "../../lib/competitionName";
import MatchdayShell from "./MatchdayShell";
import { stepLiveMatch } from "../../services/matchService";
import { resolveMatchStep } from "./MatchStepReducer.helpers";
import {
  MatchSnapshot,
  MatchEvent,
  SimSpeed,
  SPEED_MS,
} from "./types";
import {
  Play, Pause, FastForward, SkipForward,
} from "lucide-react";
import { TeamLogo } from "../ui";

interface PenaltyShootoutScreenProps {
  matchdayIdentity: MatchdayIdentity;
  snapshot: MatchSnapshot;
  gameState: GameStateData;
  userSide: "Home" | "Away" | null;
  isSpectator: boolean;
  importantEvents: MatchEvent[];
  onSnapshotUpdate: (snap: MatchSnapshot) => void;
  onImportantEvent: (evt: MatchEvent) => void;
  onFullTime: () => void;
}

// Only true shootout kicks: an in-match PenaltyAwarded from regulation/ET
// lives in the same snapshot.events log and must not appear in this feed.
const SHOOTOUT_EVENTS = new Set([
  "ShootoutGoal",
  "ShootoutMiss",
]);

export default function PenaltyShootoutScreen({
  matchdayIdentity,
  snapshot,
  gameState,
  onSnapshotUpdate,
  onImportantEvent,
  onFullTime,
}: PenaltyShootoutScreenProps) {
  const { t } = useTranslation();
  const [speed, setSpeed] = useState<SimSpeed>("normal");
  const [isRunning, setIsRunning] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const signaledRef = useRef(false);

  const homeFullTeam = gameState.teams.find(
    (tm) => tm.id === snapshot.home_team.id,
  );
  const awayFullTeam = gameState.teams.find(
    (tm) => tm.id === snapshot.away_team.id,
  );

  const ps = snapshot.penalty_shootout;
  const roundNumber = ps ? Math.max(ps.home_taken, ps.away_taken) : 0;

  // A kick folds its response into the shootout on screen, and has to fold it
  // into the newest one rather than whichever the timer closed over.
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  const stepMatch = useCallback(async () => {
    try {
      // Always one at a time, never batched like the live match: here a "minute" is a single
      // penalty, and the whole point of the screen is watching each one.
      const response = await stepLiveMatch(1);
      const results = response.minutes;
      if (results.length > 0) {
        for (const r of results) {
          for (const evt of r.events) {
            if (SHOOTOUT_EVENTS.has(evt.event_type)) {
              onImportantEvent(evt);
            }
          }
        }

        const next = await resolveMatchStep(snapshotRef.current, response);
        if (next) onSnapshotUpdate(next);

        const lastResult = results[results.length - 1];
        if (lastResult.is_finished && !signaledRef.current) {
          signaledRef.current = true;
          setIsRunning(false);
          setSpeed("paused");
          setTimeout(() => onFullTime(), 800);
        }
      }
    } catch (err) {
      console.error("Failed to step penalty shootout:", err);
      setIsRunning(false);
    }
  }, [onSnapshotUpdate, onImportantEvent, onFullTime]);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (isRunning && speed !== "paused") {
      timerRef.current = setTimeout(async () => {
        await stepMatch();
      }, SPEED_MS[speed]);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isRunning, speed, snapshot.current_minute, snapshot.phase, stepMatch]);

  const shootoutEvents = snapshot.events.filter((e) =>
    SHOOTOUT_EVENTS.has(e.event_type),
  );

  return (
    <MatchdayShell
      bodyMode="centered"
      header={
        /*
          The shootout is the same match still being decided, so it reads like
          one: the score and the round sit beside the competition, and the
          transport is beside them rather than stranded below the kick feed.
        */
        <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-3">
          <p className="font-heading text-xs uppercase tracking-widest text-accent-600 dark:text-accent-400">
            {ps?.sudden_death
              ? t("match.shootout.suddenDeath")
              : roundNumber > 0
                ? t("match.shootout.round", { n: roundNumber })
                : t("match.penaltyShootout")}
          </p>

          <div className="flex items-center gap-3">
            <span className="truncate font-heading font-bold text-gray-800 dark:text-gray-200">
              {snapshot.home_team.name}
            </span>
            <span className="font-heading text-2xl font-bold tabular-nums text-gray-900 dark:text-white">
              {ps?.home_scored ?? 0}
            </span>
            <span className="font-heading text-gray-400 dark:text-gray-500">–</span>
            <span className="font-heading text-2xl font-bold tabular-nums text-gray-900 dark:text-white">
              {ps?.away_scored ?? 0}
            </span>
            <span className="truncate font-heading font-bold text-gray-800 dark:text-gray-200">
              {snapshot.away_team.name}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              aria-label={isRunning ? t("match.pause") : t("match.live")}
              className="rounded-full bg-white p-2 shadow transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 motion-reduce:transition-none dark:bg-navy-700 dark:hover:bg-navy-600 dark:focus-visible:ring-offset-navy-900"
              onClick={() => {
                setIsRunning((running) => !running);
                setSpeed(isRunning ? "paused" : "normal");
              }}
              type="button"
            >
              {isRunning ? (
                <Pause aria-hidden="true" className="h-5 w-5 text-gray-700 dark:text-gray-200" />
              ) : (
                <Play aria-hidden="true" className="h-5 w-5 text-gray-700 dark:text-gray-200" />
              )}
            </button>
            <button
              aria-label={t("match.fast")}
              className="rounded-full bg-white p-2 shadow transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 motion-reduce:transition-none dark:bg-navy-700 dark:hover:bg-navy-600 dark:focus-visible:ring-offset-navy-900"
              onClick={() => {
                setSpeed("fast");
                setIsRunning(true);
              }}
              type="button"
            >
              <FastForward aria-hidden="true" className="h-5 w-5 text-gray-700 dark:text-gray-200" />
            </button>
            <button
              aria-label={t("match.shootout.stepKick")}
              className="rounded-full bg-white p-2 shadow transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 motion-reduce:transition-none dark:bg-navy-700 dark:hover:bg-navy-600 dark:focus-visible:ring-offset-navy-900"
              onClick={() => {
                setIsRunning(false);
                void stepMatch();
              }}
              type="button"
            >
              <SkipForward aria-hidden="true" className="h-5 w-5 text-gray-700 dark:text-gray-200" />
            </button>
          </div>
        </div>
      }
      identity={matchdayIdentity}
    >
      <div className="flex flex-col items-center">
      {/* Score card */}
      <div className="w-full max-w-lg bg-white dark:bg-navy-800 rounded-2xl shadow-lg p-6 mb-4">
        <div className="flex items-center justify-between gap-4">
          {/* Home */}
          <div className="flex flex-col items-center gap-2 flex-1">
            {homeFullTeam && <TeamLogo team={homeFullTeam} />}
            <span className="font-heading font-semibold text-gray-900 dark:text-white text-sm text-center">
              {snapshot.home_team.name}
            </span>
            <span className="text-3xl font-heading font-bold text-gray-900 dark:text-white tabular-nums">
              {ps?.home_scored ?? 0}
            </span>
          </div>

          {/* vs */}
          <div className="text-gray-400 dark:text-gray-500 font-heading font-bold text-xl">
            –
          </div>

          {/* Away */}
          <div className="flex flex-col items-center gap-2 flex-1">
            {awayFullTeam && <TeamLogo team={awayFullTeam} />}
            <span className="font-heading font-semibold text-gray-900 dark:text-white text-sm text-center">
              {snapshot.away_team.name}
            </span>
            <span className="text-3xl font-heading font-bold text-gray-900 dark:text-white tabular-nums">
              {ps?.away_scored ?? 0}
            </span>
          </div>
        </div>

        {/* Kick grid */}
        {ps && (
          <div className="mt-6 space-y-3">
            <KickRow
              events={snapshot.events}
              label={snapshot.home_team.name}
              maxRounds={ps.sudden_death ? ps.home_taken + 1 : 5}
              scored={ps.home_scored}
              side="Home"
              taken={ps.home_taken}
            />
            <KickRow
              events={snapshot.events}
              label={snapshot.away_team.name}
              maxRounds={ps.sudden_death ? ps.away_taken + 1 : 5}
              scored={ps.away_scored}
              side="Away"
              taken={ps.away_taken}
            />
          </div>
        )}
      </div>

      {/* Event feed */}
      {shootoutEvents.length > 0 && (
        <div className="w-full max-w-lg bg-white dark:bg-navy-800 rounded-xl p-4 mb-4 space-y-1">
          {shootoutEvents.slice(-8).map((evt, i) => (
            <div
              key={i}
              className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
            >
              <span className="text-gray-400 dark:text-gray-500 tabular-nums w-6 text-right">
                {evt.minute}&apos;
              </span>
              <span
                className={
                  evt.event_type === "ShootoutGoal"
                    ? "text-green-600 dark:text-green-400 font-semibold"
                    : "text-red-500 dark:text-red-400"
                }
              >
                {evt.event_type === "ShootoutGoal" ? "⚽" : "✗"}
              </span>
              <span>
                {evt.side === "Home"
                  ? snapshot.home_team.name
                  : snapshot.away_team.name}
              </span>
            </div>
          ))}
        </div>
      )}

      </div>
    </MatchdayShell>
  );
}

/** What happened to one kick, in the order it was taken. */
type KickOutcome = "scored" | "missed" | "pending";

/**
 * The kicks a side has taken, in order.
 *
 * Counts cannot answer this. Two of three scored says nothing about *which*
 * one was missed, and drawing the first two as goals put the miss on the wrong
 * kick whenever a side missed and then scored. The events know.
 */
function kicksTaken(events: MatchEvent[], side: "Home" | "Away"): KickOutcome[] {
  return events
    .filter(
      (event) => event.side === side && SHOOTOUT_EVENTS.has(event.event_type),
    )
    .map((event) => (event.event_type === "ShootoutGoal" ? "scored" : "missed"));
}

export function KickRow({
  label,
  taken,
  scored,
  maxRounds,
  events,
  side,
}: {
  label: string;
  maxRounds: number;
  /**
   * The shootout's events. With them the row can say which kick was missed;
   * `taken` and `scored` are only enough to say how many were.
   */
  events?: MatchEvent[];
  side?: "Home" | "Away";
  taken?: number;
  scored?: number;
}) {
  const { t } = useTranslation();

  const outcomes =
    events && side
      ? kicksTaken(events, side)
      : // No event log: the best that can be said is how many went in, and the
        // order shown is a guess. Only reachable before a kick is taken.
        Array.from({ length: taken ?? 0 }, (_, index) =>
          index < (scored ?? 0) ? "scored" : "missed",
        );

  const cells = Math.max(maxRounds, outcomes.length);

  return (
    <div className="flex items-center gap-3">
      <span className="w-20 truncate text-right text-xs text-gray-500 dark:text-gray-400">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: cells }).map((_, index) => {
          const outcome: KickOutcome = outcomes[index] ?? "pending";
          // Named, because a green ball and a red cross are a colour and a
          // pictograph — nothing a screen reader can read, and nothing a
          // colour-blind manager can tell apart.
          const name = t(
            outcome === "scored"
              ? "match.shootout.kickScored"
              : outcome === "missed"
                ? "match.shootout.kickMissed"
                : "match.shootout.kickPending",
            { n: index + 1, team: label },
          );

          if (outcome === "pending") {
            return (
              <span
                aria-label={name}
                className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-gray-200 text-xs text-gray-400 dark:border-gray-600 dark:text-gray-500"
                key={index}
                role="img"
              >
                ?
              </span>
            );
          }

          return (
            <span
              aria-label={name}
              className={`flex h-6 w-6 items-center justify-center rounded-full text-sm ${
                outcome === "scored"
                  ? "bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400"
                  : "bg-red-100 text-red-500 dark:bg-red-900/40 dark:text-red-400"
              }`}
              key={index}
              role="img"
            >
              {outcome === "scored" ? "\u26bd" : "\u2717"}
            </span>
          );
        })}
      </div>
    </div>
  );
}
