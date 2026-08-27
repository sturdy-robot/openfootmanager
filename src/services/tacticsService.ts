import { invoke } from "@tauri-apps/api/core";

import type { TacticsLibraryEntry } from "../components/tactics/TacticsCommandBar";

/** A custom tactic as the save holds it. */
export interface CustomTacticData {
  id: string;
  name: string;
  description: string;
  formation: string;
  play_style: string;
  source_preset_name: string | null;
}

/** The save's shape, as a library entry the tactics screen can use. */
export function toLibraryEntry(tactic: CustomTacticData): TacticsLibraryEntry {
  return {
    description: tactic.description,
    formation: tactic.formation,
    id: tactic.id,
    name: tactic.name,
    playStyle: tactic.play_style,
    sourcePresetName: tactic.source_preset_name,
    type: "custom",
  };
}

/** A library entry as the save wants it. */
export function toCustomTacticData(
  entry: TacticsLibraryEntry,
): CustomTacticData {
  return {
    description: entry.description,
    formation: entry.formation,
    id: entry.id,
    name: entry.name,
    play_style: entry.playStyle,
    source_preset_name: entry.sourcePresetName ?? null,
  };
}

export function listCustomTactics(): Promise<CustomTacticData[]> {
  return invoke<CustomTacticData[]>("list_custom_tactics");
}

export function saveCustomTactic(
  tactic: CustomTacticData,
): Promise<CustomTacticData[]> {
  return invoke<CustomTacticData[]>("save_custom_tactic", { tactic });
}

export function deleteCustomTactic(
  tacticId: string,
): Promise<CustomTacticData[]> {
  return invoke<CustomTacticData[]>("delete_custom_tactic", { tacticId });
}
