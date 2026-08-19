import { getPlayerOvr } from "../../lib/helpers";
import { isSeniorSquadPlayer } from "../../lib/playerSquad";
import type { PlayerData } from "../../store/gameStore";
import type { TacticsPhaseSettings } from "../../store/types";
import {
  buildPitchRows,
  applyLineupSwap,
  buildStartingXIIds,
  type PitchSlotRow,
  canonicalPosition,
  comparePlayersForSlot,
  getPreferredPositions,
  isPlayerOutOfPosition,
  normalisePosition,
  positionCode,
  translatePositionAbbreviation,
  translatePositionLabel,
  type SquadSection,
} from "../squad/SquadTab.helpers";
export { FORMATIONS } from "../match/types";

export type TacticsLayoutMode = "balanced" | "pitch" | "analysis";
export type TacticsTableMode = "lineup" | "roles";
export type SortDirection = "asc" | "desc";
export type SortKey = "pos" | "name" | "condition" | "morale" | "ovr";

export interface TacticsPresetDefinition {
  descriptionKey: string;
  formation: string;
  id: string;
  /**
   * The nine phase dials this preset stands for.
   *
   * A preset used to be only a formation and a play style, which left the
   * blueprint carrying over from whatever was selected before — a tactic named
   * "High press" could sit on passive pressing (#365). Owning the whole shape
   * is what makes the name true.
   */
  phaseBlueprint: TacticsPhaseSettings;
  playStyle: string;
}

export interface TacticsPitchSlot {
  index: number;
  player: PlayerData | null;
  position: string;
  rowLabel: string;
}

export interface TacticsFormationSlotOption {
  index: number;
  label: string;
  position: string;
  shortLabel: string;
}

export const TACTICS_PRESETS: TacticsPresetDefinition[] = [
  {
    id: "balanced-control",
    formation: "4-4-2",
    playStyle: "Balanced",
    descriptionKey: "tactics.presetDescriptions.balanced-control",
    // The neutral reference the other four are read against.
    phaseBlueprint: {
      build_up_style: "Mixed",
      width: "Normal",
      tempo: "Direct",
      defensive_line: "Medium",
      pressing_intensity: "Medium",
      defensive_shape: "Normal",
      marking_style: "Zonal",
      counter_press_duration: "Short",
      break_speed: "Medium",
    },
  },
  {
    id: "wing-play",
    formation: "4-3-3",
    playStyle: "Attacking",
    descriptionKey: "tactics.presetDescriptions.wing-play",
    // Width is the whole idea: stay wide, stretch the block, break quickly.
    phaseBlueprint: {
      build_up_style: "Mixed",
      width: "Wide",
      tempo: "Direct",
      defensive_line: "High",
      pressing_intensity: "Medium",
      defensive_shape: "Stretched",
      marking_style: "Zonal",
      counter_press_duration: "Short",
      break_speed: "Fast",
    },
  },
  {
    id: "high-press",
    formation: "3-4-3",
    playStyle: "HighPress",
    descriptionKey: "tactics.presetDescriptions.high-press",
    // Hunt the ball high and win it back at once; man-marking is what makes
    // the press bite rather than merely follow the ball.
    phaseBlueprint: {
      build_up_style: "Short",
      width: "Wide",
      tempo: "Direct",
      defensive_line: "High",
      pressing_intensity: "Aggressive",
      defensive_shape: "Compact",
      marking_style: "ManToMan",
      counter_press_duration: "Long",
      break_speed: "Fast",
    },
  },
  {
    id: "counter-attack",
    formation: "4-2-3-1",
    playStyle: "Counter",
    descriptionKey: "tactics.presetDescriptions.counter-attack",
    // Patient with the ball and fast without it — the two are not in tension,
    // they are the counter-attack: wait, win it, go.
    phaseBlueprint: {
      build_up_style: "Long",
      width: "Narrow",
      tempo: "Patient",
      defensive_line: "Low",
      pressing_intensity: "Passive",
      defensive_shape: "Compact",
      marking_style: "Zonal",
      counter_press_duration: "None",
      break_speed: "Fast",
    },
  },
  {
    id: "low-block",
    formation: "5-3-2",
    playStyle: "Defensive",
    descriptionKey: "tactics.presetDescriptions.low-block",
    // Concede the ball, concede the half, concede nothing else.
    phaseBlueprint: {
      build_up_style: "Long",
      width: "Narrow",
      tempo: "Patient",
      defensive_line: "VeryLow",
      pressing_intensity: "Passive",
      defensive_shape: "Compact",
      marking_style: "Zonal",
      counter_press_duration: "None",
      break_speed: "Slow",
    },
  },
];

const POSITION_ORDER: Record<string, number> = {
  Goalkeeper: 1,
  Defender: 2,
  Midfielder: 3,
  Forward: 4,
};

interface TacticsPlayerSortContext {
  section: SquadSection;
  sortDir: SortDirection;
  sortKey: SortKey;
  xiActivePosition: Map<string, string>;
}

interface TacticsPlayerFilterContext {
  playerSearch: string;
  positionFilter: string;
  section: SquadSection;
  xiActivePosition: Map<string, string>;
}

interface ResolveStartingXiIdsOptions {
  availablePlayers: PlayerData[];
  formation: string;
  pendingStartingXiIds: string[] | null;
  playersById: Map<string, PlayerData>;
  savedStartingXiIds: string[];
}


export function buildTacticsRoster(
  players: PlayerData[],
  teamId: string | null,
): PlayerData[] {
  if (!teamId) {
    return [];
  }

  return players
    .filter(
      (player) => player.team_id === teamId && isSeniorSquadPlayer(player),
    )
    .sort((leftPlayer, rightPlayer) => {
      return (
        (POSITION_ORDER[normalisePosition(leftPlayer.position)] ?? 99) -
        (POSITION_ORDER[normalisePosition(rightPlayer.position)] ?? 99) ||
        getPlayerOvr(rightPlayer) - getPlayerOvr(leftPlayer)
      );
    });
}

export function resolveStartingXiIds({
  availablePlayers,
  formation,
  pendingStartingXiIds,
  playersById,
  savedStartingXiIds,
}: ResolveStartingXiIdsOptions): string[] {
  const baseIds = buildStartingXIIds(
    availablePlayers,
    savedStartingXiIds,
    formation,
  );
  const slotPositions = buildPitchRows(formation).flatMap((row) => row.positions);

  if (!pendingStartingXiIds || pendingStartingXiIds.length === 0) {
    return baseIds;
  }

  const validPendingIds = pendingStartingXiIds.filter((id) => playersById.has(id));
  const usedPlayerIds = new Set(validPendingIds);
  const fillPlayerIds: string[] = [];
  // The formation owns how many slots there are. Every shipped formation has
  // eleven, but a definition file can describe otherwise and filling to a
  // hard-coded eleven would invent slots the pitch cannot draw.
  const slotCount = slotPositions.length;

  while (validPendingIds.length + fillPlayerIds.length < slotCount) {
    const slotPosition = slotPositions[validPendingIds.length + fillPlayerIds.length];
    const bestPlayer = availablePlayers
      .filter((player) => !usedPlayerIds.has(player.id))
      .sort((leftPlayer, rightPlayer) => comparePlayersForSlot(leftPlayer, rightPlayer, slotPosition))[0];

    if (!bestPlayer) break;
    fillPlayerIds.push(bestPlayer.id);
    usedPlayerIds.add(bestPlayer.id);
  }

  return [...validPendingIds, ...fillPlayerIds].slice(0, slotCount);
}

/**
 * Whether a player may enter the first-team XI at all.
 *
 * `buildPromoteToStartingXi` already refuses an injured player and remains the
 * mutation authority. This is the decision guard the UI asks *before* offering
 * the move, and it additionally excludes youth-squad and missing players so a
 * bench list cannot offer somebody the mutation would then reject.
 */
export function isPlayerEligibleForTacticsLineup(
  player: PlayerData | null | undefined,
): boolean {
  if (!player) {
    return false;
  }

  return isSeniorSquadPlayer(player) && !player.injury;
}

export interface ResolveTacticsStartingXiIdsOptions {
  roster: readonly PlayerData[];
  formation: string;
  pendingStartingXiIds: readonly string[] | null;
  savedStartingXiIds: readonly string[];
}

/**
 * The XI the tactics board should draw right now.
 *
 * A pending XI is the optimistic result of a change the server has not
 * acknowledged yet. It is honoured only for players who are actually eligible —
 * being present in the roster map is not enough, or an injured player could be
 * held on the pitch by a stale optimistic write.
 */
export function resolveTacticsStartingXiIds({
  roster,
  formation,
  pendingStartingXiIds,
  savedStartingXiIds,
}: ResolveTacticsStartingXiIdsOptions): string[] {
  const availablePlayers = roster.filter(isPlayerEligibleForTacticsLineup);

  if (availablePlayers.length === 0) {
    return [];
  }

  const playersById = new Map(
    availablePlayers.map((player) => [player.id, player] as const),
  );
  const eligiblePendingIds = pendingStartingXiIds
    ? pendingStartingXiIds.filter((id) => playersById.has(id))
    : null;

  return resolveStartingXiIds({
    availablePlayers: [...availablePlayers],
    formation,
    pendingStartingXiIds:
      eligiblePendingIds && eligiblePendingIds.length > 0
        ? eligiblePendingIds
        : null,
    playersById,
    savedStartingXiIds: [...savedStartingXiIds],
  });
}

/**
 * Whether the optimistic XI may be dropped in favour of the server's copy.
 *
 * The same ids in a different order is *not* an acknowledgement: the array
 * index owns the formation slot, so a reorder is a different lineup.
 */
export function reconcilePendingStartingXiIds(
  pendingStartingXiIds: readonly string[] | null,
  savedStartingXiIds: readonly string[],
): string[] | null {
  if (!pendingStartingXiIds) {
    return null;
  }

  const acknowledged =
    pendingStartingXiIds.length === savedStartingXiIds.length &&
    pendingStartingXiIds.every((id, index) => savedStartingXiIds[index] === id);

  return acknowledged ? null : [...pendingStartingXiIds];
}

export interface TacticsLineupSelection {
  selectedPlayerId: string | null;
  selectedPlayerSection: SquadSection | null;
  comparePlayerId: string | null;
  comparePlayerSection: SquadSection | null;
}

const EMPTY_TACTICS_LINEUP_SELECTION: TacticsLineupSelection = {
  selectedPlayerId: null,
  selectedPlayerSection: null,
  comparePlayerId: null,
  comparePlayerSection: null,
};

/** The click state machine behind picking two players to swap. */
export function updateTacticsLineupSelection(
  selection: TacticsLineupSelection,
  playerId: string,
  section: SquadSection,
): TacticsLineupSelection {
  const { selectedPlayerId, comparePlayerId } = selection;

  if (!selectedPlayerId || !selection.selectedPlayerSection) {
    return {
      selectedPlayerId: playerId,
      selectedPlayerSection: section,
      comparePlayerId: null,
      comparePlayerSection: null,
    };
  }

  if (playerId === comparePlayerId) {
    return {
      ...selection,
      comparePlayerId: null,
      comparePlayerSection: null,
    };
  }

  if (playerId === selectedPlayerId) {
    // Clicking the first pick again hands the selection to whoever was being
    // compared, so a second click walks the pair forward instead of dead-ending.
    if (comparePlayerId && selection.comparePlayerSection) {
      return {
        selectedPlayerId: comparePlayerId,
        selectedPlayerSection: selection.comparePlayerSection,
        comparePlayerId: null,
        comparePlayerSection: null,
      };
    }

    return { ...EMPTY_TACTICS_LINEUP_SELECTION };
  }

  return {
    ...selection,
    comparePlayerId: playerId,
    comparePlayerSection: section,
  };
}

/**
 * Whether the current pair can actually be swapped.
 *
 * Decision only — `applyLineupSwap` performs the move and stays the authority
 * on where each player lands.
 */
export function canConfirmTacticsLineupSwap(
  currentXiIds: readonly string[],
  playersById: ReadonlyMap<string, PlayerData>,
  selection: TacticsLineupSelection,
): boolean {
  const {
    selectedPlayerId,
    selectedPlayerSection,
    comparePlayerId,
    comparePlayerSection,
  } = selection;

  if (
    !selectedPlayerId ||
    !selectedPlayerSection ||
    !comparePlayerId ||
    !comparePlayerSection ||
    selectedPlayerId === comparePlayerId
  ) {
    return false;
  }

  const participants = [
    { id: selectedPlayerId, from: selectedPlayerSection },
    { id: comparePlayerId, from: comparePlayerSection },
  ];

  for (const participant of participants) {
    const player = playersById.get(participant.id);
    if (!player) {
      return false;
    }
    // Only somebody coming off the bench has to earn a place; a player already
    // in the XI keeps his, injured or not, until he is substituted out.
    if (
      participant.from === "bench" &&
      !isPlayerEligibleForTacticsLineup(player)
    ) {
      return false;
    }
  }

  const nextXiIds = applyLineupSwap(
    [...currentXiIds],
    { id: selectedPlayerId, from: selectedPlayerSection },
    comparePlayerId,
    comparePlayerSection,
  );

  if (!nextXiIds) {
    return false;
  }

  return nextXiIds.some((id, index) => currentXiIds[index] !== id);
}

export function getSectionPlayerPosition(
  player: PlayerData,
  section: SquadSection,
  xiActivePosition: Map<string, string>,
): string {
  if (section === "xi") {
    return xiActivePosition.get(player.id) ?? player.position;
  }

  return player.natural_position || player.position;
}

export function sortTacticsPlayers(
  players: PlayerData[],
  context: TacticsPlayerSortContext,
): PlayerData[] {
  const { section, sortDir, sortKey, xiActivePosition } = context;
  const sortedPlayers = [...players].sort((leftPlayer, rightPlayer) => {
    const leftPosition = getSectionPlayerPosition(leftPlayer, section, xiActivePosition);
    const rightPosition = getSectionPlayerPosition(rightPlayer, section, xiActivePosition);

    switch (sortKey) {
      case "pos":
        return (
          (POSITION_ORDER[normalisePosition(leftPosition)] ?? 99) -
          (POSITION_ORDER[normalisePosition(rightPosition)] ?? 99) ||
          getPlayerOvr(rightPlayer) - getPlayerOvr(leftPlayer)
        );
      case "name":
        return leftPlayer.full_name.localeCompare(rightPlayer.full_name);
      case "condition":
        return leftPlayer.condition - rightPlayer.condition;
      case "morale":
        return leftPlayer.morale - rightPlayer.morale;
      case "ovr":
        return getPlayerOvr(leftPlayer) - getPlayerOvr(rightPlayer);
      default:
        return 0;
    }
  });

  if (sortDir === "desc") {
    return sortedPlayers.reverse();
  }

  return sortedPlayers;
}

export function matchesTacticsPlayerFilters(
  player: PlayerData,
  context: TacticsPlayerFilterContext,
): boolean {
  const { playerSearch, positionFilter, section, xiActivePosition } = context;
  const currentPosition = normalisePosition(
    getSectionPlayerPosition(player, section, xiActivePosition),
  );
  const preferredPositions = getPreferredPositions(player);
  const normalizedSearch = playerSearch.trim().toLowerCase();

  if (normalizedSearch) {
    const searchableText = [
      player.full_name,
      player.match_name,
      currentPosition,
      ...preferredPositions,
      ...preferredPositions.map(positionCode),
    ]
      .join(" ")
      .toLowerCase();

    if (!searchableText.includes(normalizedSearch)) {
      return false;
    }
  }

  if (
    positionFilter !== "All" &&
    currentPosition !== positionFilter &&
    !preferredPositions.includes(positionFilter)
  ) {
    return false;
  }

  return true;
}

export function filterAndSortTacticsPlayers(
  players: PlayerData[],
  filterContext: TacticsPlayerFilterContext,
  sortContext: TacticsPlayerSortContext,
): PlayerData[] {
  return sortTacticsPlayers(
    players.filter((player) => matchesTacticsPlayerFilters(player, filterContext)),
    sortContext,
  );
}

export function countOutOfPositionPlayers(
  startingPlayers: PlayerData[],
  xiActivePosition: Map<string, string>,
): number {
  return startingPlayers.filter((player) => {
    const currentPosition = xiActivePosition.get(player.id) ?? player.position;

    return isPlayerOutOfPosition(player, currentPosition);
  }).length;
}

export function getSelectedAndComparePlayers(
  comparePlayerId: string | null,
  playersById: Map<string, PlayerData>,
  selectedPlayerId: string | null,
): {
  comparePlayer: PlayerData | null;
  selectedPlayer: PlayerData | null;
} {
  const selectedPlayer = selectedPlayerId
    ? playersById.get(selectedPlayerId) ?? null
    : null;

  const comparePlayer =
    selectedPlayerId && comparePlayerId && selectedPlayerId !== comparePlayerId
      ? playersById.get(comparePlayerId) ?? null
      : null;

  return {
    comparePlayer,
    selectedPlayer,
  };
}



/**
 * The formation's slots in index order.
 *
 * There used to be a second set of pitch coordinates computed here, which
 * disagreed with the match pitch about where a five-wide row sits. Placement
 * belongs to the board; this only flattens the rows, preserving slot index so
 * entry `i` stays formation slot `i`.
 */
export function flattenPitchSlotRows(rows: PitchSlotRow[]): TacticsPitchSlot[] {
  return rows.flatMap((row) =>
    row.slots.map((slot) => ({
      index: slot.index,
      player: slot.player,
      position: slot.position,
      rowLabel: row.label,
    })),
  );
}

function getDuplicatedSlotShortLabel(
  position: string,
  duplicateIndex: number,
  duplicateCount: number,
): string {
  const canonical = canonicalPosition(position);

  if (canonical === "CenterBack") {
    if (duplicateCount === 2) return duplicateIndex === 0 ? "LCB" : "RCB";
    if (duplicateCount === 3) {
      return ["LCB", "CB", "RCB"][duplicateIndex] ?? "CB";
    }
  }

  if (canonical === "CentralMidfielder") {
    if (duplicateCount === 2) return duplicateIndex === 0 ? "LCM" : "RCM";
    if (duplicateCount === 3) {
      return ["LCM", "CM", "RCM"][duplicateIndex] ?? "CM";
    }
  }

  if (canonical === "Striker") {
    if (duplicateCount === 2) return duplicateIndex === 0 ? "LS" : "RS";
    if (duplicateCount === 3) {
      return ["LF", "ST", "RF"][duplicateIndex] ?? "ST";
    }
  }

  return `${positionCode(position)} ${duplicateIndex + 1}`;
}

function getDuplicatedSlotLabel(
  translate: (key: string) => string,
  position: string,
  duplicateIndex: number,
  duplicateCount: number,
): string {
  const positionLabel = translatePositionLabel(translate, position);

  if (duplicateCount === 2) {
    return duplicateIndex === 0
      ? `${translate("common.left")} ${positionLabel}`
      : `${translate("common.right")} ${positionLabel}`;
  }

  if (duplicateCount === 3) {
    const descriptors = [
      translate("common.left"),
      translate("common.center"),
      translate("common.right"),
    ];

    return `${descriptors[duplicateIndex] ?? duplicateIndex + 1} ${positionLabel}`;
  }

  return `${positionLabel} ${duplicateIndex + 1}`;
}

export function buildFormationSlotOptions(
  formation: string,
  translate: (key: string) => string,
): TacticsFormationSlotOption[] {
  const positions = buildPitchRows(formation).flatMap((row) => row.positions);
  const duplicateCounts = new Map<string, number>();
  const duplicateIndexes = new Map<string, number>();

  positions.forEach((position) => {
    duplicateCounts.set(position, (duplicateCounts.get(position) ?? 0) + 1);
  });

  return positions.map((position, index) => {
    const duplicateIndex = duplicateIndexes.get(position) ?? 0;
    const duplicateCount = duplicateCounts.get(position) ?? 1;
    duplicateIndexes.set(position, duplicateIndex + 1);

    if (duplicateCount === 1) {
      return {
        index,
        label: translatePositionLabel(translate, position),
        position,
        shortLabel: translatePositionAbbreviation(translate, position),
      };
    }

    return {
      index,
      label: getDuplicatedSlotLabel(
        translate,
        position,
        duplicateIndex,
        duplicateCount,
      ),
      position,
      shortLabel: getDuplicatedSlotShortLabel(
        position,
        duplicateIndex,
        duplicateCount,
      ),
    };
  });
}

export function findTacticsPresetBySetup(
  formation: string,
  playStyle: string,
): TacticsPresetDefinition | null {
  return (
    TACTICS_PRESETS.find(
      (preset) =>
        preset.formation === formation && preset.playStyle === playStyle,
    ) ?? null
  );
}

export function getOverallRatingClassName(overallRating: number): string {
  if (overallRating >= 75) {
    return "text-success-500 dark:text-success-400";
  }

  if (overallRating >= 55) {
    return "text-accent-600 dark:text-accent-400";
  }

  return "text-gray-500 dark:text-gray-400";
}
