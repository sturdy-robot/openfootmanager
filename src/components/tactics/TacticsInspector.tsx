import type { JSX, ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  Award,
  CircleDot,
  CornerDownRight,
  Crown,
  Footprints,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import type {
  GameStateData,
  PlayerData,
  TeamMatchRolesData,
} from "../../store/gameStore";
import type { PlayerRole, TacticsPhaseSettings } from "../../store/types";
import { setTeamMatchRoles } from "../../services/squadService";
import { getRoleOptions } from "../../lib/playerRoles";
import { translatePositionLabel } from "../squad/SquadTab.helpers";
import SetPieceSelector from "../match/SetPieceSelector";
import { Button, Select } from "../ui";
import { PHASE_FIELD_SECTIONS, PhaseBlueprintPanel } from "./PhaseBlueprintPanel";
import TacticsPlayerFocusPanel, {
  SinglePlayerAttributes,
} from "./TacticsPlayerFocusPanel";
import {
  buildUpdatedMatchRolesForAssignment,
  resolveEffectiveMatchRoles,
} from "./TacticsRoles.helpers";

/**
 * The five responsibilities, in the order they are read on a team sheet.
 * Paired with the icon that stands for each one in the editor.
 */
const RESPONSIBILITIES: {
  Icon: typeof Crown;
  key: keyof TeamMatchRolesData;
  labelKey: string;
  /** A goalkeeper can wear the armband; they do not take the corners. */
  outfieldOnly: boolean;
  role: string;
}[] = [
  { Icon: Crown, key: "captain", labelKey: "preMatch.captain", outfieldOnly: false, role: "captain" },
  { Icon: Award, key: "vice_captain", labelKey: "tactics.viceCaptain", outfieldOnly: false, role: "vicecaptain" },
  { Icon: CircleDot, key: "penalty_taker", labelKey: "preMatch.penaltyTaker", outfieldOnly: true, role: "penalty" },
  { Icon: Footprints, key: "free_kick_taker", labelKey: "preMatch.freeKickTaker", outfieldOnly: true, role: "freekick" },
  { Icon: CornerDownRight, key: "corner_taker", labelKey: "preMatch.cornerTaker", outfieldOnly: true, role: "corner" },
];

interface TacticsInspectorProps {
  allSquad: PlayerData[];
  canConfirmSwap: boolean;
  comparePlayer: PlayerData | null;
  /** The slot the selected player is deployed in, when they are in the XI. */
  deployedPosition?: string;
  /**
   * False while a formation change is staged and unsent. The pitch is then
   * drawing slots the server does not have, so a role chosen against them
   * would be validated against the old shape — and overwritten by the draft's
   * own roles on Apply. The picker comes back once the shape is settled.
   */
  isShapeSettled: boolean;
  /**
   * Whether the selected player is in the starting XI the *server* holds. The
   * board draws a best-guess XI when none has been saved, and the backend
   * refuses a role for a player who is not in the stored list — so offering the
   * picker there would be offering a control that cannot work.
   */
  isSelectedPlayerInSavedXi: boolean;
  matchRoles?: TeamMatchRolesData;
  onAssignBestFit: (playerId: string) => void;
  onClearSelection: () => void;
  /**
   * Open the assignment dialog for the slot this player occupies. Enter on the
   * pitch does the same thing; this is how a pointer gets there.
   */
  onReplaceInSlot?: () => void;
  onConfirmSwap: () => void;
  onGameUpdate: (game: GameStateData) => void;
  onOpenPlayerProfile: (playerId: string) => void;
  onPlayerRoleChange: (playerId: string, role: PlayerRole) => void;
  onTacticsPhaseChange: (patch: Partial<TacticsPhaseSettings>) => void;
  playerRoles: Record<string, PlayerRole>;
  selectedPlayer: PlayerData | null;
  startingPlayers: PlayerData[];
  tacticsPhase?: TacticsPhaseSettings;
}

export function InspectorCard({
  children,
  id,
  onToggleEditing,
  isEditing,
  title,
}: {
  children: ReactNode;
  /** Distinguishes this card's controls from the other card's. */
  id: string;
  isEditing: boolean;
  onToggleEditing: () => void;
  title: string;
}): JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-navy-600 dark:bg-navy-800">
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-3 py-2 dark:border-navy-700">
        <h3
          id={`${id}-title`}
          className="text-[11px] font-heading font-bold uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400"
        >
          {title}
        </h3>
        {/*
          Named by its own word *and* its section heading. Two buttons both
          called "Adjust" are indistinguishable in a screen reader's controls
          list, and this pane has exactly two.
        */}
        <button
          type="button"
          aria-controls={`${id}-body`}
          aria-expanded={isEditing}
          aria-labelledby={`${id}-action ${id}-title`}
          id={`${id}-action`}
          onClick={onToggleEditing}
          className="rounded-lg border border-gray-200 px-2 py-1 text-[10px] font-heading font-bold uppercase tracking-[0.18em] text-gray-600 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 dark:border-navy-600 dark:text-gray-300 dark:hover:bg-navy-700 dark:focus:ring-offset-navy-800"
        >
          {isEditing ? t("tactics.done") : t("tactics.adjust")}
        </button>
      </div>
      <div id={`${id}-body`}>{children}</div>
    </div>
  );
}

/** A label and its value, which is all a setting is until you want to change it. */
export function ReadRow({
  label,
  value,
}: {
  label: string;
  value: string;
}): JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[11px] text-gray-500 dark:text-gray-400">
        {label}
      </span>
      <span className="text-right text-xs font-medium text-gray-900 dark:text-gray-100">
        {value}
      </span>
    </div>
  );
}

export default function TacticsInspector({
  allSquad,
  canConfirmSwap,
  comparePlayer,
  deployedPosition,
  isShapeSettled,
  isSelectedPlayerInSavedXi,
  matchRoles,
  onAssignBestFit,
  onClearSelection,
  onReplaceInSlot,
  onConfirmSwap,
  onGameUpdate,
  onOpenPlayerProfile,
  onPlayerRoleChange,
  onTacticsPhaseChange,
  playerRoles,
  selectedPlayer,
  startingPlayers,
  tacticsPhase,
}: TacticsInspectorProps): JSX.Element {
  const { t } = useTranslation();
  const [editingInstructions, setEditingInstructions] = useState(false);
  const [editingResponsibilities, setEditingResponsibilities] = useState(false);

  const effectiveRoles = useMemo(
    () => resolveEffectiveMatchRoles(startingPlayers, matchRoles),
    [matchRoles, startingPlayers],
  );

  const selectorPlayers = useMemo(
    () =>
      startingPlayers.map((player) => ({
        id: player.id,
        name: player.match_name || player.full_name,
        position: player.position,
      })),
    [startingPlayers],
  );

  const nameById = useMemo(
    () => new Map(allSquad.map((player) => [player.id, player.match_name || player.full_name])),
    [allSquad],
  );

  async function persistMatchRoles(next: TeamMatchRolesData): Promise<void> {
    try {
      onGameUpdate(await setTeamMatchRoles(next));
    } catch (error) {
      console.error("Failed to set team match roles:", error);
    }
  }

  function handleResponsibilityChange(
    key: keyof TeamMatchRolesData,
    playerId: string,
  ): void {
    void persistMatchRoles(
      buildUpdatedMatchRolesForAssignment(
        effectiveRoles,
        startingPlayers,
        key,
        playerId,
      ),
    );
  }

  return (
    <section
      aria-label={t("tactics.detailsPane")}
      className="flex min-h-0 flex-col gap-4 overflow-y-auto @3xl/tactics:col-span-3 @5xl/tactics:col-span-1"
    >
      {selectedPlayer && comparePlayer ? (
        // The comparison was a modal only because there was nowhere to put it.
        // There is now, so it stops covering the pitch it is talking about.
        <TacticsPlayerFocusPanel
          canConfirmSwap={canConfirmSwap}
          comparePlayer={comparePlayer}
          onClose={onClearSelection}
          onConfirmSwap={onConfirmSwap}
          selectedPlayer={selectedPlayer}
        />
      ) : selectedPlayer ? (
        <div className="rounded-xl border border-gray-200 bg-white dark:border-navy-600 dark:bg-navy-800">
          <div className="border-b border-gray-100 px-3 py-2 dark:border-navy-700">
            <p className="text-[11px] font-heading font-bold uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400">
              {t("tactics.selectedPlayer")}
            </p>
            <h3 className="truncate text-sm font-heading font-bold text-gray-900 dark:text-gray-100">
              {selectedPlayer.full_name}
            </h3>
          </div>
          <div className="space-y-3 p-3">
            <div className="space-y-1.5">
              <ReadRow
                label={t("tactics.deployedSlot")}
                value={
                  deployedPosition
                    ? translatePositionLabel(t, deployedPosition)
                    : t("match.notAssigned")
                }
              />
              {/* The natural position is never mutated by a deployment (#272),
                  so the two are stated as the separate facts they are. */}
              <ReadRow
                label={t("tactics.naturalPosition")}
                value={translatePositionLabel(
                  t,
                  selectedPlayer.natural_position || selectedPlayer.position,
                )}
              />
              <ReadRow
                label={t("common.condition")}
                value={`${Math.round(selectedPlayer.condition)}%`}
              />
            </div>

            {deployedPosition && isShapeSettled && isSelectedPlayerInSavedXi ? (
              <div>
                <span className="mb-1 block text-[11px] text-gray-500 dark:text-gray-400">
                  {t("tactics.playerRoleLabel")}
                </span>
                <Select
                  aria-label={t("tactics.playerRoleLabel")}
                  fullWidth
                  onChange={(event) => {
                    onPlayerRoleChange(
                      selectedPlayer.id,
                      event.target.value as PlayerRole,
                    );
                  }}
                  selectSize="sm"
                  value={playerRoles[selectedPlayer.id] ?? "Standard"}
                >
                  {getRoleOptions(
                    // Roles follow the deployed slot, which is what the backend
                    // validates against — a natural-position role for an
                    // out-of-position player is rejected and silently reverts.
                    deployedPosition,
                    playerRoles[selectedPlayer.id] ?? "Standard",
                  ).map((role) => (
                    <option key={role} value={role}>
                      {t(`tactics.playerRoles.${role}`, role)}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                type="button"
                onClick={() => {
                  onAssignBestFit(selectedPlayer.id);
                }}
              >
                {t("tactics.assignBestFit")}
              </Button>
              <Button
                size="sm"
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenPlayerProfile(selectedPlayer.id);
                }}
              >
                {t("tactics.openProfile")}
              </Button>
              {deployedPosition && onReplaceInSlot ? (
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={onReplaceInSlot}
                >
                  {t("tactics.replaceInSlot")}
                </Button>
              ) : null}
            </div>

            <SinglePlayerAttributes player={selectedPlayer} />
          </div>
        </div>
      ) : (
        <>
          <InspectorCard
            id="tactics-team-instructions"
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
                          value={t(
                            `tactics.phaseSettings.${labelKey}_${value}`,
                            value,
                          )}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </InspectorCard>

          <InspectorCard
            id="tactics-responsibilities"
            isEditing={editingResponsibilities}
            onToggleEditing={() => {
              setEditingResponsibilities((open) => !open);
            }}
            title={t("tactics.responsibilities")}
          >
            {startingPlayers.length === 0 ? (
              <p className="p-3 text-center text-xs text-gray-500 dark:text-gray-400">
                {t("tactics.noStartersForRoles")}
              </p>
            ) : editingResponsibilities ? (
              <div className="space-y-1 p-3">
                <button
                  type="button"
                  onClick={() => {
                    void persistMatchRoles(effectiveRoles);
                  }}
                  className="mb-2 w-full rounded-lg border border-primary-200 py-1.5 text-[10px] font-heading font-bold uppercase tracking-[0.18em] text-primary-500 transition-colors hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 dark:border-primary-500/30 dark:text-primary-400 dark:hover:bg-primary-500/10 dark:focus:ring-offset-navy-800"
                >
                  {t("tactics.autoSelectAssignments")}
                </button>
                {RESPONSIBILITIES.map(({ Icon, key, labelKey, outfieldOnly, role }) => (
                  <SetPieceSelector
                    key={key}
                    allSquad={allSquad}
                    currentId={effectiveRoles[key]}
                    icon={<Icon className="h-4 w-4" />}
                    label={t(labelKey)}
                    onSelect={(id) => {
                      handleResponsibilityChange(key, id);
                    }}
                    players={
                      outfieldOnly
                        ? selectorPlayers.filter(
                            (player) => player.position !== "Goalkeeper",
                          )
                        : selectorPlayers
                    }
                    role={role}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-1.5 p-3">
                {RESPONSIBILITIES.map(({ key, labelKey }) => (
                  <ReadRow
                    key={key}
                    label={t(labelKey)}
                    value={
                      nameById.get(effectiveRoles[key] ?? "") ??
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
