import {
  type ChallengeFormat,
  type Character,
  type ItemDefinition,
  type Mission,
  type MissionReward,
  type MissionType,
} from '../engine';
import { parseCsv } from '../catalog/csv';
import { characterIdOf } from '../catalog/importCatalog';
import {
  MISSION_GROUPS,
  newCatalogId,
  QUESTION_LEVELS,
  type CatalogMission,
  type MissionGroup,
  type QuestionEntry,
} from './catalog';

// The catalog and the questions as CSV files for Excel (D-041): one mission
// or question per row, semicolons as Italian Excel expects, lists inside a
// cell separated by " | ".

export const CATALOG_COLUMNS = [
  'chi',
  'tipo',
  'formato',
  'condizione',
  'avversari',
  'obiettivo',
  'e torna',
  'turni',
  'testo',
  'recluta',
  'premio personaggi',
  'premio monete',
  'premio oggetti',
  'dietro',
  'peso',
  'battute',
] as const;

export const QUESTION_COLUMNS = ['domanda', 'A', 'B', 'C', 'D', 'giusta', 'livello'] as const;

const TYPE_NAMES: Record<MissionType, string> = {
  fight: 'combattimento',
  quiz: 'quiz',
  goTo: 'vai da',
  defeat: 'batti',
  bring: 'porta',
  wait: 'attendi',
  skipTurns: 'salta turni',
  other: 'altro',
};

const LIST_SEPARATOR = ' | ';
const YES = new Set(['si', 'x', 'yes', 'true', '1']);
const LETTERS = ['A', 'B', 'C', 'D'];

/** The result of reading a file: what was read, and the rows left out with the reason. */
export interface CsvImport<T> {
  entries: T[];
  skipped: string[];
}

/** The catalog as a CSV file that Excel opens directly. */
export function catalogToCsv(
  catalog: CatalogMission[],
  characters: Character[],
  items: ItemDefinition[],
): string {
  const name = (id: string) => characters.find((character) => character.id === id)?.name ?? id;
  const names = (ids: string[] | undefined) => (ids ?? []).map(name).join(LIST_SEPARATOR);
  const rows = catalog.map((entry) => {
    const { mission } = entry;
    const giver =
      'characterId' in entry.giver
        ? name(entry.giver.characterId)
        : (MISSION_GROUPS.find((group) => group.group === (entry.giver as { group: MissionGroup }).group)?.label ?? '');
    return [
      giver,
      TYPE_NAMES[mission.type],
      mission.format ?? '',
      mission.type === 'fight' ? (mission.condition === 'transform' ? 'trasformazione' : 'vincere') : '',
      names(mission.opponents),
      mission.targetId ? name(mission.targetId) : '',
      mission.returnToGiver ? 'sì' : '',
      mission.turns === undefined ? '' : String(mission.turns),
      mission.text ?? '',
      mission.reward.cellCharacter ? 'sì' : '',
      names(mission.reward.characters),
      mission.reward.coins ? String(mission.reward.coins) : '',
      (mission.reward.items ?? [])
        .map((id) => items.find((item) => item.id === id)?.name ?? id)
        .join(LIST_SEPARATOR),
      entry.behindId ? name(entry.behindId) : '',
      String(entry.weight),
      entry.lines.join(LIST_SEPARATOR),
    ];
  });
  return toCsv([[...CATALOG_COLUMNS], ...rows]);
}

/**
 * Reads the catalog back from a CSV. Rows with a character not in the
 * list, an unknown kind or an unknown item are left out and listed.
 */
export function catalogFromCsv(
  text: string,
  characters: Character[],
  items: ItemDefinition[],
): CsvImport<CatalogMission> {
  const rows = parseCsv(text);
  const header = (rows[0] ?? []).map(normalize);
  const at = (row: string[], column: string) => {
    const index = header.indexOf(normalize(column));
    return index === -1 ? '' : (row[index] ?? '').trim();
  };
  const known = new Set(characters.map((character) => character.id));
  const entries: CatalogMission[] = [];
  const skipped: string[] = [];

  rows.slice(1).forEach((row, index) => {
    if (row.every((field) => field.trim() === '')) {
      return;
    }
    const rowNumber = index + 2;
    const problems: string[] = [];
    const character = (name: string) => {
      const id = characterIdOf(name);
      if (!known.has(id)) {
        problems.push(`«${name}» non è nella lista dei personaggi`);
      }
      return id;
    };
    const characterList = (cell: string) => list(cell).map(character);

    const who = at(row, 'chi');
    const group = MISSION_GROUPS.find((entry) => entry.label === normalize(who))?.group;
    const giver = group ? { group } : who ? { characterId: character(who) } : undefined;
    if (!giver) {
      problems.push('manca chi dà la missione');
    }
    const type = (Object.keys(TYPE_NAMES) as MissionType[]).find(
      (key) => TYPE_NAMES[key] === normalize(at(row, 'tipo')),
    );
    if (!type) {
      problems.push(`tipo «${at(row, 'tipo')}» sconosciuto`);
    }
    const format = at(row, 'formato');
    if (format && !['1v1', '2v2', '3v3'].includes(format)) {
      problems.push(`formato «${format}» sconosciuto`);
    }
    const turns = at(row, 'turni');
    const coins = at(row, 'premio monete');
    const weight = at(row, 'peso');
    for (const [label, value] of [['turni', turns], ['premio monete', coins], ['peso', weight]]) {
      if (value && !/^-?\d+$/.test(value.replace(/\./g, ''))) {
        problems.push(`«${label}» non è un numero`);
      }
    }
    const itemIds = list(at(row, 'premio oggetti')).map((itemName) => {
      const item = items.find((candidate) => normalize(candidate.name) === normalize(itemName));
      if (!item) {
        problems.push(`oggetto «${itemName}» sconosciuto`);
      }
      return item?.id ?? itemName;
    });

    const opponents = characterList(at(row, 'avversari'));
    const target = at(row, 'obiettivo');
    const rewardCharacters = characterList(at(row, 'premio personaggi'));
    const behind = at(row, 'dietro');

    if (problems.length > 0 || !giver || !type) {
      skipped.push(`Riga ${rowNumber}: ${problems.join('; ')}.`);
      return;
    }
    const reward: MissionReward = {};
    if (YES.has(normalize(at(row, 'recluta')))) {
      reward.cellCharacter = true;
    }
    if (rewardCharacters.length > 0) {
      reward.characters = rewardCharacters;
    }
    if (coins) {
      reward.coins = number(coins);
    }
    if (itemIds.length > 0) {
      reward.items = itemIds;
    }
    const mission: Mission = { type, reward };
    if (format) {
      mission.format = format as ChallengeFormat;
    }
    if (type === 'fight') {
      mission.condition = normalize(at(row, 'condizione')).startsWith('trasform') ? 'transform' : 'win';
    }
    if (opponents.length > 0) {
      mission.opponents = opponents;
    }
    if (target) {
      mission.targetId = character(target);
    }
    if (type === 'goTo') {
      mission.returnToGiver = YES.has(normalize(at(row, 'e torna')));
    }
    if (turns) {
      mission.turns = number(turns);
    }
    if (at(row, 'testo')) {
      mission.text = at(row, 'testo');
    }
    entries.push({
      id: newCatalogId(),
      giver,
      mission,
      lines: list(at(row, 'battute')),
      ...(behind ? { behindId: character(behind) } : {}),
      weight: weight ? Math.max(0, number(weight)) : 1,
    });
  });
  return { entries, skipped };
}

/** The questions as a CSV file: question, answers A to D, the letter of the right one, the level. */
export function questionsToCsv(questions: QuestionEntry[]): string {
  const rows = questions.map((entry) => [
    entry.question,
    ...LETTERS.map((_, index) => entry.answers[index] ?? ''),
    LETTERS[entry.correct] ?? '',
    QUESTION_LEVELS.find((level) => level.level === entry.level)?.label ?? '',
  ]);
  return toCsv([[...QUESTION_COLUMNS], ...rows]);
}

/**
 * Reads the questions back: at least three answers, and the right one among
 * them. The level may be missing (a file from before spec 043), never unknown.
 */
export function questionsFromCsv(text: string): CsvImport<QuestionEntry> {
  const rows = parseCsv(text);
  const entries: QuestionEntry[] = [];
  const skipped: string[] = [];
  rows.slice(1).forEach((row, index) => {
    if (row.every((field) => field.trim() === '')) {
      return;
    }
    const [question = '', ...rest] = row.map((field) => field.trim());
    const answers = rest.slice(0, 4).filter((answer) => answer !== '');
    const correct = LETTERS.indexOf((rest[4] ?? '').toUpperCase());
    if (!question || answers.length < 3 || correct === -1 || correct >= answers.length) {
      skipped.push(
        `Riga ${index + 2}: servono la domanda, almeno tre risposte e la lettera della risposta giusta.`,
      );
      return;
    }
    const levelText = rest[5] ?? '';
    const level = QUESTION_LEVELS.find((entry) => entry.label === normalize(levelText))?.level;
    if (levelText && !level) {
      skipped.push(`Riga ${index + 2}: livello «${levelText}» sconosciuto: facile, media o difficile.`);
      return;
    }
    entries.push({ id: newCatalogId(), question, answers, correct, ...(level ? { level } : {}) });
  });
  return { entries, skipped };
}

/** Semicolons, quotes where needed, the byte order mark Excel wants for UTF-8. */
function toCsv(rows: string[][]): string {
  const field = (value: string) =>
    /[;"\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  return `﻿${rows.map((row) => row.map(field).join(';')).join('\r\n')}\r\n`;
}

function list(cell: string): string[] {
  return cell
    .split('|')
    .map((part) => part.trim())
    .filter((part) => part !== '');
}

function number(text: string): number {
  return Number(text.replace(/\./g, ''));
}

/** Lower case, no accents, single spaces: "Sì" and "si" are the same. */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
