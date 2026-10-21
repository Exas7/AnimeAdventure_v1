// The lines of a cell (D-031): what the character says in the challenge
// scene, with the task written inside.

/** Trims every line and drops the empty ones. */
export function cleanLines(lines: readonly string[] | undefined): string[] {
  return (lines ?? []).map((line) => line.trim()).filter((line) => line !== '');
}

/** The next line to show in the scene: after the last one, back to the first (spec 020). */
export function nextLineIndex(index: number, lineCount: number): number {
  return lineCount === 0 ? 0 : (index + 1) % lineCount;
}

/**
 * Brings the content of a cell saved before D-031 up to date: balloon and
 * task become two lines, balloon first, so no text is lost. Works on raw
 * data read from a file or from the browser, and changes it in place.
 */
export function upgradeCellTexts(cell: unknown): void {
  if (typeof cell !== 'object' || cell === null || Array.isArray(cell)) {
    return;
  }
  const raw = cell as Record<string, unknown>;
  if (raw.balloon === undefined && raw.task === undefined) {
    return;
  }
  const lines = [
    ...(Array.isArray(raw.lines) ? raw.lines : []),
    raw.balloon,
    raw.task,
  ].filter((line): line is string => typeof line === 'string' && line.trim() !== '');
  delete raw.balloon;
  delete raw.task;
  if (lines.length > 0) {
    raw.lines = lines.map((line) => line.trim());
  }
}
