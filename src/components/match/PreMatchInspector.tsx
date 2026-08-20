import type { JSX } from "react";
import { useState } from "react";
import { CircleDot, CornerDownRight, Crown, Footprints } from "lucide-react";
import { useTranslation } from "react-i18next";

import { condColor } from "../../lib/playerConditionDisplay";
import { getRoleOptions } from "../../lib/playerRoles";
import type { PlayerData } from "../../store/gameStore";
import type { PlayerRole, TacticsPhaseSettings } from "../../store/types";
import { translatePositionLabel } from "../squad/SquadTab.helpers";
import {
  PHASE_FIELD_SECTIONS,
  PhaseBlueprintPanel,
} from "../tactics/PhaseBlueprintPanel";
import { InspectorCard, ReadRow } from "../tactics/TacticsInspector";
import { Select } from "../ui";
import type { EnginePlayerData, SetPieceTakers } from "./types";

export type PreMatchSetPieceRole = "penalty" | "freekick" | "corner" | "captain";

/**
 * The four duties a manager hands out before kick-off, in team-sheet order.
 * Pre-match has no vice-captain: nobody is going to be asked to take over
 * before the match has started.
 */
const RESPONSIBILITIES: {
  Icon: typeof Crown;
  labelKey: string;
  outfieldOnly: boolean;
  role: PreMatchSetPieceRole;
  taker: keyof SetPieceTakers;
}[] = [
  { Icon: Crown, labelKey: "match.captain", outfieldOnly: false, role: "captain", taker: "captain" },
  { Icon: CircleDot, labelKey: "match.penaltyTaker", outfieldOnly: true, role: "penalty", taker: "penalty_taker" },
  { Icon: Footprints, labelKey: "match.freeKickTaker", outfieldOnly: true, role: "freekick", taker: "free_kick_taker" },
  { Icon: CornerDownRight, labelKey: "match.cornerTaker", outfieldOnly: true, role: "corner", taker: "corner_taker" },
];

interface PreMatchInspectorProps {
  bench: EnginePlayerData[];
  /** A match command is out. Nothing that mutates the match may be sent yet. */
  isBusy?: boolean;
  onAutoSelectTakers: () => void;
  onChangePlayerRole: (playerId: string, role: PlayerRole) => void;
  onSetPieceTaker: (role: PreMatchSetPieceRole, playerId: string) => void;
  onSwapWithBench: (benchPlayerId: string) => void;
  onTacticsPhaseChange: (patch: Partial<TacticsPhaseSettings>) => void;
  selectedPlayer: EnginePlayerData | null;
  /** The slot the selected player is deployed in, from the live shape. */
  selectedSlotPosition?: string;
  setPieces: SetPieceTakers;
  starters: EnginePlayerData[];
  /** Store-side players, for the natural position an engine player does not carry. */
  storeById: Map<string, PlayerData>;
  tacticsPhase?: TacticsPhaseSettings;
}

/**
 * The pre-match details pane — the tactics inspector's twin, not its clone.
 *
 * It answers the same question in the same shape: the team at rest, one player
 * when one is chosen. But the two screens have different authorities. The
 * tactics inspector edits the saved team through squad services; this one edits
 * a match that has already been built, through `MatchCommand` snapshots. Sharing
 * one component would mean one prop surface carrying both, with nothing but
 * care keeping a saved edit from being sent to a running match.
 *
 * What *is* shared is every opinion: the nine dials and their grouping, the fit
 * vocabulary, the role table, the position names, and the card that puts an
 * editor one Adjust behind a value.
 */
export default function PreMatchInspector({
  bench,
  isBusy = false,
  onAutoSelectTakers,
  onChangePlayerRole,
  onSetPieceTaker,
  onSwapWithBench,
  onTacticsPhaseChange,
  selectedPlayer,
  selectedSlotPosition,
  setPieces,
  starters,
  storeById,
  tacticsPhase,
}: PreMatchInspectorProps): JSX.Element {
  const { t } = useTranslation();
  const [editingInstructions, setEditingInstructions] = useState(false);
  const [editingResponsibilities, setEditingResponsibilities] = useState(false);

  const nameById = new Map(
    [...starters, ...bench].map((player) => [
      player.id,
      storeById.get(player.id)?.match_name || player.name,
    ]),
  );

  const selectedStore = selectedPlayer
    ? storeById.get(selectedPlayer.id)
    : undefined;
  const naturalPosition =
    selectedStore?.natural_position ??
    selectedStore?.position ??
    selectedPlayer?.position;

  return (
    <section
      aria-label={t("tactics.detailsPane")}
      className="flex min-h-0 flex-col gap-4 overflow-y-auto @3xl/prematch:col-span-3 @5xl/prematch:col-span-1"
    >
      {selectedPlayer ? (
        <div className="rounded-xl border border-gray-200 bg-white dark:border-navy-600 dark:bg-navy-800">
          <div className="border-b border-gray-100 px-3 py-2 dark:border-navy-700">
            <p className="text-[11px] font-heading font-bold uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400">
              {t("tactics.selectedPlayer")}
            </p>
            <h3 className="truncate text-sm font-heading font-bold text-gray-900 dark:text-gray-100">
              {nameById.get(selectedPlayer.id) ?? selectedPlayer.name}
            </h3>
          </div>
          <div className="space-y-3 p-3">
            <div className="space-y-1.5">
              <ReadRow
                label={t("tactics.deployedSlot")}
                value={
                  selectedSlotPosition
                    ? translatePositionLabel(t, selectedSlotPosition)
                    : t("match.notAssigned")
                }
              />
              {/* Where they are playing is not who they are (#272). */}
              <ReadRow
                label={t("tactics.naturalPosition")}
                value={
                  naturalPosition
                    ? translatePositionLabel(t, naturalPosition)
                    : t("common.unknown")
                }
              />
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                  {t("common.condition")}
                </span>
                <span
                  className={`text-right text-xs font-medium tabular-nums ${condColor(selectedPlayer.condition)}`}
                >
                  {`${Math.round(selectedPlayer.condition)}%`}
                </span>
              </div>
            </div>

            {selectedSlotPosition ? (
              <div>
                <span className="mb-1 block text-[11px] text-gray-500 dark:text-gray-400">
                  {t("tactics.playerRoleLabel")}
                </span>
                <Select
                  aria-label={t("tactics.playerRoleLabel")}
                  disabled={isBusy}
                  fullWidth
                  onChange={(event) => {
                    onChangePlayerRole(
                      selectedPlayer.id,
                      event.target.value as PlayerRole,
                    );
                  }}
                  selectSize="sm"
                  value={selectedPlayer.role || "Standard"}
                >
                  {getRoleOptions(
                    // The slot they are standing in, not the position they were
                    // born in — the engine validates against the former and
                    // ignores a role it thinks invalid, without saying so.
                    selectedSlotPosition,
                    selectedPlayer.role || "Standard",
                  ).map((role) => (
                    <option key={role} value={role}>
                      {t(`tactics.playerRoles.${role}`, role)}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}

            <div>
              <span className="mb-1.5 block text-[11px] font-heading font-bold uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400">
                {t("preMatch.substitutes")}
              </span>
              {bench.length === 0 ? (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t("preMatch.noBench")}
                </p>
              ) : (
                <div className="space-y-1">
                  {bench.map((player) => (
                    <button
                      key={player.id}
                      type="button"
                      onClick={() => {
                        onSwapWithBench(player.id);
                      }}
                      className="flex w-full items-center justify-between gap-2 rounded-lg border border-gray-200 px-2 py-1.5 text-left text-xs transition-colors hover:border-primary-300 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 dark:border-navy-600 dark:hover:border-primary-400 dark:hover:bg-navy-700 dark:focus-visible:ring-offset-navy-800"
                    >
                      <span className="min-w-0 truncate font-medium text-gray-900 dark:text-gray-100">
                        {nameById.get(player.id) ?? player.name}
                      </span>
                      <span
                        className={`shrink-0 tabular-nums ${condColor(player.condition)}`}
                      >
                        {Math.round(player.condition)}%
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          <InspectorCard
            id="prematch-team-instructions"
            isEditing={editingInstructions}
            onToggleEditing={() => {
              setEditingInstructions((open) => !open);
            }}
            title={t("tactics.teamInstructions")}
          >
            {editingInstructions ? (
              <PhaseBlueprintPanel
                onTacticsPhaseChange={onTacticsPhaseChange}
                tacticsPhase={tacticsPhase}
              />
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-navy-700">
                {PHASE_FIELD_SECTIONS.map(([sectionKey, fields]) => (
                  <div key={sectionKey} className="space-y-1.5 p-3">
                    <div className="mb-1.5 text-[11px] font-heading font-bold uppercase tracking-[0.2em] text-primary-500 dark:text-primary-400">
                      {t(`tactics.phaseLabels.${sectionKey}`)}
                    </div>
                    {fields.map(([field, labelKey, options]) => {
                      const value = (tacticsPhase?.[field] ??
                        options[0]) as string;
                      return (
                        <ReadRow
                          key={field}
                          label={t(`tactics.phaseSettings.${labelKey}`)}
                          // No string fallback: every dial's value key exists
                          // in all eleven locales, and a fallback here would
                          // quietly ship the raw enum name if one ever did not.
                          value={t(`tactics.phaseSettings.${labelKey}_${value}`)}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </InspectorCard>

          <InspectorCard
            id="prematch-responsibilities"
            isEditing={editingResponsibilities}
            onToggleEditing={() => {
              setEditingResponsibilities((open) => !open);
            }}
            title={t("tactics.responsibilities")}
          >
            {editingResponsibilities ? (
              <div className="space-y-2 p-3">
                <button
                  type="button"
                  onClick={onAutoSelectTakers}
                  className="w-full rounded-lg border border-accent-200 py-1.5 text-[10px] font-heading font-bold uppercase tracking-[0.18em] text-accent-700 transition-colors hover:bg-accent-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 dark:border-accent-500/30 dark:text-accent-400 dark:hover:bg-accent-500/10 dark:focus-visible:ring-offset-navy-800"
                >
                  {t("match.autoSelectTakers")}
                </button>
                {RESPONSIBILITIES.map(({ Icon, labelKey, outfieldOnly, role, taker }) => (
                  <div key={role}>
                    <span className="mb-1 flex items-center gap-1 text-[10px] font-heading uppercase tracking-widest text-gray-500 dark:text-gray-400">
                      <Icon aria-hidden="true" className="h-3 w-3" />
                      {t(labelKey)}
                    </span>
                    <Select
                      aria-label={t(labelKey)}
                      fullWidth
                      onChange={(event) => {
                        onSetPieceTaker(role, event.target.value);
                      }}
                      selectSize="xs"
                      value={setPieces[taker] ?? ""}
                    >
                      <option value="">—</option>
                      {starters
                        .filter(
                          (player) =>
                            !outfieldOnly || player.position !== "Goalkeeper",
                        )
                        .map((player) => (
                          <option key={player.id} value={player.id}>
                            {nameById.get(player.id) ?? player.name}
                          </option>
                        ))}
                    </Select>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-1.5 p-3">
                {RESPONSIBILITIES.map(({ labelKey, role, taker }) => (
                  <ReadRow
                    key={role}
                    label={t(labelKey)}
                    value={
                      nameById.get(setPieces[taker] ?? "") ??
                      t("match.notAssigned")
                    }
                  />
                ))}
              </div>
            )}
          </InspectorCard>

          <p className="px-1 text-xs text-gray-500 dark:text-gray-400">
            {t("tactics.nothingSelectedHint")}
          </p>
        </>
      )}
    </section>
  );
}
