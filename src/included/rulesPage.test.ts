import { describe, expect, it } from 'vitest';
import { LEVELS } from '../ai/brain';
import { defaultNewGameForm } from '../director/newGame';
import { BASE_ACTIONS, BASE_INTERACTIONS, TEAM_SIZE, testItems } from '../engine';
import { DEFAULT_READY_POWERS } from '../starters/readyPowers';
import { cardTextFor, formatCoins } from '../starters/starterChoice';
import { includedCatalog, includedMissions, includedQuestions } from './includedLists';
import { listIncludedMaps } from './includedMaps';
import { measureRandomize, rulesPage, type IncludedLists } from './rulesPage';

const catalog = includedCatalog();
const lists: IncludedLists = {
  catalog,
  missions: includedMissions(catalog),
  questions: includedQuestions(),
  items: testItems,
};
const maps = (await listIncludedMaps()).maps.map((entry) => entry.map);
const startingCoins = defaultNewGameForm(maps[0]!).startingCoins;
const stats = measureRandomize(maps, lists);
const page = rulesPage(lists, startingCoins, stats);

describe('the page of the rules and values (spec 077)', () => {
  // When a value, a list or a map changes, write the page again with:
  //   npx vitest run src/included/rulesPage.test.ts -u
  it('C1: docs/regole-e-valori.md is the page generated from the code and the lists', async () => {
    await expect(page).toMatchFileSnapshot('../../docs/regole-e-valori.md');
  });

  it('C2: the values in the page are those of the game', () => {
    expect(page).toContain(`**${BASE_ACTIONS} azioni** e **${BASE_INTERACTIONS} interazione**`);
    expect(page).toContain(`**${TEAM_SIZE} posti**`);
    expect(page).toContain(`Si parte con **${formatCoins(startingCoins)}**`);
    for (const item of testItems) {
      expect(page).toContain(`| ${item.name} | ${formatCoins(item.price)} |`);
    }
    for (const power of DEFAULT_READY_POWERS) {
      expect(page).toContain(`- ${cardTextFor(power, startingCoins)}`);
    }
    expect(page).toContain(
      `| Quiz giusti | ${Math.round(LEVELS.easy.quiz * 10)} su 10 | ${Math.round(LEVELS.normal.quiz * 10)} su 10 | ` +
        `${Math.round(LEVELS.hard.quiz * 10)} su 10 |`,
    );
    const lines = page.split('\n');
    for (const { tier, price, name } of catalog) {
      if (tier && price) {
        const row = lines.find((line) => line.startsWith(`| ${tier} | `));
        // One price for the tier, or a range «da … a …» when the list has several.
        expect(row?.includes(formatCoins(price)) || row?.includes('| da '), name).toBe(true);
      }
    }
  });

  it('C3: every base map is measured, and its character cells add up to all of them', () => {
    expect(stats.map((map) => map.name)).toEqual(maps.map((map) => map.name));
    for (const map of stats) {
      const counted = Object.values(map.byKind).reduce((total, count) => total + count, 0);
      expect(counted, map.name).toBe(map.characterCells * map.episodes);
      expect(page).toContain(map.name);
    }
  });

  it('C4: no question of the quizzes is in the page, and so no answer', () => {
    for (const entry of lists.questions) {
      expect(page).not.toContain(entry.question);
    }
  });
});
