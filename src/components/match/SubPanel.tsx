import { useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  type MatchSnapshot,
  FORMATIONS,
  PLAY_STYLES,
} from "./types";
import { getPlayerName } from "./helpers";
import { FormationPitch } from "./FormationPitch";
import { condBgColor, condColor } from "../../lib/playerConditionDisplay";
import { Badge, Select } from "../ui";
import {
  RefreshCw,
  AlertTriangle,
  UserMinus,
  UserPlus,
  Shield,
  Swords,
  Sparkles,
  X,
} from "lucide-react";
import ContextMenu from "../ContextMenu";
import {
  buildPitchRows,
  translatePositionAbbreviation,
  translatePositionLabel,
} from "../squad/SquadTab.helpers";
import { getRoleOptions } from "../../lib/playerRoles";
import { groupBenchByExactPosition } from "./SubPanel.helpers";
import { useAnnouncer } from "../../hooks/useAnnouncer";
import { useDialogFocusTrap } from "../../hooks/useDialogFocusTrap";
import { LiveRegion } from "../ui/LiveRegion";
import {
  EMPTY_MATCH_DRAFT,
  isMatchDraftEmpty,
  queueLineupChange,
  removeLineupChange,
  removeSlotRole,
  type MatchDraft,
  type MatchLineupDraftChange,
} from "./MatchDraft.helpers";
import {
  buildRecommendedSubstitutions,
  getMatchScenario,
  type MatchScenarioId,
} from "./SubPanel.helpers";

const CompareBar = ({
  label,
  valA,
  valB,
}: {
  label: string;
  valA: number;
  valB: number;
}) => {
  const diff = valB - valA;
  return (
    <div className="flex items-center gap-1.5 py-0.5 text-xs">
      <span className="w-7 text-right font-heading text-gray-500">{label}</span>
      <span className="w-5 text-right tabular-nums text-red-400">{valA}</span>
      <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-navy-600">
        <div className="h-full bg-red-500/60" style={{ width: `${valA}%` }} />
      </div>
      <div className="flex h-1.5 flex-1 justify-end overflow-hidden rounded-full bg-navy-600">
        <div className="h-full bg-green-500/60" style={{ width: `${valB}%` }} />
      </div>
      <span className="w-5 tabular-nums text-green-400">{valB}</span>
      <span
        className={`w-6 text-right tabular-nums font-heading font-bold ${diff > 0 ? "text-green-400" : diff < 0 ? "text-red-400" : "text-gray-600"}`}
      >
        {diff > 0 ? "+" : ""}
        {diff}
      </span>
    </div>
  );
};

/** One queued change, with the control that takes it back out. */
function PendingEntry({
  onRemove,
  summary,
}: {
  onRemove: () => void;
  summary: string;
}) {
  const { t } = useTranslation();
  return (
    <li className="flex items-center justify-between gap-2 text-xs text-gray-700 dark:text-gray-200">
      <span>{summary}</span>
      <button
        aria-label={t("match.removePendingChange", { change: summary })}
        className="shrink-0 rounded-md p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 dark:text-gray-400 dark:hover:bg-navy-700 dark:hover:text-gray-100 dark:focus-visible:ring-offset-navy-800"
        onClick={onRemove}
        type="button"
      >
        <X aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

export function SubPanel({
  snapshot,
  side,
  onSubmitDraft,
  submissionError,
  naturalPositionById,
  onClose,
}: {
  snapshot: MatchSnapshot;
  side: "Home" | "Away";
  /**
   * Send everything the manager has decided, as one change set.
   *
   * The draft lives here rather than above, because the panel is where it is
   * built, reviewed and abandoned — and because a refusal has to leave it
   * exactly as it was so the manager corrects rather than restarts.
   */
  onSubmitDraft: (draft: MatchDraft) => void | Promise<void>;
  /** Already localized; why the last submission was refused. */
  submissionError?: string | null;
  /**
   * The exact position each player actually plays, from the store. The engine
   * carries four coarse buckets, so a left-back arrives here as "Defender" —
   * no use at all to someone looking for a left-back (#371).
   */
  naturalPositionById?: Map<string, string>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [selectedOff, setSelectedOff] = useState<string | null>(null);
  const [selectedBench, setSelectedBench] = useState<string | null>(null);
  const [queueRefusal, setQueueRefusal] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draft, setDraft] = useState<MatchDraft>(EMPTY_MATCH_DRAFT);
  const { announce, announcement } = useAnnouncer();
  const applyRef = useRef<HTMLButtonElement>(null);
  const queueRegionRef = useRef<HTMLElement>(null);
  const dialog = useDialogFocusTrap<HTMLDivElement>(onClose);

  const onDraftChange = setDraft;

  /**
   * Taking a change back out is the one queue action with nowhere obvious to
   * land: the button that did it has just gone. Focus moves to Apply, which is
   * the region's own control and stays there whether the queue is empty or not.
   */
  const removeFromQueue = (next: MatchDraft, removed: string) => {
    setQueueRefusal(null);
    onDraftChange(next);
    announce(t("match.removedPendingChange", { change: removed }));

    // Apply is disabled the moment the queue empties, and a focused element
    // that becomes disabled drops focus to the body — outside the panel. So
    // the review region takes it when there is nothing left to apply.
    if (isMatchDraftEmpty(next)) {
      queueRegionRef.current?.focus();
      return;
    }
    applyRef.current?.focus();
  };

  const team = side === "Home" ? snapshot.home_team : snapshot.away_team;
  const bench = side === "Home" ? snapshot.home_bench : snapshot.away_bench;
  const subsMade =
    side === "Home" ? snapshot.home_subs_made : snapshot.away_subs_made;

  const subbedOnIds = new Set(
    snapshot.substitutions
      .filter((s) => s.side === side)
      .map((s) => s.player_on_id),
  );
  const subbedOffIds = new Set(
    snapshot.substitutions
      .filter((s) => s.side === side)
      .map((s) => s.player_off_id),
  );
  const availableBench = bench.filter(
    (p) => !subbedOffIds.has(p.id) && !subbedOnIds.has(p.id),
  );
  const benchGroups = groupBenchByExactPosition(
    availableBench,
    naturalPositionById,
  );
  const selectedPlayer = selectedOff
    ? team.players.find((p) => p.id === selectedOff)
    : null;
  const comparedPlayer = selectedBench
    ? availableBench.find((p) => p.id === selectedBench)
    : null;

  const scenario = getMatchScenario(snapshot, side);
  const recommendations = buildRecommendedSubstitutions(snapshot, side);
  const visibleRecommendations = recommendations.flatMap((rec) => {
    const offPlayer = team.players.find((p) => p.id === rec.offId);
    const onPlayer = availableBench.find((p) => p.id === rec.onId);
    if (!offPlayer || !onPlayer) return [];
    return [{ rec, offPlayer, onPlayer }];
  });

  const getScenarioIcon = (id: MatchScenarioId) => {
    switch (id) {
      case "protect-lead":
        return <Shield className="h-3.5 w-3.5 text-primary-400" />;
      case "chase-goal":
        return <Swords className="h-3.5 w-3.5 text-accent-400" />;
      case "find-winner":
        return <Sparkles className="h-3.5 w-3.5 text-accent-400" />;
      default:
        return <RefreshCw className="h-3.5 w-3.5 text-gray-400" />;
    }
  };

  const handleClearSelection = () => {
    setSelectedOff(null);
    setSelectedBench(null);
  };

  const handleSelectOffPlayer = (playerId: string) => {
    setSelectedOff((cur) => {
      if (cur === playerId) {
        setSelectedBench(null);
        return null;
      }
      setSelectedBench(null);
      return playerId;
    });
  };

  const handleSelectBenchPlayer = (playerId: string) => {
    if (!selectedOff) return;
    if (selectedBench === playerId) {
      // Choosing the same replacement again takes the change back out, which
      // is the only reading of a second click that is not a no-op. It goes
      // through the same path as the queue's own remove button, so it is
      // announced rather than being the one silent way to undo something.
      const slotIndex = slotIndexOf(selectedOff);
      const change = draft.lineupChanges.find(
        (queued) => queued.slotIndex === slotIndex,
      );
      setSelectedBench(null);
      removeFromQueue(
        removeLineupChange(draft, slotIndex),
        change ? describeChange(change) : "",
      );
      return;
    }
    setSelectedBench(playerId);
    queueSwap(selectedOff, playerId);
  };

  const slotIndexOf = (playerId: string | null): number =>
    playerId === null
      ? -1
      : team.players.findIndex((player) => player.id === playerId);

  // The shape the manager is about to send, not the one on the pitch. The
  // engine applies the formation before it validates a single role, so a role
  // picker still showing the old slot would offer roles the engine then
  // refuses — taking the substitutions down with them.
  const draftedFormation = draft.formation ?? team.formation;
  const slotPositions = buildPitchRows(draftedFormation).flatMap(
    (row) => row.positions,
  );

  const deployedSlotPosition = (slotIndex: number): string =>
    slotPositions[slotIndex] ?? team.players[slotIndex]?.position ?? "";

  function queueSwap(offId: string, onId: string): void {
    const slotIndex = slotIndexOf(offId);
    if (slotIndex < 0) {
      return;
    }

    const result = queueLineupChange(draft, snapshot, side, {
      incomingPlayerId: onId,
      outgoingPlayerId: offId,
      slotIndex,
    });

    if (result.refusedRemaining !== undefined) {
      // Said here rather than sent: the remaining count is known on this side,
      // so the manager finds out now instead of having a whole set refused.
      setQueueRefusal(
        t("match.tooManyPendingSubstitutions", {
          remaining: result.refusedRemaining,
        }),
      );
      return;
    }

    setQueueRefusal(null);
    onDraftChange(result.draft);
    // The pair stays selected. Nothing has been sent yet, so the comparison is
    // still what the manager needs in front of them to judge the change they
    // have just queued — and to take it back out if it does not hold up.
  }

  const formationSummary = draft.formation
    ? `${t("tactics.formation")}: ${draft.formation}`
    : null;
  const playStyleSummary = draft.playStyle
    ? `${t("tactics.playStyle")}: ${t(
        `common.playStyles.${draft.playStyle}`,
        draft.playStyle,
      )}`
    : null;

  const describeChange = (change: MatchLineupDraftChange): string =>
    t("match.pendingSubstitution", {
      playerOff: getPlayerName(snapshot, change.outgoingPlayerId),
      playerOn: getPlayerName(snapshot, change.incomingPlayerId),
    });

  const describeRole = (slotIndex: number, role: string): string =>
    t("match.pendingRoleChange", {
      player: team.players[slotIndex]?.name ?? "",
      role: t(`tactics.playerRoles.${role}`, role),
    });

  const handleApplyRecommendation = (offId: string, onId: string) => {
    // A recommendation is a decision, not a prefill: it joins the queue like
    // any other, where it can be reviewed or taken back out.
    setSelectedOff(offId);
    setSelectedBench(onId);
    queueSwap(offId, onId);
  };

  const handleInteractiveRowKeyDown = (
    event: KeyboardEvent<HTMLElement>,
    action: () => void,
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      action();
      return;
    }
    if (
      event.key === "ContextMenu" ||
      (event.shiftKey && event.key === "F10")
    ) {
      event.preventDefault();
      event.currentTarget.dispatchEvent(
        new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
      role="presentation"
    >
      {/*
        A real dialog. The panel was a pair of divs over a backdrop: everything
        behind it stayed in the tab order, so a keyboard user tabbed straight
        out into live-match controls they could not see, and it could be
        dismissed by clicking outside but not by pressing a key.
      */}
      <div
        aria-labelledby="sub-panel-title"
        aria-modal="true"
        className="bg-white dark:bg-navy-800 rounded-2xl border border-gray-200 dark:border-navy-600 shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden transition-colors duration-300 motion-reduce:transition-none"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={dialog.onKeyDown}
        role="dialog"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-linear-to-r from-gray-100 to-white px-5 py-3 dark:border-navy-700 dark:from-navy-700 dark:to-navy-800">
          <div className="flex items-center gap-2.5">
            <RefreshCw className="h-4 w-4 text-accent-400" />
            <h3
              className="font-heading text-sm font-bold uppercase tracking-widest text-gray-900 dark:text-white"
              id="sub-panel-title"
            >
              {t("match.substitutionsTitle")}
            </h3>
            <Badge
              variant={subsMade >= snapshot.max_subs ? "danger" : "primary"}
              size="sm"
            >
              {t("match.subsUsed", { used: subsMade, max: snapshot.max_subs })}
            </Badge>
          </div>
          <button
            aria-label={t("common.close")}
            className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 motion-reduce:transition-none dark:text-gray-400 dark:hover:bg-navy-600 dark:hover:text-white dark:focus-visible:ring-offset-navy-800"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        {/*
          A spent substitution allowance stops substitutions and nothing else.
          Formation, play style and a slot's role are still the manager's to
          change, and hiding the whole panel took them away.
        */}
        <>
            <div className="shrink-0 border-b border-gray-200 px-4 py-3 dark:border-navy-700">
        {/*
          What the manager has decided, before any of it is sent. A break is
          three or four changes and the engine used to take them one at a time,
          so a refusal halfway through left the earlier ones committed.
        */}
        <section
          aria-label={t("match.pendingChanges")}
          className="rounded-xl border border-gray-200 bg-white p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 dark:border-navy-600 dark:bg-navy-800"
          ref={queueRegionRef}
          tabIndex={-1}
        >
          <LiveRegion announcement={announcement} />
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="font-heading text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
              {t("match.pendingChanges")}
            </h3>
            <button
              type="button"
              disabled={isMatchDraftEmpty(draft) || isSubmitting}
              onClick={() => {
                // A second press while the first is in flight sends the same
                // set twice; the engine commits one and refuses the other for a
                // slot that has already moved.
                if (isSubmitting) return;
                setIsSubmitting(true);
                announce(t("match.applyingPendingChanges"));
                void Promise.resolve(onSubmitDraft(draft)).finally(() => {
                  setIsSubmitting(false);
                });
              }}
              ref={applyRef}
              className="rounded-lg bg-primary-600 px-3 py-1.5 font-heading text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-navy-800"
            >
              {t("match.applyPendingChanges")}
            </button>
          </div>

          {submissionError ? (
            <p
              role="alert"
              className="mb-2 rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300"
            >
              {submissionError}
            </p>
          ) : null}
          {queueRefusal ? (
            <p
              role="alert"
              className="mb-2 rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
            >
              {queueRefusal}
            </p>
          ) : null}

          {isMatchDraftEmpty(draft) ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t("match.noPendingChanges")}
            </p>
          ) : (
            <ul className="space-y-1">
              {draft.lineupChanges.map((change) => {
                const summary = describeChange(change);
                return (
                  <PendingEntry
                    key={`lineup-${change.slotIndex}`}
                    onRemove={() => {
                      if (change.outgoingPlayerId === selectedOff) {
                        setSelectedBench(null);
                      }
                      removeFromQueue(
                        removeLineupChange(draft, change.slotIndex),
                        summary,
                      );
                    }}
                    summary={summary}
                  />
                );
              })}
              {Object.entries(draft.slotRoles).map(([slotIndex, role]) => {
                const summary = describeRole(Number(slotIndex), role);
                return (
                  <PendingEntry
                    key={`role-${slotIndex}`}
                    onRemove={() =>
                      removeFromQueue(
                        removeSlotRole(draft, Number(slotIndex)),
                        summary,
                      )
                    }
                    summary={summary}
                  />
                );
              })}
              {formationSummary ? (
                <PendingEntry
                  onRemove={() =>
                    removeFromQueue({ ...draft, formation: null }, formationSummary)
                  }
                  summary={formationSummary}
                />
              ) : null}
              {playStyleSummary ? (
                <PendingEntry
                  onRemove={() =>
                    removeFromQueue({ ...draft, playStyle: null }, playStyleSummary)
                  }
                  summary={playStyleSummary}
                />
              ) : null}
            </ul>
          )}

          {selectedOff && slotIndexOf(selectedOff) >= 0 ? (
            <div className="mt-3">
              <span className="mb-1 block text-[11px] text-gray-500 dark:text-gray-400">
                {t("tactics.playerRoleLabel")}
              </span>
              <Select
                aria-label={t("tactics.playerRoleLabel")}
                fullWidth
                onChange={(event) => {
                  const slotIndex = slotIndexOf(selectedOff);
                  onDraftChange({
                    ...draft,
                    slotRoles: {
                      ...draft.slotRoles,
                      [slotIndex]: event.target.value,
                    },
                  });
                }}
                selectSize="sm"
                value={
                  draft.slotRoles[slotIndexOf(selectedOff)] ??
                  team.players[slotIndexOf(selectedOff)]?.role ??
                  "Standard"
                }
              >
                {getRoleOptions(
                  deployedSlotPosition(slotIndexOf(selectedOff)),
                  draft.slotRoles[slotIndexOf(selectedOff)] ??
                    team.players[slotIndexOf(selectedOff)]?.role ??
                    "Standard",
                ).map((role) => (
                  <option key={role} value={role}>
                    {t(`tactics.playerRoles.${role}`, role)}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
        </section>
            </div>
            {/* Tactics strip — scenario, recommendation chips, quick selects */}
            <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-gray-200 bg-gray-50/60 px-4 py-2 dark:border-navy-700 dark:bg-navy-900/30">
              {/* Scenario + apply play style */}
              <div className="flex items-center gap-1.5">
                {getScenarioIcon(scenario.id)}
                <span className="font-heading text-[11px] font-bold uppercase tracking-widest text-gray-800 dark:text-gray-200">
                  {t(`match.subScenario.${scenario.id}.title`)}
                </span>
                <button
                  type="button"
                  data-testid="recommended-plan-cta"
                  onClick={() => {
                    onDraftChange({
                      ...draft,
                      playStyle: scenario.recommendedPlayStyle,
                    });
                  }}
                  className="rounded-full border border-primary-500/25 bg-primary-500/12 px-2 py-0.5 font-heading text-[10px] font-bold uppercase tracking-widest text-primary-500 transition-colors hover:bg-primary-500/20 dark:text-primary-300"
                >
                  {t("match.recommendedPlan")}:{" "}
                  {t(`common.playStyles.${scenario.recommendedPlayStyle}`)}
                </button>
              </div>

              {/* Recommendation chips */}
              {visibleRecommendations.length > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  {visibleRecommendations.slice(0, 3).map(
                    ({ rec, offPlayer, onPlayer }) => (
                      <button
                        key={`${rec.offId}-${rec.onId}`}
                        type="button"
                        data-testid={`recommended-sub-${rec.offId}-${rec.onId}`}
                        onClick={() =>
                          handleApplyRecommendation(rec.offId, rec.onId)
                        }
                        className="flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-0.5 font-heading text-[10px] font-bold transition-colors hover:border-primary-400 hover:bg-primary-50 dark:border-navy-600 dark:bg-navy-800 dark:hover:bg-navy-700"
                      >
                        <span className="text-red-400">
                          {offPlayer.name.split(" ").pop()}
                        </span>
                        <span className="text-gray-400">→</span>
                        <span className="text-green-400">
                          {onPlayer.name.split(" ").pop()}
                        </span>
                      </button>
                    ),
                  )}
                  {visibleRecommendations.length > 3 && (
                    <span className="font-heading text-[10px] text-gray-400 dark:text-gray-500">
                      +{visibleRecommendations.length - 3}
                    </span>
                  )}
                </div>
              )}

              {/* Quick formation & play style selects */}
              <div className="ml-auto flex items-center gap-2">
                <Select
                  value={
                    draft.formation ??
                    (FORMATIONS.includes(team.formation)
                      ? team.formation
                      : FORMATIONS[0])
                  }
                  onChange={(e) =>
                    setDraft((current) => ({
                      ...current,
                      formation: e.target.value,
                    }))
                  }
                  aria-label={t("tactics.formation")}
                  selectSize="xs"
                >
                  {FORMATIONS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </Select>
                <Select
                  value={draft.playStyle ?? team.play_style}
                  onChange={(e) =>
                    setDraft((current) => ({
                      ...current,
                      playStyle: e.target.value,
                    }))
                  }
                  aria-label={t("tactics.playStyle")}
                  selectSize="xs"
                >
                  {PLAY_STYLES.map((style) => (
                    <option key={style} value={style}>
                      {t(`common.playStyles.${style}`, style)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {/* Main body: two columns */}
            <div className="flex min-h-0 flex-1 overflow-hidden">
              {/* Left: formation pitch + on-field player list */}
              <div className="flex min-w-0 flex-1 flex-col border-r border-gray-200 dark:border-navy-700">
                <div className="shrink-0 border-b border-gray-200 bg-gray-50 px-4 py-2 dark:border-navy-700 dark:bg-navy-800/50">
                  <p className="font-heading text-xs uppercase tracking-widest text-red-400">
                    {selectedOff
                      ? t("match.takingOff", { name: selectedPlayer?.name })
                      : t("match.selectPlayerOff")}
                  </p>
                </div>

                {/* Formation pitch */}
                <FormationPitch
                  formation={draftedFormation}
                  players={team.players}
                  sentOff={snapshot.sent_off}
                  selectedId={selectedOff}
                  subbedOnIds={subbedOnIds}
                  onPlayerClick={handleSelectOffPlayer}
                  className="mx-4 mt-3 h-[210px] shrink-0"
                />

                {/* On-field player table */}
                <div className="min-h-0 flex-1 overflow-auto px-4 py-2">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-gray-200 font-heading text-[10px] uppercase tracking-widest text-gray-600 dark:border-navy-700 dark:text-gray-500">
                        <th className="py-2 pr-2">{t("match.player")}</th>
                        <th className="w-12 py-2 text-center">
                          {t("common.position")}
                        </th>
                        <th className="w-12 py-2 text-center">
                          {t("common.ovr")}
                        </th>
                        <th className="w-24 py-2">{t("match.fitness")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {team.players
                        .filter((p) => !snapshot.sent_off.includes(p.id))
                        .sort((a, b) => {
                          const ord: Record<string, number> = {
                            Goalkeeper: 1,
                            Defender: 2,
                            Midfielder: 3,
                            Forward: 4,
                          };
                          return (
                            (ord[a.position] ?? 99) -
                              (ord[b.position] ?? 99) ||
                            a.name.localeCompare(b.name)
                          );
                        })
                        .map((p) => {
                          const isSelected = selectedOff === p.id;
                          const isSubOn = subbedOnIds.has(p.id);
                          const row = (
                            <tr
                              key={p.id}
                              data-testid={`sub-panel-off-${p.id}`}
                              onClick={() => handleSelectOffPlayer(p.id)}
                              onKeyDown={(e) =>
                                handleInteractiveRowKeyDown(e, () =>
                                  handleSelectOffPlayer(p.id),
                                )
                              }
                              role="button"
                              tabIndex={0}
                              aria-pressed={isSelected}
                              className={`cursor-pointer text-sm transition-colors ${
                                isSelected
                                  ? "bg-red-500/10"
                                  : "hover:bg-gray-100 dark:hover:bg-navy-700/50"
                              }`}
                            >
                              <td className="py-2 pr-2">
                                <div className="flex items-center gap-1.5">
                                  {isSelected && (
                                    <UserMinus className="h-3.5 w-3.5 shrink-0 text-red-400" />
                                  )}
                                  {isSubOn && (
                                    <span className="text-[10px] text-green-400">
                                      ▲
                                    </span>
                                  )}
                                  <span
                                    className={`truncate font-medium ${isSelected ? "text-red-400" : "text-gray-700 dark:text-gray-300"}`}
                                  >
                                    {p.name}
                                  </span>
                                </div>
                              </td>
                              <td className="w-12 py-2 text-center">
                                <span className="font-heading text-xs text-gray-500 dark:text-gray-400">
                                  {translatePositionAbbreviation(
                                    t,
                                    p.position,
                                  )}
                                </span>
                              </td>
                              <td className="w-12 py-2 text-center font-heading font-bold text-gray-500 dark:text-gray-400">
                                {p.ovr}
                              </td>
                              <td className="w-24 py-2">
                                <div className="flex items-center gap-1.5">
                                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-300 dark:bg-navy-600">
                                    <div
                                      className={`h-full rounded-full ${condBgColor(p.condition)}`}
                                      style={{ width: `${p.condition}%` }}
                                    />
                                  </div>
                                  <span
                                    className={`w-7 text-right font-heading text-xs tabular-nums ${condColor(p.condition)}`}
                                  >
                                    {Math.round(p.condition)}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                          return (
                            <ContextMenu
                              key={p.id}
                              items={[
                                {
                                  label: isSelected
                                    ? t("common.cancel")
                                    : t("match.selectToTakeOff"),
                                  icon: <UserMinus className="h-4 w-4" />,
                                  onClick: () => handleSelectOffPlayer(p.id),
                                },
                              ]}
                            >
                              {row}
                            </ContextMenu>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right: bench players (full column height) */}
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="shrink-0 border-b border-gray-200 bg-gray-50 px-4 py-2 dark:border-navy-700 dark:bg-navy-800/50">
                  <p className="font-heading text-xs uppercase tracking-widest text-green-400">
                    {selectedOff
                      ? t("match.selectReplacement")
                      : t("match.benchPlayers")}
                  </p>
                </div>

                {subsMade >= snapshot.max_subs ? (
                  <div className="flex flex-1 items-center justify-center p-8">
                    <div className="flex flex-col items-center gap-3">
                      <AlertTriangle className="h-8 w-8 text-yellow-500" />
                      <p className="font-heading text-sm font-bold uppercase tracking-wider text-yellow-500">
                        {t("match.allSubsUsed")}
                      </p>
                    </div>
                  </div>
                ) : availableBench.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center">
                    <p className="text-xs text-gray-600 dark:text-gray-500">
                      {t("match.noBenchAvailable")}
                    </p>
                  </div>
                ) : (
                  <div className="min-h-0 flex-1 overflow-auto px-4 py-2">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-gray-200 font-heading text-[10px] uppercase tracking-widest text-gray-600 dark:border-navy-700 dark:text-gray-500">
                          <th className="py-2 pr-2">{t("match.player")}</th>
                          <th className="w-12 py-2 text-center">
                            {t("common.position")}
                          </th>
                          <th className="w-12 py-2 text-center">
                            {t("common.ovr")}
                          </th>
                          <th className="w-24 py-2">{t("match.fitness")}</th>
                        </tr>
                      </thead>
                      {benchGroups.map((group) => (
                      <tbody key={group.position}>
                        <tr>
                          <th
                            className="pt-3 pb-1 font-heading text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400"
                            colSpan={4}
                            scope="colgroup"
                          >
                            {translatePositionLabel(t, group.position)}
                          </th>
                        </tr>
                        {group.players.map((p) => {
                          const posMatch = selectedPlayer
                            ? p.position === selectedPlayer.position
                            : true;
                          const benchRow = (
                            <tr
                              key={p.id}
                              data-testid={`sub-panel-bench-${p.id}`}
                              onClick={() => handleSelectBenchPlayer(p.id)}
                              onKeyDown={(e) =>
                                handleInteractiveRowKeyDown(e, () =>
                                  handleSelectBenchPlayer(p.id),
                                )
                              }
                              role="button"
                              tabIndex={0}
                              aria-pressed={selectedBench === p.id}
                              aria-disabled={!selectedOff}
                              className={`text-sm transition-colors ${
                                selectedOff
                                  ? selectedBench === p.id
                                    ? "cursor-pointer bg-green-500/15 ring-1 ring-green-500/30"
                                    : "cursor-pointer hover:bg-green-500/10"
                                  : "opacity-60"
                              }`}
                            >
                              <td className="py-2 pr-2">
                                <div className="flex items-center gap-1.5">
                                  {selectedOff && (
                                    <UserPlus className="h-3.5 w-3.5 shrink-0 text-green-400/50" />
                                  )}
                                  <span className="truncate font-medium text-gray-700 dark:text-gray-300">
                                    {p.name}
                                  </span>
                                </div>
                              </td>
                              <td className="w-12 py-2 text-center">
                                <span
                                  className={`font-heading text-xs ${!posMatch && selectedOff ? "text-yellow-400" : "text-gray-500 dark:text-gray-400"}`}
                                >
                                  {translatePositionAbbreviation(
                                    t,
                                    naturalPositionById?.get(p.id) ?? p.position,
                                  )}
                                  {!posMatch && selectedOff && " !"}
                                </span>
                              </td>
                              <td className="w-12 py-2 text-center font-heading font-bold text-gray-500 dark:text-gray-400">
                                {p.ovr}
                              </td>
                              <td className="w-24 py-2">
                                <div className="flex items-center gap-1.5">
                                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-300 dark:bg-navy-600">
                                    <div
                                      className={`h-full rounded-full ${condBgColor(p.condition)}`}
                                      style={{ width: `${p.condition}%` }}
                                    />
                                  </div>
                                  <span
                                    className={`w-7 text-right font-heading text-xs tabular-nums ${condColor(p.condition)}`}
                                  >
                                    {Math.round(p.condition)}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                          return (
                            <ContextMenu
                              key={p.id}
                              items={
                                selectedOff
                                  ? [
                                      {
                                        label:
                                          selectedBench === p.id
                                            ? t(
                                                "match.clearReplacementSelection",
                                              )
                                            : t("match.selectReplacementMenu"),
                                        icon: <UserPlus className="h-4 w-4" />,
                                        onClick: () =>
                                          handleSelectBenchPlayer(p.id),
                                      },
                                    ]
                                  : [
                                      {
                                        label: t(
                                          "match.selectPlayerToTakeOffFirst",
                                        ),
                                        icon: <UserPlus className="h-4 w-4" />,
                                        onClick: () => {},
                                        disabled: true,
                                      },
                                    ]
                              }
                            >
                              {benchRow}
                            </ContextMenu>
                          );
                        })}
                      </tbody>
                      ))}
                    </table>
                  </div>
                )}

                {/* Sub history */}
                {snapshot.substitutions.filter((s) => s.side === side).length >
                  0 && (
                  <div className="shrink-0 border-t border-gray-200 px-4 py-3 dark:border-navy-700">
                    <p className="mb-1.5 font-heading text-[10px] uppercase tracking-widest text-gray-600 dark:text-gray-500">
                      {t("match.history")}
                    </p>
                    {snapshot.substitutions
                      .filter((s) => s.side === side)
                      .map((sub, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-1.5 py-0.5 text-[11px]"
                        >
                          <span className="w-5 text-right font-heading tabular-nums text-gray-600 dark:text-gray-500">
                            {sub.minute}'
                          </span>
                          <span className="text-green-400">▲</span>
                          <span className="truncate text-gray-700 dark:text-gray-300">
                            {getPlayerName(snapshot, sub.player_on_id)}
                          </span>
                          <span className="text-red-400">▼</span>
                          <span className="truncate text-gray-500 dark:text-gray-400">
                            {getPlayerName(snapshot, sub.player_off_id)}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* Sticky footer: comparison summary + confirm / cancel */}
            <div className="shrink-0 border-t border-gray-200 bg-gray-50/60 px-4 py-3 dark:border-navy-700 dark:bg-navy-900/30">
              {selectedPlayer && comparedPlayer ? (
                <div>
                  {/* Player names + position match + action buttons */}
                  <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <UserMinus className="h-3.5 w-3.5 shrink-0 text-red-400" />
                      <span className="max-w-[110px] truncate font-heading text-sm font-bold text-red-400">
                        {selectedPlayer.name}
                      </span>
                      <span className="text-gray-400">→</span>
                      <span className="max-w-[110px] truncate font-heading text-sm font-bold text-green-400">
                        {comparedPlayer.name}
                      </span>
                      <UserPlus className="h-3.5 w-3.5 shrink-0 text-green-400" />
                    </div>
                    <span
                      className={`font-heading text-[10px] font-bold uppercase tracking-wide ${
                        comparedPlayer.position === selectedPlayer.position
                          ? "text-green-400"
                          : "text-yellow-400"
                      }`}
                    >
                      {comparedPlayer.position === selectedPlayer.position
                        ? t("match.fitExact")
                        : t("match.fitAdjusted")}
                    </span>
                    <div className="ml-auto flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleClearSelection}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 font-heading text-xs font-bold uppercase tracking-wider text-gray-700 transition-colors hover:bg-gray-100 dark:border-navy-500 dark:text-gray-300 dark:hover:bg-navy-600"
                      >
                        {t("common.cancel")}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectBenchPlayer(comparedPlayer.id)}
                        className="rounded-lg bg-red-500/10 px-3 py-1.5 font-heading text-xs font-bold uppercase tracking-wider text-red-500 transition-colors hover:bg-red-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 dark:text-red-300 dark:focus-visible:ring-offset-navy-800"
                      >
                        {t("match.undoQueuedSubstitution")}
                      </button>
                    </div>
                  </div>
                  {/* Attribute comparison bars */}
                  <div className="grid grid-cols-2 gap-x-4">
                    <CompareBar
                      label="OVR"
                      valA={selectedPlayer.ovr}
                      valB={comparedPlayer.ovr}
                    />
                    <CompareBar
                      label="PAC"
                      valA={selectedPlayer.pace}
                      valB={comparedPlayer.pace}
                    />
                    <CompareBar
                      label="PAS"
                      valA={selectedPlayer.passing}
                      valB={comparedPlayer.passing}
                    />
                    <CompareBar
                      label="SHO"
                      valA={selectedPlayer.shooting}
                      valB={comparedPlayer.shooting}
                    />
                    <CompareBar
                      label="TAC"
                      valA={selectedPlayer.tackling}
                      valB={comparedPlayer.tackling}
                    />
                    <CompareBar
                      label="COND"
                      valA={Math.round(selectedPlayer.condition)}
                      valB={Math.round(comparedPlayer.condition)}
                    />
                  </div>
                </div>
              ) : selectedPlayer ? (
                <div className="flex items-center gap-2">
                  <UserMinus className="h-3.5 w-3.5 text-red-400" />
                  <span className="font-heading text-sm font-bold text-red-400">
                    {selectedPlayer.name}
                  </span>
                  <span className="text-gray-400">—</span>
                  <span className="font-heading text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {t("match.selectBenchToCompare")}
                  </span>
                </div>
              ) : (
                <p className="text-center font-heading text-xs uppercase tracking-widest text-gray-500 dark:text-gray-400">
                  {t("match.selectPlayerOff")}
                </p>
              )}
            </div>
        </>
      </div>
    </div>
  );
}
