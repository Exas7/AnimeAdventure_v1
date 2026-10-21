import type { GameMap } from '../engine';
import { isMapData } from '../editor/mapFile';
import { withStore } from './database';

// The map library in the browser (D-018): maps chosen in "Nuova partita".

export interface MapSummary {
  id: string;
  name: string;
  updatedAt: number;
  cells: number;
  hasBackground: boolean;
}

interface MapEntry {
  id: string;
  map: GameMap;
  updatedAt: number;
}

export function newMapId(): string {
  return crypto.randomUUID();
}

/** Saved maps, most recently changed first. Unreadable entries are skipped. */
export async function listMaps(): Promise<MapSummary[]> {
  const values = await withStore<unknown[]>('maps', 'readonly', (store) => store.getAll());
  return values
    .filter(isEntry)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((entry) => ({
      id: entry.id,
      name: entry.map.name,
      updatedAt: entry.updatedAt,
      cells: entry.map.nodes.length,
      hasBackground: entry.map.background !== undefined,
    }));
}

export async function loadMap(id: string): Promise<GameMap | null> {
  const value = await withStore<unknown>('maps', 'readonly', (store) => store.get(id));
  return isEntry(value) ? value.map : null;
}

export async function saveMap(id: string, map: GameMap): Promise<void> {
  const entry: MapEntry = { id, map, updatedAt: Date.now() };
  await withStore('maps', 'readwrite', (store) => store.put(entry, id));
}

export async function deleteMap(id: string): Promise<void> {
  await withStore('maps', 'readwrite', (store) => store.delete(id));
}

function isEntry(value: unknown): value is MapEntry {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const entry = value as Partial<MapEntry>;
  return typeof entry.id === 'string' && typeof entry.updatedAt === 'number' && isMapData(entry.map);
}
