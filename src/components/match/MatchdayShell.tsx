import type { ReactElement, ReactNode } from "react";

import type { MatchdayIdentity } from "../../lib/competitionName";
import { ThemeToggle } from "../ui";

/**
 * How a stage's body handles height.
 *
 * `frame` is for the working surfaces — the pitch, the lineups, the report
 * tabs. They are laid out in columns that own their own scrolling, so at wide
 * sizes the body must not scroll at all. When those columns collapse to one at
 * a narrow width the body becomes a scroller instead, because the alternative
 * is what pre-match used to do: keep `overflow-hidden` and cut the content off.
 *
 * `centered` is for the reading surfaces — the press conference and the
 * shootout. One column, always scrollable, capped at the reading width.
 */
export type MatchdayBodyMode = "frame" | "centered";

export interface MatchdayShellProps {
  bodyMode: MatchdayBodyMode;
  children: ReactNode;
  identity: MatchdayIdentity;
  header?: ReactNode;
  footer?: ReactNode;
}

/**
 * The chrome every matchday stage sits in.
 *
 * There were seven roots before this: six hand-rolled and one shared shell that
 * only the live screen used. They disagreed — `h-screen` on pre-match against
 * `min-h-screen` everywhere else — and two of them let the document scroll,
 * which is the thing the whole layout pass is removing. The theme toggle was
 * placed independently in each.
 *
 * Owning the viewport here means a stage can only describe its content, and the
 * competition it belongs to is named once for all of them (issue #369).
 */
export default function MatchdayShell({
  bodyMode,
  children,
  identity,
  header,
  footer,
}: MatchdayShellProps): ReactElement {
  // Composed rather than interpolated with a separator, so a friendly — which
  // has no competition to name — does not render a dangling middot.
  const identityLabel = identity.competitionName
    ? `${identity.competitionName} · ${identity.roundLabel}`
    : identity.roundLabel;

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-gray-100 text-gray-900 transition-colors duration-300 motion-reduce:transition-none dark:bg-navy-900 dark:text-white">
      <header
        aria-label={identityLabel}
        className="shrink-0 border-b border-gray-200 dark:border-navy-700"
      >
        <div className="relative mx-auto w-full max-w-page px-6 py-3">
          <div className="pr-14">
            <p className="font-heading text-xs uppercase tracking-widest text-gray-500 dark:text-gray-400">
              {identity.competitionName ? (
                <>
                  <span>{identity.competitionName}</span>
                  <span aria-hidden="true"> · </span>
                </>
              ) : null}
              <span>{identity.roundLabel}</span>
            </p>
            {header}
          </div>
          <ThemeToggle className="absolute right-6 top-3" />
        </div>
      </header>

      <div
        className={
          bodyMode === "frame"
            ? "min-h-0 flex-1 overflow-y-auto xl:overflow-hidden"
            : "min-h-0 flex-1 overflow-y-auto"
        }
      >
        {bodyMode === "centered" ? (
          <div className="mx-auto w-full max-w-page px-6 py-6">{children}</div>
        ) : (
          children
        )}
      </div>

      {footer ? <div className="shrink-0">{footer}</div> : null}
    </div>
  );
}
