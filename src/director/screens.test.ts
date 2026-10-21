import { describe, expect, it } from 'vitest';
import {
  challengeScreen,
  chooseAnswer,
  closeShown,
  describeScreen,
  exploreBoard,
  isExploring,
  nextLine,
  openPreview,
  showPreviewToAll,
  shownInDirector,
  type DirectorScreens,
} from './screens';

const nothing: DirectorScreens = { shared: null, preview: null };

describe('preview in the director window (spec 020, criterion 5; D-032)', () => {
  it('with a screen on the stream, the director shows its preview; closing it goes back', () => {
    const shop: DirectorScreens = { shared: { kind: 'shop', nodeId: 'sh1' }, preview: null };
    const previewing = openPreview(shop, 'c2');
    expect(shownInDirector(previewing)).toEqual(challengeScreen('c2'));
    expect(previewing.shared).toEqual(shop.shared);

    const closed = closeShown(previewing);
    expect(closed).toEqual(shop);
    expect(shownInDirector(closed)).toEqual({ kind: 'shop', nodeId: 'sh1' });
  });

  it('without a preview, "Chiudi" closes the screen on both windows', () => {
    expect(closeShown({ shared: challengeScreen('c1'), preview: null })).toEqual(nothing);
  });

  it('"Mostra al pubblico" replaces the stream screen, from the line shown', () => {
    const previewing = nextLine(openPreview({ shared: { kind: 'showdown' }, preview: null }, 'c2'), 3);
    expect(showPreviewToAll(previewing)).toEqual({
      shared: { kind: 'challenge', nodeId: 'c2', line: 1 },
      preview: null,
    });
    expect(showPreviewToAll(nothing)).toBe(nothing);
  });

  it('the balloon click moves the scene the director sees: the preview, or the shared one', () => {
    const shared: DirectorScreens = { shared: challengeScreen('c1'), preview: null };
    expect(nextLine(shared, 2).shared).toEqual({ kind: 'challenge', nodeId: 'c1', line: 1 });
    expect(nextLine(nextLine(shared, 2), 2).shared).toEqual(challengeScreen('c1'));

    const previewing = openPreview(shared, 'c2');
    const moved = nextLine(previewing, 2);
    expect(moved.preview).toEqual({ kind: 'challenge', nodeId: 'c2', line: 1 });
    expect(moved.shared).toEqual(challengeScreen('c1'));

    const showdown: DirectorScreens = { shared: { kind: 'showdown' }, preview: null };
    expect(nextLine(showdown, 2)).toBe(showdown);
  });
});

describe('quiz answers (spec 026, 2.5 and criterion 12)', () => {
  it('the answer clicked goes to the scene the director sees: shared, or only the preview', () => {
    const shared: DirectorScreens = { shared: challengeScreen('c1'), preview: null };
    expect(chooseAnswer(shared, 2).shared).toEqual({ kind: 'challenge', nodeId: 'c1', line: 0, answer: 2 });

    const previewing = openPreview(shared, 'c2');
    const answered = chooseAnswer(previewing, 1);
    expect(answered.preview).toEqual({ kind: 'challenge', nodeId: 'c2', line: 0, answer: 1 });
    expect(answered.shared).toEqual(challengeScreen('c1'));

    const shop: DirectorScreens = { shared: { kind: 'shop', nodeId: 'sh1' }, preview: null };
    expect(chooseAnswer(shop, 0)).toBe(shop);
  });

  it('a scene opened again starts without an answer', () => {
    expect(challengeScreen('c1')).toEqual({ kind: 'challenge', nodeId: 'c1', line: 0 });
  });
});

describe('"Esplora Regia" (spec 020, 2.3 and criterion 5)', () => {
  const challenge: DirectorScreens = { shared: challengeScreen('c1'), preview: null };

  it('shows the board to the director only; the stream keeps its screen', () => {
    const exploring = exploreBoard(challenge);
    expect(isExploring(exploring)).toBe(true);
    expect(shownInDirector(exploring)).toBeNull();
    expect(exploring.shared).toEqual(challenge.shared);
  });

  it('works only over a screen open on both windows', () => {
    expect(exploreBoard(nothing)).toBe(nothing);
    const previewing = openPreview(challenge, 'c2');
    expect(exploreBoard(previewing)).toBe(previewing);
  });

  it('a preview from the explored board, once closed, goes back to the stream screen', () => {
    const previewing = openPreview(exploreBoard(challenge), 'c2');
    expect(shownInDirector(previewing)).toEqual(challengeScreen('c2'));
    expect(isExploring(previewing)).toBe(false);
    expect(closeShown(previewing)).toEqual(challenge);
  });

  it('"Torna allo stream" goes back to the stream screen without closing it', () => {
    expect(closeShown(exploreBoard(challenge))).toEqual(challenge);
  });

  it('the explored board is neither shown to all nor moved by a balloon click', () => {
    const exploring = exploreBoard(challenge);
    expect(showPreviewToAll(exploring)).toBe(exploring);
    expect(nextLine(exploring, 3)).toBe(exploring);
  });

  it('is not exploring when no screen is open on the stream', () => {
    expect(isExploring({ shared: null, preview: { kind: 'board' } })).toBe(false);
  });

  it('names what the stream keeps showing', () => {
    const names: Record<string, string> = { c1: 'Zangya', sh1: 'Muten Roshi' };
    const cellName = (nodeId: string) => names[nodeId] ?? nodeId;
    expect(describeScreen(challengeScreen('c1'), cellName)).toBe('sfida di Zangya');
    expect(describeScreen({ kind: 'shop', nodeId: 'sh1' }, cellName)).toBe('negozio di Muten Roshi');
    expect(describeScreen({ kind: 'showdown' }, cellName)).toBe('showdown');
  });
});
