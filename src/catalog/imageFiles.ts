import { characterIdOf } from './importCatalog';

const IMAGE = /\.(jpe?g|png|webp)$/i;

/**
 * Character images by character code (D-024): "Son_Goku_(inizio).png" belongs
 * to "Son Goku (inizio)". Case, accents, spaces and underscores do not matter.
 */
export function imagesById(files: Record<string, string>): Record<string, string> {
  const images: Record<string, string> = {};
  for (const [path, url] of Object.entries(files)) {
    if (!IMAGE.test(path)) {
      continue;
    }
    const file = (path.split('/').pop() ?? path).replace(/\.[^.]+$/, '');
    images[characterIdOf(file)] = url;
  }
  return images;
}

/**
 * The face of a character for the small square frames (spec 051, D-081):
 * the file of the same name in assets/characters/volti, otherwise its whole figure.
 */
export function faceOrFigure(
  faces: Record<string, string>,
  figures: Record<string, string>,
  characterId: string,
): string | undefined {
  return faces[characterId] ?? figures[characterId];
}

/** The image whose file is named like this (D-024): an item's name, "Nuvola Speedy" (spec 045). */
export function imageNamed(images: Record<string, string>, name: string): string | undefined {
  return images[characterIdOf(name)];
}
