import { useState } from "react";
import { useTranslation } from "react-i18next";
import { GameStateData } from "../../store/gameStore";
import type { MatchdayIdentity } from "../../lib/competitionName";
import MatchdayShell from "./MatchdayShell";
import {
  applyMatchTactics,
  applyTeamTalk,
  type TeamTalkMoraleChange,
} from "../../services/matchService";
import {
  MatchSnapshot,
  MatchEvent,
  FORMATIONS,
  PLAY_STYLES,
  getTeamTalkOptions,
  TeamTalkTone,
} from "./types";
import { getEventDisplay, getPlayerName, makeTeamFallback } from "./helpers";
import { getTalkIcon } from "./TeamTalkIcons";
import { SubPanel } from "./SubPanel";
import {
  EMPTY_MATCH_DRAFT,
  buildMatchTacticsChangeSet,
  type MatchDraft,
} from "./MatchDraft.helpers";
import { buildNaturalPositionMap } from "./SubPanel.helpers";
import { resolveBackendError } from "../../utils/backendI18n";
import { Badge, Select, TeamLogo } from "../ui";
import {
  Play,
  RefreshCw,
  MessageCircle,
} from "lucide-react";

interface HalfTimeBreakProps {
  matchdayIdentity: MatchdayIdentity;
  snapshot: MatchSnapshot;
  gameState: GameStateData;
  userSide: "Home" | "Away";
  isSpectator: boolean;
  importantEvents: MatchEvent[];
  onResume: () => void;
  onUpdateSnapshot: (snap: MatchSnapshot) => void;
}

export default function HalfTimeBreak({
  matchdayIdentity,
  snapshot,
  gameState,
  userSide,
  isSpectator,
  importantEvents,
  onResume,
  onUpdateSnapshot,
}: HalfTimeBreakProps) {
  const { t } = useTranslation();
  const teamTalkOptions = getTeamTalkOptions(t);
  const [selectedTalk, setSelectedTalk] = useState<TeamTalkTone | null>(null);
  const [showSubPanel, setShowSubPanel] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [talkDelivered, setTalkDelivered] = useState(false);
  const [talkResults, setTalkResults] = useState<TeamTalkMoraleChange[]>([]);

  const homeFullTeam = gameState.teams.find((t) => t.id === snapshot.home_team.id);
  const awayFullTeam = gameState.teams.find((t) => t.id === snapshot.away_team.id);
  const homeTeamColor = homeFullTeam?.colors?.primary || "#10b981";
  const awayTeamColor = awayFullTeam?.colors?.primary || "#6366f1";

  const userTeam =
    userSide === "Home" ? snapshot.home_team : snapshot.away_team;

  // First half key events
  const firstHalfEvents = importantEvents.filter((e) =>
    [
      "Goal",
      "PenaltyGoal",
      "YellowCard",
      "RedCard",
      "SecondYellow",
      "Injury",
      "PenaltyMiss",
    ].includes(e.event_type),
  );

  // Half time is the break where a manager makes several changes at once, so
  // it is the one that most needed them to land together.
  const handleSubmitDraft = async (draft: MatchDraft) => {
    try {
      const snap = await applyMatchTactics(
        buildMatchTacticsChangeSet({ draft, side: userSide, snapshot }),
      );
      onUpdateSnapshot(snap);
      setSubmissionError(null);
      setShowSubPanel(false);
    } catch (err) {
      console.error("Half-time change set failed:", err);
      setSubmissionError(resolveBackendError(err));
    }
  };

  /**
   * A shape chosen at the break goes the same way as everything else.
   *
   * Half time is when several changes are made at once, so a formation that
   * committed on its own while the substitutions were still queued was the
   * split this step exists to close.
   */
  const submitTacticalChange = async (change: Partial<MatchDraft>) => {
    try {
      const snap = await applyMatchTactics(
        buildMatchTacticsChangeSet({
          draft: { ...EMPTY_MATCH_DRAFT, ...change },
          side: userSide,
          snapshot,
        }),
      );
      onUpdateSnapshot(snap);
      setSubmissionError(null);
    } catch (err) {
      console.error("Half-time tactical change failed:", err);
      setSubmissionError(resolveBackendError(err));
    }
  };

  const handleFormationChange = (formation: string) =>
    submitTacticalChange({ formation });

  const handlePlayStyleChange = (playStyle: string) =>
    submitTacticalChange({ playStyle });


  const handleDeliverTalk = async () => {
    if (!selectedTalk) return;
    const userScore =
      userSide === "Home" ? snapshot.home_score : snapshot.away_score;
    const oppScore =
      userSide === "Home" ? snapshot.away_score : snapshot.home_score;
    const context =
      userScore > oppScore
        ? "winning"
        : userScore < oppScore
          ? "losing"
          : "drawing";
    try {
      const results = await applyTeamTalk(selectedTalk, context);
      setTalkResults(results);
    } catch (err) {
      console.error("Team talk failed:", err);
    }
    setTalkDelivered(true);
  };

  return (
    <MatchdayShell
      bodyMode="frame"
      header={
        /*
          The break reads as the same match, paused. The live screen already
          moved its score and its controls up here; half time kept its own
          scoreboard band in the body with Resume floated over the top of it,
          so the two stages disagreed about where a manager looks.
        */
        <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex min-w-0 items-center gap-3">
            <TeamLogo
              className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg font-heading font-bold"
              imageClassName="h-7 w-7 object-contain drop-shadow"
              style={{
                backgroundColor: homeTeamColor + "30",
                borderColor: homeTeamColor,
                borderWidth: 2,
              }}
              team={homeFullTeam ?? makeTeamFallback(snapshot.home_team.name)}
            />
            <p className="truncate font-heading font-bold text-gray-800 dark:text-gray-200">
              {snapshot.home_team.name}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="font-heading text-3xl font-bold tabular-nums text-gray-900 dark:text-white">
              {snapshot.home_score}
            </span>
            <p className="font-heading text-xs uppercase tracking-widest text-accent-700 dark:text-accent-400">
              {snapshot.phase === "ExtraTimeHalfTime"
                ? t("match.extraTimeHalfTime")
                : t("match.halfTime")}
            </p>
            <span className="font-heading text-3xl font-bold tabular-nums text-gray-900 dark:text-white">
              {snapshot.away_score}
            </span>
          </div>

          <div className="flex min-w-0 items-center gap-3">
            <p className="truncate font-heading font-bold text-gray-800 dark:text-gray-200">
              {snapshot.away_team.name}
            </p>
            <TeamLogo
              className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg font-heading font-bold"
              imageClassName="h-7 w-7 object-contain drop-shadow"
              style={{
                backgroundColor: awayTeamColor + "30",
                borderColor: awayTeamColor,
                borderWidth: 2,
              }}
              team={awayFullTeam ?? makeTeamFallback(snapshot.away_team.name)}
            />
          </div>

          <div className="flex min-w-[10rem] flex-1 items-center gap-2 text-xs">
            <span className="w-10 text-right font-heading font-bold text-primary-600 dark:text-primary-400">
              {snapshot.home_possession_pct.toFixed(0)}%
            </span>
            <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-gray-300 transition-colors duration-300 motion-reduce:transition-none dark:bg-navy-700">
              <div
                className="h-full bg-primary-500"
                style={{ width: `${snapshot.home_possession_pct}%` }}
              />
              <div
                className="h-full bg-accent-500"
                style={{ width: `${snapshot.away_possession_pct}%` }}
              />
            </div>
            <span className="w-10 font-heading font-bold text-accent-600 dark:text-accent-400">
              {snapshot.away_possession_pct.toFixed(0)}%
            </span>
          </div>

          <button
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 px-5 py-2 font-heading text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-primary-500/20 transition-colors hover:from-primary-600 hover:to-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 motion-reduce:transition-none dark:focus-visible:ring-offset-navy-900"
            onClick={onResume}
            type="button"
          >
            <Play aria-hidden="true" className="h-4 w-4" />
            {t("match.resumeMatch")}
          </button>
        </div>
      }
      identity={matchdayIdentity}
    >
      {/* Main Content */}
      <div className="mx-auto grid h-full min-h-0 w-full max-w-page grid-cols-1 gap-6 px-6 py-6 xl:grid-cols-3">
          {/* Left: First Half Summary */}
          <div className="flex min-h-0 flex-col gap-4 xl:overflow-y-auto">
            <div className="bg-white dark:bg-navy-800 rounded-xl border border-gray-200 dark:border-navy-700 shadow-sm p-4 transition-colors duration-300">
              <h3 className="text-xs font-heading font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-3">
                {t("match.firstHalfEvents")}
              </h3>
              {firstHalfEvents.length === 0 ? (
                <p className="text-xs text-gray-600 dark:text-gray-500">
                  {t("match.noMajorEvents")}
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {firstHalfEvents.map((evt, i) => {
                    const display = getEventDisplay(evt);
                    return (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="text-gray-600 dark:text-gray-500 tabular-nums w-6 text-right font-heading">
                          {evt.minute}'
                        </span>
                        <span>{display.icon}</span>
                        <span
                          className={`${display.color} font-medium truncate`}
                        >
                          {getPlayerName(snapshot, evt.player_id)}
                        </span>
                        <Badge
                          variant={evt.side === "Home" ? "primary" : "accent"}
                          size="sm"
                        >
                          {evt.side === "Home"
                            ? snapshot.home_team.name.substring(0, 3)
                            : snapshot.away_team.name.substring(0, 3)}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Center: Team Talk (user only) */}
          <div className="flex min-h-0 flex-col gap-4 xl:overflow-y-auto">
            {!isSpectator ? (
              <div className="bg-white dark:bg-navy-800 rounded-xl border border-gray-200 dark:border-navy-700 shadow-sm p-4 transition-colors duration-300">
                <div className="flex items-center gap-2 mb-4">
                  <MessageCircle className="w-4 h-4 text-accent-400" />
                  <h3 className="text-xs font-heading font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                    {t("match.teamTalk")}
                  </h3>
                </div>

                {!talkDelivered ? (
                  <>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                      {t("match.teamTalkPrompt")}
                    </p>
                    <div className="flex flex-col gap-2">
                      {teamTalkOptions.map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => setSelectedTalk(opt.id)}
                          className={`flex items-center gap-3 p-3 rounded-lg text-left transition-all ${
                            selectedTalk === opt.id
                              ? "bg-primary-500/20 ring-2 ring-primary-500/50"
                              : "bg-gray-100 hover:bg-gray-200 dark:bg-navy-700/50 dark:hover:bg-navy-700"
                          }`}
                        >
                          <span className="text-xl">
                            {getTalkIcon(opt.icon)}
                          </span>
                          <div>
                            <p
                                className={`text-sm font-heading font-bold ${
                                  selectedTalk === opt.id
                                    ? "text-primary-400"
                                    : "text-gray-800 dark:text-gray-200"
                                }`}
                              >
                                {opt.label}
                              </p>
                              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                {opt.description}
                              </p>
                          </div>
                        </button>
                      ))}
                    </div>
                    {selectedTalk && (
                      <button
                        onClick={handleDeliverTalk}
                        className="w-full mt-3 py-2.5 bg-primary-500/20 hover:bg-primary-500/30 text-primary-400 rounded-lg font-heading font-bold text-sm uppercase tracking-wider transition-colors"
                      >
                        {t("match.deliverTeamTalk")}
                      </button>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 mb-1">
                      {getTalkIcon(selectedTalk || "")}
                      <p className="text-sm font-heading font-bold text-primary-400">
                        {
                          teamTalkOptions.find((o) => o.id === selectedTalk)
                            ?.label
                        }
                      </p>
                      <Badge variant="success" size="sm">
                        {t("match.delivered")}
                      </Badge>
                    </div>
                    {talkResults.length > 0 && (
                      <div className="flex flex-col gap-0.5 max-h-48 overflow-auto">
                        {talkResults.map((r) => (
                          <div
                            key={r.player_id}
                            className="flex items-center gap-2 px-2 py-1 text-xs"
                          >
                            <span className="text-gray-500 dark:text-gray-400 flex-1 truncate">
                              {r.player_name}
                            </span>
                            <span
                              className={`font-heading font-bold tabular-nums ${r.delta > 0 ? "text-green-400" : r.delta < 0 ? "text-red-400" : "text-gray-500 dark:text-gray-400"}`}
                            >
                              {r.delta > 0 ? "+" : ""}
                              {r.delta}
                            </span>
                            <div className="w-12 h-1.5 bg-gray-300 dark:bg-navy-600 rounded-full overflow-hidden transition-colors duration-300">
                              <div
                                className={`h-full rounded-full ${r.new_morale >= 70 ? "bg-green-500" : r.new_morale >= 40 ? "bg-yellow-500" : "bg-red-500"}`}
                                style={{ width: `${r.new_morale}%` }}
                              />
                            </div>
                            <span className="text-gray-500 dark:text-gray-400 tabular-nums w-6 text-right">
                              {r.new_morale}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white dark:bg-navy-800 rounded-xl border border-gray-200 dark:border-navy-700 shadow-sm p-4 flex flex-col items-center justify-center py-8 transition-colors duration-300">
                <p className="text-xs font-heading uppercase tracking-widest text-gray-600 dark:text-gray-500 mb-1">
                  {t("match.spectatorMode")}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                  {t("match.spectatorHT")}
                </p>
              </div>
            )}
          </div>

          {/* Right: Tactical Changes (user only) */}
          <div className="flex min-h-0 flex-col gap-4 xl:overflow-y-auto">
            {!isSpectator && (
              <>
                {/*
                  A shape or style chosen here can be refused too, and the panel
                  that normally carries the reason is closed. Shown only while
                  it is, so a refusal is never reported twice.
                */}
                {!showSubPanel && submissionError ? (
                  <p
                    className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300"
                    role="alert"
                  >
                    {submissionError}
                  </p>
                ) : null}
                {/*
                  Eight formations and six styles laid out as fourteen buttons
                  is not a decision anyone makes at speed, and the live dugout
                  already stopped asking for one.
                */}
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-colors duration-300 motion-reduce:transition-none dark:border-navy-700 dark:bg-navy-800">
                  <h3 className="mb-3 font-heading text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                    {t("match.formation")}
                  </h3>
                  <Select
                    aria-label={t("match.formation")}
                    fullWidth
                    onChange={(event) =>
                      void handleFormationChange(event.target.value)
                    }
                    selectSize="sm"
                    value={
                      FORMATIONS.includes(userTeam.formation)
                        ? userTeam.formation
                        : FORMATIONS[0]
                    }
                  >
                    {FORMATIONS.map((formation) => (
                      <option key={formation} value={formation}>
                        {formation}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-colors duration-300 motion-reduce:transition-none dark:border-navy-700 dark:bg-navy-800">
                  <h3 className="mb-3 font-heading text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                    {t("match.playStyle")}
                  </h3>
                  <Select
                    aria-label={t("match.playStyle")}
                    fullWidth
                    onChange={(event) =>
                      void handlePlayStyleChange(event.target.value)
                    }
                    selectSize="sm"
                    value={userTeam.play_style}
                  >
                    {PLAY_STYLES.map((style) => (
                      <option key={style} value={style}>
                        {t(`common.playStyles.${style}`, style)}
                      </option>
                    ))}
                  </Select>
                </div>

                {/* Substitutions */}
                <div className="bg-white dark:bg-navy-800 rounded-xl border border-gray-200 dark:border-navy-700 shadow-sm p-4 transition-colors duration-300">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-heading font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                      {t("match.substitutions")}
                    </h3>
                    <Badge variant="neutral" size="sm">
                      {userSide === "Home"
                        ? snapshot.home_subs_made
                        : snapshot.away_subs_made}
                      /{snapshot.max_subs}
                    </Badge>
                  </div>

                  <button
                    onClick={() => setShowSubPanel(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-200 hover:bg-gray-300 dark:bg-navy-700 dark:hover:bg-navy-600 rounded-lg text-sm font-heading uppercase tracking-wider text-gray-700 dark:text-gray-300 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    {t("match.makeSubstitution")}
                  </button>
                </div>
              </>
            )}
          </div>
      </div>

      {/* Substitution Modal — reuses the full SubPanel from MatchLive */}
      {showSubPanel && (
        <SubPanel
          naturalPositionById={buildNaturalPositionMap(gameState.players)}
          snapshot={snapshot}
          side={userSide}
          onSubmitDraft={(draft) => {
            void handleSubmitDraft(draft);
          }}
          submissionError={submissionError}
          onClose={() => setShowSubPanel(false)}
        />
      )}
    </MatchdayShell>
  );
}
