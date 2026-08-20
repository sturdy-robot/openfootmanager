import {
  Check,
  Copy,
  Crosshair,
  Flag,
  HelpCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Shield,
  Target,
  Undo2,
  Zap,
} from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";

import { Badge, Button, Card, Select } from "../ui";
import type { TacticsDraftControls } from "./TacticsCustomTactics.helpers";
import { FORMATIONS } from "./TacticsTab.helpers";

export interface TacticsLibraryEntry {
  description: string;
  formation: string;
  id: string;
  name: string;
  playStyle: string;
  sourcePresetName?: string | null;
  type: "preset" | "custom";
}

interface TacticsCommandBarProps {
  activeTactic: TacticsLibraryEntry;
  activePlayStyle: string;
  /** Apply / Revert / Reset availability, from the staged draft. */
  draftControls: TacticsDraftControls;
  /** Translation key for the outcome of the last apply or save, if any. */
  /** Already-localized; the screen has one voice and this is what it just said. */
  feedback: string;
  formation: string;
  isApplying: boolean;
  isDirty: boolean;
  outOfPositionCount: number;
  onApply: () => void;
  onCreateNew: () => void;
  onDuplicate: () => void;
  onFormationChange: (formation: string) => void;
  onPlayStyleChange: (playStyle: string) => void;
  onReset: () => void;
  onRevert: () => void;
  onSave: () => void;
  onSelectTactic: (id: string) => void;
  saveDisabled: boolean;
  tacticLibrary: TacticsLibraryEntry[];
}

const PLAY_STYLES = [
  { id: "Balanced", icon: <Target className="h-3.5 w-3.5" /> },
  { id: "Attacking", icon: <Zap className="h-3.5 w-3.5" /> },
  { id: "Defensive", icon: <Shield className="h-3.5 w-3.5" /> },
  { id: "Possession", icon: <RefreshCw className="h-3.5 w-3.5" /> },
  { id: "Counter", icon: <Crosshair className="h-3.5 w-3.5" /> },
  { id: "HighPress", icon: <Flag className="h-3.5 w-3.5" /> },
] as const;

function summarizeTactic(entry: TacticsLibraryEntry, t: TFunction): string {
  return `${entry.formation} - ${t(`common.playStyles.${entry.playStyle}`, entry.playStyle)}`;
}

/** What the ring, the bar and the pitch's gestures mean — on request. */
function PitchLegend(): JSX.Element {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={t("tactics.pitchLegend")}
        onClick={() => {
          setIsOpen((open) => !open);
        }}
        onKeyDown={(event) => {
          // On the trigger, not the popover: nothing inside the popover takes
          // focus, so a handler there could never fire.
          if (event.key === "Escape") {
            setIsOpen(false);
          }
        }}
        className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 text-[11px] font-heading font-bold text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 dark:border-navy-600 dark:text-gray-400 dark:hover:bg-navy-700 dark:hover:text-gray-200 dark:focus:ring-offset-navy-800"
      >
        <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {isOpen ? (
        <div
          className="absolute left-0 top-8 z-30 w-72 rounded-xl border border-gray-200 bg-white p-3 shadow-lg dark:border-navy-600 dark:bg-navy-800"
          role="group"
          aria-label={t("tactics.pitchLegend")}
        >
          <div className="space-y-1.5">
            {(
              [
                ["squad.naturalFit", "bg-success-400"],
                ["pitchToken.adaptedToSlot", "bg-accent-400"],
                ["squad.outOfPosition", "bg-red-400"],
              ] as const
            ).map(([labelKey, tone]) => (
              <div key={labelKey} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={`h-3 w-3 shrink-0 rounded-full ${tone}`}
                />
                <span className="text-xs text-gray-600 dark:text-gray-300">
                  {t(labelKey)}
                </span>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="flex shrink-0 gap-0.5">
                <span className="h-1.5 w-2 rounded-full bg-primary-500" />
                <span className="h-1.5 w-2 rounded-full bg-amber-500" />
                <span className="h-1.5 w-2 rounded-full bg-red-500" />
              </span>
              <span className="text-xs text-gray-600 dark:text-gray-300">
                {t("common.condition")} · {t("tactics.conditionBands")}
              </span>
            </div>
          </div>
          <p className="mt-2 border-t border-gray-100 pt-2 text-xs text-gray-500 dark:border-navy-700 dark:text-gray-400">
            {t("tactics.pitchInteractionHint")}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export default function TacticsCommandBar({
  activeTactic,
  activePlayStyle,
  draftControls,
  feedback,
  formation,
  isApplying,
  isDirty,
  outOfPositionCount,
  onApply,
  onCreateNew,
  onDuplicate,
  onFormationChange,
  onPlayStyleChange,
  onReset,
  onRevert,
  onSave,
  onSelectTactic,
  saveDisabled,
  tacticLibrary,
}: TacticsCommandBarProps): JSX.Element {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeEntryIndex, setActiveEntryIndex] = useState(0);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const pickerTriggerRef = useRef<HTMLButtonElement | null>(null);
  const pickerSearchRef = useRef<HTMLInputElement | null>(null);
  const listboxId = useId();

  const filteredLibrary = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return tacticLibrary;
    }

    return tacticLibrary.filter((entry) =>
      [
        entry.name,
        entry.description,
        entry.formation,
        entry.playStyle,
        entry.sourcePresetName,
        entry.type,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [search, tacticLibrary]);

  const presetEntries = filteredLibrary.filter((entry) => entry.type === "preset");
  const customEntries = filteredLibrary.filter((entry) => entry.type === "custom");
  // The order the arrow keys walk: what is on screen, top to bottom.
  const visibleEntries = [...customEntries, ...presetEntries];
  const activeEntry = visibleEntries[activeEntryIndex];
  const optionId = (entryId: string) => `${listboxId}-${entryId}`;

  function openPicker(): void {
    const startIndex = visibleEntries.findIndex(
      (entry) => entry.id === activeTactic.id,
    );
    setActiveEntryIndex(startIndex >= 0 ? startIndex : 0);
    setIsOpen(true);
  }

  function closePicker({ restoreFocus }: { restoreFocus: boolean }): void {
    setIsOpen(false);
    setSearch("");
    if (restoreFocus) {
      pickerTriggerRef.current?.focus();
    }
  }

  function choosePickerEntry(entryId: string): void {
    onSelectTactic(entryId);
    closePicker({ restoreFocus: true });
  }

  function handlePickerKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    if (event.key === "Escape") {
      event.preventDefault();
      closePicker({ restoreFocus: true });
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (visibleEntries.length === 0) {
        return;
      }
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveEntryIndex(
        (current) =>
          (current + step + visibleEntries.length) % visibleEntries.length,
      );
      return;
    }

    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setActiveEntryIndex(event.key === "Home" ? 0 : visibleEntries.length - 1);
      return;
    }

    if (event.key === "Enter" && activeEntry) {
      event.preventDefault();
      choosePickerEntry(activeEntry.id);
    }
  }

  const saveLabel =
    activeTactic.type === "custom"
      ? t("tactics.updateTactic")
      : t("tactics.saveAsTactic");

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  return (
    <Card className="overflow-visible">
      <div ref={wrapperRef} className="p-4 sm:p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-heading font-bold uppercase tracking-[0.24em] text-gray-500 dark:text-gray-400">
                  {t("tactics.presetTactics")}
                </span>
                <Badge
                  variant={activeTactic.type === "custom" ? "accent" : "success"}
                  size="sm"
                >
                  {activeTactic.type === "custom"
                    ? t("tactics.customTactic")
                    : t("tactics.activePreset")}
                </Badge>
                <Badge variant={isDirty ? "accent" : "neutral"} size="sm">
                  {isDirty ? t("tactics.unsavedChanges") : t("tactics.synced")}
                </Badge>
                {outOfPositionCount > 0 ? (
                  <Badge variant="danger" size="sm">
                    {outOfPositionCount} {t("squad.outOfPosition")}
                  </Badge>
                ) : null}
                <PitchLegend />
              </div>
              {/*
                The one place the screen speaks back. It has to be a live region
                because the manager's attention is on the pitch, not on the
                button they just pressed — the complaint in #377 was that a
                successful save looked exactly like a broken one.
              */}
              {/* Visible only. The spoken copy is a single live region owned
                  by the screen, so a later message cannot be masked by an
                  earlier one that was never cleared. */}
              <p className="mt-2 min-h-5 text-sm text-gray-600 dark:text-gray-300">
                {feedback}
              </p>
              <p className="mt-2 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
                {activeTactic.description}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 xl:justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                icon={<Plus />}
                onClick={onCreateNew}
              >
                {t("tactics.newTactic")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                icon={<Copy />}
                onClick={onDuplicate}
              >
                {t("tactics.duplicateTactic")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                icon={<Save />}
                disabled={saveDisabled}
                onClick={onSave}
              >
                {saveLabel}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                icon={<Undo2 />}
                disabled={!draftControls.canReset}
                onClick={onReset}
              >
                {t("tactics.resetToPreset")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                icon={<RotateCcw />}
                disabled={!draftControls.canRevert}
                onClick={onRevert}
              >
                {t("tactics.revertChanges")}
              </Button>
              <Button
                type="button"
                variant="accent"
                size="sm"
                icon={<Check />}
                disabled={!draftControls.canApply}
                onClick={onApply}
              >
                {isApplying
                  ? t("tactics.applyingChanges")
                  : t("tactics.applyChanges")}
              </Button>
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)_minmax(0,1.2fr)]">
            <div className="relative rounded-2xl border border-gray-200/70 bg-gray-50/80 p-3 dark:border-navy-600 dark:bg-navy-900/35">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="text-[11px] font-heading font-bold uppercase tracking-[0.24em] text-gray-500 dark:text-gray-400">
                  {t("tactics.chooseTactic")}
                </div>
                <div className="text-[10px] font-heading font-bold uppercase tracking-[0.18em] text-primary-500 dark:text-primary-300">
                  {activeTactic.type === "custom"
                    ? t("tactics.myTactics")
                    : t("tactics.presets")}
                </div>
              </div>

              <button
                type="button"
                aria-controls={isOpen ? listboxId : undefined}
                aria-expanded={isOpen}
                aria-haspopup="listbox"
                aria-label={t("tactics.chooseTactic")}
                onClick={() => {
                  if (isOpen) {
                    closePicker({ restoreFocus: false });
                  } else {
                    openPicker();
                  }
                }}
                ref={pickerTriggerRef}
                className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-3 text-left transition-colors hover:border-primary-300 dark:border-white/10 dark:bg-navy-800/90 dark:hover:border-primary-400"
              >
                <div className="min-w-0">
                  <div className="truncate text-base font-heading font-bold text-gray-900 dark:text-gray-100">
                    {activeTactic.name}
                  </div>
                  <div className="mt-1 truncate text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                    {summarizeTactic(activeTactic, t)}
                  </div>
                </div>
                <div className="shrink-0 rounded-full bg-primary-500/10 px-2 py-1 text-[10px] font-heading font-bold uppercase tracking-[0.18em] text-primary-500 dark:text-primary-300">
                  {activeTactic.type === "custom"
                    ? t("tactics.myTactics")
                    : t("tactics.presets")}
                </div>
              </button>

              {isOpen ? (
                <div
                  className="absolute left-0 right-0 top-full z-50 mt-2 rounded-2xl border border-gray-200 bg-white p-2 shadow-2xl dark:border-navy-600 dark:bg-navy-800"
                  onKeyDown={handlePickerKeyDown}
                >
                  <div className="mb-2 flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 dark:border-navy-600 dark:bg-navy-700">
                    <Search className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                    {/*
                      Focus stays here while the arrows move a highlight in the
                      list below — which is what `aria-activedescendant` is for.
                      Moving real focus onto the options would take the search
                      box away from under the manager's hands mid-search.
                    */}
                    <input
                      type="text"
                      value={search}
                      onChange={(event) => {
                        setSearch(event.target.value);
                        setActiveEntryIndex(0);
                      }}
                      aria-activedescendant={
                        activeEntry ? optionId(activeEntry.id) : undefined
                      }
                      aria-controls={listboxId}
                      aria-label={t("tactics.searchTactics")}
                      autoFocus
                      placeholder={t("tactics.searchTactics")}
                      ref={pickerSearchRef}
                      className="w-full bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400 dark:text-gray-100"
                    />
                  </div>

                  <div
                    role="listbox"
                    aria-label={t("tactics.chooseTactic")}
                    id={listboxId}
                    className="max-h-80 space-y-3 overflow-y-auto p-1"
                  >
                    {customEntries.length > 0 ? (
                      <div role="group" aria-label={t("tactics.myTactics")}>
                        <div
                          aria-hidden="true"
                          className="mb-2 px-2 text-[11px] font-heading font-bold uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400"
                        >
                          {t("tactics.myTactics")}
                        </div>
                        <div className="space-y-1">
                          {customEntries.map((entry) => (
                            <button
                              key={entry.id}
                              type="button"
                              role="option"
                              aria-selected={entry.id === activeTactic.id}
                              id={optionId(entry.id)}
                              tabIndex={-1}
                              onClick={() => {
                                choosePickerEntry(entry.id);
                              }}
                              className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                                entry.id === activeEntry?.id
                                  ? "border-primary-400 bg-primary-50 ring-2 ring-primary-400 dark:border-primary-300 dark:bg-primary-500/15"
                                  : entry.id === activeTactic.id
                                    ? "border-primary-300 bg-primary-50 dark:border-primary-400 dark:bg-primary-500/10"
                                    : "border-transparent bg-gray-50 hover:border-gray-200 hover:bg-white dark:bg-navy-700/70 dark:hover:border-navy-500 dark:hover:bg-navy-700"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-heading font-bold text-gray-900 dark:text-gray-100">
                                    {entry.name}
                                  </div>
                                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    {entry.description}
                                  </div>
                                </div>
                                <span className="shrink-0 text-[11px] font-heading font-bold uppercase tracking-[0.18em] text-primary-500 dark:text-primary-300">
                                  {summarizeTactic(entry, t)}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div role="group" aria-label={t("tactics.presets")}>
                      <div
                        aria-hidden="true"
                        className="mb-2 px-2 text-[11px] font-heading font-bold uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400"
                      >
                        {t("tactics.presets")}
                      </div>
                      <div className="space-y-1">
                        {presetEntries.map((entry) => (
                          <button
                            key={entry.id}
                            type="button"
                            role="option"
                            aria-selected={entry.id === activeTactic.id}
                            id={optionId(entry.id)}
                            tabIndex={-1}
                            onClick={() => {
                              choosePickerEntry(entry.id);
                            }}
                            className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                              entry.id === activeEntry?.id
                                ? "border-primary-400 bg-primary-50 ring-2 ring-primary-400 dark:border-primary-300 dark:bg-primary-500/15"
                                : entry.id === activeTactic.id
                                  ? "border-primary-300 bg-primary-50 dark:border-primary-400 dark:bg-primary-500/10"
                                  : "border-transparent bg-gray-50 hover:border-gray-200 hover:bg-white dark:bg-navy-700/70 dark:hover:border-navy-500 dark:hover:bg-navy-700"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-heading font-bold text-gray-900 dark:text-gray-100">
                                  {entry.name}
                                </div>
                                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                  {entry.description}
                                </div>
                              </div>
                              <span className="shrink-0 text-[11px] font-heading font-bold uppercase tracking-[0.18em] text-primary-500 dark:text-primary-300">
                                {summarizeTactic(entry, t)}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-gray-200/70 bg-gray-50/80 p-3 dark:border-navy-600 dark:bg-navy-900/35">
              <div className="mb-2 text-[11px] font-heading font-bold uppercase tracking-[0.24em] text-gray-500 dark:text-gray-400">
                {t("tactics.formation")}
              </div>
              <Select
                value={FORMATIONS.includes(formation) ? formation : FORMATIONS[0]}
                onChange={(e) => onFormationChange(e.target.value)}
                fullWidth
                aria-label={t("tactics.formation")}
              >
                {FORMATIONS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </Select>
            </div>

            <div className="rounded-2xl border border-gray-200/70 bg-gray-50/80 p-3 dark:border-navy-600 dark:bg-navy-900/35">
              <div className="mb-2 text-[11px] font-heading font-bold uppercase tracking-[0.24em] text-gray-500 dark:text-gray-400">
                {t("tactics.playStyle")}
              </div>
              <Select
                value={activePlayStyle}
                onChange={(e) => onPlayStyleChange(e.target.value)}
                fullWidth
                aria-label={t("tactics.playStyle")}
              >
                {PLAY_STYLES.map((style) => (
                  // Native <option> renders text only — an icon/span child is
                  // stripped by the browser and warns in React, so use plain text.
                  <option key={style.id} value={style.id}>
                    {t(`common.playStyles.${style.id}`, style.id)}
                  </option>
                ))}
              </Select>
            </div>

          </div>
        </div>
      </div>
    </Card>
  );
}
