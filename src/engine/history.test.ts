import { describe, expect, it } from 'vitest';
import {
  act,
  canUndo,
  createGame,
  currentState,
  dismissNotification,
  dismissRedoNotification,
  redo,
  stepBackCell,
  undo,
  undoKeepingRedo,
  type Timeline,
} from './game';
import { gameLog } from './log';
import { powerCatalog } from './powers';
import { testSetup } from './testMap';
import type { Game, GameAction } from './types';

function play(game: Game, ...actions: GameAction[]): Game {
  return actions.reduce(act, game);
}

function undoAll(game: Game): Game {
  let result = game;
  while (canUndo(result)) {
    result = undo(result);
  }
  return result;
}

const setupWithPowers = testSetup({
  p1Powers: [powerCatalog.coinsAtTurnEnd(100), powerCatalog.skipOpponentTurn(2)],
  p2Powers: [powerCatalog.coinsEveryNTurns(250, 1)],
});

describe('undo and log (spec 001, criteria 16-18)', () => {
  it('C16: undoing an end of turn restores coins, counter, player, actions and skips', () => {
    const before = play(
      createGame(setupWithPowers),
      { type: 'move', to: 'n1' },
      { type: 'usePower', player: 'p1', powerId: 'p1-1' },
    );
    const afterEndTurn = act(before, { type: 'endTurn' });
    expect(currentState(afterEndTurn)).not.toEqual(currentState(before));

    expect(currentState(undo(afterEndTurn))).toEqual(currentState(before));
  });

  it('C17: undoing repeatedly goes back exactly to the start of the game', () => {
    const start = createGame(setupWithPowers);
    const played = play(
      start,
      { type: 'move', to: 'n1' },
      { type: 'interact', nodeId: 'c1' },
      { type: 'endTurn' },
      { type: 'addCharacter', player: 'p2', characterId: 'char-c' },
      { type: 'setCoins', player: 'p1', coins: 999 },
      { type: 'endTurn' },
    );
    const back = undoAll(played);
    expect(back.history).toHaveLength(1);
    expect(currentState(back)).toEqual(currentState(start));
    expect(undo(back)).toBe(back);
  });

  it('C18: an undone action disappears from the log', () => {
    const game = play(
      createGame(testSetup()),
      { type: 'move', to: 'n1' },
      { type: 'interact', nodeId: 'c1' },
    );
    expect(gameLog(game).map((line) => line.text)).toEqual([
      'Inizio della partita',
      'G1 si sposta su casella #1',
      'G1 interagisce con Personaggio A',
    ]);
    expect(gameLog(undo(game)).map((line) => line.text)).toEqual([
      'Inizio della partita',
      'G1 si sposta su casella #1',
    ]);
  });

  it('log lines carry turn and player', () => {
    const game = play(
      createGame(testSetup()),
      { type: 'endTurn' },
      { type: 'move', to: 'n5' },
    );
    const last = gameLog(game).at(-1);
    expect(last).toMatchObject({
      turn: 2,
      player: 'p2',
      playerName: 'G2',
      text: 'G2 si sposta su casella #5',
    });
  });

  it('never modifies a previous game or state', () => {
    const start = createGame(setupWithPowers);
    const snapshot = JSON.stringify(start);
    play(start, { type: 'move', to: 'n1' }, { type: 'endTurn' }, { type: 'endTurn' });
    expect(JSON.stringify(start)).toBe(snapshot);
  });
});

describe('notifications', () => {
  it('a fired power adds a notification that the host can close', () => {
    let game = play(createGame(setupWithPowers), { type: 'endTurn' });
    const notification = currentState(game).notifications[0];
    expect(notification?.text).toBe('G1 · Monete a fine turno: +100 monete');

    game = dismissNotification(game, notification?.id ?? -1);
    expect(currentState(game).notifications).toEqual([]);
  });

  it('closing a notification is not logged, and undo does not bring it back', () => {
    let game = play(createGame(setupWithPowers), { type: 'endTurn' }, { type: 'move', to: 'n5' });
    const logLength = gameLog(game).length;
    const id = currentState(game).notifications[0]?.id ?? -1;

    game = dismissNotification(game, id);
    expect(gameLog(game)).toHaveLength(logLength);

    game = undo(game); // undoes the move, not the closing
    expect(currentState(game).notifications.map((n) => n.id)).not.toContain(id);
  });
});

describe('"Ripeti" (spec 021, criterion 3)', () => {
  const moves: GameAction[] = [
    { type: 'move', to: 'n1' },
    { type: 'move', to: 'c1' },
    { type: 'endTurn' },
  ];
  const played: Timeline = { game: play(createGame(setupWithPowers), ...moves), redo: [] };

  it('brings back the actions undone, in order, exactly as they were', () => {
    const twiceUndone = undoKeepingRedo(undoKeepingRedo(played));
    expect(twiceUndone.game.history).toHaveLength(played.game.history.length - 2);
    expect(twiceUndone.redo).toHaveLength(2);

    const once = redo(twiceUndone);
    expect(once.game.history).toEqual(played.game.history.slice(0, -1));
    const twice = redo(once);
    expect(twice.game).toEqual(played.game);
    expect(twice.redo).toEqual([]);
    expect(gameLog(twice.game)).toEqual(gameLog(played.game));
  });

  it('without an undo there is nothing to repeat', () => {
    expect(redo(played)).toEqual(played);
  });

  it('the start of the game is never undone, so it never goes into "Ripeti"', () => {
    const start: Timeline = { game: createGame(setupWithPowers), redo: [] };
    expect(undoKeepingRedo(start)).toEqual(start);
  });

  it('a closed notification does not come back with "Ripeti"', () => {
    const undone = undoKeepingRedo(played);
    const notified = undone.redo.flatMap((entry) => entry.state.notifications);
    expect(notified.length).toBeGreaterThan(0);
    const [first] = notified;
    const cleaned = dismissRedoNotification(undone.redo, first?.id ?? -1);
    expect(cleaned.flatMap((entry) => entry.state.notifications)).not.toContainEqual(first);
  });
});

describe('going back where the last move started (D-087)', () => {
  it('is the cell the last move of the turn started from, back to the start', () => {
    const start = createGame(setupWithPowers);
    expect(stepBackCell(start)).toBeNull();
    const once = act(start, { type: 'move', to: 'n1' });
    expect(stepBackCell(once)).toBe('s1');
    const twice = act(once, { type: 'move', to: 'sh1' });
    expect(stepBackCell(twice)).toBe('n1');
    expect(stepBackCell(undo(twice))).toBe('s1');
  });

  it('is gone once something else happened after the move, or the turn ended', () => {
    const moved = act(createGame(setupWithPowers), { type: 'move', to: 'n1' });
    expect(stepBackCell(act(moved, { type: 'setCoins', player: 'p1', coins: 5 }))).toBeNull();
    expect(stepBackCell(act(moved, { type: 'endTurn' }))).toBeNull();
  });
});
