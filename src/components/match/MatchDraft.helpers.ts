import type {
  MatchSnapshot,
  MatchTacticsChangeSet,
  Side,
  TacticsConfig,
} from "./types";

/** One swap the manager has decided on but not yet sent. */
export interface MatchLineupDraftChange {
  incomingPlayerId: string;
  outgoingPlayerId: string;
  slotIndex: number;
}

/**
 * Everything the manager has changed at this break, before any of it is sent.
 *
 * The engine applies a `Substitute` command the moment it arrives, so three
 * changes were three round trips and a failure on the third left the first two
 * committed with no way back. Held here instead, they go as one change set that
 * the engine validates whole and commits only if all of it passes.
 */
export interface MatchDraft {
  formation: string | null;
  lineupChanges: MatchLineupDraftChange[];
  playStyle: string | null;
  /** Keyed by formation slot, because that is what a role belongs to. */
  slotRoles: Record<number, string>;
}

export const EMPTY_MATCH_DRAFT: MatchDraft = {
  formation: null,
  lineupChanges: [],
  playStyle: null,
  slotRoles: {},
};

export function isMatchDraftEmpty(draft: MatchDraft): boolean {
  return (
    draft.formation === null &&
    draft.playStyle === null &&
    draft.lineupChanges.length === 0 &&
    Object.keys(draft.slotRoles).length === 0
  );
}

function teamFor(snapshot: MatchSnapshot, side: Side) {
  return side === "Home" ? snapshot.home_team : snapshot.away_team;
}

export function substitutionsRemaining(
  snapshot: MatchSnapshot,
  side: Side,
  draft: MatchDraft,
): number {
  const made = side === "Home" ? snapshot.home_subs_made : snapshot.away_subs_made;
  return Math.max(0, snapshot.max_subs - made - draft.lineupChanges.length);
}

/**
 * Queue a swap, or say why not.
 *
 * The remaining count is known here, so a manager who is out of substitutions
 * is told before a request goes anywhere — rather than assembling a set the
 * engine will refuse whole.
 */
export function queueLineupChange(
  draft: MatchDraft,
  snapshot: MatchSnapshot,
  side: Side,
  change: MatchLineupDraftChange,
): { draft: MatchDraft; refusedRemaining?: number } {
  if (substitutionsRemaining(snapshot, side, draft) <= 0) {
    const made =
      side === "Home" ? snapshot.home_subs_made : snapshot.away_subs_made;
    // The allowance itself, not what is left of it: the manager needs to know
    // how many they had, having just been stopped from queueing one more.
    return { draft, refusedRemaining: Math.max(0, snapshot.max_subs - made) };
  }

  // One change per slot, and the newest wins: choosing a different replacement
  // for the same player is a correction, not a second substitution.
  const lineupChanges = [
    ...draft.lineupChanges.filter(
      (queued) => queued.slotIndex !== change.slotIndex,
    ),
    change,
  ].sort((left, right) => left.slotIndex - right.slotIndex);

  return { draft: { ...draft, lineupChanges } };
}

export function removeLineupChange(
  draft: MatchDraft,
  slotIndex: number,
): MatchDraft {
  return {
    ...draft,
    lineupChanges: draft.lineupChanges.filter(
      (queued) => queued.slotIndex !== slotIndex,
    ),
  };
}

export function removeSlotRole(draft: MatchDraft, slotIndex: number): MatchDraft {
  const slotRoles = { ...draft.slotRoles };
  delete slotRoles[slotIndex];
  return { ...draft, slotRoles };
}

/**
 * The draft as the engine wants it: total, not a patch.
 *
 * `apply_tactics_change_set` replaces the side's whole tactical state, so
 * everything the manager did *not* touch is read from the snapshot they are
 * looking at rather than left out.
 */
export function buildMatchTacticsChangeSet({
  draft,
  side,
  snapshot,
}: {
  draft: MatchDraft;
  side: Side;
  snapshot: MatchSnapshot;
}): MatchTacticsChangeSet {
  const team = teamFor(snapshot, side);

  return {
    side,
    formation: draft.formation ?? team.formation,
    play_style: draft.playStyle ?? team.play_style,
    tactics: team.tactics as TacticsConfig,
    slot_roles: team.players.map(
      (player, slotIndex) =>
        draft.slotRoles[slotIndex] ?? player.role ?? "Standard",
    ),
    lineup_changes: draft.lineupChanges.map((change) => ({
      slot_index: change.slotIndex,
      // The client states who it believed was in the slot; the engine refuses
      // the whole set if they have moved since.
      expected_outgoing_player_id: change.outgoingPlayerId,
      incoming_player_id: change.incomingPlayerId,
    })),
    assignments:
      side === "Home" ? snapshot.home_set_pieces : snapshot.away_set_pieces,
  };
}
