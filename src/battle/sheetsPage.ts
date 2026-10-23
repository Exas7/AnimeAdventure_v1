import type { Character } from '../engine';
import {
  BLOW_DAMAGE,
  DEFAULT_SETTINGS,
  DODGE_CHANCE,
  DRAIN_IMMUNE_RACES,
  DRAIN_SHARE,
  FAIL_CHANCE,
  FINALE_COUNTER_SHARE,
  FINALE_DAMAGE,
  fighterOf,
  fightStats,
  GRAB_CHANCE,
  GRAB_DRAIN,
  MOVE_DAMAGE,
  TIER_STEP,
  type Fighter,
  type FightSettings,
} from './fight';
import { formatHp } from './playback';
import { seededRandom } from './random';
import { NORMAL_SHEET, sheetOf, type Move } from './sheets';

// The page for the community (spec 040, D-065): the sheets of the character
// list, the rules of the fight simulator with its starting values, and the
// win chances it measures. It is generated from the list, never written by
// hand; a test keeps docs/schede-personaggi.md in step.

/** Fights per measured row, with repeatable dice. */
const MEASURED_FIGHTS = 2000;
const MEASURE_SEED = 40;
/** The tier gaps of the one-on-one table, and the gap of the teams table. */
const GAPS = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 19];
const TEAM_GAP = 5;
const TEAM_SIZES = [1, 3, 5];

const LETTERS = ['E', 'D', 'C', 'B', 'A', 'S', 'SS'];

/** The sagas in story order, as in the readme of the list; others come after. */
const SAGA_ORDER = ['Dragon Ball', 'Saiyan', 'Freezer', 'Cell', 'Majin Bu', 'GT', 'Film e speciali', 'Extra'];

/** The tier of a rank, the reverse of tierRank: 13 → "A+". */
export function tierName(rank: number): string {
  const letter = Math.floor((rank + 1) / 3);
  const step = rank - letter * 3;
  return `${LETTERS[letter] ?? '?'}${step > 0 ? '+' : step < 0 ? '-' : ''}`;
}

/** The ranks of an example pair `gap` steps apart: from A+ for small gaps, from SS+ for big ones. */
function examplePair(gap: number): [number, number] {
  const stronger = gap < 10 ? 13 : 19;
  return [stronger, stronger - gap];
}

export interface MeasuredChances {
  /** One against one, normal sheets: the stronger side's share of wins by tier gap. */
  byGap: { gap: number; share: number }[];
  /** The same at TEAM_GAP, by team size. */
  bySize: { size: number; share: number }[];
}

/** What the simulator measures with the starting values, always with the same dice. */
export function measureChances(settings: FightSettings = DEFAULT_SETTINGS): MeasuredChances {
  const fighter = (rank: number) =>
    fighterOf({ id: `tier-${rank}`, name: tierName(rank), tier: tierName(rank) }) as Fighter;
  const share = (stronger: number, weaker: number, size: number, seed: number) => {
    const team = (rank: number) => Array.from({ length: size }, () => fighter(rank));
    const stats = fightStats({ a: team(stronger), b: team(weaker) }, settings, MEASURED_FIGHTS, seededRandom(seed));
    return stats.wins.a / MEASURED_FIGHTS;
  };
  const [teamStronger, teamWeaker] = examplePair(TEAM_GAP);
  return {
    byGap: GAPS.map((gap) => {
      const [stronger, weaker] = examplePair(gap);
      return { gap, share: share(stronger, weaker, 1, MEASURE_SEED + gap) };
    }),
    // One against one uses the dice of the first table, so the two tables agree.
    bySize: TEAM_SIZES.map((size) => ({
      size,
      share: share(teamStronger, teamWeaker, size, size === 1 ? MEASURE_SEED + TEAM_GAP : MEASURE_SEED + 100 + size),
    })),
  };
}

const percent = (share: number) =>
  share >= 0.99 ? `${(share * 100).toFixed(1).replace('.', ',')}%` : `${Math.round(share * 100)}%`;
const oneIn = (chance: number) => Math.round(1 / chance);
const cell = (text: string) => text.replace(/\|/g, '\\|');

function moveText(move: Move): string {
  const kind = move.kind === 'wave' ? 'onda' : move.hitsGiants ? 'impeto, colpisce i giganti' : 'impeto';
  return cell(`${move.name} (${kind}${move.drains ? ', risucchio' : ''})`);
}

function rules(settings: FightSettings): string[] {
  const tierStep = `${((TIER_STEP - 1) * 100).toFixed(1).replace('.', ',')}%`;
  return [
    '## Come funziona lo scontro',
    '',
    'Lo scontro è una serie di **scambi** fra i due personaggi in campo, in squadre da 1 a 5. Il',
    'simulatore lo calcola tutto in una volta, poi lo racconta scambio per scambio in regia e sulla',
    'stream. I numeri qui sotto sono i valori di partenza del gioco.',
    '',
    `- **Il tier decide la forza.** I tier sono 20 gradini, da E a SS+. Ogni gradino in più rende un personaggio più forte del ${tierStep}, sia nell'attaccare più spesso sia nel danno.`,
    `- **La scheda decide lo stile, non il risultato.** Barre di vita (da 3 a 5, ognuna da 10.000 HP), potenza (quanto toglie un colpo) e velocità (quanto spesso attacca e schiva), da 1 a 5, con potenza + velocità = 6. Allo stesso tier, schede diverse vincono più o meno lo stesso numero di volte: il simulatore pareggia i danni di ogni scheda contro quella normale (${NORMAL_SHEET.bars} barre, potenza ${NORMAL_SHEET.power}, velocità ${NORMAL_SHEET.speed}). Più barre vogliono dire più colpi per mandare a terra un personaggio, non più forza.`,
    `- **Gli attacchi.** A ogni scambio attacca uno dei due: chi è più veloce attacca più spesso. Di solito è un colpo normale (circa ${formatHp(BLOW_DAMAGE)} HP a tier pari e potenza 3); una volta ogni ${oneIn(settings.moveChance)} attacchi una delle due mosse base (circa ${formatHp(MOVE_DAMAGE)} HP); una volta ogni ${oneIn(settings.finaleChance)} la mossa finale (circa ${formatHp(FINALE_DAMAGE)} HP).`,
    "- **Onde e impeti.** Ogni mossa è un'onda (energia: raggi, raffiche di ki, esplosioni, bombe, massi lanciati) o un impeto (fisico: cariche, prese). Gli impeti non funzionano sui **giganti**, tranne quelli segnati «colpisce i giganti».",
    `- **Il risucchio.** Una mossa segnata «risucchio» (Drain Life) restituisce a chi la mette a segno il ${Math.round(DRAIN_SHARE * 100)}% del danno che fa, mai oltre le sue barre. Chi ha una mossa col risucchio afferra anche l'avversario: una volta ogni ${oneIn(GRAB_CHANCE)} colpi la presa gli toglie ${formatHp(GRAB_DRAIN)} HP e glieli prende. I giganti non si afferrano, e chi è di razza ${DRAIN_IMMUNE_RACES.map((race) => `«${race}»`).join(' o ')} non si risucchia. Come le altre schede, il risucchio cambia lo stile, non il risultato: il simulatore pareggia i danni di chi risucchia.`,
    `- **Come va una mossa.** Schivata il ${Math.round(DODGE_CHANCE * 100)}% delle volte (di più se chi difende è più veloce), fallita il ${Math.round(FAIL_CHANCE * 100)}%, contrastata il ${Math.round(settings.counterChance * 100)}%; altrimenti va a segno.`,
    `- **Gli scontri fra mosse.** Se la mossa è contrastata, chi difende risponde con una delle sue (con la mossa finale una volta su ${oneIn(FINALE_COUNTER_SHARE)}). Onda contro onda: vince uno dei due, a caso ma pesato su tier e potenza, e fa il 150% del danno della sua mossa. Impeto contro onda: vince sempre l'onda. Impeto contro impeto: vince uno dei due e fa il danno pieno.`,
    `- **La forma della squadra.** A inizio scontro ogni squadra tira un dado che la rende più forte o più debole per tutto lo scontro, di solito entro il ${Math.round(settings.formSpread * 100)}% in più o in meno: la giornata buona o quella storta.`,
    `- **Il cambio.** Ogni squadra ha una barra di ricarica che si riempie in ${settings.switchRecharge} scambi. A barra carica il simulatore può cambiare chi è in campo, tanto più volentieri quanta più vita recupererebbe: chi esce torna a fine barra meno 1 (da 14.300 a 19.999 HP).`,
    '- **Chi entra**, dopo un cambio o un KO: un compagno al massimo 3 gradini sotto l\'avversario in campo, a caso; se non ce n\'è, un compagno qualsiasi.',
    `- **Le trasformazioni.** Chi ha una forma successiva («si trasforma in») può trasformarsi in campo, una forma alla volta: una volta ogni ${oneIn(settings.transformChance)} scambi a vita piena, fino a 3 volte più spesso vicino al KO. Da lì combatte con tier e scheda della nuova forma, e tiene la vita che aveva; una forma con «cura trasformandosi» recupera in più quegli HP.`,
    '',
  ];
}

function chancesSection(chances: MeasuredChances): string[] {
  const [teamStronger, teamWeaker] = examplePair(TEAM_GAP);
  return [
    '## Probabilità di vittoria',
    '',
    `Misurate dal simulatore con ${formatHp(MEASURED_FIGHTS)} scontri per riga, schede normali e valori di partenza. I dadi`,
    'sono sempre gli stessi: rigenerando la pagina i numeri cambiano solo se cambiano le regole.',
    '',
    '### Uno contro uno, per distacco di tier',
    '',
    '| Distacco | Esempio | Vince il più forte |',
    '|---|---|---|',
    ...chances.byGap.map(({ gap, share }) => {
      const [stronger, weaker] = examplePair(gap);
      return `| ${gap} ${gap === 1 ? 'gradino' : 'gradini'} | ${tierName(stronger)} contro ${tierName(weaker)} | ${percent(share)} |`;
    }),
    '',
    `### In squadra, ${TEAM_GAP} gradini di distacco (${tierName(teamStronger)} contro ${tierName(teamWeaker)})`,
    '',
    '| Formato | Vince il più forte |',
    '|---|---|',
    ...chances.bySize.map(({ size, share }) => `| ${size}v${size} | ${percent(share)} |`),
    '',
  ];
}

function charactersSection(catalog: readonly Character[]): string[] {
  const fighters = catalog.filter((character) => character.tier);
  const nameOf = (id: string | undefined) => catalog.find((character) => character.id === id)?.name ?? '';
  const place = (saga: string) => (SAGA_ORDER.includes(saga) ? SAGA_ORDER.indexOf(saga) : SAGA_ORDER.length);
  const sagas = [...new Set(fighters.map((character) => character.saga ?? 'Senza saga'))].sort(
    (one, other) => place(one) - place(other),
  );
  const lines = [
    '## I personaggi',
    '',
    `${fighters.length} personaggi con un tier, divisi per saga. Prezzo: in un negozio (vuoto per chi non si vende).`,
    'Gigante: gli impeti normali non lo colpiscono. Risucchio: la mossa restituisce energia a chi la fa. Cura trasformandosi: gli HP che recupera chi si trasforma in questa forma.',
    '',
  ];
  for (const saga of sagas) {
    const members = fighters.filter((character) => (character.saga ?? 'Senza saga') === saga);
    lines.push(
      `### ${saga} (${members.length})`,
      '',
      '| Personaggio | Tier | Prezzo | Barre | Potenza | Velocità | Gigante | Mossa 1 | Mossa 2 | Mossa finale | Si trasforma in | Cura trasformandosi |',
      '|---|---|---|---|---|---|---|---|---|---|---|---|',
      ...members.map((character) => {
        const sheet = sheetOf(character);
        return `| ${[
          cell(character.name),
          character.tier as string,
          character.price === undefined ? '' : formatHp(character.price),
          String(sheet.bars),
          String(sheet.power),
          String(sheet.speed),
          sheet.giant ? 'sì' : '',
          moveText(sheet.moves[0]),
          moveText(sheet.moves[1]),
          moveText(sheet.finale),
          cell(nameOf(character.fight?.transformsInto)),
          sheet.transformHeal ? `${formatHp(sheet.transformHeal)} HP` : '',
        ].join(' | ')} |`;
      }),
      '',
    );
  }
  const others = catalog.filter((character) => !character.tier);
  lines.push(
    '## Senza tier',
    '',
    'Non combattono nel simulatore: personaggi della storia, per missioni e negozi.',
    '',
    ...others.map((character) => `- ${character.name}`),
    '',
  );
  return lines;
}

/** The whole page, in Markdown. */
export function sheetsPage(
  catalog: readonly Character[],
  chances: MeasuredChances = measureChances(),
  settings: FightSettings = DEFAULT_SETTINGS,
): string {
  return [
    '# Schede dei personaggi',
    '',
    'Le schede che il simulatore di scontro usa per ogni personaggio, e le regole con cui le usa. Mosse e',
    'trasformazioni vengono da *Dragon Ball Z: Budokai Tenkaichi 3*, con i nomi inglesi del gioco; barre,',
    'potenza e velocità le abbiamo scelte noi, in linea con il gioco. Progetto di fan, non ufficiale.',
    '',
    '> Questa pagina si genera dalla lista dei personaggi (`personaggi-bt3.csv` e `.xlsx`, in questa',
    '> cartella): non modificarla a mano, cambia la lista.',
    '',
    ...rules(settings),
    ...chancesSection(chances),
    ...charactersSection(catalog),
  ].join('\n');
}
