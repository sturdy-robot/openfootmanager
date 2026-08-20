import { useCallback, useState } from "react";

export interface Announcement {
  /**
   * Bumped on every announcement, including a repeat of the same words.
   *
   * A live region that re-renders identical text does not announce again — the
   * DOM never changed, so there is nothing for a screen reader to notice. Two
   * successful applies in a row are two events even though they read the same,
   * and only the caller knows that. The sequence number is what lets the region
   * replace its child and be heard.
   */
  id: number;
  text: string;
}

export interface Announcer {
  announce: (text: string) => void;
  announcement: Announcement;
}

/** One voice per screen, so a later message cannot be masked by an earlier one. */
export function useAnnouncer(): Announcer {
  const [announcement, setAnnouncement] = useState<Announcement>({
    id: 0,
    text: "",
  });

  const announce = useCallback((text: string) => {
    setAnnouncement((current) => ({ id: current.id + 1, text }));
  }, []);

  return { announce, announcement };
}
