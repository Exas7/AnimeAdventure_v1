import { describe, expect, it } from 'vitest';
import { parseCsv } from './csv';
// A copy of the list as it was at spec 022: 165 characters, without the
// columns «cattivo» and «persona». The list in docs/ has grown since.
import oldFormatTable from './fixtures/personaggi-formato-vecchio.csv?raw';
import { importCatalog, parseMove } from './importCatalog';

function imported(text: string) {
  const result = importCatalog(text);
  if (!result.ok) {
    throw new Error(`unexpected errors: ${result.errors.join(' ')}`);
  }
  return result;
}

function errorsOf(text: string): string[] {
  const result = importCatalog(text);
  return result.ok ? [] : result.errors;
}

describe('CSV reading (spec 005, criteria 1-2)', () => {
  it('C1: commas or semicolons give the same catalog', () => {
    const withCommas = 'nome,prezzo,tier\nKrilin,,C\nVegeta,2500,A\n';
    const withSemicolons = 'nome;prezzo;tier\r\nKrilin;;C\r\nVegeta;2500;A\r\n';
    expect(imported(withSemicolons).catalog).toEqual(imported(withCommas).catalog);
  });

  it('C2: quoted fields keep separators, quotes and line breaks', () => {
    expect(parseCsv('a;b\n"x; y";"detto ""Re"""\n"due\nrighe";z')).toEqual([
      ['a', 'b'],
      ['x; y', 'detto "Re"'],
      ['due\nrighe', 'z'],
    ]);
  });

  it('ignores the byte order mark that Excel writes', () => {
    expect(parseCsv('﻿nome;prezzo\nGoku;100')[0]).toEqual(['nome', 'prezzo']);
  });
});

describe('catalog import (spec 005, criteria 3-7)', () => {
  it('C3: the first column is the name; other headers in any order, case and spacing; unknown columns ignored', () => {
    const { catalog } = imported(
      'Personaggio;Note varie;  PREZZO ;Possibile  Starter;Razza\nPiccolo;boh;1700;sì;Namecciano\n',
    );
    expect(catalog).toEqual([
      { id: 'piccolo', name: 'Piccolo', price: 1700, possibleStarter: true, race: 'Namecciano' },
    ]);
  });

  it('any CSV works: the names come from the first column, whatever its title (spec 010)', () => {
    const { catalog } = imported('Fighter,Country\nKazuya,Japan\nPaul,USA\n');
    expect(catalog).toEqual([
      { id: 'kazuya', name: 'Kazuya' },
      { id: 'paul', name: 'Paul' },
    ]);
  });

  it('C4: "sì", "si", "x" mean yes; "-", "no" and empty mean no', () => {
    const { catalog } = imported(
      'nome;possibile starter\nA;sì\nB;si\nC;x\nD;-\nE;no\nF;\n',
    );
    expect(catalog.map((character) => Boolean(character.possibleStarter))).toEqual([
      true,
      true,
      true,
      false,
      false,
      false,
    ]);
  });

  it('C5: an empty price means not for sale; a wrong price is an error with its row', () => {
    const { catalog } = imported('nome;prezzo\nMr. Satan;\nCell;3.800\n');
    expect(catalog[0]?.price).toBeUndefined();
    expect(catalog[1]?.price).toBe(3800);
    expect(errorsOf('nome;prezzo\nGoku;100\nVegeta;tanti\n')).toEqual([
      'Riga 3: il prezzo "tanti" non è un numero.',
    ]);
  });

  it('C6: duplicate names, an empty file and a file with only titles are errors', () => {
    expect(errorsOf('nome\nGoku\nVegeta\ngoku\n')).toEqual(['Nomi doppi: Goku / goku.']);
    expect(errorsOf('nome;prezzo\n')).toEqual([
      "Il file non contiene personaggi: c'è solo la riga dei titoli.",
    ]);
    expect(errorsOf('')).toEqual(['Il file è vuoto.']);
    expect(errorsOf('nome;prezzo\n;100\n')).toEqual(['Riga 2: manca il nome.']);
  });

  it('skips blank rows', () => {
    expect(imported('nome;prezzo\nGoku;100\n;\n\nVegeta;200\n').catalog.map((c) => c.name)).toEqual([
      'Goku',
      'Vegeta',
    ]);
  });

  it('C7: the old-format table gives 165 characters, 24 possible starters, 124 with a price (spec 022)', () => {
    const result = imported(oldFormatTable);
    expect(result.summary).toEqual({
      count: 165,
      possibleStarters: 24,
      priced: 124,
      shopkeepers: 6,
      withoutTier: 4,
    });
    expect(result.catalog[1]).toEqual({
      id: 'son-goku-meta',
      name: 'Son Goku (metà)',
      price: 1900,
      tier: 'B+',
      saga: 'Freezer',
      race: 'Saiyan',
    });
  });

  it('reads the shopkeepers; without a tier a character is not recruitable (spec 022, D-034)', () => {
    const result = imported('nome;tier;negoziante\nGoku;C+;-\nKami;;sì\nMuten Roshi;D+;x\n');
    expect(result.catalog).toEqual([
      { id: 'goku', name: 'Goku', tier: 'C+' },
      { id: 'kami', name: 'Kami', shopkeeper: true },
      { id: 'muten-roshi', name: 'Muten Roshi', shopkeeper: true, tier: 'D+' },
    ]);
    expect(result.summary).toMatchObject({ shopkeepers: 2, withoutTier: 1 });
  });

  it('without the column nobody is a shopkeeper', () => {
    expect(imported('nome;tier\nGoku;C+\n').summary).toMatchObject({ shopkeepers: 0 });
  });
});

describe('the "persona" column (spec 031, criterion 2)', () => {
  it('the forms of one person share it; empty, a character is a person alone', () => {
    const result = importCatalog(
      'nome;tier;persona\nSon Gohan SSJ;B;Son Gohan\nSon Gohan SSJ2;A;Son Gohan\nKrilin;C;\n',
    );
    expect(result.ok && result.catalog.map((character) => character.person)).toEqual([
      'Son Gohan',
      'Son Gohan',
      undefined,
    ]);
  });
});

describe('villains in the character list (spec 027, 2.2 and criterion 2)', () => {
  it('the "cattivo" column says who is a villain', () => {
    const result = importCatalog(['nome;tier;cattivo', 'Freeza;S;sì', 'Krilin;C;-', 'Cell;S;x'].join('\n'));
    if (!result.ok) {
      throw new Error(result.errors.join(' '));
    }
    const villains = result.catalog.filter((character) => character.villain);
    expect(villains.map((character) => character.name)).toEqual(['Freeza', 'Cell']);
  });

  it('without the column, no villain', () => {
    const result = importCatalog(['nome;tier', 'Freeza;S'].join('\n'));
    expect(result.ok && result.catalog.some((character) => character.villain)).toBe(false);
  });
});

describe('the fight sheet columns (spec 037, 2.2 and criteria 2-3)', () => {
  const header = 'nome;tier;barre;potenza;velocità;gigante;mossa 1;mossa 2;mossa finale;si trasforma in';

  it('reads numbers, giants, moves with their type, and the next form', () => {
    const result = imported(
      [
        header,
        'Son Goku (bambino);C;3;2;4;-;Kamehameha (onda);Counterattack! (impeto);Penetrate! (impeto, giganti);Son Goku (bambino) Oozaru',
        'Son Goku (bambino) Oozaru;A-;5;5;1;sì;Chou Makouhou (onda);;;',
        'Krilin;C;;;;;;;;',
      ].join('\n'),
    );
    expect(result.sheetProblems).toEqual([]);
    expect(result.catalog[0]?.fight).toEqual({
      bars: 3,
      power: 2,
      speed: 4,
      move1: { name: 'Kamehameha', kind: 'wave' },
      move2: { name: 'Counterattack!', kind: 'rush' },
      finale: { name: 'Penetrate!', kind: 'rush', hitsGiants: true },
      transformsInto: 'son-goku-bambino-oozaru',
    });
    expect(result.catalog[1]?.fight).toEqual({
      bars: 5,
      power: 5,
      speed: 1,
      giant: true,
      move1: { name: 'Chou Makouhou', kind: 'wave' },
    });
    expect(result.catalog[2]?.fight).toBeUndefined();
  });

  it('wrong values count as empty, do not stop the import and are listed', () => {
    const result = imported(
      [
        header,
        'Goku;B;7;x;3;;Kamehameha;Meteor Smash (impeto);;Gohan',
        'Bulma;;;;;;;;;',
        'Vegeta;B;;;;;;;;Bulma',
        'Freeza;B;;;;;;;;Cell',
        'Cell;B;;;;;;;;Freeza',
      ].join('\n'),
    );
    expect(result.catalog[0]?.fight).toEqual({ speed: 3, move2: { name: 'Meteor Smash', kind: 'rush' } });
    expect(result.catalog[2]?.fight).toBeUndefined();
    expect(result.catalog[3]?.fight).toBeUndefined();
    expect(result.catalog[4]?.fight).toBeUndefined();
    expect(result.sheetProblems).toEqual([
      'Goku: barre «7», va da 3 a 5',
      'Goku: potenza «x», va da 1 a 5',
      'Goku: mossa 1 «Kamehameha» senza tipo, es. «Kamehameha (onda)» o «Meteor Smash (impeto)»',
      'Goku: si trasforma in «Gohan», che non è un personaggio della lista con un tier',
      'Vegeta: si trasforma in «Bulma», che non è un personaggio della lista con un tier',
      'Freeza: le sue trasformazioni tornano su sé stesse',
      'Cell: le sue trasformazioni tornano su sé stesse',
    ]);
  });

  it('a list without the new columns reads as before', () => {
    const result = imported('nome;tier\nGoku;B\n');
    expect(result.catalog[0]?.fight).toBeUndefined();
    expect(result.sheetProblems).toEqual([]);
  });

  it('a move name may hold brackets of its own; a wave never "works on giants"', () => {
    expect(parseMove('Kamehameha (x10) (onda)')).toEqual({ name: 'Kamehameha (x10)', kind: 'wave' });
    expect(parseMove('Big Bang (ONDA, giganti)')).toEqual({ name: 'Big Bang', kind: 'wave' });
    expect(parseMove('Kamehameha (raggio)')).toBeNull();
  });
});
