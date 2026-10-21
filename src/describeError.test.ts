import { describe, expect, it } from 'vitest';
import { describeError } from './describeError';

describe('errors in words (spec 034, 2.5)', () => {
  it("an Error gives its message, anything else itself as text", () => {
    expect(describeError(new Error('Spazio esaurito'))).toBe('Spazio esaurito');
    expect(describeError('bloccato')).toBe('bloccato');
    expect(describeError(404)).toBe('404');
  });
});
