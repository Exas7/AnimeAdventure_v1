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
