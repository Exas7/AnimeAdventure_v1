import type { Character } from '../engine';
import { isSpecialKeeper } from '../catalog/specialKeepers';

/** Sagas in story order (D-028). Sagas not listed here follow, alphabetically. */
export const SAGA_ORDER = [
  'Dragon Ball',
  'Saiyan',
  'Freezer',
  'Cell',
  'Majin Bu',
  'GT',
  'Film e speciali',
  'Extra',
];

/** The group of characters without a saga, always last. */
export const NO_SAGA = 'Senza saga';

/** One tile of a character menu (spec 017). */
export interface CharacterGroup {
  label: string;
  characters: Character[];
}

/**
 * Characters by saga: known sagas in story order, then the others
 * alphabetically, then those without a saga. Inside a saga the characters
 * keep the order of the imported list.
 */
export function groupBySaga(catalog: Character[]): CharacterGroup[] {
  const bySaga = new Map<string, CharacterGroup>();
  const noSaga: Character[] = [];
  for (const character of catalog) {
    const saga = character.saga?.trim();
    if (!saga) {
      noSaga.push(character);
      continue;
    }
    const key = saga.toLowerCase();
    const group = bySaga.get(key) ?? { label: saga, characters: [] };
    group.characters.push(character);
    bySaga.set(key, group);
  }
  const storyIndex = (label: string) => {
    const index = SAGA_ORDER.findIndex((saga) => saga.toLowerCase() === label.toLowerCase());
    return index === -1 ? SAGA_ORDER.length : index;
  };
  const groups = [...bySaga.values()].sort(
    (a, b) => storyIndex(a.label) - storyIndex(b.label) || a.label.localeCompare(b.label, 'it'),
  );
  return noSaga.length > 0 ? [...groups, { label: NO_SAGA, characters: noSaga }] : groups;
}

/** The starter menu: possible starters first (spec 005), then every saga. */
export function starterGroups(catalog: Character[]): CharacterGroup[] {
  const suggested = catalog.filter((character) => character.possibleStarter);
  const sagas = groupBySaga(withoutSpecialKeepers(catalog));
  return suggested.length > 0
    ? [{ label: 'Possibili starter', characters: suggested }, ...sagas]
    : sagas;
}

/** The list without the special shopkeepers, who only keep shops (D-035). */
export function withoutSpecialKeepers(catalog: Character[]): Character[] {
  return catalog.filter((character) => !isSpecialKeeper(character));
}

/**
 * The shopkeeper menu (spec 022): the shopkeepers of the list, the special
 * ones, the older versions only this episode still has, then every saga.
 * Empty groups are left out.
 */
export function keeperGroups(catalog: Character[], onlyInEpisode: string[] = []): CharacterGroup[] {
  const here = new Set(onlyInEpisode);
  const specials = catalog.filter(isSpecialKeeper);
  const groups: CharacterGroup[] = [
    {
      label: 'Negozianti',
      characters: catalog.filter((character) => character.shopkeeper && !isSpecialKeeper(character)),
    },
    { label: 'Negozianti speciali', characters: specials.filter((keeper) => !here.has(keeper.id)) },
    { label: 'Solo in questa puntata', characters: specials.filter((keeper) => here.has(keeper.id)) },
  ];
  return [
    ...groups.filter((group) => group.characters.length > 0),
    ...groupBySaga(withoutSpecialKeepers(catalog)),
  ];
}

/** Only the characters whose name contains the text; case and accents do not count. */
export function filterGroups(groups: CharacterGroup[], text: string): CharacterGroup[] {
  const wanted = searchable(text);
  if (!wanted) {
    return groups;
  }
  return groups
    .map((group) => ({
      label: group.label,
      characters: group.characters.filter((character) =>
        searchable(character.name).includes(wanted),
      ),
    }))
    .filter((group) => group.characters.length > 0);
}

/**
 * The character Enter picks in the search bar: the one whose name is the
 * text exactly, or the only one left. Null when the choice is not clear.
 */
export function searchPick(groups: CharacterGroup[], text: string): Character | null {
  const wanted = searchable(text);
  if (!wanted) {
    return null;
  }
  const found = filterGroups(groups, text).flatMap((group) => group.characters);
  const exact = found.find((character) => searchable(character.name) === wanted);
  const distinct = new Set(found.map((character) => character.id));
  return exact ?? (distinct.size === 1 ? (found[0] ?? null) : null);
}

function searchable(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}
