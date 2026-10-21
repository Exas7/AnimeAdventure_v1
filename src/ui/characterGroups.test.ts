import { describe, expect, it } from 'vitest';
import type { Character } from '../engine';
import {
  NO_SAGA,
  filterGroups,
  groupBySaga,
  keeperGroups,
  searchPick,
  starterGroups,
  withoutSpecialKeepers,
} from './characterGroups';

function character(name: string, saga?: string, possibleStarter = false): Character {
  return {
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name,
    ...(saga ? { saga } : {}),
    ...(possibleStarter ? { possibleStarter } : {}),
  };
}

const catalog = [
  character('Vegeta', 'Saiyan'),
  character('Freezer', 'Freezer'),
  character('Nappa', 'Saiyan'),
  character('Son Goku (bambino)', 'Dragon Ball', true),
  character('Broly', 'Film e speciali'),
  character('Ospite misterioso'),
  character('Zangya', 'Altri film'),
  character('Cell perfetto', 'Cell'),
  character('Bulma', 'Avventure'),
  character('Chichì', 'Dragon Ball'),
];

describe('character menus by saga (spec 017, D-028)', () => {
  it('orders sagas as in the story, then unknown sagas alphabetically, then no saga', () => {
    expect(groupBySaga(catalog).map((group) => group.label)).toEqual([
      'Dragon Ball',
      'Saiyan',
      'Freezer',
      'Cell',
      'Film e speciali',
      'Altri film',
      'Avventure',
      NO_SAGA,
    ]);
  });

  it('keeps the order of the list inside a saga', () => {
    const saiyan = groupBySaga(catalog).find((group) => group.label === 'Saiyan');
    expect(saiyan?.characters.map((entry) => entry.name)).toEqual(['Vegeta', 'Nappa']);
  });

  it('puts possible starters first in the starter menu', () => {
    const groups = starterGroups(catalog);
    expect(groups[0]).toEqual({
      label: 'Possibili starter',
      characters: [character('Son Goku (bambino)', 'Dragon Ball', true)],
    });
    expect(groups[1]?.label).toBe('Dragon Ball');
  });

  it('filters by name, ignoring case and accents, and drops empty sagas', () => {
    const groups = filterGroups(groupBySaga(catalog), 'CHICHI');
    expect(groups).toEqual([{ label: 'Dragon Ball', characters: [catalog[9]] }]);
    expect(filterGroups(groupBySaga(catalog), '')).toEqual(groupBySaga(catalog));
  });

  it('Enter picks the exact name or the only one left, otherwise nothing', () => {
    const groups = groupBySaga(catalog);
    expect(searchPick(groups, 'vegeta')?.name).toBe('Vegeta');
    expect(searchPick(groups, 'nap')?.name).toBe('Nappa');
    // "Cell perfetto" and "Chichì" both contain "c": not clear.
    expect(searchPick(groups, 'c')).toBeNull();
    expect(searchPick(groups, '')).toBeNull();
  });

  it('a possible starter found twice in the starter menu still counts once', () => {
    expect(searchPick(starterGroups(catalog), 'goku')?.name).toBe('Son Goku (bambino)');
  });
});

describe('shopkeeper menu (spec 022)', () => {
  const picture = 'data:image/png;base64,AA';
  const list = [
    { id: 'goku', name: 'Goku', saga: 'Saiyan', tier: 'C+' },
    { id: 'roshi', name: 'Muten Roshi', saga: 'Dragon Ball', tier: 'D+', shopkeeper: true },
    { id: 'kami', name: 'Kami', saga: 'Dragon Ball', shopkeeper: true },
    { id: 'k-new', name: 'Oste', shopkeeper: true, imageData: picture },
    { id: 'k-old', name: 'Oste', shopkeeper: true, imageData: picture },
  ];

  it('shopkeepers first, then the special ones, then the older versions of this episode, then sagas', () => {
    const groups = keeperGroups(list, ['k-old']);
    expect(groups.map((group) => [group.label, group.characters.map((entry) => entry.id)])).toEqual([
      ['Negozianti', ['roshi', 'kami']],
      ['Negozianti speciali', ['k-new']],
      ['Solo in questa puntata', ['k-old']],
      ['Dragon Ball', ['roshi', 'kami']],
      ['Saiyan', ['goku']],
    ]);
  });

  it('special shopkeepers stay out of the other menus', () => {
    expect(withoutSpecialKeepers(list).map((entry) => entry.id)).toEqual(['goku', 'roshi', 'kami']);
    expect(starterGroups(list).flatMap((group) => group.characters.map((entry) => entry.id))).not.toContain(
      'k-new',
    );
  });
});
