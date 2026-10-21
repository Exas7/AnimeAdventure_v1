import type { Character } from '../engine';
import { imagesById } from '../catalog/imageFiles';

// The images of assets/characters, read when the app is prepared (D-021,
// D-024): an image added later appears at the next start with the launcher.
const files = import.meta.glob<string>(
  '../../assets/characters/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}',
  { eager: true, query: '?url', import: 'default' },
);

const IMAGES = imagesById(files);

/** The image of a character, or undefined: then the white placeholder is shown. */
export function characterImage(characterId: string | null | undefined): string | undefined {
  return characterId ? IMAGES[characterId] : undefined;
}

/** The picture a special shopkeeper carries with it (D-035), if the character has one. */
export function ownImage(
  catalog: Character[],
  characterId: string | null | undefined,
): string | undefined {
  return catalog.find((character) => character.id === characterId)?.imageData;
}
