import { describe, expect, it } from 'vitest';
import { act, createGame, currentState, lastWarnings } from './game';
import { powerCatalog } from './powers';
import { testSetup } from './testMap';
import type { Game, GameAction } from './types';

function play(game: Game, ...actions: GameAction[]): Game {
  return actions.reduce(act, game);
}

const useDoubleMove: GameAction = { type: 'usePower', player: 'p1', powerId: 'p1-0' };

describe('limits and warnings, never blocks (spec 001, criteria 9-13)', () => {
  it('C9: a manual power with no uses left still fires, keeps uses at zero and warns', () => {
    let game = createGame(testSetup({ p1Powers: [powerCatalog.extraActionsOnDemand(2, 1)] }));
    game = act(game, useDoubleMove);
    expect(lastWarnings(game)).toEqual([]);
    expect(currentState(game).players.p1.powers[0]?.usesLeft).toBe(0);

    game = act(game, useDoubleMove);
    expect(lastWarnings(game).map((w) => w.kind)).toEqual(['powerOutOfUses']);
    expect(currentState(game).actions.available).toBe(6);
    expect(currentState(game).players.p1.powers[0]?.usesLeft).toBe(0);
  });

  it('C10: after the host adds uses, the power fires without warnings', () => {
    let game = createGame(testSetup({ p1Powers: [powerCatalog.extraActionsOnDemand(2, 1)] }));
    game = play(game, useDoubleMove, {
      type: 'setPowerUses',
      player: 'p1',
      powerId: 'p1-0',
      uses: 1,
    });
    game = act(game, useDoubleMove);
    expect(lastWarnings(game)).toEqual([]);
    expect(currentState(game).players.p1.powers[0]?.usesLeft).toBe(0);
  });

  it('C11: interacting with a conquered cell happens, with a warning', () => {
    let game = createGame(testSetup());
    game = play(
      game,
      { type: 'setConquest', nodeId: 'c1', player: 'p1' },
      { type: 'endTurn' },
      { type: 'interact', nodeId: 'c1' },
    );
    expect(lastWarnings(game)).toEqual([
      {
        kind: 'nodeAlreadyConquered',
        message: 'G1 ha già conquistato Personaggio A',
      },
    ]);
    expect(currentState(game).actions.used).toBe(1);
    expect(currentState(game).actions.interactionsUsed).toBe(1);
  });

  it('C12: a sixth character joins as an extra, with a warning', () => {
    let game = createGame(testSetup());
    for (const characterId of ['char-a', 'char-b', 'char-c', 'char-d']) {
      game = act(game, { type: 'addCharacter', player: 'p1', characterId });
      expect(lastWarnings(game)).toEqual([]);
    }
    expect(currentState(game).players.p1.team).toHaveLength(5);

    game = act(game, { type: 'addCharacter', player: 'p1', characterId: 'char-e' });
    expect(lastWarnings(game).map((w) => w.kind)).toEqual(['teamFull']);
    expect(currentState(game).players.p1.team).toEqual([
      'hero-1',
      'char-a',
      'char-b',
      'char-c',
      'char-d',
      'char-e',
    ]);
  });

  it('C13: removing the starter happens, with a warning', () => {
    let game = createGame(testSetup());
    game = act(game, { type: 'removeCharacter', player: 'p1', characterId: 'hero-1' });
    expect(lastWarnings(game).map((w) => w.kind)).toEqual(['starterRemoved']);
    expect(currentState(game).players.p1.team).toEqual([]);
  });
});
