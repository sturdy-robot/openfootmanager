import React from "react";
import { MatchEvent, MatchSnapshot } from "./types";
import type { FixtureData, GameStateData } from "../../store/gameStore";
import {
  Circle,
  CircleOff,
  Square,
  ArrowLeftRight,
  Cross,
  Play,
  Pause,
  Flag,
  Hand,
  ArrowUpRight,
  Shield,
  CornerDownRight,
  Ruler,
  AlertTriangle,
  Zap,
  CircleDot,
} from "lucide-react";

export const EVENT_ICONS: Record<
  string,
  { icon: React.ReactNode; color: string; important: boolean }
> = {
  Goal: {
    icon: <Circle className="w-4 h-4 fill-current" />,
    color: "text-accent-700 dark:text-accent-400",
    important: true,
  },
  PenaltyGoal: {
    icon: <CircleDot className="w-4 h-4" />,
    color: "text-accent-700 dark:text-accent-400",
    important: true,
  },
  PenaltyMiss: {
    icon: <CircleOff className="w-4 h-4" />,
    color: "text-red-400",
    important: true,
  },
  ShootoutGoal: {
    icon: <CircleDot className="w-4 h-4" />,
    color: "text-accent-700 dark:text-accent-400",
    important: true,
  },
  ShootoutMiss: {
    icon: <CircleOff className="w-4 h-4" />,
    color: "text-red-400",
    important: true,
  },
  YellowCard: {
    icon: <Square className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />,
    color: "text-yellow-400",
    important: true,
  },
  RedCard: {
    icon: <Square className="w-3.5 h-3.5 fill-red-500 text-red-500" />,
    color: "text-red-500",
    important: true,
  },
  SecondYellow: {
    icon: <Square className="w-3.5 h-3.5 fill-red-500 text-red-500" />,
    color: "text-red-500",
    important: true,
  },
  Substitution: {
    icon: <ArrowLeftRight className="w-4 h-4" />,
    color: "text-blue-400",
    important: true,
  },
  Injury: {
    icon: <Cross className="w-4 h-4" />,
    color: "text-red-400",
    important: true,
  },
  KickOff: {
    icon: <Play className="w-3.5 h-3.5 fill-current" />,
    color: "text-gray-700 dark:text-gray-400",
    important: true,
  },
  HalfTime: {
    icon: <Pause className="w-3.5 h-3.5" />,
    color: "text-gray-700 dark:text-gray-400",
    important: true,
  },
  SecondHalfStart: {
    icon: <Play className="w-3.5 h-3.5 fill-current" />,
    color: "text-gray-700 dark:text-gray-400",
    important: true,
  },
  FullTime: {
    icon: <Flag className="w-4 h-4" />,
    color: "text-gray-700 dark:text-gray-400",
    important: true,
  },
  ShotSaved: {
    icon: <Hand className="w-4 h-4" />,
    color: "text-green-700 dark:text-green-400",
    important: false,
  },
  ShotOffTarget: {
    icon: <ArrowUpRight className="w-4 h-4" />,
    color: "text-gray-700 dark:text-gray-500",
    important: false,
  },
  ShotBlocked: {
    icon: <Shield className="w-4 h-4" />,
    color: "text-gray-700 dark:text-gray-500",
    important: false,
  },
  Corner: {
    icon: <CornerDownRight className="w-4 h-4" />,
    color: "text-gray-700 dark:text-gray-500",
    important: false,
  },
  FreeKick: {
    icon: <Ruler className="w-4 h-4" />,
    color: "text-gray-700 dark:text-gray-500",
    important: false,
  },
  Foul: {
    icon: <AlertTriangle className="w-4 h-4" />,
    color: "text-yellow-700 dark:text-yellow-500",
    important: false,
  },
  PenaltyAwarded: {
    icon: <Zap className="w-4 h-4" />,
    color: "text-accent-700 dark:text-accent-400",
    important: true,
  },
};

const DEFAULT_DISPLAY = {
  icon: <Circle className="w-3 h-3" />,
  color: "text-gray-700 dark:text-gray-400",
  important: false,
};

const PHASE_LABELS: Record<string, string> = {
  PreKickOff: "Pre-Match",
  FirstHalf: "1st Half",
  HalfTime: "Half Time",
  SecondHalf: "2nd Half",
  FullTime: "Full Time",
  ExtraTimeFirstHalf: "ET 1st Half",
  ExtraTimeHalfTime: "ET Half Time",
  ExtraTimeSecondHalf: "ET 2nd Half",
  ExtraTimeEnd: "ET End",
  PenaltyShootout: "Penalties",
  Finished: "Final",
};

function humanizeEventType(eventType: string): string {
  return eventType.replace(/([A-Z])/g, " $1").trim();
}

type TranslateFn = (key: string, options?: { defaultValue?: string }) => string;

export function makeTeamFallback(teamName: string) {
  return {
    name: teamName,
    short_name: teamName.substring(0, 3).toUpperCase().padEnd(3, " "),
  };
}

export function getEventDisplay(evt: MatchEvent) {
  return EVENT_ICONS[evt.event_type] || DEFAULT_DISPLAY;
}

export function getEventTypeLabel(
  eventType: string,
  t?: TranslateFn,
): string {
  const fallbackLabel = humanizeEventType(eventType);

  return t
    ? t(`match.eventTypes.${eventType}`, { defaultValue: fallbackLabel })
    : fallbackLabel;
}

export function getPlayerName(
  snapshot: MatchSnapshot,
  playerId: string | null,
): string {
  if (!playerId) return "";
  for (const p of snapshot.home_team.players) {
    if (p.id === playerId) return p.name;
  }
  for (const p of snapshot.away_team.players) {
    if (p.id === playerId) return p.name;
  }
  // Also check bench players
  if (snapshot.home_bench) {
    for (const p of snapshot.home_bench) {
      if (p.id === playerId) return p.name;
    }
  }
  if (snapshot.away_bench) {
    for (const p of snapshot.away_bench) {
      if (p.id === playerId) return p.name;
    }
  }
  return playerId;
}

export function phaseLabel(phase: string, t?: TranslateFn): string {
  const fallbackLabel = PHASE_LABELS[phase] ?? humanizeEventType(phase);

  return t
    ? t(`match.phases.${phase}`, { defaultValue: fallbackLabel })
    : fallbackLabel;
}

export function resolveMatchFixture(
  gameState: GameStateData | null,
  snapshot: MatchSnapshot | null,
  fixtureIndex?: number,
): FixtureData | null {
  if (!gameState || !snapshot) return null;

  // The route index is an index into ONE competition's fixture list, but a
  // cup tie and a league game can both be at index 0. Trusting the index alone
  // resolved a cup match to whatever the domestic league had in that slot —
  // wrong opponents, wrong competition. The teams in the snapshot are the only
  // thing that identifies the fixture across competitions, so the index is now
  // a hint that has to agree with them.
  const matchesSnapshot = (fixture: FixtureData): boolean =>
    fixture.home_team_id === snapshot.home_team.id &&
    fixture.away_team_id === snapshot.away_team.id;

  const leagueFixtures = gameState.league?.fixtures ?? [];

  if (
    typeof fixtureIndex === "number" &&
    fixtureIndex >= 0 &&
    fixtureIndex < leagueFixtures.length &&
    matchesSnapshot(leagueFixtures[fixtureIndex])
  ) {
    return leagueFixtures[fixtureIndex];
  }

  // `gameState.league` is a mirror of the domestic league and can go stale, and
  // that same league usually also appears in `competitions`. Searching the
  // mirror first would let a stale copy answer for a tie played elsewhere, so
  // the league is searched last, from one place, and skipped here.
  const leagueId = gameState.league?.id;
  const competitionFixtures = (gameState.competitions ?? [])
    .filter((competition) => competition.id !== leagueId)
    .flatMap((competition) => competition.fixtures ?? []);

  return (
    competitionFixtures.find(matchesSnapshot) ??
    leagueFixtures.find(matchesSnapshot) ??
    null
  );
}
