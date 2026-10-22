import { tierRank } from '../episode/fill';

// How an energy wave looks in the simulated fight (spec 062): the shape of
// the move, the colour of the aura of who throws it, how big it is and
// whether lightning runs around it.

/** The aura of a character, as the outline of its figure (spec 051, 2.1). */
export type Aura = 'white' | 'gold' | 'purple' | 'green' | 'aqua' | 'pink' | 'red' | 'dabura';

/** The glow of each aura; the core of every wave is white. Dabura's red has a dark halo. */
export const AURA_COLORS: Record<Aura, { color: string; halo: string }> = {
  white: { color: '#4fc3ff', halo: '#a8e4ff' },
  gold: { color: '#ffb800', halo: '#ffe066' },
  purple: { color: '#a646ff', halo: '#d29bff' },
  green: { color: '#1ee85a', halo: '#8dffa6' },
  aqua: { color: '#16e8d6', halo: '#8ffbf1' },
  pink: { color: '#ff4fc6', halo: '#ffa3e2' },
  red: { color: '#ff2020', halo: '#ff7a7a' },
  dabura: { color: '#ff2a2a', halo: '#1a0000' },
};

/**
 * The aura by the name of the form, with the rules of spec 051: white for
 * everyone except the Super Saiyan forms and the Gogeta (gold), Freeza and
 * his family (purple), Cell, Legendary Broli and Bojack transformed
 * (green), Broli SSJ (aqua), the Buu and Uub (pink), the SSJ4 and Super
 * C-13 (red), Dabura (red, dark halo).
 */
export function auraOf(name: string): Aura {
  if (/^Dabura\b/.test(name)) {
    return 'dabura';
  }
  if ((/\bSSJ4\b/.test(name) && !/\bGogeta\b/.test(name)) || /^Super C-13\b/.test(name)) {
    return 'red';
  }
  if (/^Broli SSJ$/.test(name)) {
    return 'aqua';
  }
  if (/^Broli Super Saiyan Leggendario\b/.test(name) || /^Cell\b/.test(name) || /^Bojack \(massima potenza\)/.test(name)) {
    return 'green';
  }
  if (/\b(Freeza|Cooler)\b/.test(name) || /^Re Cold\b/.test(name)) {
    return 'purple';
  }
  if (/\b(Buu|Uub)\b/.test(name)) {
    return 'pink';
  }
  if (
    /\bSSJ\d?\b/.test(name) ||
    /^Super (Vegeta|Trunks|Vegetto|Baby)\b/.test(name) ||
    /^Majin Vegeta\b/.test(name) ||
    /\bGogeta\b/.test(name) ||
    /^Hildegarn\b/.test(name) ||
    /^Baby Oozaru\b/.test(name)
  ) {
    return 'gold';
  }
  return 'white';
}

/** A ray with the charge on the hands, an energy ball, or a thin ray from a finger. */
export type WaveShape = 'beam' | 'ball' | 'thin';

/** Moves that in the anime are energy balls (spec 062, 2.1). */
const BALL = /\b(Bomb|Bomber|Ball|Supernova|Big Bang Attack|Meteor|Planet Burst|Omega Blaster|Soukidan|Destroy The Planet)\b/i;
/** Moves shot from a finger: thin rays. */
const THIN = /\b(Death Beam|Finger Beam|Special Beam Cannon|Dodon|Eye Beam|Chocolate Beam|Execution Beam|Devilmite Beam|Death Saucer|Destructo Disc)\b/i;
/** The biggest of all, Gogeta SSJ4's (spec 062, 2.2). */
const HUGE = /^100x Big Bang Kamehameha$/i;

export function waveShape(moveName: string): WaveShape {
  if (THIN.test(moveName)) {
    return 'thin';
  }
  return BALL.test(moveName) ? 'ball' : 'beam';
}

/** Lightning from tier A+ up: Perfect Cell, the SSJ2 (spec 062, 2.2). */
export const LIGHTNING_FROM = tierRank('A+') as number;
const TOP_RANK = tierRank('SS+') as number;

export interface WaveLook {
  shape: WaveShape;
  aura: Aura;
  color: string;
  halo: string;
  /** 1 is an average wave: from 0.7 (tier E) to 1.5 (SS+), 2.2 for the biggest. */
  size: number;
  lightning: boolean;
}

/** How the wave of a move looks, thrown by a fighter of this name and rank. */
export function waveLook(fighter: { name: string; rank: number }, moveName: string): WaveLook {
  const aura = auraOf(fighter.name);
  const rank = Math.min(TOP_RANK, Math.max(0, fighter.rank));
  return {
    shape: waveShape(moveName),
    aura,
    ...AURA_COLORS[aura],
    size: HUGE.test(moveName.trim()) ? 2.2 : 0.7 + (0.8 * rank) / TOP_RANK,
    lightning: fighter.rank >= LIGHTNING_FROM,
  };
}
