/**
 * Moves one item up (delta -1) or down (delta 1) in a list. A move past
 * either end leaves the list as it is.
 */
export function moveItem<T>(list: readonly T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) {
    return [...list];
  }
  const moved = [...list];
  [moved[index], moved[target]] = [moved[target] as T, moved[index] as T];
  return moved;
}
