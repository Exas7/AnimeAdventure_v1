import { describe, expect, it } from 'vitest';
import { createGame, testSetup } from '../engine';
import { emptyProposals } from '../starters/proposals';
import { startChoice, starterChoiceView } from '../starters/starterChoice';
import { directorMessage, isShowing } from './directorMessage';
import { buildLiveView, DEFAULT_LAYOUT } from './liveView';
import { battleMessage, starterChoiceMessage, viewMessage } from './messages';
import { DEFAULT_SETTINGS, fighterOf, recordFight, type Fighter } from '../battle/fight';
import { seededRandom } from '../battle/random';

const game = createGame(testSetup());
const choice = starterChoiceView(emptyProposals(), startChoice('p1'), { p1: 'G1', p2: 'G2' }, 1000, []);
const nothing = { game: null, overlay: null, layout: DEFAULT_LAYOUT, starterChoice: null, battle: null };
const fighter = fighterOf({ id: 'a', name: 'A', tier: 'A' }) as Fighter;
const battle = {
  record: recordFight({ a: [fighter], b: [fighter] }, DEFAULT_SETTINGS, seededRandom(1)),
  shown: 0,
  speed: 1,
  switchRecharge: 15,
};

describe('what the director sends to the stream (spec 032, criterion 4)', () => {
  it('a game, or the starter choice while it is open', () => {
    expect(directorMessage({ ...nothing, game }, false)).toEqual(
      viewMessage(buildLiveView(game, null, DEFAULT_LAYOUT)),
    );
    expect(directorMessage({ ...nothing, game, starterChoice: choice }, true)).toEqual(starterChoiceMessage(choice));
  });

  it('a simulated fight goes before everything while it is open (spec 037, D-058)', () => {
    expect(directorMessage({ ...nothing, game, starterChoice: choice, battle }, true)).toEqual(battleMessage(battle));
    expect(isShowing(battleMessage(battle))).toBe(true);
  });

  it('without a game, a window that never showed anything stays quiet', () => {
    expect(directorMessage(nothing, false)).toBeNull();
  });

  it('a game closed or a scene left: the stream shows that no game is in progress', () => {
    expect(directorMessage(nothing, true)).toEqual(viewMessage(null));
  });

  it('after a game or a scene the stream is showing something; after "no game" it is not', () => {
    expect(isShowing(viewMessage(buildLiveView(game, null, DEFAULT_LAYOUT)))).toBe(true);
    expect(isShowing(starterChoiceMessage(choice))).toBe(true);
    expect(isShowing(viewMessage(null))).toBe(false);
  });
});
