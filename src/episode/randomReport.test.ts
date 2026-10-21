import { describe, expect, it } from 'vitest';
import type { Character } from '../engine';
import { cellShortage, extraGroups, shopShortages } from './randomReport';

const catalog: Character[] = [
  { id: 'chichi', name: 'Chichi (adulta)' },
  { id: 'krilin', name: 'Krilin' },
  { id: 'tenshinhan', name: 'Tenshinhan' },
  { id: 'cooler', name: 'Cooler' },
  { id: 'metal-cooler', name: 'Metal Cooler' },
];

describe('the tendine after "Randomizza tutto" (spec 033, 2.3)', () => {
  it('"Sfide extra": three groups in order, with names and cells', () => {
    const groups = extraGroups(
      [
        { kind: 'chain', giverId: 'cooler', cellId: 'n12', behindId: 'metal-cooler', behindCellId: 'n13' },
        { kind: 'placed', characterId: 'krilin', cellId: 'n10', forId: 'tenshinhan' },
        { kind: 'story', characterId: 'chichi', cellId: 'n72' },
      ],
      catalog,
    );
    expect(groups).toEqual([
      { title: 'Danno solo una missione, non si reclutano', lines: ['Chichi (adulta), casella #72'] },
      {
        title: 'Messi sulla mappa per la missione di un altro',
        lines: ['Krilin, casella #10: per la missione di Tenshinhan'],
      },
      {
        title: 'Catene sui percorsi bloccati',
        lines: ['Cooler nella casella #12 apre il percorso; dietro, nella #13, Metal Cooler'],
      },
    ]);
  });

  it('"Sfide extra" leaves out the empty groups, and is empty without extras', () => {
    const groups = extraGroups([{ kind: 'story', characterId: 'chichi', cellId: 'n72' }], catalog);
    expect(groups.map((group) => group.title)).toEqual(['Danno solo una missione, non si reclutano']);
    expect(extraGroups([], catalog)).toEqual([]);
  });

  it('empty Character cells: said only when there are some, singular and plural', () => {
    expect(cellShortage(0)).toBeNull();
    expect(cellShortage(1)).toBe('1 Casella personaggio rimasta vuota: mancano personaggi adatti.');
    expect(cellShortage(2)).toBe('2 Caselle personaggio rimaste vuote: mancano personaggi adatti.');
  });

  it('shops: what is missing, only when something is', () => {
    expect(shopShortages({ cellsLeftEmpty: 3, forSaleLeftEmpty: 0, keepersKept: 0 })).toEqual([]);
    expect(shopShortages({ cellsLeftEmpty: 0, forSaleLeftEmpty: 1, keepersKept: 2 })).toEqual([
      'Manca 1 personaggio da vendere: non ce ne sono abbastanza con prezzo e non usati.',
      "2 negozi tengono il negoziante di prima: non ce n'erano altri liberi.",
    ]);
    expect(shopShortages({ cellsLeftEmpty: 0, forSaleLeftEmpty: 3, keepersKept: 1 })).toEqual([
      'Mancano 3 personaggi da vendere: non ce ne sono abbastanza con prezzo e non usati.',
      "1 negozio tiene il negoziante di prima: non ce n'erano altri liberi.",
    ]);
  });
});
