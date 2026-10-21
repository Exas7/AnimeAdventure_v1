import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  fighterOf,
  recordFight,
  type FightEvent,
  type Fighter,
  type FightRecord,
  type FightSnapshot,
} from './fight';
import {
  afterNextExchange,
  captionOf,
  describeStep,
  eventDuration,
  fightDuration,
  formatHp,
  snapshotAt,
} from './playback';
import { seededRandom } from './random';

const fighter = (name: string, tier: string): Fighter =>
  fighterOf({ id: name.toLowerCase(), name, tier }) as Fighter;

const goku = fighter('Goku', 'A');
const piccolo = fighter('Piccolo', 'A');
const vegeta = fighter('Vegeta', 'A');
const wave = { name: 'Kamehameha', kind: 'wave' } as const;
const rush = { name: 'Meteor Smash', kind: 'rush' } as const;
const galick = { name: 'Galick Gun', kind: 'wave' } as const;

const snapshot = (hpA: number[], hpB: number[], activeA = 0, formsA = [0, 0]): FightSnapshot => ({
  hp: { a: hpA, b: hpB },
  active: { a: activeA, b: 0 },
  gauge: { a: 0, b: 0 },
  forms: { a: formsA, b: [0] },
});

/** A short fight written by hand: Goku and Piccolo against Vegeta. */
function handMade(events: { event: FightEvent; after: FightSnapshot }[]): FightRecord {
  return {
    teams: { a: [goku, piccolo], b: [vegeta] },
    form: { a: 1, b: 1 },
    start: snapshot([40_000, 40_000], [40_000]),
    steps: events,
    winner: 'b',
  };
}

describe('telling a fight (spec 035, 2.9-2.11)', () => {
  it('HP with the dot for thousands', () => {
    expect(formatHp(19_999)).toBe('19.999');
    expect(formatHp(1_500)).toBe('1.500');
    expect(formatHp(500)).toBe('500');
  });

  it('blows take half a second; moves, clashes, switches and KOs 2 or 3 seconds', () => {
    expect(eventDuration({ type: 'blow', exchange: 1, side: 'a', damage: 1 })).toBe(500);
    const slow: FightEvent[] = [
      { type: 'move', exchange: 1, side: 'a', move: wave, finale: false, outcome: 'hit', damage: 1 },
      { type: 'move', exchange: 1, side: 'a', move: wave, finale: true, outcome: 'hit', damage: 1 },
      {
        type: 'clash',
        exchange: 1,
        side: 'a',
        move: wave,
        finale: false,
        counter: galick,
        counterFinale: false,
        kind: 'waves',
        winner: 'a',
        damage: 1,
      },
      { type: 'switch', exchange: 1, side: 'a', out: 0, in: 1, recovered: 0, immediate: false },
      { type: 'ko', exchange: 1, side: 'a', fighter: 0 },
    ];
    for (const event of slow) {
      expect(eventDuration(event)).toBeGreaterThanOrEqual(2000);
      expect(eventDuration(event)).toBeLessThanOrEqual(3000);
    }
  });

  it('a 5v5 lasts about 3 or 4 minutes at speed 1×', () => {
    const team = (tier: string) => Array.from({ length: 5 }, () => fighter('X', tier));
    const random = seededRandom(21);
    const fights = Array.from({ length: 50 }, () =>
      recordFight({ a: team('A'), b: team('A') }, DEFAULT_SETTINGS, random),
    );
    const minutes = fights.reduce((total, record) => total + fightDuration(record), 0) / fights.length / 60_000;
    expect(minutes).toBeGreaterThanOrEqual(2.5);
    expect(minutes).toBeLessThanOrEqual(4.5);
  });

  it('"Avanti di uno scambio" shows every event of the next exchange', () => {
    const record = handMade([
      { event: { type: 'blow', exchange: 1, side: 'a', damage: 1_000 }, after: snapshot([40_000, 40_000], [39_000]) },
      {
        event: { type: 'switch', exchange: 2, side: 'a', out: 0, in: 1, recovered: 0, immediate: true },
        after: snapshot([40_000, 40_000], [39_000], 1),
      },
      { event: { type: 'blow', exchange: 2, side: 'b', damage: 2_000 }, after: snapshot([40_000, 38_000], [39_000], 1) },
    ]);
    expect(afterNextExchange(record, 0)).toBe(1);
    expect(afterNextExchange(record, 1)).toBe(3);
    expect(afterNextExchange(record, 3)).toBe(3);
    expect(snapshotAt(record, 0)).toBe(record.start);
    expect(snapshotAt(record, 2).active.a).toBe(1);
  });

  it('the log and the stream name who was on the field at that moment', () => {
    const start = snapshot([40_000, 40_000], [40_000]);
    const record = handMade([
      { event: { type: 'blow', exchange: 1, side: 'a', damage: 1_523 }, after: snapshot([40_000, 40_000], [38_477]) },
      {
        event: { type: 'move', exchange: 2, side: 'a', move: wave, finale: false, outcome: 'hit', damage: 9_120 },
        after: start,
      },
      {
        event: { type: 'move', exchange: 3, side: 'b', move: galick, finale: true, outcome: 'dodged', damage: 0 },
        after: start,
      },
      {
        event: { type: 'move', exchange: 4, side: 'a', move: rush, finale: false, outcome: 'giant', damage: 0 },
        after: start,
      },
      {
        event: {
          type: 'clash',
          exchange: 5,
          side: 'a',
          move: wave,
          finale: false,
          counter: galick,
          counterFinale: false,
          kind: 'waves',
          winner: 'b',
          damage: 13_500,
        },
        after: start,
      },
      {
        event: {
          type: 'clash',
          exchange: 6,
          side: 'a',
          move: rush,
          finale: false,
          counter: galick,
          counterFinale: true,
          kind: 'rushVsWave',
          winner: 'b',
          damage: 9_000,
        },
        after: snapshot([14_300, 40_000], [40_000]),
      },
      {
        event: { type: 'switch', exchange: 7, side: 'a', out: 0, in: 1, recovered: 5_699, immediate: false },
        after: snapshot([19_999, 40_000], [40_000], 1),
      },
      { event: { type: 'ko', exchange: 8, side: 'a', fighter: 1 }, after: snapshot([19_999, 0], [40_000], 1) },
      { event: { type: 'enter', exchange: 8, side: 'a', fighter: 0 }, after: snapshot([19_999, 0], [40_000]) },
      { event: { type: 'end', exchange: 9, winner: 'b' }, after: snapshot([0, 0], [40_000]) },
    ]);
    expect(record.steps.map((_, index) => describeStep(record, index))).toEqual([
      'Goku colpisce Vegeta: −1.523',
      'Goku: Kamehameha! A segno: −9.120',
      'Vegeta, mossa finale: Galick Gun! Goku la schiva',
      'Goku: Meteor Smash! Non funziona sui giganti',
      'Goku: Kamehameha! Vegeta risponde con Galick Gun: scontro di onde, vince Vegeta: −13.500 (150%) a Goku',
      "Goku: Meteor Smash! Vegeta risponde con Galick Gun (mossa finale): l'onda travolge l'impeto, −9.000 a Goku",
      'Cambio: esce Goku (torna a 19.999 HP), entra Piccolo',
      'KO! Piccolo è a terra',
      'Entra Goku',
      'Vince la Squadra B!',
    ]);
    expect(record.steps.map((_, index) => captionOf(record, index))).toEqual([
      null,
      { title: 'KAMEHAMEHA!', detail: 'Goku · A segno: −9.120' },
      { title: 'GALICK GUN!', detail: 'Vegeta, mossa finale · Schivata!' },
      { title: 'METEOR SMASH!', detail: 'Goku · Non funziona sui giganti!' },
      { title: 'SCONTRO DI ONDE!', detail: 'Kamehameha contro Galick Gun · vince Vegeta: −13.500 (150%)' },
      { title: "L'ONDA TRAVOLGE L'IMPETO!", detail: 'Meteor Smash contro Galick Gun · vince Vegeta: −9.000' },
      { title: 'CAMBIO!', detail: 'Esce Goku, entra Piccolo' },
      { title: 'KO!', detail: 'Piccolo è a terra' },
      { title: 'IN CAMPO!', detail: 'Goku' },
      { title: 'VINCE LA SQUADRA B!', detail: '' },
    ]);
  });

  it('a transformation is told with the new name, and so is everything after it (spec 037, 2.3)', () => {
    const gokuWithForm: Fighter = { ...goku, next: fighter('Goku SSJ', 'A+') };
    const forms = (a: number): FightSnapshot => ({
      hp: { a: [40_000], b: [40_000] },
      active: { a: 0, b: 0 },
      gauge: { a: 0, b: 0 },
      forms: { a: [a], b: [0] },
    });
    const record: FightRecord = {
      teams: { a: [gokuWithForm], b: [vegeta] },
      form: { a: 1, b: 1 },
      start: forms(0),
      steps: [
        { event: { type: 'transform', exchange: 1, side: 'a', fighter: 0 }, after: forms(1) },
        { event: { type: 'blow', exchange: 1, side: 'a', damage: 1_000 }, after: forms(1) },
      ],
      winner: 'a',
    };
    expect(describeStep(record, 0)).toBe('Goku si trasforma: Goku SSJ!');
    expect(describeStep(record, 1)).toBe('Goku SSJ colpisce Vegeta: −1.000');
    expect(captionOf(record, 0)).toEqual({ title: 'TRASFORMAZIONE!', detail: 'Goku → Goku SSJ' });
    expect(eventDuration({ type: 'transform', exchange: 1, side: 'a', fighter: 0 })).toBe(2500);
  });
});

