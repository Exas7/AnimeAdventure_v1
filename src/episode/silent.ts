import type { Character } from '../engine';
import type { Random } from './fill';

// Spec 090: who does not speak in the story does not speak in a cell either. A
// character drawn for a group mission (or for no catalog mission at all) gets
// his cries, not the lines of the group; the missions written for him keep theirs.

const OOZARU_ROARS = [
  'GROOOAAAR!',
  'RAAAAARGH!',
  'GRAAAAAAH!',
  'ROOOAAAAR!',
  'GRRRRR... GRAAAWR!',
  'AAARGHHH!',
  'HUAAAARGH!',
  'GRRAAAAAWR!',
  'ROAAAAAAR!',
  'GRRRROOOOAAAR!',
];
const SAIBAIMAN_CACKLES = ['KEKEKEKE!', 'KYAKYAKYA!', 'KIII-KIII-KIII!', 'KEH-KEH-KEH!'];
const KID_BUU_SHRIEKS = ['AHAHAHAHAH!', 'BUUUUUU!', 'HIIIIII-YAAAH!', 'BUU! BUU! BUUUU!'];
const JANEMBA_SOUNDS = ['(Ghigna e fa un verso gutturale.)', "(Un ruggito basso fa tremare l'aria.)", '(Emette uno stridio sinistro.)'];
const BROLI_STARES = [
  '(Fissa il vuoto, senza dire una parola.)',
  '(Resta immobile, con lo sguardo perso nel vuoto.)',
  '(Non parla: guarda nel vuoto.)',
];
const BROLI_LEGENDARY = ['Kakaroth... KAKAROTH!', 'KAKAROTH!', 'KAKAROTH... KAKAROTH!'];

/** The cries of a character who does not speak, or null for one who does. */
function voiceOf(character: Character): readonly string[] | null {
  const name = character.name;
  if (/oozaru/i.test(name) || /^hildegarn/i.test(name)) {
    return OOZARU_ROARS;
  }
  if (/^saibaiman/i.test(name)) {
    return SAIBAIMAN_CACKLES;
  }
  if (/^majin buu \(puro\)$/i.test(name)) {
    return KID_BUU_SHRIEKS;
  }
  if (/^(super )?janemba/i.test(name)) {
    return JANEMBA_SOUNDS;
  }
  if (/^broli.*leggendario/i.test(name)) {
    return BROLI_LEGENDARY;
  }
  if (/^broli/i.test(name)) {
    return BROLI_STARES;
  }
  return null;
}

export function isSilent(character: Character): boolean {
  return voiceOf(character) !== null;
}

/** `count` different cries (or as many as there are) for the character; null when he speaks. */
export function silentLines(character: Character, count: number, random: Random): string[] | null {
  const voice = voiceOf(character);
  if (!voice) {
    return null;
  }
  const pool = [...voice];
  const lines: string[] = [];
  for (let index = 0; index < Math.max(1, count) && pool.length > 0; index += 1) {
    lines.push(pool.splice(Math.floor(random() * pool.length), 1)[0] as string);
  }
  return lines;
}
