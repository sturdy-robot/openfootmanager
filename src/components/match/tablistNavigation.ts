/**
 * Where an arrow key should move within a tab list.
 *
 * A roving tabindex takes every unselected tab out of the tab order, which is
 * the point of it — but only if the arrow keys put them back within reach.
 * Without this the pattern is strictly worse than plain buttons: the selected
 * tab is reachable and the rest of the list is not.
 *
 * Returns `null` for a key that means nothing here, so the caller knows to
 * leave the event alone.
 */
export function nextTabIndex(
  current: number,
  count: number,
  key: string,
): number | null {
  if (count === 0) return null;

  switch (key) {
    // Wrapping, per the APG: the ends of a tab list are not walls.
    case "ArrowRight":
      return (current + 1) % count;
    case "ArrowLeft":
      return (current - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}
