import type { CellContent, Character } from '../engine';

// Special shopkeepers (spec 022, D-035): a name and a picture chosen by the
// host, kept apart from the character list, so that they stay whatever list
// or game is in use. They are ordinary characters for the rest of the app.

/** Longest side of a special shopkeeper's picture, in pixels (D-035). */
export const KEEPER_IMAGE_SIZE = 256;

/** A new code: editing a shopkeeper makes a new version with a new code (spec 022). */
export function newSpecialKeeperId(): string {
  return `negoziante-speciale-${crypto.randomUUID()}`;
}

export function makeSpecialKeeper(id: string, name: string, imageData: string): Character {
  return { id, name: name.trim(), shopkeeper: true, imageData };
}

/** Special shopkeepers are the only characters that carry their own picture. */
export function isSpecialKeeper(character: Character): boolean {
  return character.shopkeeper === true && character.imageData !== undefined;
}

/** Checks the shape of a special shopkeeper read from the browser or from a file. */
export function looksLikeSpecialKeeper(value: unknown): value is Character {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const keeper = value as Record<string, unknown>;
  return (
    typeof keeper.id === 'string' &&
    keeper.id !== '' &&
    typeof keeper.name === 'string' &&
    keeper.name.trim() !== '' &&
    keeper.shopkeeper === true &&
    typeof keeper.imageData === 'string' &&
    keeper.imageData.startsWith('data:image/')
  );
}

/** The special shopkeepers that keep a shop in this content, for the copy an episode keeps. */
export function keepersUsedIn(
  content: Record<string, CellContent>,
  available: Character[],
): Character[] {
  const used = new Set(Object.values(content).map((cell) => cell.characterId));
  return available.filter((keeper) => used.has(keeper.id));
}

/**
 * The special shopkeepers an episode can use: those of the library, and the
 * episode's own copies of versions the library no longer has (spec 022).
 */
export function availableKeepers(
  library: Character[],
  episodeCopies: Character[],
): { library: Character[]; onlyInEpisode: Character[] } {
  const known = new Set(library.map((keeper) => keeper.id));
  return { library, onlyInEpisode: episodeCopies.filter((keeper) => !known.has(keeper.id)) };
}
