import { describe, expect, it } from 'vitest';
import { addNode, newMap } from '../editor/mapEdit';
import { emptyProposals, withProposal } from '../starters/proposals';
import { DEFAULT_READY_POWERS } from '../starters/readyPowers';
import { parseEpisode, serializeEpisode } from './episodeFile';
import { libraryStatus, newEpisode } from './newEpisode';

const characters = [
  { id: 'krilin', name: 'Krilin', tier: 'C' },
  { id: 'freeza', name: 'Freeza', tier: 'S', villain: true },
  { id: 'bulma', name: 'Bulma', shopkeeper: true },
];

describe('"Prima di cominciare": the state of the libraries (spec 028, criterion 2)', () => {
  it('everything ready: green ticks with the numbers', () => {
    const status = libraryStatus({ characters, powers: 3, specialKeepers: 1, missions: 39, questions: 45 });
    expect(status.map((check) => check.ready)).toEqual([true, true, true, true, true]);
    expect(status.map((check) => check.text)).toEqual([
      '3 personaggi: 1 negozianti, 1 cattivi.',
      '3 poteri da dare agli starter.',
      '1 nella lista, 1 speciali.',
      '39 missioni nel catalogo.',
      '45 domande.',
    ]);
  });

  it('what is missing is said, with what it means', () => {
    const status = libraryStatus({ characters: [], powers: 0, specialKeepers: 0, missions: 0, questions: 0 });
    expect(status.every((check) => !check.ready)).toBe(true);
    // The button is in the advanced settings of the start page (spec 042, criterion 4).
    expect(status[0]?.text).toMatch(/«Impostazioni avanzate» → «Importa lista personaggi»/);
    expect(status[3]?.text).toMatch(/docs\/missioni-bt3\.csv/);
  });

  it('a list without villains is an old list to import again', () => {
    const [list] = libraryStatus({
      characters: [{ id: 'krilin', name: 'Krilin', tier: 'C' }],
      powers: 3,
      specialKeepers: 0,
      missions: 0,
      questions: 0,
    });
    expect(list?.ready).toBe(false);
    expect(list?.text).toMatch(/reimporta docs\/personaggi-bt3\.csv/);
  });
});

describe('the episode the guided creation saves (spec 028, criterion 3)', () => {
  // A map with one shop, n1.
  const map = addNode(newMap('Pianeta Nameck'), { x: 0.5, y: 0.5 }, 'shop').map;
  const keeper = { id: 'k1', name: 'Oste', shopkeeper: true, imageData: 'data:image/png;base64,AA' };

  it('has map, name, proposed starters, the content and copies of the special shopkeepers', () => {
    const [power] = DEFAULT_READY_POWERS;
    const starters = withProposal(emptyProposals(), 'p1', 0, {
      characterId: 'krilin',
      powers: power ? [power] : [],
    });
    const content = { n1: { characterId: 'k1', forSale: ['krilin'] } };
    const episode = newEpisode({ name: '  Pianeta Nameck · 1 ', map, content, starters }, [keeper]);
    expect(episode).toEqual({ name: 'Pianeta Nameck · 1', map, content, keepers: [keeper], starters });
    expect(parseEpisode(serializeEpisode(episode))).toEqual(episode);
  });

  it('without starters or special shopkeepers it leaves them out', () => {
    const episode = newEpisode({ name: '', map, content: {}, starters: emptyProposals() }, [keeper]);
    expect(episode).toEqual({ name: 'Puntata senza nome', map, content: {} });
  });
});
