import { describe, expect, it } from 'vitest';
import type { Fighter, FightRecord, Side } from '../battle/fight';
import { act, createGame, currentState, testSetup, type Game, type GameAction, type Mission } from '../engine';
import {
  blockReason,
  canUndoOnPhone,
  fightResults,
  moveTargets,
  phoneShowdownDue,
  quizRewards,
  rewardsDue,
  showdownWinner,
} from './arbiter';

function play(game: Game, ...actions: GameAction[]): Game {
  return actions.reduce(act, game);
}

const start = (startingCoins = 0) => createGame(testSetup({ startingCoins }));

describe('where the pawn goes with a tap (spec 052, criterion 2)', () => {
  it('the cells next to it along open paths, while actions are left', () => {
    const game = start();
    expect([...moveTargets(game, currentState(game))].sort()).toEqual(['n1', 'n2']);

    // c1 -> n3 starts closed (e8): from c1 only n1 is reachable.
    const atC1 = play(game, { type: 'placePawn', player: 'p1', nodeId: 'c1' });
    expect([...moveTargets(atC1, currentState(atC1))]).toEqual(['n1']);
  });

  it('none once the actions of the turn are used', () => {
    const game = play(start(), { type: 'move', to: 'n1' }, { type: 'interact', nodeId: 'c1' });
    expect(moveTargets(game, currentState(game)).size).toBe(0);
  });

  it('the cell the last move started from, even with the actions used (D-087)', () => {
    const game = play(start(), { type: 'move', to: 'n1' }, { type: 'move', to: 'c1' });
    expect([...moveTargets(game, currentState(game))]).toEqual(['n1']);
  });
});

describe('the referee refuses what the director only warns about (spec 052, criterion 3)', () => {
  it('a move to a cell that is not next to the pawn', () => {
    expect(blockReason(start(), { type: 'move', to: 's2' })).toMatch(/non adiacente/);
    expect(blockReason(start(), { type: 'move', to: 'n1' })).toBeNull();
  });

  it('a move with the actions of the turn used', () => {
    const game = play(start(), { type: 'move', to: 'n1' }, { type: 'move', to: 'c1' });
    expect(blockReason(game, { type: 'move', to: 'n1' })).toMatch(/tutte le azioni/);
  });

  it('an interaction with a cell conquered by someone', () => {
    const game = play(
      start(),
      { type: 'setConquest', nodeId: 'c1', player: 'p2' },
      { type: 'placePawn', player: 'p1', nodeId: 'c1' },
    );
    expect(blockReason(game, { type: 'interact', nodeId: 'c1' })).toMatch(/già conquistato/);
  });

  it('a character that would join a full team', () => {
    const full = play(
      start(),
      { type: 'addCharacter', player: 'p1', characterId: 'char-e' },
      { type: 'addCharacter', player: 'p1', characterId: 'char-f' },
      { type: 'addCharacter', player: 'p1', characterId: 'char-g' },
      { type: 'addCharacter', player: 'p1', characterId: 'char-h' },
      { type: 'placePawn', player: 'p1', nodeId: 'c1' },
    );
    expect(blockReason(full, { type: 'interact', nodeId: 'c1' })).toMatch(/completa/);
  });

  it('a purchase without enough coins, and one with them', () => {
    expect(blockReason(start(0), { type: 'buyCharacter', shopNodeId: 'sh1', characterId: 'char-e' })).toBe(
      'G1 ha 0 monete: ne servono 300',
    );
    expect(blockReason(start(1000), { type: 'buyCharacter', shopNodeId: 'sh1', characterId: 'char-e' })).toBeNull();
  });

  it('an item bought twice when it is once per player', () => {
    const game = play(start(1000), { type: 'buyItem', shopNodeId: 'sh1', itemId: 'heavy-clothes' });
    expect(blockReason(game, { type: 'buyItem', shopNodeId: 'sh1', itemId: 'heavy-clothes' })).toMatch(
      /già comprato/,
    );
  });

  it('ending the turn with actions left is asked, not refused', () => {
    expect(blockReason(start(), { type: 'endTurn' })).toBeNull();
  });
});

const bringMission: Mission = { type: 'bring', targetId: 'char-e', reward: { coins: 100 } };

describe('rewards apply by themselves (spec 052, criterion 4)', () => {
  it('a mission whose condition came true gives its reward', () => {
    const accepted = play(
      start(),
      { type: 'setCellContent', nodeId: 'c1', content: { characterId: 'char-a', mission: bringMission } },
      { type: 'acceptMission', nodeId: 'c1', player: 'p1' },
    );
    expect(rewardsDue(currentState(accepted))).toEqual([]);

    const done = act(accepted, { type: 'addCharacter', player: 'p1', characterId: 'char-e' });
    expect(rewardsDue(currentState(done))).toEqual([{ type: 'completeMission', nodeId: 'c1', player: 'p1' }]);
  });

  it('the right answer of a quiz gives the reward, a wrong one nothing', () => {
    const quiz: Mission = {
      type: 'quiz',
      quiz: { question: 'Chi è la moglie di Goku?', answers: ['Bulma', 'Chichi'], correct: 1 },
      reward: { coins: 100 },
    };
    expect(quizRewards(quiz, 1, 'c1', 'p1')).toEqual([{ type: 'completeMission', nodeId: 'c1', player: 'p1' }]);
    expect(quizRewards(quiz, 0, 'c1', 'p1')).toEqual([]);
  });
});

function fighter(id: string, next?: Fighter): Fighter {
  return { id, name: id, tier: 'B', rank: 8, sheet: {} as Fighter['sheet'], next };
}

/** A fight told only by its end: who won, and how many forms each fighter climbed. */
function fightRecord(winner: Side, forms: { a: number[]; b: number[] }): FightRecord {
  const after = { hp: { a: [1], b: [1] }, active: { a: 0, b: 0 }, gauge: { a: 0, b: 0 }, forms };
  const transformed = forms.b.some((count) => count > 0)
    ? [{ event: { type: 'transform', exchange: 1, side: 'b', fighter: 0 }, after }]
    : [];
  return {
    teams: { a: [fighter('hero-1', fighter('hero-1-ssj'))], b: [fighter('char-a', fighter('char-a-2'))] },
    form: { a: 0, b: 0 },
    start: after,
    steps: [...transformed, { event: { type: 'end', exchange: 2, winner }, after }],
    winner,
  } as unknown as FightRecord;
}

describe('simulated fights apply their outcome (spec 052, criterion 4)', () => {
  const fight: Mission = { type: 'fight', format: '1v1', condition: 'win', reward: { cellCharacter: true } };
  const transform: Mission = { ...fight, condition: 'transform' };

  it('won gives the reward, lost gives nothing', () => {
    expect(fightResults(fightRecord('a', { a: [0], b: [0] }), fight, 'c1', 'p1', ['hero-1'])).toEqual([
      { type: 'completeMission', nodeId: 'c1', player: 'p1' },
    ]);
    expect(fightResults(fightRecord('b', { a: [0], b: [0] }), fight, 'c1', 'p1', ['hero-1'])).toEqual([]);
  });

  it('«costringimi a trasformarmi» is done when the opponent transformed, even if lost', () => {
    expect(fightResults(fightRecord('b', { a: [0], b: [1] }), transform, 'c1', 'p1', ['hero-1'])).toEqual([
      { type: 'completeMission', nodeId: 'c1', player: 'p1' },
    ]);
  });

  it("the player's characters that transformed stay so, even after a lost fight", () => {
    expect(fightResults(fightRecord('b', { a: [1], b: [0] }), fight, 'c1', 'p1', ['hero-1'])).toEqual([
      { type: 'transformCharacters', player: 'p1', changes: [{ from: 'hero-1', to: 'hero-1-ssj' }] },
    ]);
  });
});

describe('the showdown (spec 052, criterion 5)', () => {
  it('is due with both pawns on one cell or with both teams full', () => {
    expect(phoneShowdownDue(currentState(start()))).toBe(false);
    const together = play(start(), { type: 'placePawn', player: 'p2', nodeId: 's1' });
    expect(phoneShowdownDue(currentState(together))).toBe(true);

    const fill = (player: 'p1' | 'p2', ids: string[]) =>
      ids.map((characterId): GameAction => ({ type: 'addCharacter', player, characterId }));
    const fullTeams = play(
      start(),
      ...fill('p1', ['char-a', 'char-b', 'char-c', 'char-d']),
      ...fill('p2', ['char-e', 'char-f', 'char-g', 'char-h']),
    );
    expect(phoneShowdownDue(currentState(fullTeams))).toBe(true);
  });

  it('is won by the first player when side a wins', () => {
    expect(showdownWinner(fightRecord('a', { a: [0], b: [0] }))).toBe('p1');
    expect(showdownWinner(fightRecord('b', { a: [0], b: [0] }))).toBe('p2');
  });
});

describe('«Annulla» on the phone (spec 052, criterion 6)', () => {
  it('takes back a move or a purchase of the current turn', () => {
    expect(canUndoOnPhone(start())).toBe(false);
    expect(canUndoOnPhone(act(start(), { type: 'move', to: 'n1' }))).toBe(true);
    expect(canUndoOnPhone(act(start(1000), { type: 'buyItem', shopNodeId: 'sh1', itemId: 'senzu' }))).toBe(true);
  });

  it('not an interaction, a reward, or anything before the end of the turn', () => {
    const atC1 = play(start(), { type: 'placePawn', player: 'p1', nodeId: 'c1' });
    expect(canUndoOnPhone(act(atC1, { type: 'interact', nodeId: 'c1' }))).toBe(false);
    expect(canUndoOnPhone(act(atC1, { type: 'completeMission', nodeId: 'c1', player: 'p1' }))).toBe(false);
    expect(canUndoOnPhone(play(start(), { type: 'move', to: 'n1' }, { type: 'endTurn' }))).toBe(false);
  });
});
