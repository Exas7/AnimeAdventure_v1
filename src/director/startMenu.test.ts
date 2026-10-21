import { describe, expect, it } from 'vitest';
import { catalogStatus, sheetProblemsNotice, startMenu } from './startMenu';

describe('start page menu (spec 024, criterion 2)', () => {
  it('with a saved game: every button in order, "Riprendi la partita" first and main', () => {
    const menu = startMenu(true);
    expect(menu.map((item) => item.label)).toEqual([
      'Riprendi la partita',
      'Nuova partita',
      'Puntate',
      'Editor delle mappe',
      'Carica partita da file',
      'Importa lista personaggi',
    ]);
    expect(menu.filter((item) => item.primary).map((item) => item.id)).toEqual(['resume']);
  });

  it('without a saved game: no "Riprendi la partita", and "Nuova partita" is the main button', () => {
    const menu = startMenu(false);
    expect(menu.some((item) => item.id === 'resume')).toBe(false);
    expect(menu.filter((item) => item.primary).map((item) => item.id)).toEqual(['newGame']);
  });

  it('every button has its own hint', () => {
    const hints = startMenu(true).map((item) => item.hint.trim());
    expect(hints.every((hint) => hint.length > 0)).toBe(true);
    expect(new Set(hints).size).toBe(hints.length);
  });
});

describe('character list status under the menu (spec 024, 2.1)', () => {
  it('sums up the imported list', () => {
    expect(
      catalogStatus({ count: 165, possibleStarters: 24, priced: 124, shopkeepers: 6, withoutTier: 4 }),
    ).toBe(
      'Lista dei personaggi: 165 personaggi, 24 possibili starter, 124 con prezzo, 6 negozianti, 4 senza tier (non arruolabili).',
    );
  });

  it('says what to do without a list', () => {
    expect(catalogStatus(null)).toBe('Nessuna lista importata: importala per iniziare una partita.');
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
