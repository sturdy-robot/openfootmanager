import type { JSX } from "react";

import type { Announcement } from "../../hooks/useAnnouncer";

export interface LiveRegionProps {
  announcement: Announcement;
  /**
   * For outcomes the manager needs to hear even mid-sentence — a refused
   * change, not a successful one. Politeness is the default because most of
   * what this screen says is confirmation.
   */
  assertive?: boolean;
  className?: string;
}

/**
 * The screen speaking back.
 *
 * The region itself never unmounts — a live region has to exist before its
 * contents change or the first message is missed — but its child is keyed by
 * the announcement's sequence number, so repeating the same words still
 * replaces a node and is still heard.
 */
export function LiveRegion({
  announcement,
  assertive = false,
  className,
}: LiveRegionProps): JSX.Element {
  return (
    <p
      aria-live={assertive ? "assertive" : "polite"}
      className={className ?? "sr-only"}
      role={assertive ? "alert" : "status"}
    >
      <span key={announcement.id}>{announcement.text}</span>
    </p>
  );
}
