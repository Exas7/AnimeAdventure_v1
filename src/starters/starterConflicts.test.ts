import { describe, expect, it } from 'vitest';
import type { Character, GameMap } from '../engine';
import { emptyProposals, withProposal } from './proposals';
import { starterConflicts } from './starterConflicts';

const catalog: Character[] = [
  { id: 'vegeta', name: 'Vegeta', tier: 'A' },
  { id: 'goku', name: 'Goku', tier: 'A' },
  { id: 'bulma', name: 'Bulma', shopkeeper: true },
  { id: 'cell', name: 'Cell', tier: 'S' },
  { id: 'krilin', name: 'Krilin', tier: 'C' },
];

const map: GameMap = {
  name: 'Prova',
  nodes: [
    { id: 'n2', x: 0.2, y: 0.5, type: 'character' },
    { id: 'n3', x: 0.3, y: 0.5, type: 'character' },
    { id: 'n4', x: 0.4, y: 0.5, type: 'shop' },
  ],
  edges: [],
};

const proposing = (...ids: string[]) =>
  ids.reduce((proposals, id, index) => withProposal(proposals, 'p1', index, { characterId: id, powers: [] }), emptyProposals());

describe('a proposed starter that the episode already uses (spec 034, 2.5)', () => {
  it('on the map, as a shopkeeper, for sale, and inside missions', () => {
    const content = {
      n2: { characterId: 'vegeta', mission: { type: 'bring' as const, targetId: 'goku', reward: { cellCharacter: true } } },
      n3: {
        characterId: 'cell',
        mission: { type: 'fight' as const, opponents: ['cell', 'krilin'], reward: { characters: ['goku'] } },
      },
      n4: { characterId: 'bulma', forSale: ['krilin'] },
    };
    expect(starterConflicts(proposing('vegeta', 'goku', 'krilin'), content, map, catalog)).toEqual([
      'Vegeta è nella casella #2: se viene scelto, lì ne arriva un altro.',
      "Goku è l'obiettivo della missione di Vegeta (casella #2): se viene scelto, la missione va cambiata.",
      'Goku è il premio della missione di Cell (casella #3): se viene scelto, la missione va cambiata.',
      'Krilin è tra gli avversari della missione di Cell (casella #3).',
      'Krilin è in vendita nel negozio #4: se viene scelto, al suo posto ne arriva un altro.',
    ]);
    expect(starterConflicts(proposing('bulma'), content, map, catalog)).toEqual([
      'Bulma fa il negoziante nel negozio #4: se viene scelto, lì ne arriva un altro.',
    ]);
  });

  it('nothing to say for starters the episode does not use, or without an episode', () => {
    const content = { n2: { characterId: 'vegeta' } };
    expect(starterConflicts(proposing('goku', 'cell'), content, map, catalog)).toEqual([]);
    expect(starterConflicts(proposing('vegeta'), {}, map, catalog)).toEqual([]);
  });
});
