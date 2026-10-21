/** Lines remembered while preparing episodes (spec 007, 2.5; D-031). */
export interface TextLibrary {
  lines: string[];
}

export const EMPTY_TEXT_LIBRARY: TextLibrary = { lines: [] };

/** Remembers the lines of a cell; no duplicates, even with different spacing or case. */
export function rememberLines(library: TextLibrary, lines: readonly string[] | undefined): TextLibrary {
  return { lines: (lines ?? []).reduce(addText, library.lines) };
}

export function forgetLine(library: TextLibrary, line: string): TextLibrary {
  return { lines: library.lines.filter((entry) => entry !== line) };
}

/**
 * Reads a library saved in the browser. Before D-031 it had tasks and
 * balloons: both become lines, balloons first. Anything else gives null.
 */
export function readTextLibrary(value: unknown): TextLibrary | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const { lines, tasks, balloons } = value as Record<string, unknown>;
  if (isStringList(lines)) {
    return { lines };
  }
  if (isStringList(tasks) && isStringList(balloons)) {
    return rememberLines(EMPTY_TEXT_LIBRARY, [...balloons, ...tasks]);
  }
  return null;
}

function addText(list: string[], text: string | undefined): string[] {
  const clean = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!clean || list.some((entry) => entry.toLowerCase() === clean.toLowerCase())) {
    return list;
  }
  return [...list, clean];
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}
