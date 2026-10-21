import { describe, expect, it } from 'vitest';
import { personsOf } from '../catalog/person';
import { personOfId, testItems, type GameMap } from '../engine';
import { includedCatalog, includedMissions, includedQuestions } from '../included/includedLists';
import { listIncludedMaps } from '../included/includedMaps';
import { DEFAULT_READY_POWERS } from '../starters/readyPowers';
import { emptyProposals } from '../starters/proposals';
import { starterConflicts } from '../starters/starterConflicts';
import { checkEpisode } from './checks';
import type { Content } from './fill';
import { randomizeWithMissions } from './missionFill';
import { prepareEpisodeContent, preparationReport } from './playEpisode';
import { randomEpisode } from './stepRandomize';
import { EMPTY_TEXT_LIBRARY } from './textLibrary';

const catalog = includedCatalog();
const missions = { catalog: includedMissions(catalog), questions: includedQuestions(), items: testItems };

/** Repeatable "random" numbers (mulberry32). */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Everyone in the episode: cells, shopkeepers, for sale, rewards. */
function everyone(content: Content): string[] {
  return Object.values(content).flatMap((cell) => [
    ...(cell.characterId ? [cell.characterId] : []),
    ...(cell.forSale ?? []),
    ...(cell.mission?.reward.characters ?? []),
  ]);
}

describe('one person in one place per game (spec 039)', () => {
  it('C1-C2: "Randomizza tutto" on the base maps: one place per person, chains excepted; starters of persons apart', async () => {
    const random = seeded(39);
    for (const { map } of (await listIncludedMaps()).maps) {
      for (let run = 0; run < 8; run++) {
        const episode = randomEpisode(map, {
          catalog,
          specialKeepers: [],
          powers: DEFAULT_READY_POWERS,
          texts: EMPTY_TEXT_LIBRARY,
          missions,
          perShop: 3,
          random,
        });
        expect(checkEpisode(episode.content, catalog, map).filter((issue) => issue.kind === 'samePerson')).toEqual(
          [],
        );
        const starters = [...episode.starters.p1, ...episode.starters.p2].flatMap((proposal) =>
          proposal.characterId ? [proposal.characterId] : [],
        );
        const starterPersons = starters.map((id) => personOfId(catalog, id));
        expect(new Set(starterPersons).size).toBe(starters.length);
        const inEpisode = personsOf(everyone(episode.content), catalog);
        expect(starterPersons.filter((person) => inEpisode.has(person))).toEqual([]);
      }
    }
  });

  it('C3: a partial "Randomizza" never puts a form of a reward promised by a cell not redone', async () => {
    const map = (await listIncludedMaps()).maps.find((entry) => entry.id === 'inclusa:Pianeta_Nameck')?.map as GameMap;
    const characterCells = map.nodes.filter((node) => node.type === 'character').map((node) => node.id);
    const shops = map.nodes.filter((node) => node.type === 'shop').map((node) => node.id);
    const kept = characterCells[0] as string;
    const content: Content = {
      [kept]: { characterId: 'krilin', mission: { type: 'other', text: 'Promessa', reward: { characters: ['son-goku-meta'] } } },
    };
    for (let seed = 1; seed <= 6; seed++) {
      const result = randomizeWithMissions(
        map,
        content,
        catalog,
        [],
        EMPTY_TEXT_LIBRARY,
        [...characterCells.slice(1), ...shops],
        3,
        seeded(seed),
        missions,
      );
      const elsewhere = Object.entries(result.content)
        .filter(([id]) => id !== kept)
        .flatMap(([, cell]) => [...(cell.characterId ? [cell.characterId] : []), ...(cell.forSale ?? [])]);
      expect(elsewhere.filter((id) => id === 'son-goku-meta' || id === 'son-goku-meta-ssj')).toEqual([]);
    }
  });

  it('C4: at the start of the game another form of a chosen starter leaves the map too', () => {
    const prepared = prepareEpisodeContent({ n1: { characterId: 'son-goku-meta-ssj' } }, catalog, ['son-goku-meta']);
    const substitute = prepared.content.n1?.characterId;
    expect(substitute).toBeDefined();
    expect(personOfId(catalog, substitute as string)).not.toBe(personOfId(catalog, 'son-goku-meta'));
    expect(prepared.replacements[0]).toMatchObject({ starterName: 'Son Goku (metà)', formName: 'Son Goku (metà) SSJ' });
    expect(preparationReport(prepared)[0]).toMatch(
      /^Son Goku \(metà\) SSJ, un'altra forma dello starter Son Goku \(metà\), tolto dalla casella/,
    );
  });

  it('C6: the editor warns about one person in two places, never about a chain behind a grey road (D-066)', () => {
    const chain = {
      nodes: [],
      edges: [{ id: 'e1', from: 'a', to: 'b', curve: [], locked: true, unlockNodeId: 'a' }],
    } as unknown as GameMap;
    const freeza: Content = { a: { characterId: 'freeza-prima-forma' }, b: { characterId: 'freeza-forma-finale' } };
    expect(checkEpisode(freeza, catalog, chain).filter((issue) => issue.kind === 'samePerson')).toEqual([]);
    expect(checkEpisode(freeza, catalog).find((issue) => issue.kind === 'samePerson')?.message).toBe(
      'Stessa persona in più posti: Freeza (prima forma), Freeza (forma finale).',
    );
    const goku: Content = { a: { characterId: 'son-goku-meta' }, c: { forSale: ['son-goku-meta-ssj'] } };
    expect(checkEpisode(goku, catalog, chain).map((issue) => issue.kind)).toContain('samePerson');
  });

  it('C7: "Nuova partita" says when another form of a proposed starter is on the map', () => {
    const proposals = emptyProposals();
    proposals.p1[0] = { ...proposals.p1[0], powers: [], characterId: 'son-goku-meta' };
    const map = { nodes: [{ id: 'n1', type: 'character' }], edges: [] } as unknown as GameMap;
    const lines = starterConflicts(proposals, { n1: { characterId: 'son-goku-meta-ssj' } }, map, catalog);
    expect(lines).toContain(
      "Son Goku (metà) SSJ, un'altra forma di Son Goku (metà), è nella casella #1: se Son Goku (metà) viene scelto, lì ne arriva un altro.",
    );
  });
});
