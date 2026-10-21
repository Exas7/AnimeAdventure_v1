const IMAGE = /\.(jpe?g|png|webp)$/i;

/**
 * The image of assets/layout with this name, whatever its extension and case
 * (spec 024): "pagina-iniziale" finds "Pagina-Iniziale.JPG". With two files of
 * the same name, the first in alphabetical order wins, so the choice is stable.
 */
export function layoutImage(files: Record<string, string>, name: string): string | undefined {
  const wanted = name.toLowerCase();
  const match = Object.keys(files)
    .filter((path) => IMAGE.test(path))
    .filter((path) => fileName(path).toLowerCase() === wanted)
    .sort()[0];
  return match === undefined ? undefined : files[match];
}

function fileName(path: string): string {
  return (path.split('/').pop() ?? path).replace(/\.[^.]+$/, '');
}
