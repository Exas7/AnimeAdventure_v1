import { describe, expect, it } from 'vitest';
import { tierRank } from '../episode/fill';
import { includedCatalog } from '../included/includedLists';
import { DEFAULT_SETTINGS } from './fight';
import { measureChances, sheetsPage, tierName } from './sheetsPage';

const catalog = includedCatalog();
const chances = measureChances();
const page = sheetsPage(catalog, chances);

describe('the sheets page for the community (spec 040)', () => {
  // When the list changes, write the page again with:
  //   npx vitest run src/battle/sheetsPage.test.ts -u
  it('C1: docs/schede-personaggi.md is the page generated from the character list', async () => {
    await expect(page).toMatchFileSnapshot('../../docs/schede-personaggi.md');
  });

  it('C2: every character with a tier once in the tables, those without a tier at the end', () => {
    const lines = page.split('\n');
    for (const character of catalog.filter((entry) => entry.tier)) {
      expect(lines.filter((line) => line.startsWith(`| ${character.name} |`))).toHaveLength(1);
    }
    const end = page.slice(page.indexOf('## Senza tier'));
    for (const character of catalog.filter((entry) => !entry.tier)) {
      expect(end).toContain(`- ${character.name}`);
    }
  });

  it('C3: the starting values in the page are those of the game', () => {
    expect(page).toContain(`una volta ogni ${Math.round(1 / DEFAULT_SETTINGS.moveChance)} attacchi`);
    expect(page).toContain(`contrastata il ${Math.round(DEFAULT_SETTINGS.counterChance * 100)}%`);
    expect(page).toContain(`si riempie in ${DEFAULT_SETTINGS.switchRecharge} scambi`);
    expect(page).toContain(`una volta ogni ${Math.round(1 / DEFAULT_SETTINGS.transformChance)} scambi`);
  });

  it('C4: the measured chances: even at the same tier, about 8 in 10 with 5 steps, almost sure at 19', () => {
    const at = (gap: number) => chances.byGap.find((row) => row.gap === gap)?.share as number;
    expect(at(0)).toBeGreaterThan(0.45);
    expect(at(0)).toBeLessThan(0.55);
    expect(at(5)).toBeGreaterThan(0.75);
    expect(at(5)).toBeLessThan(0.85);
    expect(at(19)).toBeGreaterThan(0.99);
    for (const row of chances.bySize) {
      expect(row.share).toBeGreaterThan(0.75);
      expect(row.share).toBeLessThan(0.86);
    }
  });

  it('tier names are the reverse of the ranks', () => {
    for (const tier of ['E', 'D-', 'C+', 'B', 'A+', 'S-', 'SS+']) {
      expect(tierName(tierRank(tier) as number)).toBe(tier);
    }
  });
});
