import { describe, expect, it } from 'vitest';
import { fusionOptions, isOffCell } from './fusions';
import { act, createGame, currentState, lastWarnings } from './game';
import { testCatalog, testSetup } from './testMap';
import type { Character, Game, GameAction, PlayerId } from './types';

// The fusion characters of the included list, with their persons.
const forms = (person: string, ...ids: [string, string][]): Character[] =>
  ids.map(([id, name]) => ({ id, name, person, tier: 'A', price: 1000 }));
const FUSION_CATALOG: Character[] = [
  ...testCatalog,
  ...forms('Son Goku (fine)', ['son-goku-fine', 'Son Goku (fine)'], ['son-goku-fine-ssj', 'Son Goku (fine) SSJ'], ['son-goku-fine-ssj3', 'Son Goku (fine) SSJ3']),
  ...forms('Vegeta (seconda forma)', ['vegeta-seconda-forma', 'Vegeta (seconda forma)'], ['vegeta-seconda-forma-ssj', 'Vegeta (seconda forma) SSJ']),
  ...forms('Majin Vegeta', ['majin-vegeta', 'Majin Vegeta']),
  ...forms('Vegetto', ['vegetto', 'Vegetto'], ['super-vegetto', 'Super Vegetto']),
  ...forms('Super Gogeta', ['super-gogeta', 'Super Gogeta']),
  ...forms('Son Goku (GT)', ['son-goku-ssj4', 'Son Goku SSJ4']),
  ...forms('Vegeta SSJ4', ['vegeta-ssj4', 'Vegeta SSJ4']),
  ...forms('Gogeta SSJ4', ['gogeta-ssj4', 'Gogeta SSJ4']),
  ...forms('Son Goten', ['son-goten', 'Son Goten'], ['son-goten-ssj', 'Son Goten SSJ']),
  ...forms('Trunks (bambino)', ['trunks-bambino', 'Trunks (bambino)'], ['trunks-bambino-ssj', 'Trunks (bambino) SSJ']),
  ...forms('Gotenks', ['gotenks', 'Gotenks'], ['gotenks-ssj', 'Gotenks SSJ']),
];

const start = (): Game => createGame({ ...testSetup(), catalog: FUSION_CATALOG });
const play = (game: Game, ...actions: GameAction[]) => actions.reduce(act, game);
const add = (player: PlayerId, ...ids: string[]): GameAction[] =>
  ids.map((characterId) => ({ type: 'addCharacter', player, characterId }));
const options = (game: Game, player: PlayerId = 'p1') =>
  fusionOptions(currentState(game), FUSION_CATALOG, player).map((option) => option.resultId);

describe('the fusions a team may do (spec 068, criteria 1 and 3)', () => {
  it('Goku and Vegeta at the end of Dragon Ball: Vegetto in base form, Super Vegetto or Super Gogeta when both are SSJ', () => {
    expect(options(play(start(), ...add('p1', 'son-goku-fine', 'vegeta-seconda-forma')))).toEqual(['vegetto']);
    // Only one SSJ: base form.
    expect(options(play(start(), ...add('p1', 'son-goku-fine-ssj', 'vegeta-seconda-forma')))).toEqual(['vegetto']);
    expect(options(play(start(), ...add('p1', 'son-goku-fine-ssj3', 'vegeta-seconda-forma-ssj')))).toEqual([
      'super-vegetto',
      'super-gogeta',
    ]);
    // Majin Vegeta counts as an SSJ Vegeta.
    expect(options(play(start(), ...add('p1', 'majin-vegeta', 'son-goku-fine-ssj')))).toEqual([
      'super-vegetto',
      'super-gogeta',
    ]);
  });

  it('Gogeta SSJ4 from Goku and Vegeta SSJ4; Gotenks from Goten and Trunks, SSJ when both are', () => {
    expect(options(play(start(), ...add('p1', 'son-goku-ssj4', 'vegeta-ssj4')))).toEqual(['gogeta-ssj4']);
    expect(options(play(start(), ...add('p1', 'son-goten-ssj', 'trunks-bambino')))).toEqual(['gotenks']);
    expect(options(play(start(), ...add('p1', 'son-goten-ssj', 'trunks-bambino-ssj')))).toEqual(['gotenks-ssj']);
    expect(options(play(start(), ...add('p1', 'son-goten', 'vegeta-seconda-forma')))).toEqual([]);
  });

  it('a fusion already in a team is not offered; with Vegetto and Super Gogeta both taken, none', () => {
    const kids = play(start(), ...add('p1', 'son-goten', 'trunks-bambino'), ...add('p2', 'gotenks-ssj'));
    expect(options(kids)).toEqual([]);
    const pair = add('p1', 'son-goku-fine-ssj', 'vegeta-seconda-forma-ssj');
    expect(options(play(start(), ...pair, ...add('p2', 'super-gogeta')))).toEqual(['super-vegetto']);
    // Vegetto in base form takes the person: Super Vegetto is gone too.
    expect(options(play(start(), ...pair, ...add('p2', 'vegetto', 'super-gogeta')))).toEqual([]);
  });
});

describe('a fusion done (spec 068, criterion 2)', () => {
  const fuse: GameAction = {
    type: 'fuse',
    player: 'p1',
    members: ['son-goku-fine', 'vegeta-seconda-forma'],
    resultId: 'vegetto',
  };

  it('the two leave the team, the fusion takes the place of the first; the starter follows it', () => {
    const game = createGame({
      ...testSetup(),
      catalog: FUSION_CATALOG,
      players: {
        ...testSetup().players,
        p1: { ...testSetup().players.p1, starter: { characterId: 'vegeta-seconda-forma', powers: [] } },
      },
    });
    const done = play(game, ...add('p1', 'char-a', 'son-goku-fine'), fuse);
    const p1 = currentState(done).players.p1;
    expect(p1.team).toEqual(['vegetto', 'char-a']);
    expect(p1.starterId).toBe('vegetto');
    expect(currentState(done).notifications.at(-1)?.text).toBe(
      'G1: Son Goku (fine) e Vegeta (seconda forma) si fondono in Vegetto',
    );
  });

  it('the fusion on the board turns its cell off for both; in a shop it leaves the sale', () => {
    const game = play(
      start(),
      { type: 'setCellContent', nodeId: 'c1', content: { characterId: 'super-vegetto' } },
      { type: 'setCellContent', nodeId: 'sh1', content: { characterId: 'keeper-1', forSale: ['vegetto', 'char-a'] } },
      ...add('p1', 'son-goku-fine', 'vegeta-seconda-forma'),
      fuse,
    );
    const state = currentState(game);
    expect(isOffCell(state, 'c1')).toBe(true);
    expect(state.cells.sh1?.forSale).toEqual(['char-a']);
    const tried = play(game, { type: 'endTurn' }, { type: 'placePawn', player: 'p2', nodeId: 'c1' }, { type: 'interact', nodeId: 'c1' });
    expect(lastWarnings(tried).map((warning) => warning.kind)).toContain('cellOff');
  });

  it('two who are not in the team cannot fuse', () => {
    expect(() => play(start(), ...add('p1', 'son-goku-fine'), fuse)).toThrow();
  });
});
