import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { KitPattern } from "../../store/types";
import { condBgColor } from "../../lib/playerConditionDisplay";
import { getPositionColor } from "../../lib/positionColors";
import { PlayerAvatar } from "./PlayerAvatar";
import JerseyIcon from "./JerseyIcon";

/** How well a player fits the slot they occupy — drives the avatar ring colour. */
export type PitchFitTone = "exact" | "adapted" | "out" | "empty";

/** A small role marker chip (Captain, Penalty taker, etc.) stacked top-left. */
export interface PitchTokenMarker {
  key: string;
  shortLabel: string;
  /** Tailwind classes for the chip background/border/text. */
  toneClassName: string;
}

export interface PitchTokenProps {
  /** Display name (already formatted/uppercased by the caller if desired). */
  name: string;
  /** Short position label shown top-right (e.g. "ST", "GK"). */
  positionAbbr: string;
  /** Raw position enum (e.g. "CenterBack"); colours the position badge. */
  position?: string;
  ovr: number;
  /** 0–100 short-term condition; drives the bar at the bottom. */
  condition: number;
  fitTone?: PitchFitTone;
  /** When present, renders a face/generated avatar; otherwise initials from name. */
  avatar?: { full_name: string; match_name: string; media?: { face?: string } };
  /** Optional kit jersey rendered under the avatar. */
  jersey?: {
    primaryColor: string;
    secondaryColor: string;
    pattern: KitPattern;
    number?: number | null;
  };
  /** Plain "#N" fallback shown when no kit `jersey` is available. */
  jerseyNumber?: number | null;
  /** Role markers stacked at the top-left (max 3 shown). */
  markers?: PitchTokenMarker[];
  /** Optional slot below the name — e.g. a tactical-role combobox. */
  children?: ReactNode;
}

function fitRingClass(fitTone: PitchFitTone): string {
  switch (fitTone) {
    case "exact":
      return "ring-2 ring-success-400 dark:ring-success-400";
    case "adapted":
      return "ring-2 ring-accent-400 dark:ring-accent-400";
    case "out":
      return "ring-2 ring-red-400 dark:ring-red-400";
    default:
      return "ring-1 ring-white/25 dark:ring-white/25";
  }
}

/** Which translation names each fit tone, for the token's spoken description. */
const FIT_LABEL_KEYS: Record<PitchFitTone, string> = {
  exact: "squad.naturalFit",
  adapted: "pitchToken.adaptedToSlot",
  out: "squad.outOfPosition",
  empty: "pitchToken.fitUnavailable",
};



/**
 * Presentational pitch token shared by the tactics board and the pre-match
 * screen: a circular avatar with a fit-tone ring, corner badges (position +
 * OVR), stacked role markers, an optional kit jersey, the player name, an
 * optional control slot (e.g. a role combobox), and a condition bar.
 *
 * It renders visuals only — wrap it in a button / drag handle and wire
 * interactions at the call site.
 */
export function PitchToken({
  name,
  positionAbbr,
  position,
  ovr,
  condition,
  fitTone = "empty",
  avatar,
  jersey,
  jerseyNumber,
  markers,
  children,
}: PitchTokenProps) {
  const { t } = useTranslation();
  // Clamped once: a condition outside 0-100 would otherwise produce a bar wider
  // than its track and a value a screen reader cannot place on the scale.
  const clampedCondition = Math.min(100, Math.max(0, Math.round(condition)));
  const conditionLabel = t("pitchToken.conditionValue", {
    condition: clampedCondition,
  });
  // One localized template rather than fragments joined in code, so a language
  // can order name, condition and fit however it reads best.
  const tokenLabel = t("pitchToken.accessibleName", {
    condition: conditionLabel,
    fit: t(FIT_LABEL_KEYS[fitTone]),
    name,
  });

  return (
    // A labelled group, not role="img": the tactics token still embeds a role
    // combobox, and role="img" would make every descendant presentational and
    // hide it. The group contributes its name to the interactive parent while
    // leaving what is inside reachable.
    <div
      aria-label={tokenLabel}
      className="flex w-full flex-col items-center gap-1"
      role="group"
      title={tokenLabel}
    >
      {/* Avatar with overlaid badges */}
      <div className="relative">
        {markers && markers.length > 0 && (
          <div className="absolute -left-1.5 -top-1.5 z-10 flex flex-col gap-0.5">
            {markers.slice(0, 3).map((marker) => (
              <span
                key={marker.key}
                className={`rounded-full border px-1.5 py-0.5 text-[10px] font-heading font-bold leading-4 ${marker.toneClassName}`}
              >
                {marker.shortLabel}
              </span>
            ))}
          </div>
        )}
        <div className="absolute -right-1.5 -top-1.5 z-10">
          <span className={`rounded-full ${position ? getPositionColor(position) : "bg-gray-900"} px-2 py-0.5 text-xs font-heading font-bold uppercase leading-4 text-white ring-1 ring-white/40`}>
            {positionAbbr}
          </span>
        </div>
        <PlayerAvatar
          player={avatar ?? { full_name: name, match_name: name }}
          className={`h-11 w-11 overflow-hidden rounded-full ${fitRingClass(fitTone)}`}
        />
        <div className="absolute -bottom-1 -right-1.5 z-10">
          <span className="rounded-full bg-gray-900 px-2 py-0.5 text-xs font-heading font-bold leading-4 text-white ring-1 ring-white/30">
            {ovr}
          </span>
        </div>
      </div>

      {jersey ? (
        <JerseyIcon
          size="md"
          primaryColor={jersey.primaryColor}
          secondaryColor={jersey.secondaryColor}
          pattern={jersey.pattern}
          number={jersey.number}
        />
      ) : jerseyNumber != null ? (
        <span className="text-[10px] font-heading font-bold text-white/80">
          #{jerseyNumber}
        </span>
      ) : null}

      <div className="max-w-full truncate text-xs font-heading font-bold uppercase tracking-[0.12em] text-white drop-shadow-sm">
        {name}
      </div>

      {children}

      <div className="w-full">
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            aria-label={conditionLabel}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={clampedCondition}
            className={`h-full rounded-full ${condBgColor(clampedCondition)}`}
            role="progressbar"
            style={{ width: `${clampedCondition}%` }}
          />
        </div>
      </div>
    </div>
  );
}
