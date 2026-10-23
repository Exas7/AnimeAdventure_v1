// The guests of spec 074 (D-100): Livio, Maggi and Meliador. Shopkeepers
// like the others; as story characters, at most one of the three per
// episode, for their quiz of 1,500 coins.

export const GUESTS = ['livio', 'maggi', 'meliador'];

export function isGuest(characterId: string): boolean {
  return GUESTS.includes(characterId);
}

/**
 * The story characters in their order, with only the first of the guests,
 * or none when one is already on the board (spec 074, 2.5).
 */
export function oneGuestAtMost<T extends { id: string }>(characters: T[], guestOnBoard: boolean): T[] {
  const first = guestOnBoard ? undefined : characters.find((character) => isGuest(character.id));
  return characters.filter((character) => !isGuest(character.id) || character === first);
}
