import { looksLikeMission, type Character, type Mission, type QuizQuestion } from '../engine';

// The catalog of missions calibrated on the characters (spec 027, D-041):
// kept in the browser, edited in the app or in Excel through a CSV file.

/** Who gets the missions of a group: those without missions of their own. */
export type MissionGroup = 'villains' | 'recruitable' | 'story';

export const MISSION_GROUPS: { group: MissionGroup; label: string }[] = [
  { group: 'villains', label: 'cattivi' },
  { group: 'recruitable', label: 'arruolabili' },
  { group: 'story', label: 'storia' },
];

/** A mission of the catalog: who gives it, the mission, its lines and how often it comes out. */
export interface CatalogMission {
  id: string;
  /** A character's code, or a group (spec 027, 2.1). */
  giver: { characterId: string } | { group: MissionGroup };
  /**
   * The mission as a model: an empty target, format or question is chosen by
   * "Randomizza" when it puts the mission in a cell.
   */
  mission: Mission;
  /** Lines with {obiettivo}, {premio}, {n} and {monete}, filled by "Randomizza". */
  lines: string[];
  /** Chains on locked paths: who goes behind the path this cell opens (Cooler → Metal Cooler). */
  behindId?: string;
  /** How often it comes out among the missions of the same giver. */
  weight: number;
}

/** A question of the quiz library (spec 027, 2.3). */
export interface QuestionEntry extends QuizQuestion {
  id: string;
}

export function newCatalogId(): string {
  return crypto.randomUUID();
}

/** The group of a character: villains first, then recruitable (with a tier), then story characters. */
export function groupOf(character: Character): MissionGroup {
  if (character.villain) {
    return 'villains';
  }
  return character.tier ? 'recruitable' : 'story';
}

/** The missions written for this very character. */
export function ownMissions(characterId: string, catalog: CatalogMission[]): CatalogMission[] {
  return catalog.filter(
    (entry) => 'characterId' in entry.giver && entry.giver.characterId === characterId,
  );
}

/** The missions of the character's group: villains, recruitable or story characters. */
export function groupMissions(character: Character, catalog: CatalogMission[]): CatalogMission[] {
  const group = groupOf(character);
  return catalog.filter((entry) => 'group' in entry.giver && entry.giver.group === group);
}

/** A character with missions of their own in the catalog. */
export function hasOwnMissions(characterId: string, catalog: CatalogMission[]): boolean {
  return ownMissions(characterId, catalog).length > 0;
}

/** The values the lines can mention. */
export interface LineValues {
  target?: string;
  reward?: string;
  turns?: number;
  coins?: number;
}

/** "Portami {obiettivo} e avrai {premio}!" with the names and numbers of the cell. */
export function fillLines(lines: string[], values: LineValues): string[] {
  return lines.map((line) =>
    line
      .replaceAll('{obiettivo}', values.target ?? '')
      .replaceAll('{premio}', values.reward ?? '')
      .replaceAll('{n}', values.turns === undefined ? '' : String(values.turns))
      .replaceAll('{monete}', values.coins === undefined ? '' : String(values.coins))
      .replace(/\s{2,}/g, ' ')
      .trim(),
  );
}

/** Checks the shape of a catalog mission read back from the browser. */
export function looksLikeCatalogMission(value: unknown): value is CatalogMission {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const entry = value as Record<string, unknown>;
  const giver = entry.giver as Record<string, unknown> | undefined;
  return (
    typeof entry.id === 'string' &&
    typeof giver === 'object' &&
    giver !== null &&
    (typeof giver.characterId === 'string' ||
      MISSION_GROUPS.some((group) => group.group === giver.group)) &&
    looksLikeMission(entry.mission) &&
    Array.isArray(entry.lines) &&
    entry.lines.every((line) => typeof line === 'string') &&
    (entry.behindId === undefined || typeof entry.behindId === 'string') &&
    typeof entry.weight === 'number'
  );
}

/** Checks the shape of a question read back from the browser. */
export function looksLikeQuestion(value: unknown): value is QuestionEntry {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === 'string' &&
    typeof entry.question === 'string' &&
    Array.isArray(entry.answers) &&
    entry.answers.every((answer) => typeof answer === 'string') &&
    typeof entry.correct === 'number'
  );
}
