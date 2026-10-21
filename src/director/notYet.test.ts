import { describe, expect, it } from 'vitest';
import { isPostponed, NOTHING_POSTPONED, postpone } from './notYet';

describe('"Non ancora" on a completed mission (spec 026, criterion 7)', () => {
  it('quiets the notice for the rest of the turn', () => {
    const later = postpone(NOTHING_POSTPONED, 3, 7);
    expect(isPostponed(later, 3, 7)).toBe(true);
    expect(isPostponed(later, 3, 8)).toBe(false);
    expect(isPostponed(postpone(later, 3, 8), 3, 7)).toBe(true);
  });

  it('the notice comes back at the next turn', () => {
    const later = postpone(NOTHING_POSTPONED, 3, 7);
    expect(isPostponed(later, 4, 7)).toBe(false);
    expect(postpone(later, 4, 9)).toEqual({ turn: 4, ids: [9] });
  });
});
