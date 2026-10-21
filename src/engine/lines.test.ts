import { describe, expect, it } from 'vitest';
import { cleanLines, nextLineIndex, upgradeCellTexts } from './lines';

describe('lines of a cell (spec 020, D-031)', () => {
  it('are trimmed, and empty ones are dropped', () => {
    expect(cleanLines([' Eccomi ', '', '   ', 'Vinci'])).toEqual(['Eccomi', 'Vinci']);
    expect(cleanLines(undefined)).toEqual([]);
  });

  it('C6: a click goes to the next line; after the last one, back to the first', () => {
    expect(nextLineIndex(0, 3)).toBe(1);
    expect(nextLineIndex(2, 3)).toBe(0);
    expect(nextLineIndex(0, 1)).toBe(0);
    expect(nextLineIndex(0, 0)).toBe(0);
  });

  it('C1: balloon and task saved before D-031 become two lines, balloon first', () => {
    const both: Record<string, unknown> = {
      characterId: 'goku',
      balloon: 'Eccomi',
      task: 'Vinci',
      format: '1v1',
    };
    upgradeCellTexts(both);
    expect(both).toEqual({ characterId: 'goku', lines: ['Eccomi', 'Vinci'], format: '1v1' });

    const onlyTask: Record<string, unknown> = { task: ' Vinci ', balloon: '' };
    upgradeCellTexts(onlyTask);
    expect(onlyTask).toEqual({ lines: ['Vinci'] });

    const empty: Record<string, unknown> = { characterId: 'goku', balloon: '' };
    upgradeCellTexts(empty);
    expect(empty).toEqual({ characterId: 'goku' });

    const current: Record<string, unknown> = { lines: ['Già nuova'] };
    upgradeCellTexts(current);
    expect(current).toEqual({ lines: ['Già nuova'] });
  });
});
