import { describe, expect, it } from 'vitest';
import type { Fighter, FightRecord, Side } from '../battle/fight';
import {
  act,
  createGame,
  currentState,
  powerCatalog,
  testSetup,
  type Game,
  type GameAction,
  type Mission,
  type PowerDefinition,
} from '../engine';
import {
  blockReason,
  canUndoOnPhone,
  fightResults,
  LOST_CHALLENGE_MESSAGE,
  moveTargets,
  phoneShowdownDue,
  quizRewards,
  retryChoice,
  rewardsDue,
  sendAwayChoices,
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

  it('a character that would join a full team, once the sixth of the game was taken (spec 061, D-091)', () => {
    const full = play(
      start(),
      { type: 'addCharacter', player: 'p1', characterId: 'char-e' },
      { type: 'addCharacter', player: 'p1', characterId: 'char-f' },
      { type: 'addCharacter', player: 'p1', characterId: 'char-g' },
      { type: 'addCharacter', player: 'p1', characterId: 'char-h' },
      { type: 'placePawn', player: 'p1', nodeId: 'c1' },
    );
    expect(blockReason(full, { type: 'interact', nodeId: 'c1' })).toBeNull();

    const swapped = play(
      full,
      { type: 'assign', nodeId: 'c2', player: 'p1' },
      { type: 'removeCharacter', player: 'p1', characterId: 'char-e' },
    );
    expect(blockReason(swapped, { type: 'interact', nodeId: 'c1' })).toMatch(/completa/);
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

  it('the right answer of a quiz gives the reward, a wrong one is a lost challenge (spec 061, D-090)', () => {
    const quiz: Mission = {
      type: 'quiz',
      quiz: { question: 'Chi è la moglie di Goku?', answers: ['Bulma', 'Chichi'], correct: 1 },
      reward: { coins: 100 },
    };
    expect(quizRewards(quiz, 1, 'c1', 'p1')).toEqual([{ type: 'completeMission', nodeId: 'c1', player: 'p1' }]);
    expect(quizRewards(quiz, 0, 'c1', 'p1')).toEqual([{ type: 'loseChallenge', nodeId: 'c1', player: 'p1' }]);
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

  it('won gives the reward, lost is a lost challenge (spec 061, D-090)', () => {
    expect(fightResults(fightRecord('a', { a: [0], b: [0] }), fight, 'c1', 'p1', ['hero-1'])).toEqual([
      { type: 'completeMission', nodeId: 'c1', player: 'p1' },
    ]);
    expect(fightResults(fightRecord('b', { a: [0], b: [0] }), fight, 'c1', 'p1', ['hero-1'])).toEqual([
      { type: 'loseChallenge', nodeId: 'c1', player: 'p1' },
    ]);
  });

  it('«costringimi a trasformarmi» is done when the opponent transformed, even if lost', () => {
    expect(fightResults(fightRecord('b', { a: [0], b: [1] }), transform, 'c1', 'p1', ['hero-1'])).toEqual([
      { type: 'completeMission', nodeId: 'c1', player: 'p1' },
    ]);
  });

  it("the player's characters that transformed stay so, even after a lost fight", () => {
    expect(fightResults(fightRecord('b', { a: [1], b: [0] }), fight, 'c1', 'p1', ['hero-1'])).toEqual([
      { type: 'loseChallenge', nodeId: 'c1', player: 'p1' },
      { type: 'transformCharacters', player: 'p1', changes: [{ from: 'hero-1', to: 'hero-1-ssj' }] },
    ]);
  });
});

describe('the showdown (spec 052, criterion 5)', () => {
  it('is due with both pawns on one cell, or with both teams full after the swap of the sixth (spec 061, D-091)', () => {
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
    expect(phoneShowdownDue(currentState(fullTeams))).toBe(false);

    const oneSwap = play(
      fullTeams,
      { type: 'addCharacter', player: 'p1', characterId: 'keeper-1' },
      { type: 'removeCharacter', player: 'p1', characterId: 'char-a' },
    );
    expect(phoneShowdownDue(currentState(oneSwap))).toBe(false);

    const sixthNotSentAway = play(oneSwap, { type: 'addCharacter', player: 'p2', characterId: 'keeper-2' });
    expect(phoneShowdownDue(currentState(sixthNotSentAway))).toBe(false);

    const bothSwaps = play(sixthNotSentAway, { type: 'removeCharacter', player: 'p2', characterId: 'char-e' });
    expect(phoneShowdownDue(currentState(bothSwaps))).toBe(true);
  });

  it('after the sixth, anyone but the starter may be sent away (spec 061, 2.3)', () => {
    const game = play(start(), { type: 'addCharacter', player: 'p1', characterId: 'char-a' });
    expect(sendAwayChoices(currentState(game), 'p1')).toEqual(['char-a']);
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

/** G1 on c1 (Personaggio A), where it interacted and lost the challenge. */
function lostAtC1(powers: PowerDefinition[] = []): Game {
  return play(
    createGame(testSetup({ p1Powers: powers })),
    { type: 'placePawn', player: 'p1', nodeId: 'c1' },
    { type: 'interact', nodeId: 'c1' },
    { type: 'loseChallenge', nodeId: 'c1', player: 'p1' },
  );
}

describe('a character who beat the player (spec 061, criteria 1 and 2; D-090)', () => {
  it('without the power: refused with the message of the format', () => {
    expect(retryChoice(lostAtC1(), 'c1')).toEqual({ kind: 'refused', message: LOST_CHALLENGE_MESSAGE });
    expect(blockReason(lostAtC1(), { type: 'interact', nodeId: 'c1' })).not.toBeNull();
    expect(retryChoice(start(), 'c1')).toBeNull();
  });

  it('with the power: a window to use it, then the challenge is allowed in the same turn', () => {
    const game = lostAtC1([powerCatalog.retryLostChallenge(1, 'Ritenta')]);
    const choice = retryChoice(game, 'c1');
    expect(choice).toEqual({
      kind: 'offer',
      message: 'Stai usando il potere dello starter «Ritenta» per sfidare di nuovo Personaggio A.',
      actions: [{ type: 'usePower', player: 'p1', powerId: 'p1-0' }],
    });
    const after = play(game, ...(choice?.kind === 'offer' ? choice.actions : []));
    expect(blockReason(after, { type: 'interact', nodeId: 'c1' })).toBeNull();
  });

  it('with the power out of uses and a Senzu: the Senzu recharges it', () => {
    const game = act(lostAtC1([powerCatalog.retryLostChallenge(0, 'Ritenta')]), {
      type: 'addToInventory',
      player: 'p1',
      itemId: 'senzu',
    });
    const choice = retryChoice(game, 'c1');
    expect(choice?.kind).toBe('offer');
    expect(choice?.message).toBe(
      '«Ritenta» ha finito gli usi: puoi usare un Senzu per ricaricarlo e sfidare di nuovo Personaggio A.',
    );
    const after = play(game, ...(choice?.kind === 'offer' ? choice.actions : []));
    expect(currentState(after).players.p1.inventory).toEqual([]);
    expect(blockReason(after, { type: 'interact', nodeId: 'c1' })).toBeNull();
  });

  it('with the power out of uses and no Senzu: refused', () => {
    expect(retryChoice(lostAtC1([powerCatalog.retryLostChallenge(0, 'Ritenta')]), 'c1')).toEqual({
      kind: 'refused',
      message: '«Ritenta» ha finito gli usi: non puoi sfidare un PG che te le ha già suonate',
    });
  });

  it('with no action left the power waits for the next turn', () => {
    const game = act(lostAtC1([powerCatalog.retryLostChallenge(1, 'Ritenta')]), {
      type: 'setActions',
      actions: { used: 2 },
    });
    expect(retryChoice(game, 'c1')).toEqual({
      kind: 'refused',
      message: 'G1 ha già usato tutte le azioni del turno: potrà ritentare al prossimo turno',
    });
  });

  it('the power is not used away from a lost challenge', () => {
    const game = createGame(testSetup({ p1Powers: [powerCatalog.retryLostChallenge(1, 'Ritenta')] }));
    expect(blockReason(game, { type: 'usePower', player: 'p1', powerId: 'p1-0' })).toMatch(/non ha perso/);
  });
});

describe('missions in progress after the sixth (spec 063, criterion 5; D-092)', () => {
  const bring: Mission = { type: 'bring', targetId: 'char-e', reward: { cellCharacter: true, coins: 300 } };

  it('a full team after the swap gets the coins of the reward, not the character', () => {
    const accepted = play(
      start(),
      { type: 'setCellContent', nodeId: 'c1', content: { characterId: 'char-a', mission: bring } },
      { type: 'acceptMission', nodeId: 'c1', player: 'p1' },
      ...['char-f', 'char-g', 'char-h', 'char-b', 'char-c'].map(
        (characterId): GameAction => ({ type: 'addCharacter', player: 'p1', characterId }),
      ),
      { type: 'removeCharacter', player: 'p1', characterId: 'char-c' },
      // Personaggio E joins in the place of Personaggio B: the mission comes true.
      { type: 'removeCharacter', player: 'p1', characterId: 'char-b' },
      { type: 'addCharacter', player: 'p1', characterId: 'char-e' },
    );
    const due = rewardsDue(currentState(accepted));
    expect(due).toEqual([{ type: 'completeMission', nodeId: 'c1', player: 'p1', withoutCharacters: true }]);
    const done = play(accepted, ...due);
    const p1 = currentState(done).players.p1;
    expect(p1.team).not.toContain('char-a');
    expect(p1.team).toHaveLength(5);
    expect(p1.coins).toBe(300);
    expect(currentState(done).conquests.c1).toBe('p1');
  });

  it('before the swap the mission gives its character, as the sixth', () => {
    const accepted = play(
      start(),
      { type: 'setCellContent', nodeId: 'c1', content: { characterId: 'char-a', mission: bring } },
      { type: 'acceptMission', nodeId: 'c1', player: 'p1' },
      ...['char-f', 'char-g', 'char-h', 'char-e'].map(
        (characterId): GameAction => ({ type: 'addCharacter', player: 'p1', characterId }),
      ),
    );
    expect(rewardsDue(currentState(accepted))).toEqual([{ type: 'completeMission', nodeId: 'c1', player: 'p1' }]);
  });
});

describe('«Batti» rewards at once (spec 070, 2.2)', () => {
  it('the reward of a fight conquers the cell, and the «Batti» of that cell comes due too', () => {
    const defeat: Mission = { type: 'defeat', targetId: 'char-b', reward: { cellCharacter: true } };
    const fight: Mission = { type: 'fight', format: '1v1', condition: 'win', reward: { cellCharacter: true } };
    const accepted = play(
      start(),
      { type: 'setCellContent', nodeId: 'c1', content: { characterId: 'char-a', mission: defeat } },
      { type: 'setCellContent', nodeId: 'c2', content: { characterId: 'char-b', mission: fight } },
      { type: 'acceptMission', nodeId: 'c1', player: 'p1' },
    );
    expect(rewardsDue(currentState(accepted))).toEqual([]);
    const won = play(accepted, { type: 'completeMission', nodeId: 'c2', player: 'p1' });
    expect(rewardsDue(currentState(won))).toEqual([{ type: 'completeMission', nodeId: 'c1', player: 'p1' }]);
    const p1 = currentState(play(won, ...rewardsDue(currentState(won)))).players.p1;
    expect(p1.team).toEqual(expect.arrayContaining(['char-a', 'char-b']));
  });
});
