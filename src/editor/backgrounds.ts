/** A background image of assets/maps, offered by the map editor (D-021). */
export interface BackgroundAsset {
  /** Shown in the menu: "Pianeta_Nameck.jpg" becomes "Pianeta Nameck". */
  name: string;
  /** Where the app finds the image. */
  url: string;
}

const IMAGE = /\.(jpe?g|png|webp)$/i;

/** From the files found in assets/maps to the menu entries, in alphabetical order. */
export function listBackgrounds(files: Record<string, string>): BackgroundAsset[] {
  return Object.entries(files)
    .filter(([path]) => IMAGE.test(path))
    .map(([path, url]) => ({ name: displayName(path), url }))
    .sort((a, b) => a.name.localeCompare(b.name, 'it'));
}

/** File name without folders and extension, with spaces instead of underscores. */
export function displayName(path: string): string {
  const file = path.split('/').pop() ?? path;
  return file
    .replace(/\.[^.]+$/, '')
    .replace(/_+/g, ' ')
    .trim();
}
