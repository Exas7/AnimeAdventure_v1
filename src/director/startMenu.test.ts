import { describe, expect, it } from 'vitest';
import {
  catalogFigures,
  catalogImportedNotice,
  NO_CATALOG,
  sheetProblemsNotice,
  startMenu,
} from './startMenu';

describe('start page menu (spec 024, criterion 2; spec 042, criterion 1; spec 050, criterion 3)', () => {
  it('with a saved game: every button in order, "Riprendi la partita" first and main', () => {
    const menu = startMenu(true);
    expect(menu.map((item) => item.label)).toEqual([
      'Riprendi la partita',
      'Nuova partita',
      'Puntate',
      'Editor delle mappe',
      'Carica partita da file',
      'Temi',
    ]);
    expect(menu.filter((item) => item.primary).map((item) => item.id)).toEqual(['resume']);
  });

  it('without a saved game: no "Riprendi la partita", and "Nuova partita" is the main button', () => {
    const menu = startMenu(false);
    expect(menu.some((item) => item.id === 'resume')).toBe(false);
    expect(menu.filter((item) => item.primary).map((item) => item.id)).toEqual(['newGame']);
  });

  it('"Riprendi la partita" has the dragon radar, the others the balls from one to five stars, in order', () => {
    expect(startMenu(true).map((item) => item.stars)).toEqual([null, 1, 2, 3, 4, 5]);
    expect(startMenu(false).map((item) => item.stars)).toEqual([1, 2, 3, 4, 5]);
  });

  it('on the phone: the same menu without "Carica partita da file" (spec 052, 2.2)', () => {
    expect(startMenu(true, true).map((item) => item.id)).toEqual(['resume', 'newGame', 'episodes', 'maps', 'themes']);
    expect(startMenu(false, true).some((item) => item.id === 'loadFile')).toBe(false);
  });

  it('on the phone the balls go from one to four stars, with no gap (spec 057, criterion 1)', () => {
    expect(startMenu(true, true).map((item) => item.stars)).toEqual([null, 1, 2, 3, 4]);
    expect(startMenu(false, true).map((item) => item.stars)).toEqual([1, 2, 3, 4]);
    expect(startMenu(true, true).find((item) => item.id === 'themes')?.stars).toBe(4);
  });

  it('every button has its own hint', () => {
    const hints = startMenu(true).map((item) => item.hint.trim());
    expect(hints.every((hint) => hint.length > 0)).toBe(true);
    expect(new Set(hints).size).toBe(hints.length);
  });
});

describe('character list in use, in the advanced settings (spec 042, criterion 2)', () => {
  it('one line per number', () => {
    expect(
      catalogFigures({ count: 166, possibleStarters: 24, priced: 124, shopkeepers: 6, withoutTier: 5 }),
    ).toEqual([
      '166 personaggi',
      '24 possibili starter',
      '124 con prezzo',
      '6 negozianti',
      '5 senza tier (non arruolabili)',
    ]);
  });

  it('one of a kind is singular', () => {
    expect(
      catalogFigures({ count: 1, possibleStarters: 1, priced: 1, shopkeepers: 1, withoutTier: 1 }),
    ).toEqual([
      '1 personaggio',
      '1 possibile starter',
      '1 con prezzo',
      '1 negoziante',
      '1 senza tier (non arruolabili)',
    ]);
  });

  it('says what to do without a list', () => {
    expect(NO_CATALOG).toBe('Nessuna lista: importala per iniziare una partita.');
  });
});

describe('notice after an import (spec 042, criterion 3)', () => {
  const summary = { count: 166, possibleStarters: 24, priced: 124, shopkeepers: 6, withoutTier: 5 };

  it('says how many characters came in', () => {
    expect(catalogImportedNotice(summary, [])).toEqual(['Lista importata: 166 personaggi.']);
  });

  it('with wrong fight sheet values, the notice of spec 037 stays', () => {
    const problems = ['Goku: barre «7», va da 3 a 5'];
    expect(catalogImportedNotice(summary, problems)).toEqual(sheetProblemsNotice(problems));
  });
});

describe('wrong fight sheet values after an import (spec 037, 2.2)', () => {
  it('says nothing without problems', () => {
    expect(sheetProblemsNotice([])).toEqual([]);
  });

  it('lists the problems, and counts those beyond eight', () => {
    expect(sheetProblemsNotice(['Goku: barre «7», va da 3 a 5'])).toEqual([
      'Lista importata. Un valore delle schede di combattimento non va: vale come vuoto.',
      'Goku: barre «7», va da 3 a 5',
    ]);
    const many = Array.from({ length: 10 }, (_, index) => `Problema ${index + 1}`);
    const notice = sheetProblemsNotice(many);
    expect(notice[0]).toBe('Lista importata. 10 valori delle schede di combattimento non vanno: valgono come vuoti.');
    expect(notice.slice(1, 9)).toEqual(many.slice(0, 8));
    expect(notice.at(-1)).toBe('E altri 2.');
  });
});
