import { describe, expect, it } from 'vitest';
import { testItems, type Character } from '../engine';
import characterTable from '../../docs/personaggi-bt3.csv?raw';
import missionTable from '../../docs/missioni-bt3.csv?raw';
import questionTable from '../../docs/domande.csv?raw';
import { importCatalog } from '../catalog/importCatalog';
import { tierRank } from '../episode/fill';
import { QUESTION_LEVELS, type CatalogMission } from './catalog';
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

describe('the rules of the catalog in docs (spec 043, criteria 5-6; D-069, D-070)', () => {
  const list = importCatalog(characterTable);
  const characters: Character[] = list.ok ? list.catalog : [];
  const entries = catalogFromCsv(missionTable, characters, testItems).entries;
  const find = (id: string | undefined) => characters.find((character) => character.id === id);
  const name = (id: string | undefined) => find(id)?.name ?? id ?? '';
  const rank = (id: string | undefined) => tierRank(find(id)?.tier);
  const B_PLUS = tierRank('B+') as number;
  const own = entries.filter(
    (entry): entry is CatalogMission & { giver: { characterId: string } } => 'characterId' in entry.giver,
  );

  it('group missions are only fights, quiz, waits and skipped turns: no target drawn at random', () => {
    const groups = entries.filter((entry) => 'group' in entry.giver);
    expect(groups.length).toBeGreaterThan(0);
    for (const entry of groups) {
      expect(['fight', 'quiz', 'wait', 'skipTurns']).toContain(entry.mission.type);
    }
  });

  it('nobody up to B+ asks to bring or beat, or to fight, someone more than one step stronger', () => {
    const tooStrong = own.flatMap((entry) => {
      const giver = rank(entry.giver.characterId);
      if (!entry.mission.reward.cellCharacter || giver === null || giver > B_PLUS) {
        return [];
      }
      const asked = [
        ...(['defeat', 'bring'].includes(entry.mission.type) ? [entry.mission.targetId] : []),
        ...(entry.mission.opponents ?? []).filter((id) => id !== entry.giver.characterId),
      ];
      return asked
        .filter((id) => (rank(id) ?? 0) > giver + 1)
        .map((id) => `${name(entry.giver.characterId)} → ${name(id)}`);
    });
    expect(tooStrong).toEqual([]);
  });

  it('no quiz, wait or skipped turns of their own recruits a character above B+', () => {
    const easy = own.filter(
      (entry) =>
        ['quiz', 'wait', 'skipTurns'].includes(entry.mission.type) &&
        entry.mission.reward.cellCharacter &&
        (rank(entry.giver.characterId) ?? 0) > B_PLUS,
    );
    expect(easy.map((entry) => name(entry.giver.characterId))).toEqual([]);
  });

  it('no two missions wait for each other: "Batti" and "Porta" never go round in a circle', () => {
    const next = new Map<string, string[]>();
    for (const entry of own) {
      if (['defeat', 'bring'].includes(entry.mission.type) && entry.mission.targetId) {
        next.set(entry.giver.characterId, [...(next.get(entry.giver.characterId) ?? []), entry.mission.targetId]);
      }
    }
    const circles: string[] = [];
    for (const start of next.keys()) {
      const queue: string[][] = [[start]];
      while (queue.length > 0) {
        const path = queue.shift() as string[];
        for (const id of next.get(path[path.length - 1] as string) ?? []) {
          if (id === start) {
            circles.push([...path, id].map(name).join(' → '));
          } else if (!path.includes(id)) {
            queue.push([...path, id]);
          }
        }
      }
    }
    expect(circles).toEqual([]);
  });

  it('one or two lines for each mission, the placeholders only where they mean something', () => {
    for (const entry of entries) {
      expect(entry.lines.length, name('characterId' in entry.giver ? entry.giver.characterId : '')).toBeGreaterThanOrEqual(1);
      expect(entry.lines.length).toBeLessThanOrEqual(2);
      const text = entry.lines.join(' ');
      if (text.includes('{obiettivo}')) {
        // One target, or several to choose from (spec 069, 2.3).
        expect(entry.mission.targetId ?? entry.targetChoices).toBeDefined();
      }
      if (text.includes('{n}')) {
        expect(entry.mission.turns).toBeDefined();
      }
    }
  });

  it('every question has a level, at least 18 for each', () => {
    const questions = questionsFromCsv(questionTable).entries;
    expect(questions.filter((entry) => entry.level === undefined)).toEqual([]);
    for (const { level } of QUESTION_LEVELS) {
      expect(questions.filter((entry) => entry.level === level).length, level).toBeGreaterThanOrEqual(18);
    }
  });
});

describe('the story missions in docs (spec 069, criteria 3 and 4)', () => {
  const list = importCatalog(characterTable);
  const characters: Character[] = list.ok ? list.catalog : [];
  const entries = catalogFromCsv(missionTable, characters, testItems).entries;
  const id = (name: string) => characters.find((character) => character.name === name)?.id ?? name;
  const ofGiver = (name: string) =>
    entries.filter((entry) => 'characterId' in entry.giver && entry.giver.characterId === id(name));

  it('no «Vai da … e torna»; «Accompagnami da» only from the special characters, without a tier', () => {
    expect(entries.filter((entry) => entry.mission.type === 'goTo' && entry.mission.returnToGiver)).toEqual([]);
    const escorts = entries.filter((entry) => entry.mission.type === 'escort');
    expect(escorts).toHaveLength(8);
    for (const entry of escorts) {
      const giverId = 'characterId' in entry.giver ? entry.giver.characterId : '';
      const giver = characters.find((character) => character.id === giverId);
      expect(giver).toBeDefined();
      expect(giver?.tier).toBeUndefined();
      expect(entry.mission.reward).toEqual({ coins: 800 });
    }
  });

  it('the villains of the group only fight; the story pairs of the table', () => {
    const villains = entries.filter((entry) => 'group' in entry.giver && entry.giver.group === 'villains');
    expect(villains.every((entry) => entry.mission.type === 'fight')).toBe(true);
    const opponents = (name: string, format: string) =>
      ofGiver(name).find((entry) => entry.mission.type === 'fight' && entry.mission.format === format)?.mission.opponents;
    expect(opponents('Freeza (forma finale)', '2v2')).toEqual([id('Freeza (forma finale)'), id('Re Cold')]);
    expect(opponents('C-17', '2v2')).toEqual([id('C-17'), id('C-18')]);
    expect(opponents('C-18', '2v2')).toEqual([id('C-18'), id('C-17')]);
    expect(opponents('C-16', '3v3')).toEqual([id('C-16'), id('C-17'), id('C-18')]);
  });

  it('Dabura wants a Majin Buu, any of them, beaten', () => {
    const dabura = ofGiver('Dabura').find((entry) => entry.mission.type === 'defeat');
    expect(dabura?.targetChoices).toEqual(
      ['Majin Buu (buono)', 'Majin Buu (puro male)', 'Super Buu', 'Majin Buu (puro)'].map(id),
    );
  });

  it('Cell Jr. and Saibaiman are never a target or a reward', () => {
    const henchmen = ['cell-jr', 'saibaiman'];
    for (const entry of entries) {
      const asked = [entry.mission.targetId, ...(entry.targetChoices ?? []), ...(entry.mission.reward.characters ?? [])];
      expect(asked.filter((asks) => henchmen.includes(asks ?? ''))).toEqual([]);
    }
  });
});
