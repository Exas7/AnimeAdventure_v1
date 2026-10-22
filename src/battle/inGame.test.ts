import { describe, expect, it } from 'vitest';
import {
  act,
  createGame,
  currentState,
  testCatalog,
  testSetup,
  type Character,
  type Game,
  type GameAction,
  type Mission,
} from '../engine';
import type { FightRecord, FightSnapshot, Fighter } from './fight';
import {
  charactersInGame,
  missionSides,
  partnersFor,
  proposedMissionSides,
  proposedOutcome,
  showdownSides,
  teamChanges,
} from './inGame';

function play(game: Game, ...actions: GameAction[]): Game {
  return actions.reduce(act, game);
}

const fight = (format: Mission['format'], opponents?: string[], condition?: Mission['condition']): Mission => ({
  type: 'fight',
  format,
  ...(opponents ? { opponents } : {}),
  ...(condition ? { condition } : {}),
  reward: {},
});

/** A game where G1 has three characters and cell n1 holds Personaggio H. */
function gameWith(mission: Mission): Game {
  return play(
    createGame(testSetup()),
    { type: 'addCharacter', player: 'p1', characterId: 'char-a' },
    { type: 'addCharacter', player: 'p1', characterId: 'char-b' },
    { type: 'setCellContent', nodeId: 'n1', content: { characterId: 'char-h', mission } },
  );
}

const fighter = (id: string, next?: Fighter): Fighter => ({
  id,
  name: id,
  tier: 'A',
  rank: 12,
  sheet: { bars: 4, power: 3, speed: 3, giant: false, moves: [{ name: 'O', kind: 'wave' }, { name: 'I', kind: 'rush' }], finale: { name: 'F', kind: 'wave' } },
  ...(next ? { next } : {}),
});

/** A recorded fight that only says who transformed and who won. */
function recordOf(teams: FightRecord['teams'], forms: FightSnapshot['forms'], winner: 'a' | 'b'): FightRecord {
  const snapshot = (all: FightSnapshot['forms']): FightSnapshot => ({
    hp: { a: teams.a.map(() => 1), b: teams.b.map(() => 1) },
    active: { a: 0, b: 0 },
    gauge: { a: 0, b: 0 },
    forms: all,
  });
  const start = snapshot({ a: teams.a.map(() => 0), b: teams.b.map(() => 0) });
  const transforms = (['a', 'b'] as const).flatMap((side) =>
    forms[side].flatMap((count, index) =>
      count > 0 ? [{ event: { type: 'transform' as const, exchange: 1, side, fighter: index }, after: snapshot(forms) }] : [],
    ),
  );
  return {
    teams,
    form: { a: 1, b: 1 },
    start,
    steps: [...transforms, { event: { type: 'end', exchange: 2, winner }, after: snapshot(forms) }],
    winner,
  };
}

describe('the simulator inside the game (spec 037, 2.4-2.5 and criteria 6-8)', () => {
  it('C6: the player\'s first characters, as many as the format asks, against the mission\'s opponents', () => {
    const game = gameWith(fight('2v2', ['char-c', 'char-d']));
    expect(missionSides(currentState(game), 'n1', 'p1')).toEqual({ a: ['hero-1', 'char-a'], b: ['char-c', 'char-d'] });
  });

  it('C6: without opponents, the cell\'s character; without a format, one against one', () => {
    const game = gameWith(fight(undefined));
    expect(missionSides(currentState(game), 'n1', 'p1')).toEqual({ a: ['hero-1'], b: ['char-h'] });
    const threeOnThree = gameWith(fight('3v3'));
    expect(missionSides(currentState(threeOnThree), 'n1', 'p1')).toEqual({
      a: ['hero-1', 'char-a', 'char-b'],
      b: ['char-h'],
    });
  });

  it('the showdown: the two teams in their order', () => {
    const game = gameWith(fight('1v1'));
    expect(showdownSides(currentState(game))).toEqual({ a: ['hero-1', 'char-a', 'char-b'], b: ['hero-2'] });
  });

  it('every character somewhere in the game: teams, cells and shops (D-064)', () => {
    const state = currentState(gameWith(fight('1v1')));
    const ids = charactersInGame(state);
    for (const id of ['hero-1', 'char-a', 'char-b', 'hero-2', 'char-h']) {
      expect(ids.has(id)).toBe(true);
    }
    const forSale = Object.values(state.cells).flatMap((content) => content.forSale ?? []);
    expect(forSale.length).toBeGreaterThan(0);
    expect(forSale.every((id) => ids.has(id))).toBe(true);
  });

  it('C7: the proposed outcome: won or lost; for "costringimi a trasformarmi", an opponent that transformed', () => {
    const teams = { a: [fighter('me')], b: [fighter('him', fighter('him-2'))] };
    expect(proposedOutcome(recordOf(teams, { a: [0], b: [0] }, 'a'), fight('1v1'))).toBe('won');
    expect(proposedOutcome(recordOf(teams, { a: [0], b: [0] }, 'b'), fight('1v1'))).toBe('lost');
    const transformMission = fight('1v1', undefined, 'transform');
    expect(proposedOutcome(recordOf(teams, { a: [0], b: [1] }, 'b'), transformMission)).toBe('transformed');
    expect(proposedOutcome(recordOf(teams, { a: [0], b: [0] }, 'a'), transformMission)).toBe('lost');
  });

  it('C8: "Aggiorna la squadra" changes only the player\'s characters of the team, even after a lost fight', () => {
    const goku = fighter('goku', fighter('goku-ssj'));
    const guest = fighter('guest', fighter('guest-2'));
    const teams = { a: [goku, guest], b: [fighter('him', fighter('him-2'))] };
    const record = recordOf(teams, { a: [1, 1], b: [1] }, 'b');
    expect(teamChanges(record, ['goku', 'other'])).toEqual([{ from: 'goku', to: 'goku-ssj' }]);
  });
});

/**
 * The test list with sheets for the partners (spec 048): Personaggio H, in
 * cell n1, is a villain of the Saiyan saga, tier A. Personaggio A is in G1's team.
 */
const villain = (id: string, tier: string | undefined, saga: string, more: Partial<Character> = {}): Character => ({
  id,
  name: id,
  ...(tier ? { tier } : {}),
  saga,
  villain: true,
  ...more,
});
const partnerCatalog: Character[] = [
  ...testCatalog.map((character) =>
    character.id === 'char-h' || character.id === 'char-a'
      ? { ...character, tier: 'A', saga: 'Saiyan', villain: true }
      : character,
  ),
  villain('same-saga', 'A-', 'Saiyan'),
  villain('same-saga-far', 'C', 'Saiyan'),
  villain('other-saga', 'A', 'Freezer'),
  { id: 'hero-same-saga', name: 'hero-same-saga', tier: 'A', saga: 'Saiyan' },
  villain('no-tier', undefined, 'Saiyan'),
  villain('char-h-ssj', 'A', 'Saiyan', { person: 'Personaggio H' }),
];
const withPerson = partnerCatalog.map((character) =>
  character.id === 'char-h' ? { ...character, person: 'Personaggio H' } : character,
);
const first = () => 0;

describe('the second opponent of team fights (spec 048)', () => {
  it('C1: a 2v2 without opponents gets the cell\'s character and a partner', () => {
    const state = currentState(gameWith(fight('2v2')));
    expect(proposedMissionSides(state, 'n1', 'p1', withPerson, first).b).toEqual(['char-h', 'same-saga']);
  });

  it('C2: a 3v3 with the cell\'s character only gets two different partners', () => {
    const state = currentState(gameWith(fight('3v3')));
    expect(proposedMissionSides(state, 'n1', 'p1', withPerson, first).b).toEqual([
      'char-h',
      'same-saga',
      'same-saga-far',
    ]);
  });

  it('C3: enough opponents, or a 1v1, get nobody more', () => {
    const enough = currentState(gameWith(fight('2v2', ['char-c', 'char-d'])));
    expect(proposedMissionSides(enough, 'n1', 'p1', withPerson, first).b).toEqual(['char-c', 'char-d']);
    const single = currentState(gameWith(fight('1v1')));
    expect(proposedMissionSides(single, 'n1', 'p1', withPerson, first).b).toEqual(['char-h']);
  });

  it('C4: same saga and side first, then the same side, then anyone; the closest tier', () => {
    const state = currentState(gameWith(fight('2v2')));
    const without = (...ids: string[]) => withPerson.filter((character) => !ids.includes(character.id));
    expect(partnersFor(state, without('same-saga', 'same-saga-far'), ['char-h'], 1, first)).toEqual(['other-saga']);
    expect(
      partnersFor(state, without('same-saga', 'same-saga-far', 'other-saga'), ['char-h'], 1, first),
    ).toEqual(['hero-same-saga']);
  });

  it('C5: never without a tier, another form of the cell\'s person, or a person of the teams', () => {
    const state = currentState(gameWith(fight('2v2')));
    const onlyForbidden = withPerson.filter(
      (character) => !['same-saga', 'same-saga-far', 'other-saga', 'hero-same-saga'].includes(character.id),
    );
    for (const random of [() => 0, () => 0.5, () => 0.99]) {
      const partners = partnersFor(state, onlyForbidden, ['char-h'], 1, random);
      expect(partners.filter((id) => ['no-tier', 'char-h-ssj', 'char-a'].includes(id))).toEqual([]);
    }
  });

  it('ties go at random', () => {
    const state = currentState(gameWith(fight('2v2')));
    const tied = [...withPerson, villain('same-saga-twin', 'A-', 'Saiyan')];
    expect(partnersFor(state, tied, ['char-h'], 1, () => 0)).toEqual(['same-saga']);
    expect(partnersFor(state, tied, ['char-h'], 1, () => 0.99)).toEqual(['same-saga-twin']);
  });

  it('the sides of the mission itself do not change (missionSides)', () => {
    const state = currentState(gameWith(fight('2v2')));
    expect(missionSides(state, 'n1', 'p1').b).toEqual(['char-h']);
  });
});
