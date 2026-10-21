import type { GameMap } from '../engine';

/** Internal code: stays 'arkanite-…' after the rename, or old files would not open (D-020). */
const MAP_FORMAT = 'arkanite-map';

/** Increase when the map file changes in a way old files cannot follow. */
export const MAP_FORMAT_VERSION = 1;

const NODE_TYPES = ['empty', 'character', 'shop', 'start', 'special'];

/** A map file that cannot be loaded. The message is meant for the host. */
export class MapFileError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'MapFileError';
  }
}

/** The map file holds cells, paths and the background image (D-018). */
export function serializeMap(map: GameMap): string {
  return JSON.stringify({ format: MAP_FORMAT, version: MAP_FORMAT_VERSION, map });
}

export function parseMap(text: string): GameMap {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new MapFileError('Il file è danneggiato: il contenuto non è leggibile.', {
      cause: error,
    });
  }
  if (!isRecord(data) || data.format !== MAP_FORMAT) {
    throw new MapFileError('Il file non è una mappa.');
  }
  if (data.version !== MAP_FORMAT_VERSION) {
    throw new MapFileError(
      `La mappa usa la versione ${String(data.version)} del formato, ` +
        `ma questa app sa leggere solo la versione ${MAP_FORMAT_VERSION}.`,
    );
  }
  if (!isMapData(data.map)) {
    throw new MapFileError('Il file è danneggiato: mancano parti della mappa.');
  }
  return data.map;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPoint(value: unknown): boolean {
  return isRecord(value) && typeof value.x === 'number' && typeof value.y === 'number';
}

/** Checks the shape of a map, e.g. one read back from the browser's library. */
export function isMapData(value: unknown): value is GameMap {
  if (!isRecord(value) || typeof value.name !== 'string') {
    return false;
  }
  const { nodes, edges, background } = value;
  if (!Array.isArray(nodes) || !Array.isArray(edges)) {
    return false;
  }
  const ids = new Set<string>();
  for (const node of nodes) {
    if (
      !isRecord(node) ||
      typeof node.id !== 'string' ||
      !isPoint(node) ||
      typeof node.type !== 'string' ||
      !NODE_TYPES.includes(node.type)
    ) {
      return false;
    }
    ids.add(node.id);
  }
  const edgesOk = edges.every(
    (edge) =>
      isRecord(edge) &&
      typeof edge.id === 'string' &&
      typeof edge.from === 'string' &&
      typeof edge.to === 'string' &&
      ids.has(edge.from) &&
      ids.has(edge.to) &&
      Array.isArray(edge.curve) &&
      edge.curve.every(isPoint) &&
      typeof edge.locked === 'boolean' &&
      (edge.unlockNodeId === undefined || typeof edge.unlockNodeId === 'string'),
  );
  const backgroundOk =
    background === undefined ||
    (isRecord(background) &&
      typeof background.image === 'string' &&
      typeof background.width === 'number' &&
      typeof background.height === 'number');
  return edgesOk && backgroundOk;
}
