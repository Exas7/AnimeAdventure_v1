/**
 * What to play in "Nuova partita": a prepared episode (D-019), a map of the
 * library (D-018) or a base map that comes with the app (D-045).
 */
export type MapKind = 'episode' | 'map' | 'included';

export interface MapChoice {
  id: string;
  name: string;
  kind: MapKind;
}

export interface MapGroup {
  kind: MapKind;
  label: string;
  description: string;
}

/** The three tiles of "Nuova partita", in their order; one without choices is not shown (spec 033, 2.1). */
export const MAP_GROUPS: readonly MapGroup[] = [
  {
    kind: 'episode',
    label: 'Puntate',
    description: 'personaggi, negozi e missioni già messi',
  },
  {
    kind: 'map',
    label: 'Le mie mappe',
    description: 'disegnate da te: senza «Randomizza tutto» le Caselle personaggio restano vuote',
  },
  {
    kind: 'included',
    label: 'Mappe base',
    description: "vengono con l'app: senza «Randomizza tutto» le Caselle personaggio restano vuote",
  },
];

/** The choices in the order of the tiles: the first one is proposed when the screen opens. */
export function orderChoices(choices: readonly MapChoice[]): MapChoice[] {
  return MAP_GROUPS.flatMap((group) => choices.filter((choice) => choice.kind === group.kind));
}

// Which tiles are closed: a preference kept in Chrome (D-050).
const CLOSED_KEY = 'anime-adventure:new-game:closed-groups';

/** The closed tiles written in Chrome; nothing, or something unreadable, means all open. */
export function parseClosedGroups(raw: string | null): Set<MapKind> {
  if (!raw) {
    return new Set();
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    // Not ours, or damaged: the tiles start open, as the first time.
    return new Set();
  }
  const kinds = MAP_GROUPS.map((group) => group.kind);
  return new Set(
    Array.isArray(value) ? kinds.filter((kind) => value.includes(kind)) : [],
  );
}

export function serializeClosedGroups(closed: ReadonlySet<MapKind>): string {
  return JSON.stringify(MAP_GROUPS.map((group) => group.kind).filter((kind) => closed.has(kind)));
}

type Preferences = Pick<Storage, 'getItem' | 'setItem'>;

/** Chrome's storage for preferences, or undefined where the page may not use it. */
export function browserPreferences(): Preferences | undefined {
  try {
    return window.localStorage;
  } catch {
    // Blocked site data: the preferences are simply not remembered.
    return undefined;
  }
}

export function readClosedGroups(preferences: Preferences | undefined): Set<MapKind> {
  try {
    return parseClosedGroups(preferences?.getItem(CLOSED_KEY) ?? null);
  } catch {
    // Storage that refuses to be read: all open, as the first time.
    return new Set();
  }
}

/** False when Chrome refused: the tiles stay as chosen, but only until the screen closes. */
export function writeClosedGroups(preferences: Preferences | undefined, closed: ReadonlySet<MapKind>): boolean {
  if (!preferences) {
    return false;
  }
  try {
    preferences.setItem(CLOSED_KEY, serializeClosedGroups(closed));
    return true;
  } catch {
    // Full or blocked storage: nothing is lost but the memory of the tiles.
    return false;
  }
}
