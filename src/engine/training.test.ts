import { describe, expect, it } from 'vitest';
import { act, createGame, currentState, lastWarnings, undo } from './game';
import { gameLog } from './log';
import { parseGame, serializeGame } from './save';
import { testItems, testSetup } from './testMap';
import { nextForms, trainingChanges, trainingRule, trainingRuleText } from './training';
import type { Character, Game, GameSetup, TrainingChoice } from './types';

function form(id: string, name: string, next?: string): Character {
  return { id, name, ...(next ? { fight: { transformsInto: next } } : {}) };
}

/** The test game with a few chains of forms; Eroe Uno, the starter of G1, has one more form. */
function setup(): GameSetup {
  const base = testSetup();
  return {
    ...base,
    catalog: [
      ...base.catalog.map((character) =>
        character.id === 'hero-1' ? { ...character, fight: { transformsInto: 'hero-1-ssj' } } : character,
      ),
      form('hero-1-ssj', 'Eroe Uno SSJ'),
      form('goku-meta', 'Son Goku (metà)', 'goku-meta-ssj'),
      form('goku-meta-ssj', 'Son Goku (metà) SSJ'),
      form('goku-fine', 'Son Goku (fine)', 'goku-fine-ssj'),
      form('goku-fine-ssj', 'Son Goku (fine) SSJ', 'goku-fine-ssj2'),
      form('goku-fine-ssj2', 'Son Goku (fine) SSJ2', 'goku-fine-ssj3'),
      form('goku-fine-ssj3', 'Son Goku (fine) SSJ3'),
      form('vegeta', 'Vegeta', 'vegeta-ssj'),
      form('vegeta-ssj', 'Vegeta SSJ', 'vegeta-ssj2'),
      form('vegeta-ssj2', 'Vegeta SSJ2'),
      form('krilin', 'Krilin'),
    ],
  };
}

/** G1: Eroe Uno, Son Goku (metà), Son Goku (fine), Vegeta, Krilin, and the item in the inventory. */
function withItem(itemId: string, gameSetup: GameSetup = setup()): Game {
  let game = createGame(gameSetup);
  for (const characterId of ['goku-meta', 'goku-fine', 'vegeta', 'krilin']) {
    game = act(game, { type: 'addCharacter', player: 'p1', characterId });
  }
  return act(game, { type: 'addToInventory', player: 'p1', itemId });
}

function use(game: Game, itemId: string, choices: TrainingChoice[]): Game {
  return act(game, { type: 'useTraining', player: 'p1', itemId, choices });
}

const team = (game: Game) => currentState(game).players.p1.team;

describe('"Usa" on the training items (spec 041)', () => {
  it('C1: Vestiti pesanti on Son Goku (metà): the new form in the same place, the item used, log and notification', () => {
    const before = withItem('heavy-clothes');
    const game = use(before, 'heavy-clothes', [{ characterId: 'goku-meta', forms: 1 }]);
    const state = currentState(game);
    expect(state.players.p1.team).toEqual(['hero-1', 'goku-meta-ssj', 'goku-fine', 'vegeta', 'krilin']);
    expect(state.players.p1.inventory).toEqual([]);
    expect(gameLog(game).at(-1)?.text).toBe(
      'G1 usa Vestiti pesanti da allenamento: Son Goku (metà) → Son Goku (metà) SSJ',
    );
    expect(state.notifications.at(-1)?.text).toBe(
      'G1 · Vestiti pesanti da allenamento: Son Goku (metà) → Son Goku (metà) SSJ',
    );
    expect(state.actions).toEqual(currentState(before).actions);
    expect(lastWarnings(game)).toEqual([]);
  });

  it('C2: Camera Gravitazionale: one character up two forms, or two characters up one', () => {
    const twoForms = use(withItem('gravity-room'), 'gravity-room', [{ characterId: 'goku-fine', forms: 2 }]);
    expect(team(twoForms)).toContain('goku-fine-ssj2');
    expect(lastWarnings(twoForms)).toEqual([]);

    const twoCharacters = use(withItem('gravity-room'), 'gravity-room', [
      { characterId: 'goku-meta', forms: 1 },
      { characterId: 'goku-fine', forms: 1 },
    ]);
    expect(team(twoCharacters)).toEqual(['hero-1', 'goku-meta-ssj', 'goku-fine-ssj', 'vegeta', 'krilin']);
    expect(lastWarnings(twoCharacters)).toEqual([]);
  });

  it('C3: Stanza dello Spirito e del Tempo: two characters up two forms', () => {
    const game = use(withItem('time-chamber'), 'time-chamber', [
      { characterId: 'goku-fine', forms: 2 },
      { characterId: 'vegeta', forms: 2 },
    ]);
    expect(team(game)).toEqual(['hero-1', 'goku-meta', 'goku-fine-ssj2', 'vegeta-ssj2', 'krilin']);
    expect(lastWarnings(game)).toEqual([]);
  });

  it('C4: training the starter makes the new form the starter', () => {
    const game = use(withItem('heavy-clothes'), 'heavy-clothes', [{ characterId: 'hero-1', forms: 1 }]);
    const player = currentState(game).players.p1;
    expect(player.team[0]).toBe('hero-1-ssj');
    expect(player.starterId).toBe('hero-1-ssj');
  });

  it('C5: one undo puts back forms, starter and item', () => {
    const before = withItem('gravity-room');
    const game = undo(
      use(before, 'gravity-room', [
        { characterId: 'hero-1', forms: 1 },
        { characterId: 'goku-meta', forms: 1 },
      ]),
    );
    expect(currentState(game).players.p1).toEqual(currentState(before).players.p1);
  });

  it('C6: the forms on offer follow "si trasforma in": none without a next form, one when there is only one', () => {
    const { catalog } = setup();
    expect(nextForms(catalog, 'krilin', 2)).toEqual([]);
    expect(nextForms(catalog, 'goku-meta', 2)).toEqual(['goku-meta-ssj']);
    expect(nextForms(catalog, 'goku-fine', 2)).toEqual(['goku-fine-ssj', 'goku-fine-ssj2']);
    expect(nextForms(catalog, 'goku-fine', 1)).toEqual(['goku-fine-ssj']);
    expect(() => trainingChanges(catalog, [{ characterId: 'krilin', forms: 1 }])).toThrow();
    expect(() => trainingChanges(catalog, [{ characterId: 'goku-meta', forms: 2 }])).toThrow();
  });

  it('C7: past the rule of the item the training happens, with a warning', () => {
    const twoCharacters = use(withItem('heavy-clothes'), 'heavy-clothes', [
      { characterId: 'goku-meta', forms: 1 },
      { characterId: 'goku-fine', forms: 1 },
    ]);
    expect(team(twoCharacters)).toEqual(['hero-1', 'goku-meta-ssj', 'goku-fine-ssj', 'vegeta', 'krilin']);
    expect(lastWarnings(twoCharacters)).toEqual([
      { kind: 'trainingRule', message: 'Vestiti pesanti da allenamento: 1 personaggio sale di 1 forma' },
    ]);

    const threeForms = use(withItem('gravity-room'), 'gravity-room', [
      { characterId: 'goku-fine', forms: 2 },
      { characterId: 'vegeta', forms: 1 },
    ]);
    expect(team(threeForms)).toEqual(['hero-1', 'goku-meta', 'goku-fine-ssj2', 'vegeta-ssj', 'krilin']);
    expect(lastWarnings(threeForms).map((warning) => warning.message)).toEqual([
      'Camera Gravitazionale del Dr. Brief: 1 personaggio sale di 2 forme, oppure 2 personaggi salgono di 1',
    ]);
  });

  it('C7: the rules in words are those of spec 002', () => {
    const texts = testItems.flatMap((item) => {
      const rule = trainingRule(item);
      return rule ? [`${item.name}: ${trainingRuleText(rule)}`] : [];
    });
    expect(texts).toEqual([
      'Vestiti pesanti da allenamento: 1 personaggio sale di 1 forma',
      'Camera Gravitazionale del Dr. Brief: 1 personaggio sale di 2 forme, oppure 2 personaggi salgono di 1',
      'Stanza dello Spirito e del Tempo: 2 personaggi salgono di 2 forme',
    ]);
  });

  it('C8: a new form already in a cell, in a shop or in the other team: the training happens, with a warning', () => {
    let game = withItem('time-chamber');
    game = act(game, { type: 'setCellContent', nodeId: 'c2', content: { characterId: 'goku-meta-ssj' } });
    game = act(game, {
      type: 'setCellContent',
      nodeId: 'sh1',
      content: { characterId: 'keeper-1', forSale: ['char-e', 'goku-fine-ssj'] },
    });
    game = act(game, { type: 'addCharacter', player: 'p2', characterId: 'vegeta-ssj' });
    game = use(game, 'time-chamber', [
      { characterId: 'goku-meta', forms: 1 },
      { characterId: 'goku-fine', forms: 1 },
    ]);
    expect(team(game)).toEqual(['hero-1', 'goku-meta-ssj', 'goku-fine-ssj', 'vegeta', 'krilin']);
    const messages = lastWarnings(game).map((warning) => warning.message);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toBe('Son Goku (metà) SSJ è già sulla casella #c2');
    expect(messages[1]).toMatch(/^Son Goku \(fine\) SSJ è già in vendita nel /);

    game = act(game, { type: 'addToInventory', player: 'p1', itemId: 'heavy-clothes' });
    const other = use(game, 'heavy-clothes', [{ characterId: 'vegeta', forms: 1 }]);
    expect(lastWarnings(other).map((warning) => warning.message)).toEqual(['Vegeta SSJ è già nella squadra di G2']);
  });

  it('C9: save and load keep team, starter and inventory after a training', () => {
    let game = withItem('heavy-clothes');
    game = act(game, { type: 'addToInventory', player: 'p1', itemId: 'gravity-room' });
    game = use(game, 'heavy-clothes', [{ characterId: 'hero-1', forms: 1 }]);
    const loaded = currentState(parseGame(serializeGame(game))).players.p1;
    expect(loaded.team).toEqual(['hero-1-ssj', 'goku-meta', 'goku-fine', 'vegeta', 'krilin']);
    expect(loaded.starterId).toBe('hero-1-ssj');
    expect(loaded.inventory).toEqual(['gravity-room']);
  });

  it('a game saved before spec 041 has items without the rule: they work all the same', () => {
    const items = testItems.map((item) => {
      const copy = { ...item };
      delete copy.training;
      return copy;
    });
    const game = use(withItem('heavy-clothes', { ...setup(), items }), 'heavy-clothes', [
      { characterId: 'goku-meta', forms: 1 },
    ]);
    expect(team(game)).toContain('goku-meta-ssj');
  });

  it('an item that is not in the inventory, or not a training item, is an error', () => {
    const game = withItem('flying-nimbus');
    expect(() => use(game, 'heavy-clothes', [{ characterId: 'goku-meta', forms: 1 }])).toThrow();
    expect(() => use(game, 'flying-nimbus', [{ characterId: 'goku-meta', forms: 1 }])).toThrow();
  });
});
