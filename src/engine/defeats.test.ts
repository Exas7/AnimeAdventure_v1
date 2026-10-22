import { describe, expect, it } from 'vitest';
import { act, createGame, currentState, lastWarnings } from './game';
import { gameLog } from './log';
import { powerCatalog } from './powers';
import { hasLostAt, turnRuleWarnings } from './rules';
import { parseGame, SAVE_FORMAT_VERSION, serializeGame } from './save';
import { mustSendAway, sixthAvailable, teamIsFull } from './team';
import { testSetup, type TestSetupOptions } from './testMap';
import type { Game, GameAction } from './types';

const retry = () => powerCatalog.retryLostChallenge(1, 'Ritenta');

/** G1 on c1 (char-a), where it interacted and lost; one action of two left. */
function lostAtC1(options: TestSetupOptions = {}): Game {
  let game = createGame(testSetup(options));
  game = act(game, { type: 'placePawn', player: 'p1', nodeId: 'c1' });
  game = act(game, { type: 'interact', nodeId: 'c1' });
  return act(game, { type: 'loseChallenge', nodeId: 'c1', player: 'p1' });
}

const kinds = (game: Game, action: GameAction) =>
  turnRuleWarnings(currentState(game), action, game).map((warning) => warning.kind);

describe('lost challenges (spec 061, criterion 1; D-090)', () => {
  it('a lost challenge stays in the game and is written in the log', () => {
    const game = lostAtC1();
    expect(hasLostAt(currentState(game), 'p1', 'c1')).toBe(true);
    expect(hasLostAt(currentState(game), 'p2', 'c1')).toBe(false);
    expect(gameLog(game).at(-1)?.text).toBe('G1 perde la sfida di Personaggio A');
  });

  it('challenging the same character again is a turn rule, not a reopening of the scene', () => {
    const game = lostAtC1();
    expect(currentState(game).interactedNodeId).toBeNull();
    expect(kinds(game, { type: 'interact', nodeId: 'c1' })).toEqual(['noInteractionsLeft', 'challengeLost']);
    expect(turnRuleWarnings(currentState(game), { type: 'interact', nodeId: 'c1' }, game)[1]?.message).toBe(
      'G1 ha già perso contro Personaggio A: non può sfidarlo di nuovo',
    );
  });

  it('only the player who lost: the other one may challenge that character', () => {
    let game = lostAtC1();
    game = act(game, { type: 'endTurn' });
    game = act(game, { type: 'placePawn', player: 'p2', nodeId: 'c1' });
    expect(kinds(game, { type: 'interact', nodeId: 'c1' })).toEqual([]);
  });

  it('it lasts for the whole game: next turn the rule is still there', () => {
    let game = lostAtC1();
    game = act(game, { type: 'endTurn' });
    game = act(game, { type: 'endTurn' });
    expect(kinds(game, { type: 'interact', nodeId: 'c1' })).toEqual(['challengeLost']);
  });

  it('a defeat is recorded once', () => {
    const game = act(lostAtC1(), { type: 'loseChallenge', nodeId: 'c1', player: 'p1' });
    expect(currentState(game).defeats).toEqual([{ player: 'p1', nodeId: 'c1' }]);
  });
});

describe('«Ritenta una sfida persa» (spec 061, criterion 2; D-090)', () => {
  it('on the cell of the defeat: one use less, and the challenge is allowed again in the same turn', () => {
    let game = lostAtC1({ p1Powers: [retry()] });
    game = act(game, { type: 'usePower', player: 'p1', powerId: 'p1-0' });
    const state = currentState(game);
    expect(lastWarnings(game)).toEqual([]);
    expect(state.players.p1.powers[0]?.usesLeft).toBe(0);
    expect(hasLostAt(state, 'p1', 'c1')).toBe(false);
    expect(kinds(game, { type: 'interact', nodeId: 'c1' })).toEqual([]);

    game = act(game, { type: 'interact', nodeId: 'c1' });
    expect(currentState(game).actions.used).toBe(2);
  });

  it('it gives no action: with the actions used up the retry waits for the next turn', () => {
    let game = lostAtC1({ p1Powers: [retry()] });
    game = act(game, { type: 'setActions', actions: { used: 2 } });
    game = act(game, { type: 'usePower', player: 'p1', powerId: 'p1-0' });
    expect(kinds(game, { type: 'interact', nodeId: 'c1' })).toEqual(['noActionsLeft']);
  });

  it('away from a lost challenge it does nothing, with a warning', () => {
    let game = createGame(testSetup({ p1Powers: [retry()] }));
    game = act(game, { type: 'usePower', player: 'p1', powerId: 'p1-0' });
    expect(lastWarnings(game).map((warning) => warning.kind)).toEqual(['nothingToRetry']);
  });

  it('a Senzu may recharge it, also when another manual power comes first', () => {
    let game = lostAtC1({
      startingCoins: 1000,
      p1Powers: [powerCatalog.skipOpponentTurn(1), powerCatalog.retryLostChallenge(0, 'Ritenta')],
    });
    game = act(game, { type: 'addToInventory', player: 'p1', itemId: 'senzu' });
    game = act(game, { type: 'useItem', player: 'p1', itemId: 'senzu', powerId: 'p1-1' });
    const powers = currentState(game).players.p1.powers;
    expect(powers.map((power) => power.usesLeft)).toEqual([1, 1]);
  });
});

describe('the sixth character (spec 061, criterion 3; D-091)', () => {
  it('a full team takes its sixth once, then the player must send one away; after that it is full', () => {
    let game = createGame(testSetup());
    for (const characterId of ['char-e', 'char-f', 'char-g', 'char-h']) {
      game = act(game, { type: 'addCharacter', player: 'p1', characterId });
    }
    let p1 = currentState(game).players.p1;
    expect([sixthAvailable(p1), teamIsFull(p1), mustSendAway(p1)]).toEqual([true, false, false]);

    game = act(game, { type: 'assign', nodeId: 'c3', player: 'p1' });
    p1 = currentState(game).players.p1;
    expect(lastWarnings(game).map((warning) => warning.kind)).not.toContain('teamFull');
    expect([sixthAvailable(p1), teamIsFull(p1), mustSendAway(p1)]).toEqual([false, true, true]);

    game = act(game, { type: 'removeCharacter', player: 'p1', characterId: 'char-e' });
    p1 = currentState(game).players.p1;
    expect(p1.team).toHaveLength(5);
    expect([sixthAvailable(p1), teamIsFull(p1), mustSendAway(p1)]).toEqual([false, true, false]);
  });
});

describe('saved games (spec 061; D-090, D-091)', () => {
  it('version 6 keeps the lost challenges and the sixth', () => {
    expect(SAVE_FORMAT_VERSION).toBe(6);
    const game = lostAtC1();
    const loaded = parseGame(serializeGame(game));
    expect(currentState(loaded).defeats).toEqual([{ player: 'p1', nodeId: 'c1' }]);
  });
});
