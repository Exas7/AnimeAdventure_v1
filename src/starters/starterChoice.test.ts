import { describe, expect, it } from 'vitest';
import type { StarterProposals } from './proposals';
import { DEFAULT_READY_POWERS, type ReadyPower } from './readyPowers';
import {
  canStart,
  cardTextFor,
  chooseCard,
  formatCoins,
  looksLikeStarterChoiceView,
  showOther,
  startChoice,
  starterChoiceView,
  startingCoinsWith,
} from './starterChoice';

const [everyTwo, perInteraction, richStart] = DEFAULT_READY_POWERS as [
  ReadyPower,
  ReadyPower,
  ReadyPower,
];

const catalog = [
  { id: 'krilin', name: 'Krilin' },
  { id: 'piccolo', name: 'Piccolo (inizio)' },
  { id: 'raditz', name: 'Raditz' },
  { id: 'yamcha', name: 'Yamcha' },
  { id: 'tenshinhan', name: 'Tenshinhan' },
];

const proposals: StarterProposals = {
  p1: [
    { characterId: 'krilin', powers: [everyTwo] },
    { characterId: 'piccolo', powers: [perInteraction] },
    { characterId: 'raditz', powers: [richStart] },
  ],
  p2: [
    { characterId: 'yamcha', powers: [everyTwo, perInteraction] },
    { characterId: 'tenshinhan', powers: [] },
    { powers: [richStart] },
  ],
};

const names = { p1: 'Maggi', p2: 'Melia' };

describe('the starter choice scene (spec 025, 2.4)', () => {
  it('opens on the proposals of the player who starts, nothing chosen', () => {
    const view = starterChoiceView(proposals, startChoice('p2'), names, 1000, catalog);
    expect(view.showing).toBe('p2');
    expect(view.cards).toEqual([
      {
        character: { id: 'yamcha', name: 'Yamcha' },
        texts: ['Ogni 2 turni guadagni 200$', 'Ogni volta che interagisci con un PG prendi 250$'],
        chosen: false,
      },
      { character: { id: 'tenshinhan', name: 'Tenshinhan' }, texts: [], chosen: false },
      { character: null, texts: ['Parti con 3.500$ invece che 1.000$'], chosen: false },
    ]);
    expect(view.teams).toEqual({
      p1: { name: 'Maggi', coins: 1000, starter: null },
      p2: { name: 'Melia', coins: 1000, starter: null },
    });
  });

  it('a click chooses the starter of the player shown; another click changes it', () => {
    let choice = chooseCard(startChoice('p1'), 0);
    choice = chooseCard(choice, 2);
    const view = starterChoiceView(proposals, choice, names, 1000, catalog);
    expect(view.cards.map((card) => card.chosen)).toEqual([false, false, true]);
    expect(view.teams.p1.starter).toEqual({ id: 'raditz', name: 'Raditz' });
  });

  it('the coins shown already count the extra starting coins of the chosen starter (criterion 8)', () => {
    const choice = chooseCard(startChoice('p1'), 2);
    expect(starterChoiceView(proposals, choice, names, 1000, catalog).teams.p1.coins).toBe(3500);
    expect(startingCoinsWith(1000, [everyTwo, perInteraction])).toBe(1000);
    expect(startingCoinsWith(0, [richStart, richStart])).toBe(5000);
  });

  it('"Avanti" shows the other player, whose choice is kept apart', () => {
    let choice = chooseCard(startChoice('p1'), 1);
    choice = showOther(choice);
    expect(choice.showing).toBe('p2');
    const view = starterChoiceView(proposals, chooseCard(choice, 0), names, 1000, catalog);
    expect(view.cards.map((card) => card.chosen)).toEqual([true, false, false]);
    expect(view.teams.p1.starter?.name).toBe('Piccolo (inizio)');
    expect(view.teams.p2.starter?.name).toBe('Yamcha');
    expect(showOther(showOther(choice)).showing).toBe('p2');
  });

  it('the game can start only when both have chosen a proposal with a character', () => {
    const one = chooseCard(startChoice('p1'), 0);
    expect(canStart(proposals, one)).toBe(false);
    const both = chooseCard(showOther(one), 1);
    expect(canStart(proposals, both)).toBe(true);
    expect(canStart(proposals, chooseCard(showOther(one), 2))).toBe(false);
  });

  it('without known coins the scene leaves them out', () => {
    const view = starterChoiceView(proposals, startChoice('p1'), names, null, catalog);
    expect(view.teams.p1.coins).toBeNull();
  });

  it('power texts follow the starting coins (spec 029, criterion 9)', () => {
    expect(cardTextFor(richStart, 200)).toBe('Parti con 2.700$ invece che 200$');
    expect(cardTextFor(richStart, 1000)).toBe('Parti con 3.500$ invece che 1.000$');
    expect(cardTextFor(richStart, null)).toBe('Parti con {totale} invece che {iniziali}');
    expect(cardTextFor(everyTwo, 200)).toBe('Ogni 2 turni guadagni 200$');
    const choice = chooseCard(startChoice('p1'), 2);
    expect(starterChoiceView(proposals, choice, names, 200, catalog).cards[2]?.texts).toEqual([
      'Parti con 2.700$ invece che 200$',
    ]);
  });

  it('writes coins as in the channel graphic', () => {
    expect(formatCoins(1000)).toBe('1.000$');
    expect(formatCoins(3500)).toBe('3.500$');
    expect(formatCoins(250)).toBe('250$');
    expect(formatCoins(1234567)).toBe('1.234.567$');
    expect(formatCoins(-1500)).toBe('-1.500$');
  });

  it('the stream accepts a well-formed scene and ignores anything else', () => {
    const view = starterChoiceView(proposals, startChoice('p1'), names, 1000, catalog);
    expect(looksLikeStarterChoiceView(JSON.parse(JSON.stringify(view)))).toBe(true);
    expect(looksLikeStarterChoiceView({ ...view, showing: 'p3' })).toBe(false);
    expect(looksLikeStarterChoiceView({ ...view, teams: { p1: view.teams.p1 } })).toBe(false);
    expect(looksLikeStarterChoiceView(null)).toBe(false);
  });
});
