import type { GameMap } from '../engine';
import { parseMap } from '../editor/mapFile';
import { loadMap } from '../storage/mapLibrary';
import { describeError } from '../describeError';

// The maps that come with the app (spec 030, D-045): files exported from the
// map editor and copied into assets/maps/incluse. Each one is read only when
// the maps are listed, not at start: a map weighs a few MB with its background.

const files = import.meta.glob<string>('../../assets/maps/incluse/*.json', {
  query: '?raw',
  import: 'default',
});

/** Codes of included maps start like this; those of the browser's library never do. */
const PREFIX = 'inclusa:';

export interface IncludedMap {
  id: string;
  map: GameMap;
}

export interface IncludedMaps {
  maps: IncludedMap[];
  /** Files that are not maps, with the reason: for the error message. */
  errors: string[];
}

export function isIncludedMapId(id: string): boolean {
  return id.startsWith(PREFIX);
}

/** "inclusa:Pianeta_Nameck" from ".../incluse/Pianeta_Nameck.json". */
export function includedMapId(path: string): string {
  const file = path.split('/').pop() ?? path;
  return PREFIX + file.replace(/\.json$/i, '');
}

/** Reads every file; one that is not a map is left out and reported. */
export async function readIncludedMaps(loaders: Record<string, () => Promise<string>>): Promise<IncludedMaps> {
  const maps: IncludedMap[] = [];
  const errors: string[] = [];
  for (const [path, load] of Object.entries(loaders).sort(([a], [b]) => a.localeCompare(b, 'it'))) {
    const file = path.split('/').pop() ?? path;
    try {
      maps.push({ id: includedMapId(path), map: parseMap(await load()) });
    } catch (cause) {
      errors.push(`${file}: ${describeError(cause)}`);
    }
  }
  return { maps, errors };
}

let cached: Promise<IncludedMaps> | null = null;

/** The included maps, read once per session. */
export function listIncludedMaps(): Promise<IncludedMaps> {
  cached ??= readIncludedMaps(files);
  return cached;
}

/** A map of the library or an included one, by its code. */
export async function loadAnyMap(id: string): Promise<GameMap | null> {
  if (!isIncludedMapId(id)) {
    return loadMap(id);
  }
  const { maps } = await listIncludedMaps();
  return maps.find((entry) => entry.id === id)?.map ?? null;
}
