import type { PlayerDef } from "./types";

/** A player paired with its index in the unfiltered array. */
export interface IndexedPlayer {
  player: PlayerDef;
  i: number;
}

export interface FilterPlayerRowsParams {
  players: PlayerDef[];
  /** Omit to include every player; set to scope to the youth or senior list. */
  youthOnly?: boolean;
  query: string;
  teamNames: Map<string, string>;
}

export interface FilteredPlayerRows {
  /** Everything in scope, before the search box narrows it. */
  scoped: IndexedPlayer[];
  /** What the search box left. */
  filtered: IndexedPlayer[];
}

function displayName(player: PlayerDef): string {
  return player.name || `${player.firstName} ${player.lastName}`;
}

/**
 * Narrow the player list, keeping each player's index in the array it came
 * from. That index is the record's identity everywhere else — edit, delete,
 * duplicate and the selection highlight all address the unfiltered array — so
 * it has to survive filtering rather than be recomputed from the result.
 *
 * Both totals come back because they answer different questions: the empty
 * state asks whether there are any players at all, the row count asks how many
 * the search left.
 */
export function filterPlayerRows({
  players,
  youthOnly,
  query,
  teamNames,
}: FilterPlayerRowsParams): FilteredPlayerRows {
  const scoped: IndexedPlayer[] = [];
  for (let i = 0; i < players.length; i += 1) {
    const player = players[i];
    if (youthOnly !== undefined && Boolean(player.youth) !== youthOnly) {
      continue;
    }
    scoped.push({ player, i });
  }

  const q = query.trim().toLowerCase();
  if (!q) {
    return { scoped, filtered: scoped };
  }

  const filtered = scoped.filter(({ player }) => {
    // Club matches on the name the row displays as well as the stored id —
    // searching for what is on screen finding nothing was its own small bug.
    const clubName = player.club ? teamNames.get(player.club) : undefined;
    return (
      displayName(player).toLowerCase().includes(q) ||
      player.id.toLowerCase().includes(q) ||
      player.club.toLowerCase().includes(q) ||
      (clubName !== undefined && clubName.toLowerCase().includes(q)) ||
      player.position.toLowerCase().includes(q) ||
      player.nationality.toLowerCase().includes(q)
    );
  });

  return { scoped, filtered };
}
