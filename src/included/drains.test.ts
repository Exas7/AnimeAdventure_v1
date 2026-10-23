import { describe, expect, it } from 'vitest';
import type { Character } from '../engine';
import { withDrainsOf } from './fillIncluded';
import { includedCatalog } from './includedLists';

const catalog = includedCatalog();
const byName = (name: string) => catalog.find((character) => character.name === name) as Character;

describe('drains and cures in the included list (spec 073)', () => {
  it('criterion 6: Drain Life drains for C-19, C-20 and Cell, and no other move does', () => {
    const draining = catalog.flatMap((character) =>
      [character.fight?.move1, character.fight?.move2, character.fight?.finale]
        .filter((move) => move?.drains)
        .map((move) => `${character.name}: ${move?.name}`),
    );
    expect(draining).toEqual([
      'C-19: Drain Life 19',
      'Dr. Gero (C-20): Drain Life 20',
      'Cell (prima forma): Drain Life Cell',
      'Cell (seconda forma): Drain Life Cell',
    ]);
  });

  it('criterion 6: Cell heals 2,500 HP transforming into its second form and into the perfect one', () => {
    const healing = catalog.filter((character) => character.fight?.transformHeal);
    expect(healing.map((character) => [character.name, character.fight?.transformHeal])).toEqual([
      ['Cell (seconda forma)', 2500],
      ['Cell (forma perfetta)', 2500],
    ]);
  });

  /** The list as it was before spec 073: no drains, no cures. */
  const before = catalog.map((character) => {
    if (!character.fight) {
      return character;
    }
    const { transformHeal: _heal, ...rest } = character.fight;
    const plain = (move: typeof rest.move1) =>
      move ? { name: move.name, kind: move.kind, hitsGiants: move.hitsGiants } : undefined;
    return { ...character, fight: { ...rest, move1: plain(rest.move1), move2: plain(rest.move2), finale: plain(rest.finale) } };
  });

  it('2.8: a list with the sheets of before, never changed, gets the drains and the cures', () => {
    expect(withDrainsOf(before, catalog)).toEqual(catalog);
    expect(withDrainsOf(catalog, catalog)).toBeNull();
  });

  it('2.8: a sheet changed by the host stays as it is, the others get the new values', () => {
    const changedFinale = { name: 'Drain Life 19', kind: 'wave' as const };
    const changed = before.map((character) =>
      character.name === 'C-19' ? { ...character, fight: { ...character.fight, finale: changedFinale } } : character,
    );
    const result = withDrainsOf(changed, catalog) as Character[];
    const named = (name: string) => result.find((character) => character.name === name);
    expect(named('C-19')?.fight?.finale).toEqual(changedFinale);
    expect(named('Dr. Gero (C-20)')).toEqual(byName('Dr. Gero (C-20)'));
    expect(named('Cell (seconda forma)')).toEqual(byName('Cell (seconda forma)'));
  });
});
