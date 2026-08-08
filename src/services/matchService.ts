import { invoke } from "@tauri-apps/api/core";

import type {
  MatchSnapshot,
  MatchTacticsChangeSet,
} from "../components/match/types";

export function applyMatchTactics(
  changes: MatchTacticsChangeSet,
): Promise<MatchSnapshot> {
  return invoke<MatchSnapshot>("apply_match_tactics", { changes });
}
