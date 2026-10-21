import type { GameMap } from '../engine';

/**
 * Undo and redo for the editors (spec 006, spec 007): past and future
 * versions of what is being edited (a map, or the content of an episode).
 */
export interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

export type EditorHistory = History<GameMap>;

/** Enough for a long editing session; big data (backgrounds) is shared, not copied. */
const MAX_UNDO = 300;

export function startHistory<T>(value: T): History<T> {
  return { past: [], present: value, future: [] };
}

/** Records a change. Redo is lost, as in any editor. */
export function commit<T>(history: History<T>, value: T): History<T> {
  if (value === history.present) {
    return history;
  }
  return {
    past: [...history.past, history.present].slice(-MAX_UNDO),
    present: value,
    future: [],
  };
}

export function undoEdit<T>(history: History<T>): History<T> {
  if (history.past.length === 0) {
    return history;
  }
  return {
    past: history.past.slice(0, -1),
    present: history.past[history.past.length - 1] as T,
    future: [history.present, ...history.future],
  };
}

export function redoEdit<T>(history: History<T>): History<T> {
  if (history.future.length === 0) {
    return history;
  }
  const [next, ...rest] = history.future;
  return { past: [...history.past, history.present], present: next as T, future: rest };
}
