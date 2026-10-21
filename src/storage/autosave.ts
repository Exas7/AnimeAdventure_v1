import { parseGame, serializeGame, type Game } from '../engine';
import { withStore } from './database';

// Automatic save of the game in progress (D-011). Only one game is kept:
// the current one. Other games are saved to file.

const KEY = 'current-game';

export async function saveAutosave(game: Game): Promise<void> {
  await withStore('autosave', 'readwrite', (store) => store.put(serializeGame(game), KEY));
}

/** Deletes the automatic save: no game is left to resume (spec 019). */
export async function clearAutosave(): Promise<void> {
  await withStore('autosave', 'readwrite', (store) => store.delete(KEY));
}

/** The autosaved game, or null if there is none. Throws SaveFileError if it is unreadable. */
export async function loadAutosave(): Promise<Game | null> {
  const text = await withStore<unknown>('autosave', 'readonly', (store) => store.get(KEY));
  return typeof text === 'string' ? parseGame(text) : null;
}
