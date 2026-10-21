import { describe, expect, it } from 'vitest';
import { cellNumber } from './cellNumber';

describe('cell numbers on screen (spec 023, criterion 1)', () => {
  it('"n12" reads "#12"', () => {
    expect(cellNumber('n12')).toBe('#12');
    expect(cellNumber('n1')).toBe('#1');
  });

  it('codes of another kind keep their letters after the #', () => {
    expect(cellNumber('s1')).toBe('#s1');
    expect(cellNumber('sh2')).toBe('#sh2');
    expect(cellNumber('n')).toBe('#n');
  });
});
