import { describe, expect, it } from 'vitest';
import { testItems } from '../engine';
import {
  fillLines,
  groupOf,
  hasOwnMissions,
  looksLikeCatalogMission,
  looksLikeQuestion,
  questionCount,
  type CatalogMission,
  type QuestionEntry,
} from './catalog';
import { catalogFromCsv, catalogToCsv, questionsFromCsv, questionsToCsv } from './catalogCsv';

const characters = [
  { id: 'tapion', name: 'Tapion', tier: 'S-' },
  { id: 'hildegarn', name: 'Hildegarn', tier: 'SS+' },
  { id: 'bulma', name: 'Bulma', shopkeeper: true },
  { id: 'trunks-bambino', name: 'Trunks (bambino)', tier: 'B' },
  { id: 'cooler', name: 'Cooler', tier: 'A', villain: true },
  { id: 'metal-cooler', name: 'Metal Cooler', tier: 'S-' },
  { id: 'babidi', name: 'Babidi' },
  { id: 'dabura', name: 'Dabura', tier: 'A+', villain: true },
  { id: 'majin-buu-buono', name: 'Majin Buu (buono)', tier: 'A+' },
  { id: 'krilin', name: 'Krilin', tier: 'C' },
];

const catalog: CatalogMission[] = [
  {
    id: '1',
    giver: { characterId: 'tapion' },
    mission: { type: 'defeat', targetId: 'hildegarn', reward: { cellCharacter: true } },
    lines: ['Batti {obiettivo} e verrò con te.'],
    weight: 1,
  },
  {
    id: '2',
    giver: { characterId: 'bulma' },
    mission: { type: 'wait', turns: 3, reward: { characters: ['trunks-bambino'], coins: 500 } },
    lines: ['Aspetta {n} turni,', 'e avrai {premio}!'],
    weight: 2,
  },
  {
    id: '3',
    giver: { characterId: 'cooler' },
    mission: { type: 'fight', format: '1v1', condition: 'transform', reward: { cellCharacter: true } },
    lines: ['Fammi trasformare, se ci riesci.'],
    behindId: 'metal-cooler',
    weight: 1,
  },
  {
    id: '4',
    giver: { characterId: 'babidi' },
    mission: {
      type: 'fight',
      format: '2v2',
      condition: 'win',
      opponents: ['dabura', 'majin-buu-buono'],
      reward: { coins: 800, items: ['senzu'] },
    },
    lines: ['Dabura, Majin Bu: pensateci voi!'],
    weight: 1,
  },
  {
    id: '5',
    giver: { group: 'villains' },
    mission: { type: 'fight', condition: 'win', reward: { cellCharacter: true } },
    lines: ['Non avrai pietà da me.'],
    weight: 3,
  },
  {
    id: '6',
    giver: { group: 'recruitable' },
    mission: { type: 'quiz', reward: { cellCharacter: true } },
    lines: [],
    weight: 1,
  },
];

describe('who gets which missions (spec 027, 2.1 and criterion 4)', () => {
  it('a villain, a recruitable and a story character fall in their group', () => {
    expect(groupOf({ id: 'a', name: 'A', tier: 'S', villain: true })).toBe('villains');
    expect(groupOf({ id: 'b', name: 'B', tier: 'C' })).toBe('recruitable');
    expect(groupOf({ id: 'c', name: 'C' })).toBe('story');
  });

  it('who has missions of their own', () => {
    expect(hasOwnMissions('bulma', catalog)).toBe(true);
    expect(hasOwnMissions('krilin', catalog)).toBe(false);
  });

  it('fills the lines with names and numbers (criterion 8)', () => {
    expect(
      fillLines(['Batti {obiettivo} e avrai {premio}!', 'Aspetta {n} turni per {monete} monete.'], {
        target: 'Hildegarn',
        reward: 'Tapion',
        turns: 3,
        coins: 500,
      }),
    ).toEqual(['Batti Hildegarn e avrai Tapion!', 'Aspetta 3 turni per 500 monete.']);
    expect(fillLines(['Portami {obiettivo}!'], {})).toEqual(['Portami !']);
  });

  it('recognises a mission of the catalog read back from the browser', () => {
    expect(catalog.every(looksLikeCatalogMission)).toBe(true);
    expect(looksLikeCatalogMission({ ...catalog[0], giver: { group: 'heroes' } })).toBe(false);
  });
});

describe('the catalog as a file for Excel (spec 027, criterion 1)', () => {
  const sameButIds = (entries: CatalogMission[]) => entries.map(({ id: _id, ...rest }) => rest);

  it('exported and imported again it is identical', () => {
    const text = catalogToCsv(catalog, characters, testItems);
    expect(text.startsWith('﻿chi;tipo;formato')).toBe(true);
    const back = catalogFromCsv(text, characters, testItems);
    expect(back.skipped).toEqual([]);
    expect(sameButIds(back.entries)).toEqual(sameButIds(catalog));
  });

  it('rows with an unknown character, kind or item are left out and counted', () => {
    const text = [
      'chi;tipo;obiettivo;premio oggetti;battute',
      'Tapion;batti;Hildegarn;;Batti {obiettivo}!',
      'Pui Pui;combattimento;;;Ciao',
      'Krilin;volare;;;',
      'Krilin;attendi;;Fagiolo magico;',
      ';;;;',
    ].join('\n');
    const result = catalogFromCsv(text, characters, testItems);
    expect(result.entries).toHaveLength(1);
    expect(result.skipped).toEqual([
      'Riga 3: «Pui Pui» non è nella lista dei personaggi.',
      'Riga 4: tipo «volare» sconosciuto.',
      'Riga 5: oggetto «Fagiolo magico» sconosciuto.',
    ]);
  });
});

describe('the quiz questions as a file for Excel (spec 027, 2.3)', () => {
  const questions: QuestionEntry[] = [
    { id: 'q1', question: 'Chi è il padre di Goten?', answers: ['Vegeta', 'Goku', 'Gohan', 'Crilin'], correct: 1 },
    { id: 'q2', question: 'Quante sono le sfere del drago?', answers: ['5', '7', '9'], correct: 1 },
  ];

  it('exported and imported again they are identical', () => {
    const back = questionsFromCsv(questionsToCsv(questions));
    expect(back.skipped).toEqual([]);
    expect(back.entries.map(({ id: _id, ...rest }) => rest)).toEqual(
      questions.map(({ id: _id, ...rest }) => rest),
    );
  });

  it('a question without enough answers or with a wrong letter is left out', () => {
    const text = ['domanda;A;B;C;D;giusta', 'Chi?;Uno;Due;;;A', 'Cosa?;Uno;Due;Tre;;D'].join('\n');
    expect(questionsFromCsv(text).skipped).toHaveLength(2);
  });
});

describe('the level of the questions (spec 043, 2.1 and criteria 1-2)', () => {
  const leveled: QuestionEntry[] = [
    { id: 'q1', question: 'Chi è il padre di Goten?', answers: ['Vegeta', 'Goku', 'Gohan'], correct: 1, level: 'easy' },
    { id: 'q2', question: 'Chi vince il 23° Torneo?', answers: ['Piccolo', 'Goku', 'Tenshinhan'], correct: 1, level: 'medium' },
    { id: 'q3', question: 'Da quale pianeta viene Tapion?', answers: ['Konats', 'Yardrat', 'Arlia'], correct: 0, level: 'hard' },
    { id: 'q4', question: 'Quante sono le sfere del drago?', answers: ['5', '7', '9'], correct: 1 },
  ];

  it('exported with the column «livello» and imported again they are identical', () => {
    const text = questionsToCsv(leveled);
    expect(text.split('\r\n')[0]).toBe('﻿domanda;A;B;C;D;giusta;livello');
    expect(text).toContain(';B;facile');
    const back = questionsFromCsv(text);
    expect(back.skipped).toEqual([]);
    expect(back.entries.map(({ id: _id, ...rest }) => rest)).toEqual(leveled.map(({ id: _id, ...rest }) => rest));
  });

  it('a file without the column gives questions without a level', () => {
    const back = questionsFromCsv(['domanda;A;B;C;D;giusta', 'Chi?;Uno;Due;Tre;;B'].join('\n'));
    expect(back.entries).toHaveLength(1);
    expect(back.entries[0]?.level).toBeUndefined();
  });

  it('accents and capitals do not matter; an unknown level leaves the row out, with the reason', () => {
    const text = [
      'domanda;A;B;C;D;giusta;livello',
      'Chi?;Uno;Due;Tre;;B;Difficile',
      'Cosa?;Uno;Due;Tre;;A;media ',
      'Dove?;Uno;Due;Tre;;C;impossibile',
    ].join('\n');
    const back = questionsFromCsv(text);
    expect(back.entries.map((entry) => entry.level)).toEqual(['hard', 'medium']);
    expect(back.skipped).toEqual(['Riga 4: livello «impossibile» sconosciuto: facile, media o difficile.']);
  });

  it('questions saved in the browser before spec 043 are still read; an unknown level is not', () => {
    const { level: _level, ...old } = leveled[0] as QuestionEntry;
    expect(looksLikeQuestion(old)).toBe(true);
    expect(looksLikeQuestion(leveled[2])).toBe(true);
    expect(looksLikeQuestion({ ...old, level: 'impossible' })).toBe(false);
  });

  it('the count above the list, by level', () => {
    expect(questionCount(leveled)).toBe('4 domande: 1 facile, 1 media, 1 difficile, 1 senza livello.');
    const twoEasy = [leveled[0], { ...(leveled[0] as QuestionEntry), id: 'q5' }, leveled[1]] as QuestionEntry[];
    expect(questionCount(twoEasy)).toBe('3 domande: 2 facili, 1 media.');
  });
});
