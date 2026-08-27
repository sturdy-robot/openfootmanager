import { useEffect, useMemo, useRef, useState, type JSX } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { getPlayerOvr } from "../../lib/helpers";
import { resolveInjuryName } from "../../lib/injury";
import type { PlayerData } from "../../store/gameStore";
import {
  comparePlayersForSlot,
  translatePositionLabel,
} from "../squad/SquadTab.helpers";
import { isPlayerEligibleForTacticsLineup } from "./TacticsTab.helpers";
import { useDialogFocusTrap } from "../../hooks/useDialogFocusTrap";

interface TacticsAssignmentDialogProps {
  candidates: PlayerData[];
  occupant: PlayerData | null;
  onAssign: (playerId: string) => void;
  onClose: () => void;
  slotIndex: number;
  slotPosition: string;
}

export default function TacticsAssignmentDialog({
  candidates,
  occupant,
  onAssign,
  onClose,
  slotIndex,
  slotPosition,
}: TacticsAssignmentDialogProps): JSX.Element {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const title = t("tactics.assignSlot", {
    position: translatePositionLabel(t, slotPosition),
  });

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const filteredCandidates = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return candidates
      .filter((player) => player.id !== occupant?.id)
      .filter((player) => {
        if (!query) {
          return true;
        }
        return `${player.match_name} ${player.full_name}`
          .toLocaleLowerCase()
          .includes(query);
      })
      .sort((left, right) =>
        comparePlayersForSlot(left, right, slotPosition),
      );
  }, [candidates, occupant?.id, search, slotPosition]);

  const dialog = useDialogFocusTrap<HTMLDivElement>(onClose);

  // Portalled to the body. The tactics workbench declares `@container/tactics`,
  // and a container is a containing block for `position: fixed` descendants —
  // so rendered in place this "modal" covered the tab and left the sidebar
  // clickable underneath it.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 px-4 dark:bg-black/70"
      onClick={onClose}
      role="presentation"
    >
      <div
        aria-label={title}
        aria-modal="true"
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-navy-600 dark:bg-navy-900"
        onClick={(event) => {
          event.stopPropagation();
        }}
        onKeyDown={dialog.onKeyDown}
        role="dialog"
      >
        <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-navy-700">
          <h2 className="font-heading text-lg font-bold text-gray-900 dark:text-gray-100">
            {title}
          </h2>
          <button
            className="rounded-lg px-3 py-2 text-xs font-heading font-bold uppercase tracking-wider text-gray-600 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 dark:text-gray-300 dark:hover:bg-navy-700 dark:focus:ring-offset-navy-900"
            onClick={onClose}
            type="button"
          >
            {t("common.close")}
          </button>
        </div>

        <div className="border-b border-gray-200 p-4 dark:border-navy-700">
          <label
            className="mb-1.5 block text-xs font-heading font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300"
            htmlFor={`tactics-slot-search-${slotIndex}`}
          >
            {t("squad.filterPlayers")}
          </label>
          <input
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 dark:border-navy-600 dark:bg-navy-800 dark:text-gray-100 dark:focus:ring-offset-navy-900"
            id={`tactics-slot-search-${slotIndex}`}
            onChange={(event) => setSearch(event.target.value)}
            ref={searchRef}
            type="search"
            value={search}
          />
        </div>

        <div className="min-h-0 overflow-y-auto p-3">
          {filteredCandidates.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              {t("tactics.noCandidates")}
            </p>
          ) : (
            <div className="space-y-1">
              {filteredCandidates.map((player) => (
                <button
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-navy-700 dark:focus:ring-offset-navy-900"
                  disabled={!isPlayerEligibleForTacticsLineup(player)}
                  key={player.id}
                  onClick={() => onAssign(player.id)}
                  type="button"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-heading font-bold text-gray-900 dark:text-gray-100">
                      {player.match_name || player.full_name}
                    </span>
                    <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                      {player.full_name}
                      {player.injury
                        ? ` · ${resolveInjuryName(player.injury.name, t)}`
                        : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-heading font-bold text-primary-600 dark:text-primary-400">
                    {getPlayerOvr(player)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export type { TacticsAssignmentDialogProps };
