import { upgradeCellTexts } from './lines';
import type { Game } from './types';

/** Internal code: stays 'arkanite-…' after the rename, or old files would not open (D-020). */
const SAVE_FORMAT = 'arkanite-game';

/**
 * Increase when the saved structure changes, and teach `upgrade` how to
 * bring older files up to date.
 * 1: first format. 2: adds the turn-rule warnings given in the turn (D-013).
 * 3: cell content moves from the map into the game state (D-016).
 * 4: balloon and task become lines (D-031).
 * 5: cells may hold missions (spec 026); the new fields are optional, so a
 *    version 4 file opens as it is, while an older app refuses version 5
 *    files instead of dropping their missions (spec 038).
 * 6: lost challenges and the sixth character (spec 061, D-090, D-091); the
 *    new fields are optional, as in version 5.
 */
export const SAVE_FORMAT_VERSION = 6;

/** A save file that cannot be loaded. The message is meant for the host. */
export class SaveFileError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'SaveFileError';
  }
}

/** The file holds map, catalog and the whole history, so undo works after loading. */
export function serializeGame(game: Game): string {
  return JSON.stringify({ format: SAVE_FORMAT, version: SAVE_FORMAT_VERSION, game });
}

/**
 * Reads a save file. Throws SaveFileError with a clear message when the
 * file is damaged or comes from an unknown format version.
 */
export function parseGame(text: string): Game {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new SaveFileError('Il file è danneggiato: il contenuto non è leggibile.', {
      cause: error,
    });
  }

  if (!isRecord(data) || data.format !== SAVE_FORMAT) {
    throw new SaveFileError('Il file non è un salvataggio di una partita.');
  }
  if (typeof data.version !== 'number') {
    throw new SaveFileError('Il file è danneggiato: manca la versione del formato.');
  }
  if (!Number.isInteger(data.version) || data.version < 1 || data.version > SAVE_FORMAT_VERSION) {
    throw new SaveFileError(
      `Il file usa la versione ${data.version} del formato di salvataggio, ` +
        `ma questa app sa leggere solo fino alla versione ${SAVE_FORMAT_VERSION}.`,
    );
  }
  const game = upgrade(data.game, data.version);
  if (!looksLikeGame(game)) {
    throw new SaveFileError('Il file è danneggiato: mancano parti della partita.');
  }
  return game;
}

/** Brings a game saved with an older format version up to the current one. */
function upgrade(game: unknown, version: number): unknown {
  if (version < 2 && isRecord(game) && Array.isArray(game.history)) {
    // Version 1 did not record the turn-rule warnings given in the turn.
    for (const entry of game.history) {
      if (isRecord(entry) && isRecord(entry.state) && entry.state.acknowledgedThisTurn === undefined) {
        entry.state.acknowledgedThisTurn = [];
      }
    }
  }
  if (version < 3 && isRecord(game) && Array.isArray(game.history)) {
    // Up to version 2 the cell content was written inside the map.
    const content = takeContentFromMap(game.map);
    for (const entry of game.history) {
      if (isRecord(entry) && isRecord(entry.state) && entry.state.cells === undefined) {
        entry.state.cells = JSON.parse(JSON.stringify(content)) as unknown;
      }
    }
    if (Array.isArray(game.catalog)) {
      for (const character of game.catalog) {
        if (isRecord(character)) {
          delete character.fighter;
        }
      }
    }
  }
  if (version < 4 && isRecord(game) && Array.isArray(game.history)) {
    // Up to version 3 a cell had one balloon and one task.
    for (const entry of game.history) {
      if (!isRecord(entry)) {
        continue;
      }
      if (isRecord(entry.state) && isRecord(entry.state.cells)) {
        Object.values(entry.state.cells).forEach(upgradeCellTexts);
      }
      if (isRecord(entry.action) && entry.action.type === 'setCellContent') {
        upgradeCellTexts(entry.action.content);
      }
    }
  }
  return game;
}

/** Moves character, balloon, task, format and shop list out of the map nodes. */
function takeContentFromMap(map: unknown): Record<string, Record<string, unknown>> {
  const content: Record<string, Record<string, unknown>> = {};
  if (!isRecord(map) || !Array.isArray(map.nodes)) {
    return content;
  }
  for (const node of map.nodes) {
    if (!isRecord(node) || typeof node.id !== 'string') {
      continue;
    }
    const cell: Record<string, unknown> = {};
    for (const key of ['characterId', 'balloon', 'task', 'format', 'forSale']) {
      if (node[key] !== undefined) {
        cell[key] = node[key];
        delete node[key];
      }
    }
    if (node.type === 'character') {
      node.type = 'empty';
    }
    if (Object.keys(cell).length > 0) {
      content[node.id] = cell;
    }
  }
  return content;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Checks the overall shape of a game; it does not validate every single field. */
function looksLikeGame(value: unknown): value is Game {
  if (!isRecord(value)) {
    return false;
  }
  const { map, catalog, items, history } = value;
  return (
    isRecord(map) &&
    Array.isArray(map.nodes) &&
    Array.isArray(map.edges) &&
    Array.isArray(catalog) &&
    Array.isArray(items) &&
    Array.isArray(history) &&
    history.length > 0 &&
    history.every(looksLikeHistoryEntry)
  );
}

function looksLikeHistoryEntry(value: unknown): boolean {
  if (!isRecord(value) || !isRecord(value.action) || !isRecord(value.state)) {
    return false;
  }
  const { state } = value;
  return (
    typeof state.turn === 'number' &&
    (state.currentPlayer === 'p1' || state.currentPlayer === 'p2') &&
    isRecord(state.actions) &&
    isRecord(state.players) &&
    isRecord(state.players.p1) &&
    isRecord(state.players.p2) &&
    isRecord(state.conquests) &&
    isRecord(state.edgeLocks) &&
    isRecord(state.cells) &&
    isRecord(state.characterPrices) &&
    isRecord(state.itemPrices) &&
    isRecord(state.soldCharacters) &&
    Array.isArray(state.itemPurchases) &&
    Array.isArray(state.acknowledgedThisTurn) &&
    Array.isArray(state.notifications) &&
    Array.isArray(value.warnings) &&
    Array.isArray(value.events)
  );
}
