/**
 * The items carried, on the stream, in the room at the right of the team
 * (spec 045, 2.3): as many as fit, and when they do not all fit the last
 * place says how many more there are ("+3").
 */
export function visibleItems(itemIds: readonly string[], fit: number): { shown: string[]; more: number } {
  const places = Math.max(1, Math.floor(fit));
  if (itemIds.length <= places) {
    return { shown: [...itemIds], more: 0 };
  }
  const shown = itemIds.slice(0, places - 1);
  return { shown, more: itemIds.length - shown.length };
}

/** How many places of `size` pixels, `gap` apart, fit in `width` pixels. */
export function placesIn(width: number, size: number, gap: number): number {
  return Math.max(1, Math.floor((width + gap) / (size + gap)));
}
