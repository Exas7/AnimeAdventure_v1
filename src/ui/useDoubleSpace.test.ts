import { describe, expect, it } from 'vitest';
import { DOUBLE_PRESS_MS, isDoublePress } from './useDoubleSpace';

describe('the double space bar (spec 083)', () => {
  it('two presses close together are a double press; a first one or a slow one is not', () => {
    expect(isDoublePress(null, 1000)).toBe(false);
    expect(isDoublePress(1000, 1000 + DOUBLE_PRESS_MS)).toBe(true);
    expect(isDoublePress(1000, 1000 + DOUBLE_PRESS_MS + 1)).toBe(false);
  });
});
