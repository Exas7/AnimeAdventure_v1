import { describe, expect, it } from 'vitest';
import { testItems } from '../engine';
import characterTable from '../../docs/personaggi-bt3.csv?raw';
import missionTable from '../../docs/missioni-bt3.csv?raw';
import questionTable from '../../docs/domande.csv?raw';
import { importCatalog } from '../catalog/importCatalog';
import { catalogFromCsv, questionsFromCsv } from './catalogCsv';

describe('the files shipped in docs (spec 027, 2.1 to 2.3)', () => {
  it('the catalog imports with the character list of docs, without a row left out', () => {
    const list = importCatalog(characterTable);
    if (!list.ok) {
      throw new Error(list.errors.join(' '));
    }
    const result = catalogFromCsv(missionTable, list.catalog, testItems);
    expect(result.skipped).toEqual([]);
    expect(result.entries.length).toBeGreaterThan(30);
    expect(list.catalog.filter((character) => character.villain)).toHaveLength(80);
  });

  it('the questions import without a row left out', () => {
    const result = questionsFromCsv(questionTable);
    expect(result.skipped).toEqual([]);
    expect(result.entries.length).toBeGreaterThanOrEqual(40);
    const texts = result.entries.map((entry) => entry.question);
    expect(new Set(texts).size).toBe(texts.length);
  });
});
