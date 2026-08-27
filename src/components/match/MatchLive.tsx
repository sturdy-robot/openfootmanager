import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { GameStateData } from "../../store/gameStore";
import { applyMatchTactics, stepLiveMatch } from "../../services/matchService";
import { FORMATIONS, MINUTES_PER_TICK, PLAY_STYLES, SPEED_MS, isPersistableSpeed, type EnginePlayerData, type MatchEvent, type MatchSnapshot, type Side, type SimSpeed } from "./types";
import { getEventDisplay, makeTeamFallback, phaseLabel } from "./helpers";
import { PitchToken, Select, TeamLogo, type PitchTokenMarker } from "../ui";
import { useSettingsStore } from "../../store/settingsStore";
import { EventFeed, MatchStats, Lineups } from "./MatchPanels";
import type { MatchdayIdentity } from "../../lib/competitionName";
import MatchdayShell from "./MatchdayShell";
import { SubPanel } from "./SubPanel";
import {
  EMPTY_MATCH_DRAFT,
  buildMatchTacticsChangeSet,
  type MatchDraft,
} from "./MatchDraft.helpers";
import { buildNaturalPositionMap } from "./SubPanel.helpers";
import { resolveMatchStep } from "./MatchStepReducer.helpers";
import { nextTabIndex } from "./tablistNavigation";
import { resolveBackendError } from "../../utils/backendI18n";
import { FormationPitch } from "./FormationPitch";
import { translatePositionAbbreviation } from "../squad/SquadTab.helpers";
import type { KitPattern } from "../../store/types";
import {
  Play, Pause, FastForward, SkipForward,
  Users, BarChart3, MessageSquare, RefreshCw,
  ChevronRight,
} from "lucide-react";

type ActivePanel = "events" | "stats" | "lineups";

interface MatchLiveProps {
  matchdayIdentity: MatchdayIdentity;
  snapshot: MatchSnapshot;
  gameState: GameStateData;
  userSide: Side | null;
  isSpectator: boolean;
  importantEvents: MatchEvent[];
  preferredSpeed?: "slow" | "normal" | "fast";
  onPreferredSpeedChange?: (speed: "slow" | "normal" | "fast") => void;
  onSnapshotUpdate: (snap: MatchSnapshot) => void;
  onImportantEvent: (evt: MatchEvent) => void;
  onHalfTime: (phase: "HalfTime" | "ExtraTimeHalfTime") => void;
  onFullTime: () => void;
  onPenaltyShootout?: () => void;
}

export default function MatchLive({
  matchdayIdentity,
  snapshot, gameState, userSide, isSpectator,
  importantEvents, preferredSpeed, onPreferredSpeedChange,
  onSnapshotUpdate, onImportantEvent,
  onHalfTime, onFullTime, onPenaltyShootout,
}: MatchLiveProps) {
  const { t } = useTranslation();
  const { settings } = useSettingsStore();
  const initialSpeed: SimSpeed = preferredSpeed
    ?? ((settings.match_speed === "slow" || settings.match_speed === "fast") ? settings.match_speed : "normal");
  const [speed, setSpeed] = useState<SimSpeed>(initialSpeed);
  const [activePanel, setActivePanel] = useState<ActivePanel>("events");
  const [isRunning, setIsRunning] = useState(true);
  const [showSubPanel, setShowSubPanel] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eventFeedRef = useRef<HTMLDivElement>(null);
  // Track phases we've already signaled to avoid double-firing
  const signaledRef = useRef<Set<string>>(new Set());

  const homeFullTeam = gameState.teams.find(t => t.id === snapshot.home_team.id);
  const awayFullTeam = gameState.teams.find(t => t.id === snapshot.away_team.id);
  const homeTeamColor = homeFullTeam?.colors?.primary ?? "#10b981";
  const awayTeamColor = awayFullTeam?.colors?.primary ?? "#6366f1";
  const homeTeamSecondary = homeFullTeam?.colors?.secondary ?? "#1a3a6b";
  const awayTeamSecondary = awayFullTeam?.colors?.secondary ?? "#1a3a6b";
  const homeKitPattern: KitPattern = homeFullTeam?.kit_pattern ?? "Solid";
  const awayKitPattern: KitPattern = awayFullTeam?.kit_pattern ?? "Solid";

  const playerById = useMemo(() => {
    return new Map(gameState.players.map((player) => [player.id, player]));
  }, [gameState.players]);

  // The engine knows four coarse buckets; the store knows a left-back is a
  // left-back (#371).
  const naturalPositionById = useMemo(
    () => buildNaturalPositionMap(gameState.players),
    [gameState.players],
  );

  const playerJerseyMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of gameState.players) {
      if (p.jersey_number != null) m.set(p.id, p.jersey_number);
    }
    return m;
  }, [gameState.players]);

  const isFinished = snapshot.phase === "Finished";

  // A step folds its response into the match on screen, and has to fold it
  // into the newest one — not whichever it closed over when the timer that
  // fired it was scheduled.
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  const renderLiveToken = (
    player: EnginePlayerData,
    slotPosition: string | undefined,
    yellows: Record<string, number>,
    primaryColor: string,
    secondaryColor: string,
    pattern: KitPattern,
  ) => {
    const fullPlayer = playerById.get(player.id);
    const markers: PitchTokenMarker[] = [];

    if (snapshot.sent_off.includes(player.id)) {
      markers.push({
        key: "red-card",
        label: t("match.eventTypes.RedCard"),
        shortLabel: "🟥",
        // These markers sit on turf in both themes, so their card colours do
        // not change when the surrounding chrome changes theme.
        toneClassName: "border-red-200 bg-red-500 text-white",
      });
    } else if ((yellows[player.id] ?? 0) > 0) {
      markers.push({
        key: "yellow-card",
        label: t("match.eventTypes.YellowCard"),
        shortLabel: "🟨",
        toneClassName: "border-yellow-200 bg-yellow-400 text-navy-900",
      });
    }

    return (
      <div className="w-20">
        <PitchToken
          avatar={
            fullPlayer
              ? {
                  full_name: fullPlayer.full_name,
                  match_name: fullPlayer.match_name,
                  media: fullPlayer.media,
                }
              : { full_name: player.name, match_name: player.name }
          }
          condition={player.condition}
          displayMode="live"
          jersey={{
            primaryColor,
            secondaryColor,
            pattern,
            number: fullPlayer?.jersey_number,
          }}
          jerseyNumber={fullPlayer?.jersey_number}
          markers={markers}
          name={player.name}
          ovr={player.ovr}
          position={slotPosition ?? player.position}
          positionAbbr={translatePositionAbbreviation(
            t,
            slotPosition ?? player.position,
          )}
        />
      </div>
    );
  };

  // Reads only `lastResult` for phase transitions, which is sound because step_many stops on
  // entering any phase that needs the manager — so a half time, shootout or finish is always the
  // last entry of a batch, never buried in the middle. See `phase_needs_manager` in
  // ofm_core/live_match_manager.rs; MINUTES_PER_TICK on this side is what makes batches possible.
  const stepMatch = useCallback(async (minutes: number) => {
    try {
      const response = await stepLiveMatch(minutes);
      const results = response.minutes;
      if (results.length > 0) {
        const lastResult = results[results.length - 1];

        // Collect important events
        for (const r of results) {
          for (const evt of r.events) {
            const display = getEventDisplay(evt);
            if (display.important) {
              onImportantEvent(evt);
            }
          }
        }

        const next = await resolveMatchStep(snapshotRef.current, response);
        if (next) onSnapshotUpdate(next);

        // Check for phase transitions that should pause
        const phase = lastResult.phase;
        if (phase === "HalfTime" && !signaledRef.current.has("HalfTime")) {
          signaledRef.current.add("HalfTime");
          setIsRunning(false);
          setSpeed("paused");
          // Small delay so the last event renders before transitioning
          setTimeout(() => onHalfTime("HalfTime"), 600);
          return;
        }

        if (phase === "ExtraTimeHalfTime" && !signaledRef.current.has("ExtraTimeHalfTime")) {
          signaledRef.current.add("ExtraTimeHalfTime");
          setIsRunning(false);
          setSpeed("paused");
          setTimeout(() => onHalfTime("ExtraTimeHalfTime"), 600);
          return;
        }

        if (phase === "PenaltyShootout" && !signaledRef.current.has("PenaltyShootout")) {
          signaledRef.current.add("PenaltyShootout");
          setIsRunning(false);
          setSpeed("paused");
          setTimeout(() => onPenaltyShootout?.(), 600);
          return;
        }

        if (lastResult.is_finished && !signaledRef.current.has("Finished")) {
          signaledRef.current.add("Finished");
          setIsRunning(false);
          setSpeed("paused");
          setTimeout(() => onFullTime(), 600);
          return;
        }
      }
    } catch (err) {
      console.error("Failed to step match:", err);
      setIsRunning(false);
    }
  }, [onSnapshotUpdate, onImportantEvent, onHalfTime, onFullTime, onPenaltyShootout]);

  // Auto-step timer
  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (isRunning && speed !== "paused" && !isFinished && !showSubPanel) {
      timerRef.current = setTimeout(async () => {
        await stepMatch(MINUTES_PER_TICK[speed]);
      }, SPEED_MS[speed]);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isRunning, speed, snapshot.current_minute, snapshot.phase, stepMatch, isFinished, showSubPanel]);

  // Auto-scroll event feed
  useEffect(() => {
    if (eventFeedRef.current) {
      eventFeedRef.current.scrollTop = eventFeedRef.current.scrollHeight;
    }
  }, [importantEvents.length]);

  // Apply substitution

  const handleSubmitDraft = async (draft: MatchDraft) => {
    if (!userSide || isSpectator) return;
    try {
      const snap = await applyMatchTactics(
        buildMatchTacticsChangeSet({ draft, side: userSide, snapshot }),
      );
      onSnapshotUpdate(snap);
      setSubmissionError(null);
      setShowSubPanel(false);
    } catch (err) {
      // The panel stays open with the queue intact: a refusal is a correction,
      // not a restart, and the manager cannot correct what has been closed.
      console.error("In-match change set failed:", err);
      setSubmissionError(resolveBackendError(err));
    }
  };

  /**
   * A change from the dugout bar goes the same way as one from the panel.
   *
   * `ChangeFormation` and `ChangePlayStyle` land in the engine the moment they
   * arrive, so keeping them here left two ways to manage a match — one atomic,
   * one not — and a shape committed from the bar while substitutions were
   * still queued in the panel.
   */
  const submitTacticalChange = async (change: Partial<MatchDraft>) => {
    if (!userSide || isSpectator) return;
    try {
      const snap = await applyMatchTactics(
        buildMatchTacticsChangeSet({
          draft: { ...EMPTY_MATCH_DRAFT, ...change },
          side: userSide,
          // The newest match, not the one this render closed over. A change
          // set replaces the side's whole tactical state, so building it from
          // a snapshot a tick old would send a departed player's role — and
          // the dugout bar is the one control usable while the clock runs.
          snapshot: snapshotRef.current,
        }),
      );
      onSnapshotUpdate(snap);
    } catch (err) {
      console.error("In-match tactical change failed:", err);
      setSubmissionError(resolveBackendError(err));
    }
  };

  const handleFormationChange = (formation: string) =>
    submitTacticalChange({ formation });

  const handlePlayStyleChange = (playStyle: string) =>
    submitTacticalChange({ playStyle });

  const userTeam = userSide === "Home" ? snapshot.home_team : snapshot.away_team;
  const userSubsMade = userSide === "Home"
    ? snapshot.home_subs_made
    : snapshot.away_subs_made;

  return (
    <MatchdayShell
      bodyMode="frame"
      identity={matchdayIdentity}
      footer={
        !isSpectator && userSide ? (
          <div className="border-t border-gray-200 bg-white px-6 py-3 dark:border-navy-700 dark:bg-navy-800">
            <div className="mx-auto flex max-w-page flex-wrap items-center gap-3">
              <span className="font-heading text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                {t("match.dugout")}
              </span>
              <button
                className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 font-heading text-xs font-bold uppercase tracking-wider text-gray-700 transition-colors hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 dark:bg-navy-700 dark:text-gray-200 dark:hover:bg-navy-600 dark:focus-visible:ring-primary-400 dark:focus-visible:ring-offset-navy-800"
                onClick={() => {
                  // Reopening starts clean: a refusal the manager has already
                  // acted on should not still be on screen next time.
                  setSubmissionError(null);
                  setShowSubPanel((visible) => !visible);
                }}
                type="button"
              >
                <RefreshCw aria-hidden="true" className="h-4 w-4" />
                {t("match.manageTeamWithSubs", {
                  max: snapshot.max_subs,
                  used: userSubsMade,
                })}
              </button>
              <Select
                aria-label={t("match.formation")}
                onChange={(event) => void handleFormationChange(event.target.value)}
                selectSize="sm"
                value={userTeam.formation}
              >
                {FORMATIONS.map((formation) => (
                  <option key={formation} value={formation}>
                    {formation}
                  </option>
                ))}
              </Select>
              <Select
                aria-label={t("match.playStyle")}
                onChange={(event) => void handlePlayStyleChange(event.target.value)}
                selectSize="sm"
                value={userTeam.play_style}
              >
                {PLAY_STYLES.map((style) => (
                  <option key={style} value={style}>
                    {t(`common.playStyles.${style}`, style)}
                  </option>
                ))}
              </Select>
              {/*
                A change made from here can be refused too, and the panel that
                normally carries the reason is closed. Shown only while it is,
                so a refusal is never reported twice.
              */}
              {!showSubPanel && submissionError ? (
                <p
                  className="w-full rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300"
                  role="alert"
                >
                  {submissionError}
                </p>
              ) : null}
            </div>
          </div>
        ) : undefined
      }
      header={
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {isRunning ? (
                <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 motion-safe:animate-ping" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                </span>
              ) : null}
              <span className="font-heading text-xs uppercase tracking-widest text-gray-500 dark:text-gray-400">
                {isRunning ? t("match.live") : t("match.paused")}
              </span>
            </div>

            <div className="flex items-center gap-4 lg:gap-6">
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <p className="font-heading text-sm font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                    {snapshot.home_team.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {snapshot.home_team.formation}
                  </p>
                </div>
                <TeamLogo
                  className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg font-heading text-sm font-bold"
                  imageClassName="h-8 w-8 object-contain drop-shadow"
                  style={{
                    backgroundColor: `${homeTeamColor}30`,
                    borderColor: homeTeamColor,
                    borderWidth: 2,
                  }}
                  team={homeFullTeam ?? makeTeamFallback(snapshot.home_team.name)}
                />
              </div>

              <div className="flex items-center gap-3">
                <span className="font-heading text-4xl font-bold tabular-nums text-gray-900 dark:text-white">
                  {snapshot.home_score}
                </span>
                <div className="flex flex-col items-center">
                  <span className="font-heading text-xs uppercase tracking-widest text-accent-700 dark:text-accent-400">
                    {phaseLabel(snapshot.phase, t)}
                  </span>
                  <span className="font-heading text-2xl font-bold text-gray-500 dark:text-gray-400">
                    {snapshot.current_minute}'
                  </span>
                </div>
                <span className="font-heading text-4xl font-bold tabular-nums text-gray-900 dark:text-white">
                  {snapshot.away_score}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <TeamLogo
                  className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg font-heading text-sm font-bold"
                  imageClassName="h-8 w-8 object-contain drop-shadow"
                  style={{
                    backgroundColor: `${awayTeamColor}30`,
                    borderColor: awayTeamColor,
                    borderWidth: 2,
                  }}
                  team={awayFullTeam ?? makeTeamFallback(snapshot.away_team.name)}
                />
                <div>
                  <p className="font-heading text-sm font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                    {snapshot.away_team.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {snapshot.away_team.formation}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {([
                { id: "paused" as SimSpeed, icon: <Pause className="h-4 w-4" />, label: t("match.pause") },
                { id: "slow" as SimSpeed, icon: <Play className="h-3.5 w-3.5" />, label: t("match.slow") },
                { id: "normal" as SimSpeed, icon: <Play className="h-4 w-4" />, label: t("match.normal") },
                { id: "fast" as SimSpeed, icon: <FastForward className="h-4 w-4" />, label: t("match.fast") },
                { id: "instant" as SimSpeed, icon: <SkipForward className="h-4 w-4" />, label: t("match.max") },
              ]).map((control) => (
                <button
                  aria-label={control.label}
                  aria-pressed={speed === control.id}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 dark:focus-visible:ring-primary-400 dark:focus-visible:ring-offset-navy-900 ${
                    speed === control.id
                      ? "bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-300"
                      : "text-gray-500 hover:bg-gray-200 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-navy-700 dark:hover:text-gray-200"
                  }`}
                  key={control.id}
                  onClick={() => {
                    setSpeed(control.id);
                    setIsRunning(control.id !== "paused");
                    if (isPersistableSpeed(control.id)) {
                      onPreferredSpeedChange?.(control.id);
                    }
                  }}
                  title={control.label}
                  type="button"
                >
                  {control.icon}
                </button>
              ))}
              {speed === "paused" ? (
                <button
                  className="ml-1 flex items-center gap-1 rounded-lg bg-gray-100 px-2 py-2 font-heading text-xs font-bold uppercase tracking-wider text-gray-700 transition-colors hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 dark:bg-navy-700 dark:text-gray-200 dark:hover:bg-navy-600 dark:focus-visible:ring-primary-400 dark:focus-visible:ring-offset-navy-900"
                  onClick={() => void stepMatch(1)}
                  type="button"
                >
                  <ChevronRight aria-hidden="true" className="h-4 w-4" />
                  {t("match.step1Min")}
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="w-12 text-right font-heading font-bold text-primary-600 dark:text-primary-400">
              {snapshot.home_possession_pct.toFixed(0)}%
            </span>
            <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-gray-300 transition-colors dark:bg-navy-700">
              <div
                className="h-full bg-primary-500 transition-all duration-500 motion-reduce:transition-none dark:bg-primary-500"
                style={{ width: `${snapshot.home_possession_pct}%` }}
              />
              <div
                className="h-full bg-accent-500 transition-all duration-500 motion-reduce:transition-none dark:bg-accent-500"
                style={{ width: `${snapshot.away_possession_pct}%` }}
              />
            </div>
            <span className="w-12 font-heading font-bold text-accent-600 dark:text-accent-400">
              {snapshot.away_possession_pct.toFixed(0)}%
            </span>
          </div>
        </>
      }
    >
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-auto xl:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)] xl:overflow-hidden">
        <div className="grid min-h-0 grid-cols-2 gap-3 overflow-hidden bg-gray-100 p-3 dark:bg-navy-900">
          <div className="flex min-h-0 items-center justify-center overflow-hidden">
            <FormationPitch
              className="max-h-full max-w-full"
              formation={snapshot.home_team.formation}
              label={snapshot.home_team.name}
              players={snapshot.home_team.players}
              renderToken={(player, state) =>
                renderLiveToken(
                  player,
                  state.slotPosition,
                  snapshot.home_yellows,
                  homeTeamColor,
                  homeTeamSecondary,
                  homeKitPattern,
                )
              }
            />
          </div>
          <div className="flex min-h-0 items-center justify-center overflow-hidden">
            <FormationPitch
              className="max-h-full max-w-full"
              formation={snapshot.away_team.formation}
              label={snapshot.away_team.name}
              orientation="mirrored"
              players={snapshot.away_team.players}
              renderToken={(player, state) =>
                renderLiveToken(
                  player,
                  state.slotPosition,
                  snapshot.away_yellows,
                  awayTeamColor,
                  awayTeamSecondary,
                  awayKitPattern,
                )
              }
            />
          </div>
        </div>

        <aside className="flex min-h-0 flex-col border-l border-gray-200 bg-white transition-colors dark:border-navy-700 dark:bg-navy-800">
          <div
            aria-label={t("match.matchPanels")}
            className="flex border-b border-gray-200 dark:border-navy-700"
            role="tablist"
          >
            {([
              { id: "events" as ActivePanel, label: t("match.events"), icon: <MessageSquare className="h-4 w-4" /> },
              { id: "stats" as ActivePanel, label: t("match.stats"), icon: <BarChart3 className="h-4 w-4" /> },
              { id: "lineups" as ActivePanel, label: t("match.lineups"), icon: <Users className="h-4 w-4" /> },
            ]).map((tab, index, tabs) => (
              <button
                aria-controls={`match-${tab.id}-panel`}
                aria-selected={activePanel === tab.id}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 font-heading text-xs font-bold uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-400 dark:focus-visible:ring-primary-400 ${
                  activePanel === tab.id
                    ? "border-primary-500 bg-primary-50 text-primary-600 dark:border-primary-400 dark:bg-primary-500/10 dark:text-primary-300"
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
                id={`match-${tab.id}-tab`}
                key={tab.id}
                onClick={() => setActivePanel(tab.id)}
                onKeyDown={(event) => {
                  // The roving tabindex takes every unselected tab out of the
                  // tab order, which is the point of it — but only if the
                  // arrows put them back within reach. Without this the
                  // pattern is worse than plain buttons were.
                  const next = nextTabIndex(index, tabs.length, event.key);
                  if (next === null) return;
                  event.preventDefault();
                  setActivePanel(tabs[next].id);
                  document
                    .getElementById(`match-${tabs[next].id}-tab`)
                    ?.focus();
                }}
                role="tab"
                tabIndex={activePanel === tab.id ? 0 : -1}
                type="button"
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          <div
            aria-labelledby={`match-${activePanel}-tab`}
            className="min-h-0 flex-1 overflow-auto p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-400 dark:focus-visible:ring-primary-400"
            id={`match-${activePanel}-panel`}
            role="tabpanel"
            tabIndex={0}
          >
            {activePanel === "events" ? (
              <EventFeed
                events={importantEvents}
                feedRef={eventFeedRef}
                playerJerseyMap={playerJerseyMap}
                snapshot={snapshot}
              />
            ) : null}
            {activePanel === "stats" ? <MatchStats snapshot={snapshot} /> : null}
            {activePanel === "lineups" ? <Lineups snapshot={snapshot} /> : null}
          </div>
        </aside>
      </div>

      {showSubPanel && userSide ? (
        <SubPanel
          naturalPositionById={naturalPositionById}
          onClose={() => setShowSubPanel(false)}
          onSubmitDraft={(draft) => {
            void handleSubmitDraft(draft);
          }}
          side={userSide}
          snapshot={snapshot}
          submissionError={submissionError}
        />
      ) : null}
    </MatchdayShell>
  );
}
