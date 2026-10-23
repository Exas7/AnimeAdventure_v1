import { describe, expect, it } from 'vitest';
import { seededRandom } from '../battle/random';
import { testItems } from '../engine';
import { includedCatalog, includedMissions, includedQuestions } from '../included/includedLists';
import { listIncludedMaps } from '../included/includedMaps';
import { DEFAULT_READY_POWERS } from '../starters/readyPowers';
import { isSilent, silentLines } from './silent';
import { DEFAULT_PER_SHOP, randomEpisode } from './stepRandomize';
import { EMPTY_TEXT_LIBRARY } from './textLibrary';

const catalog = includedCatalog();
const byName = (name: string) => catalog.find((character) => character.name === name);

describe('who does not speak only cries (spec 090)', () => {
  it('knows the characters who do not speak, and nobody else', () => {
    for (const name of ['Son Goku (bambino) Oozaru', 'Vegeta (scouter) Oozaru', 'Baby Oozaru', 'Hildegarn', 'Saibaiman', 'Janemba', 'Super Janemba', 'Majin Buu (puro)', 'Broli', 'Broli SSJ', 'Broli Super Saiyan Leggendario']) {
      const character = byName(name);
      expect(character, name).toBeDefined();
      expect(isSilent(character as NonNullable<typeof character>), name).toBe(true);
    }
    for (const name of ['Son Goku (inizio)', 'Majin Buu (buono)', 'Super Buu', 'Bulma', 'Cell (prima forma)']) {
      expect(isSilent(byName(name) as NonNullable<ReturnType<typeof byName>>), name).toBe(false);
    }
  });

  it('the Oozaru cry in capitals, different cries; Broli SSJ stares; the legendary says Kakaroth', () => {
    const oozaru = byName('Son Goku (bambino) Oozaru');
    const lines = silentLines(oozaru as NonNullable<typeof oozaru>, 2, seededRandom(1)) ?? [];
    expect(lines).toHaveLength(2);
    expect(new Set(lines).size).toBe(2);
    for (const line of lines) {
      expect(line).toBe(line.toUpperCase());
    }
    const stare = silentLines(byName('Broli SSJ') as NonNullable<ReturnType<typeof byName>>, 1, seededRandom(2)) ?? [];
    expect(stare[0]).toMatch(/^\(.*\)$/);
    expect(silentLines(byName('Broli Super Saiyan Leggendario') as NonNullable<ReturnType<typeof byName>>, 1, seededRandom(3))?.[0]).toMatch(/KAKAROTH/i);
    expect(silentLines(byName('Bulma') as NonNullable<ReturnType<typeof byName>>, 2, seededRandom(4))).toBeNull();
  });

  it('in a randomized episode no Oozaru speaks, whichever mission the group gives', async () => {
    const maps = (await listIncludedMaps()).maps;
    const random = seededRandom(90);
    let seen = 0;
    for (let run = 0; run < 60; run++) {
      const map = maps[run % maps.length]?.map;
      if (!map) {
        continue;
      }
      const { content } = randomEpisode(map, {
        catalog,
        specialKeepers: [],
        powers: DEFAULT_READY_POWERS,
        texts: EMPTY_TEXT_LIBRARY,
        missions: { catalog: includedMissions(catalog), questions: includedQuestions(), items: testItems },
        perShop: DEFAULT_PER_SHOP,
        random,
      });
      for (const cell of Object.values(content)) {
        const character = catalog.find((candidate) => candidate.id === cell.characterId);
        if (character && /oozaru/i.test(character.name) && cell.mission) {
          seen += 1;
          for (const line of cell.lines ?? []) {
            expect(line, `${character.name}: ${line}`).toBe(line.toUpperCase());
          }
        }
      }
    }
    expect(seen).toBeGreaterThan(5);
  });
});
