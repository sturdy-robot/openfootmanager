import { useEffect, useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { appDataDir, join } from "@tauri-apps/api/path";
import { convertFileSrc } from "@tauri-apps/api/core";
import {
  FileText,
  Newspaper,
  Trophy,
  BarChart3,
  TrendingUp,
  ArrowLeftRight,
} from "lucide-react";

import type {
  EntityMediaData,
  ManagerData,
  NewsArticle,
  PlayerData,
  TeamData,
} from "../../store/gameStore";

type TeamColorsLike = Pick<TeamData, "colors">["colors"];

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function clampColorChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function expandHexShorthand(hex: string) {
  return hex.split("").map((char) => `${char}${char}`).join("");
}

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  const expanded = normalized.length === 3
    ? expandHexShorthand(normalized)
    : normalized;

  if (!/^[\da-fA-F]{6}$/.test(expanded)) {
    return { r: 16, g: 185, b: 129 };
  }

  return {
    r: Number.parseInt(expanded.slice(0, 2), 16),
    g: Number.parseInt(expanded.slice(2, 4), 16),
    b: Number.parseInt(expanded.slice(4, 6), 16),
  };
}

function rgbToHex(rgb: { r: number; g: number; b: number }) {
  return `#${clampColorChannel(rgb.r).toString(16).padStart(2, "0")}${clampColorChannel(rgb.g).toString(16).padStart(2, "0")}${clampColorChannel(rgb.b).toString(16).padStart(2, "0")}`;
}

function lighten(hex: string, amount: number) {
  const rgb = hexToRgb(hex);
  return rgbToHex({
    r: rgb.r + (255 - rgb.r) * amount,
    g: rgb.g + (255 - rgb.g) * amount,
    b: rgb.b + (255 - rgb.b) * amount,
  });
}

function darken(hex: string, amount: number) {
  const rgb = hexToRgb(hex);
  return rgbToHex({
    r: rgb.r * (1 - amount),
    g: rgb.g * (1 - amount),
    b: rgb.b * (1 - amount),
  });
}

function buildInitials(name: string, fallback: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return fallback;
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function pickPalette(seed: string, teamColors?: TeamColorsLike | null) {
  if (teamColors) {
    return {
      primary: teamColors.primary,
      secondary: teamColors.secondary,
      accent: lighten(teamColors.primary, 0.3),
    };
  }

  const hash = hashString(seed);
  const hue = hash % 360;
  const primary = `hsl(${hue} 62% 46%)`;
  const secondary = `hsl(${(hue + 48) % 360} 58% 24%)`;
  const accent = `hsl(${(hue + 92) % 360} 70% 66%)`;
  return { primary, secondary, accent };
}

function isDirectMediaPath(path: string) {
  return /^(data:|blob:|https?:|\/)/.test(path);
}

function mediaPathFrom(media: EntityMediaData | null | undefined, kind: "portrait" | "logo") {
  return media?.[kind]?.path?.trim() || null;
}

function useResolvedMediaSrc(path: string | null) {
  const [resolved, setResolved] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setResolved(null);
      return;
    }

    if (isDirectMediaPath(path)) {
      setResolved(path);
      return;
    }

    const relativePath = path;
    let cancelled = false;

    async function resolveRelativePath() {
      try {
        const baseDir = await appDataDir();
        const absolutePath = await join(baseDir, "media", relativePath);
        if (!cancelled) {
          setResolved(convertFileSrc(absolutePath));
        }
      } catch {
        if (!cancelled) {
          setResolved(null);
        }
      }
    }

    void resolveRelativePath();

    return () => {
      cancelled = true;
    };
  }, [path]);

  return resolved;
}

export function TeamLogo({
  team,
  className,
  imageClassName,
  testId,
}: {
  team: Pick<TeamData, "id" | "name" | "short_name" | "colors" | "media">;
  className?: string;
  imageClassName?: string;
  testId?: string;
}) {
  const path = mediaPathFrom(team.media, "logo");
  const src = useResolvedMediaSrc(path);
  const uniqueId = useId().replace(/:/g, "");
  const gradientId = `team-logo-gradient-${uniqueId}`;
  const shadowId = `team-logo-shadow-${uniqueId}`;
  const shortName = team.short_name?.trim() || team.name.slice(0, 3).toUpperCase();

  if (src) {
    return (
      <img
        src={src}
        alt={team.name}
        data-testid={testId}
        className={cx("rounded-2xl object-cover", className, imageClassName)}
      />
    );
  }

  return (
    <div
      className={cx("rounded-2xl overflow-hidden", className)}
      data-testid={testId}
      aria-label={team.name}
    >
      <svg viewBox="0 0 100 120" className={cx("h-full w-full", imageClassName)} role="img">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={lighten(team.colors.primary, 0.18)} />
            <stop offset="100%" stopColor={darken(team.colors.secondary, 0.12)} />
          </linearGradient>
          <filter id={shadowId} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.25" />
          </filter>
        </defs>
        <path
          d="M50 6C30 6 14 13 14 13v40c0 26 17 49 36 61 19-12 36-35 36-61V13S70 6 50 6Z"
          fill={`url(#${gradientId})`}
          filter={`url(#${shadowId})`}
        />
        <path
          d="M50 14C34 14 22 19 22 19v32c0 21 13 39 28 49 15-10 28-28 28-49V19S66 14 50 14Z"
          fill={team.colors.primary}
          fillOpacity="0.55"
          stroke="rgba(255,255,255,0.6)"
          strokeWidth="3"
        />
        <path
          d="M20 44h60"
          stroke={lighten(team.colors.secondary, 0.28)}
          strokeWidth="10"
          strokeLinecap="round"
          opacity="0.9"
        />
        <text
          x="50"
          y="69"
          textAnchor="middle"
          fontSize="24"
          fontWeight="800"
          fill="#ffffff"
          style={{ letterSpacing: "0.14em" }}
        >
          {shortName.slice(0, 3).toUpperCase()}
        </text>
      </svg>
    </div>
  );
}

export function PersonPortrait({
  id,
  name,
  media,
  teamColors,
  className,
  imageClassName,
  fallbackLabel,
  testId,
}: {
  id: string;
  name: string;
  media?: EntityMediaData | null;
  teamColors?: TeamColorsLike | null;
  className?: string;
  imageClassName?: string;
  fallbackLabel?: string;
  testId?: string;
}) {
  const path = mediaPathFrom(media, "portrait");
  const src = useResolvedMediaSrc(path);
  const uniqueId = useId().replace(/:/g, "");
  const gradientId = `person-portrait-gradient-${uniqueId}`;
  const haloId = `person-portrait-halo-${uniqueId}`;
  const initials = buildInitials(name, fallbackLabel ?? "?");
  const palette = useMemo(() => pickPalette(`${id}:${name}`, teamColors), [id, name, teamColors]);
  const hash = hashString(`${id}:${name}`);

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        data-testid={testId}
        className={cx("rounded-2xl object-cover", className, imageClassName)}
      />
    );
  }

  return (
    <div
      className={cx("rounded-2xl overflow-hidden", className)}
      data-testid={testId}
      aria-label={name}
    >
      <svg viewBox="0 0 100 120" className={cx("h-full w-full", imageClassName)} role="img">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={lighten(palette.primary, 0.2)} />
            <stop offset="55%" stopColor={palette.primary} />
            <stop offset="100%" stopColor={darken(palette.secondary, 0.12)} />
          </linearGradient>
          <radialGradient id={haloId} cx="50%" cy="28%" r="62%">
            <stop offset="0%" stopColor={palette.accent} stopOpacity="0.95" />
            <stop offset="100%" stopColor={palette.accent} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="100" height="120" rx="18" fill={`url(#${gradientId})`} />
        <circle cx="50" cy="36" r="34" fill={`url(#${haloId})`} opacity="0.9" />
        <circle
          cx={34 + (hash % 12)}
          cy={28 + ((hash >> 3) % 10)}
          r="16"
          fill="rgba(255,255,255,0.12)"
        />
        <circle cx="50" cy="42" r="19" fill="rgba(255,255,255,0.9)" />
        <path
          d="M24 108c3-19 15-31 26-31s23 12 26 31"
          fill="rgba(255,255,255,0.88)"
        />
        <path
          d="M31 44c2-14 11-22 19-22 10 0 18 8 20 22-5-4-12-6-20-6s-15 2-19 6Z"
          fill={darken(palette.secondary, 0.18)}
          opacity="0.92"
        />
        <rect x="11" y="11" width="30" height="18" rx="9" fill="rgba(15,23,42,0.42)" />
        <text x="26" y="24" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">
          {initials}
        </text>
      </svg>
    </div>
  );
}

const NEWS_CATEGORY_META: Record<string, { icon: typeof FileText }> = {
  MatchReport: { icon: Newspaper },
  LeagueRoundup: { icon: Trophy },
  StandingsUpdate: { icon: BarChart3 },
  TransferRumour: { icon: TrendingUp },
  TransferRoundup: { icon: ArrowLeftRight },
  InjuryNews: { icon: FileText },
  SeasonPreview: { icon: FileText },
  Editorial: { icon: FileText },
  ManagerialChange: { icon: FileText },
};

export function NewsCover({
  article,
  teams,
  players,
  managers,
  className,
  compact = false,
  testId,
}: {
  article: NewsArticle;
  teams: TeamData[];
  players: PlayerData[];
  managers?: ManagerData[];
  className?: string;
  compact?: boolean;
  testId?: string;
}) {
  const { t } = useTranslation();
  const meta = NEWS_CATEGORY_META[article.category] ?? NEWS_CATEGORY_META.Editorial;
  const categoryLabel = t(`news.categories.${article.category}`, {
    defaultValue: article.category,
  });
  const primaryTeamId = article.match_score?.home_team_id ?? article.team_ids[0];
  const secondaryTeamId = article.match_score?.away_team_id ?? article.team_ids[1];
  const primaryTeam = primaryTeamId
    ? teams.find((team) => team.id === primaryTeamId)
    : undefined;
  const secondaryTeam = secondaryTeamId
    ? teams.find((team) => team.id === secondaryTeamId)
    : undefined;
  const featuredPlayer = players.find((player) => article.player_ids.includes(player.id));
  const playerTeam = featuredPlayer?.team_id
    ? teams.find((team) => team.id === featuredPlayer.team_id)
    : primaryTeam;
  const featuredManager = primaryTeam?.manager_id
    ? managers?.find((manager) => manager.id === primaryTeam.manager_id)
    : undefined;
  const Icon = meta.icon;
  const fallbackCoverTone = article.category === "LeagueRoundup"
    ? "from-amber-500/25 via-navy-800 to-navy-900"
    : article.category === "StandingsUpdate"
      ? "from-sky-500/25 via-navy-800 to-navy-900"
      : "from-gray-800 via-navy-800 to-gray-700";

  const compactIconChip = (
    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/10 text-white/75 shadow-inner shadow-white/5">
      <Icon className="h-3.5 w-3.5" />
    </div>
  );

  if (article.match_score && primaryTeam && secondaryTeam) {
    if (compact) {
      return (
        <div
          className={cx(
            "flex h-full flex-col justify-between rounded-2xl bg-gradient-to-r from-navy-800 via-navy-700 to-navy-800 p-3 text-white",
            className,
          )}
          data-testid={testId}
        >
          {compactIconChip}
          <div className="grid grid-cols-[2rem_minmax(0,1fr)_2rem] items-center gap-1.5">
            <TeamLogo team={primaryTeam} className="h-8 w-8 shrink-0" />
            <div className="min-w-0 rounded-xl bg-white/10 px-2 py-1 text-center shadow-inner shadow-white/5">
              <p className="font-heading text-xl font-bold leading-none">
                {article.match_score.home_goals}–{article.match_score.away_goals}
              </p>
            </div>
            <TeamLogo team={secondaryTeam} className="h-8 w-8 shrink-0" />
          </div>
        </div>
      );
    }

    return (
      <div
        className={cx(
          "flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-navy-800 via-navy-700 to-navy-800 p-4 text-white",
          className,
        )}
        data-testid={testId}
      >
        <div className="flex items-center gap-3 min-w-0">
          <TeamLogo team={primaryTeam} className={compact ? "h-12 w-12 shrink-0" : "h-16 w-16 shrink-0"} />
          {!compact && (
            <span className="truncate text-sm font-heading font-bold uppercase tracking-wide">
              {primaryTeam.name}
            </span>
          )}
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl bg-white/10 px-3 py-2 text-center">
          <span className="text-[10px] font-heading font-bold uppercase tracking-[0.25em] text-white/70">
            {categoryLabel}
          </span>
          <span className={cx("font-heading font-bold", compact ? "text-xl" : "text-3xl")}>
            {article.match_score.home_goals}–{article.match_score.away_goals}
          </span>
        </div>
        <div className="flex items-center gap-3 min-w-0 justify-end">
          {!compact && (
            <span className="truncate text-right text-sm font-heading font-bold uppercase tracking-wide">
              {secondaryTeam.name}
            </span>
          )}
          <TeamLogo team={secondaryTeam} className={compact ? "h-12 w-12 shrink-0" : "h-16 w-16 shrink-0"} />
        </div>
      </div>
    );
  }

  if (featuredPlayer) {
    if (compact) {
      return (
        <div
          className={cx(
            "flex h-full flex-col justify-between rounded-2xl bg-gradient-to-br from-primary-600 via-navy-800 to-navy-900 p-3 text-white",
            className,
          )}
          data-testid={testId}
        >
          {compactIconChip}
          <div className="flex items-end justify-between gap-2">
            {playerTeam ? (
              <TeamLogo team={playerTeam} className="h-10 w-10 shrink-0" />
            ) : (
              <div className="h-10 w-10 shrink-0 rounded-xl bg-white/10" />
            )}
            <PersonPortrait
              id={featuredPlayer.id}
              name={featuredPlayer.full_name}
              media={featuredPlayer.media}
              teamColors={playerTeam?.colors}
              className="h-14 w-14 shrink-0"
              fallbackLabel={featuredPlayer.match_name.slice(0, 2).toUpperCase()}
            />
          </div>
        </div>
      );
    }

    return (
      <div
        className={cx(
          "flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-br from-primary-600 via-navy-800 to-navy-900 p-4 text-white",
          className,
        )}
        data-testid={testId}
      >
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-heading font-bold uppercase tracking-[0.25em] text-white/70">
            {categoryLabel}
          </p>
          <p className={cx("mt-1 font-heading font-bold uppercase", compact ? "text-sm" : "text-lg")}>
            {featuredPlayer.full_name}
          </p>
          {playerTeam ? (
            <p className="mt-1 text-xs text-white/70">{playerTeam.name}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {playerTeam ? (
            <TeamLogo team={playerTeam} className={compact ? "h-11 w-11" : "h-14 w-14"} />
          ) : null}
          <PersonPortrait
            id={featuredPlayer.id}
            name={featuredPlayer.full_name}
            media={featuredPlayer.media}
            teamColors={playerTeam?.colors}
            className={compact ? "h-14 w-14" : "h-16 w-16"}
            fallbackLabel={featuredPlayer.match_name.slice(0, 2).toUpperCase()}
          />
        </div>
      </div>
    );
  }

  if (article.category === "ManagerialChange" && primaryTeam && featuredManager) {
    if (compact) {
      return (
        <div
          className={cx(
            "flex h-full flex-col justify-between rounded-2xl bg-gradient-to-br from-orange-500 via-navy-800 to-navy-900 p-3 text-white",
            className,
          )}
          data-testid={testId}
        >
          {compactIconChip}
          <div className="flex items-end justify-between gap-2">
            <TeamLogo team={primaryTeam} className="h-10 w-10 shrink-0" />
            <PersonPortrait
              id={featuredManager.id}
              name={`${featuredManager.first_name} ${featuredManager.last_name}`}
              media={featuredManager.media}
              teamColors={primaryTeam.colors}
              className="h-14 w-14 shrink-0"
            />
          </div>
        </div>
      );
    }

    return (
      <div
        className={cx(
          "flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-br from-orange-500 via-navy-800 to-navy-900 p-4 text-white",
          className,
        )}
        data-testid={testId}
      >
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-heading font-bold uppercase tracking-[0.25em] text-white/70">
            {categoryLabel}
          </p>
          <p className={cx("mt-1 font-heading font-bold uppercase", compact ? "text-sm" : "text-lg")}>
            {featuredManager.first_name} {featuredManager.last_name}
          </p>
          <p className="mt-1 text-xs text-white/70">{primaryTeam.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <TeamLogo team={primaryTeam} className={compact ? "h-11 w-11" : "h-14 w-14"} />
          <PersonPortrait
            id={featuredManager.id}
            name={`${featuredManager.first_name} ${featuredManager.last_name}`}
            media={featuredManager.media}
            teamColors={primaryTeam.colors}
            className={compact ? "h-14 w-14" : "h-16 w-16"}
          />
        </div>
      </div>
    );
  }

  if (primaryTeam) {
    if (compact) {
      return (
        <div
          className={cx(
            "flex h-full flex-col justify-between rounded-2xl bg-gradient-to-br from-navy-900 via-navy-800 to-primary-600 p-3 text-white",
            className,
          )}
          data-testid={testId}
        >
          {compactIconChip}
          <div className="flex items-end justify-between gap-2">
            <div className="space-y-1.5">
              <div className="h-1.5 w-8 rounded-full bg-white/15" />
              <div className="h-1.5 w-12 rounded-full bg-white/10" />
            </div>
            <TeamLogo team={primaryTeam} className="h-14 w-14 shrink-0" />
          </div>
        </div>
      );
    }

    return (
      <div
        className={cx(
          "flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-br from-navy-900 via-navy-800 to-primary-600 p-4 text-white",
          className,
        )}
        data-testid={testId}
      >
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-heading font-bold uppercase tracking-[0.25em] text-white/70">
            {categoryLabel}
          </p>
          <p className={cx("mt-1 font-heading font-bold uppercase", compact ? "text-sm" : "text-lg")}>
            {primaryTeam.name}
          </p>
        </div>
        <TeamLogo team={primaryTeam} className={compact ? "h-14 w-14" : "h-16 w-16"} />
      </div>
    );
  }

  if (compact) {
    return (
      <div
        className={cx(
          "flex h-full flex-col justify-between rounded-2xl bg-gradient-to-br p-3 text-white",
          fallbackCoverTone,
          className,
        )}
        data-testid={testId}
      >
        {compactIconChip}
        <div className="space-y-1.5">
          <div className="h-1.5 w-10 rounded-full bg-white/15" />
          <div className="h-1.5 w-14 rounded-full bg-white/10" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cx(
        "flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-br p-4 text-white",
        fallbackCoverTone,
        className,
      )}
      data-testid={testId}
    >
      <div className="min-w-0">
        <p className="text-[10px] font-heading font-bold uppercase tracking-[0.25em] text-white/70">
          {categoryLabel}
        </p>
        <p className={cx("mt-1 line-clamp-2 font-heading font-bold uppercase", compact ? "text-sm" : "text-lg")}>
          {article.source}
        </p>
      </div>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
        <Icon className="h-6 w-6" />
      </div>
    </div>
  );
}
