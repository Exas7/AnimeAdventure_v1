import { describe, expect, it } from 'vitest';
import { includedCatalog } from '../included/includedLists';
import {
  BAR_HP,
  chooseEntrant,
  CLASH_DAMAGE,
  clashKind,
  DEFAULT_SETTINGS,
  fighterOf,
  fightStats,
  hpAfterSwitch,
  otherSide,
  recordFight,
  runFight,
  transformationsOf,
  transformChance,
  worksOn,
  type FightEvent,
  type Fighter,
  type FightRecord,
  type FightSnapshot,
  type Side,
} from './fight';
import { seededRandom } from './random';
import charactersCsv from '../../docs/personaggi-bt3.csv?raw';
import { importCatalog } from '../catalog/importCatalog';
import type { Character } from '../engine';
import { fighterAt } from './playback';
import type { Move } from './sheets';

const catalog = includedCatalog();

function fighter(id: string): Fighter {
  const character = catalog.find((entry) => entry.id === id);
  const result = character ? fighterOf(character) : null;
  if (!result) {
    throw new Error(`No fighter "${id}" in the list`);
  }
  return result;
}

/** A fighter with the normal sheet. */
const normal = (tier: string): Fighter => fighterOf({ id: `normal-${tier}`, name: tier, tier }) as Fighter;
const team = (size: number, tier: string) => Array.from({ length: size }, () => normal(tier));

function winShare(a: Fighter[], b: Fighter[], fights: number, seed: number): number {
  return fightStats({ a, b }, DEFAULT_SETTINGS, fights, seededRandom(seed)).wins.a / fights;
}

function records(a: Fighter[], b: Fighter[], fights: number, seed: number): FightRecord[] {
  const random = seededRandom(seed);
  return Array.from({ length: fights }, () => recordFight({ a, b }, DEFAULT_SETTINGS, random));
}

/** Each step with the state just before it. */
function withBefore(record: FightRecord) {
  return record.steps.map((step, index) => ({
    ...step,
    before: index === 0 ? record.start : (record.steps[index - 1]?.after as FightSnapshot),
  }));
}

const onField = (record: FightRecord, snapshot: FightSnapshot, side: Side) =>
  record.teams[side][snapshot.active[side]] as Fighter;

describe('who wins (spec 035, criteria 1-3)', () => {
  it('C1: A+ against B- wins between 75% and 85%, in 1v1, 3v3 and 5v5', () => {
    for (const size of [1, 3, 5]) {
      const share = winShare(team(size, 'A+'), team(size, 'B-'), 3000, size);
      expect(share).toBeGreaterThanOrEqual(0.75);
      expect(share).toBeLessThanOrEqual(0.85);
    }
    // 9,000 fights take under 1 s alone, more than 5 s right after a fresh «npm ci» (spec 095): 30 s.
  }, 30_000);

  it('A+ beats B- more often than A and A- do (spec 035, 1)', () => {
    const shares = ['A+', 'A', 'A-'].map((tier) => winShare([normal(tier)], [normal('B-')], 4000, 7));
    expect(shares[0]).toBeGreaterThan(shares[1] as number);
    expect(shares[1]).toBeGreaterThan(shares[2] as number);
  });

  it('C2: the same tier wins about half the time; Gogeta SSJ4 beats Mr. Satan at least 99%', () => {
    const share = winShare([normal('A')], [normal('A')], 4000, 2);
    expect(share).toBeGreaterThanOrEqual(0.45);
    expect(share).toBeLessThanOrEqual(0.55);
    expect(winShare([fighter('gogeta-ssj4')], [fighter('mr-satan')], 4000, 3)).toBeGreaterThanOrEqual(0.99);
  });

  it('C3: same tier, different sheets (giant included): nobody wins more than 60%', () => {
    const tierA = ['son-goku-meta-ssj', 'son-goten-ssj', 'vegeta-scouter-oozaru'].map(fighter);
    for (const one of tierA) {
      for (const other of tierA.filter((entry) => entry !== one)) {
        const share = winShare([one], [other], 3000, 4);
        expect(share).toBeGreaterThanOrEqual(0.4);
        expect(share).toBeLessThanOrEqual(0.6);
      }
    }
  });
});

describe('switches and who enters (spec 035, criteria 4-7)', () => {
  it('C4: leaving the field brings HP to the end of the bar minus 1, never beyond the full bar', () => {
    expect(hpAfterSwitch(14_300, 40_000)).toBe(19_999);
    expect(hpAfterSwitch(19_999, 40_000)).toBe(19_999);
    expect(hpAfterSwitch(20_000, 40_000)).toBe(29_999);
    expect(hpAfterSwitch(40_000, 40_000)).toBe(40_000);
    expect(hpAfterSwitch(35_000, 40_000)).toBe(39_999);
    expect(hpAfterSwitch(25_000, 30_000)).toBe(29_999);
  });

  it('C5: against an SS a teammate from S up enters if there is one (every + and - counts)', () => {
    const rank = (tier: string) => normal(tier).rank;
    for (const roll of [0, 0.3, 0.6, 0.99]) {
      expect(chooseEntrant([rank('S-'), rank('S'), rank('B')], rank('SS'), () => roll)).toBe(1);
    }
    // Against SS+ an S is not enough; against SS- an S- is.
    for (const roll of [0, 0.5, 0.99]) {
      expect(chooseEntrant([rank('S'), rank('S+')], rank('SS+'), () => roll)).toBe(1);
    }
    expect(chooseEntrant([rank('C'), rank('S-')], rank('SS-'), () => 0)).toBe(1);
  });

  it('C5: with nobody up to it, anyone may enter', () => {
    const ranks = ['C', 'B', 'A'].map((tier) => normal(tier).rank);
    const entered = new Set([0, 0.4, 0.8].map((roll) => chooseEntrant(ranks, normal('SS+').rank, () => roll)));
    expect(entered).toEqual(new Set([0, 1, 2]));
  });

  it('C6: no switch before the gauge is full; a fighter alone never switches', () => {
    const recharge = DEFAULT_SETTINGS.switchRecharge;
    for (const record of records(team(3, 'A'), team(3, 'A'), 200, 5)) {
      const last: Record<Side, number> = { a: 0, b: 0 };
      for (const { event, after } of record.steps) {
        if (event.type !== 'switch') {
          continue;
        }
        expect(event.exchange - last[event.side]).toBeGreaterThanOrEqual(recharge);
        expect(after.hp[event.side][event.in]).toBeGreaterThan(0);
        last[event.side] = event.exchange;
      }
    }
    for (const record of records([normal('A')], team(3, 'A'), 200, 6)) {
      expect(record.steps.some(({ event }) => event.type === 'switch' && event.side === 'a')).toBe(false);
    }
  });

  it('C7: the computer does not always switch as soon as it can: under half of the switches', () => {
    const stats = fightStats({ a: team(5, 'A'), b: team(5, 'A') }, DEFAULT_SETTINGS, 300, seededRandom(7));
    expect(stats.switches).toBeGreaterThan(0);
    expect(stats.immediateSwitches / stats.switches).toBeLessThan(0.5);
  });
});

describe('special moves (spec 035, criteria 8-9)', () => {
  const wave: Move = { name: 'Onda', kind: 'wave' };
  const rush: Move = { name: 'Impeto', kind: 'rush' };

  it('C8: wave against wave pays 150%; rush against rush and rush against wave pay in full', () => {
    expect(clashKind(wave, wave)).toBe('waves');
    expect(clashKind(rush, rush)).toBe('rushes');
    expect(clashKind(rush, wave)).toBe('rushVsWave');
    expect(clashKind(wave, rush)).toBe('rushVsWave');
    expect(CLASH_DAMAGE).toEqual({ waves: 1.5, rushes: 1, rushVsWave: 1 });
  });

  it('C8: rushes do not work on giants, nobody counters a giant with a rush, the wave beats the rush', () => {
    const giants = [fighter('vegeta-scouter-oozaru'), fighter('hildegarn')];
    const others = [fighter('butter'), fighter('son-goku-meta'), fighter('mr-satan')];
    let rushesOnGiants = 0;
    for (const record of records(others, giants, 300, 8)) {
      for (const { event, before } of withBefore(record)) {
        if (event.type !== 'move' && event.type !== 'clash') {
          continue;
        }
        const attacker = onField(record, before, event.side);
        const defender = onField(record, before, otherSide(event.side));
        if (event.type === 'move' && !worksOn(event.move, defender.sheet)) {
          rushesOnGiants += 1;
          expect(event.outcome).toBe('giant');
          expect(event.damage).toBe(0);
        }
        if (event.type === 'clash') {
          expect(worksOn(event.counter, attacker.sheet)).toBe(true);
          expect(worksOn(event.move, defender.sheet)).toBe(true);
          if (event.kind === 'rushVsWave') {
            const waveSide = event.move.kind === 'wave' ? event.side : otherSide(event.side);
            expect(event.winner).toBe(waveSide);
          }
        }
      }
    }
    expect(rushesOnGiants).toBeGreaterThan(0);
  });

  it('Penetrate! works on giants, as in BT3 (D-057)', () => {
    const oozaru = fighter('vegeta-scouter-oozaru');
    const kidGoku = fighter('son-goku-bambino');
    expect(worksOn(kidGoku.sheet.finale, oozaru.sheet)).toBe(true);
    expect(worksOn(kidGoku.sheet.moves[1], oozaru.sheet)).toBe(false);
    expect(worksOn(kidGoku.sheet.moves[0], oozaru.sheet)).toBe(true);
    const penetrates = records([kidGoku], [oozaru], 400, 13).flatMap((record) =>
      record.steps.filter(({ event }) => event.type === 'move' && event.move.name === 'Penetrate!'),
    );
    expect(penetrates.length).toBeGreaterThan(0);
    expect(penetrates.some(({ event }) => event.type === 'move' && event.outcome === 'hit')).toBe(true);
    expect(penetrates.every(({ event }) => event.type === 'move' && event.outcome !== 'giant')).toBe(true);
  });

  it('C8: moves are hit, dodged, failed or countered, and all of it happens', () => {
    const stats = fightStats({ a: team(5, 'A'), b: team(5, 'A') }, DEFAULT_SETTINGS, 300, seededRandom(9));
    expect(stats.moves.hit).toBeGreaterThan(0);
    expect(stats.moves.dodged).toBeGreaterThan(0);
    expect(stats.moves.failed).toBeGreaterThan(0);
    expect(stats.clashes.waves).toBeGreaterThan(0);
    expect(stats.clashes.rushes).toBeGreaterThan(0);
    expect(stats.clashes.rushVsWave).toBeGreaterThan(0);
  });

  it('C9: the sheets of the list belong to characters with a tier, with power + speed = 6', () => {
    const result = importCatalog(charactersCsv);
    expect(result.ok && result.sheetProblems).toEqual([]);
    const withSheet = catalog.filter((character) => character.fight);
    expect(withSheet.map((character) => character.id)).toEqual(
      expect.arrayContaining(['mr-satan', 'son-goku-meta', 'vegeta-scouter-oozaru', 'hildegarn', 'gogeta-ssj4']),
    );
    for (const character of withSheet) {
      const { sheet } = fighter(character.id);
      expect(sheet.bars).toBeGreaterThanOrEqual(3);
      expect(sheet.bars).toBeLessThanOrEqual(5);
      expect(sheet.power + sheet.speed).toBe(6);
      expect(sheet.finale.name).not.toBe('');
    }
  });

  it('characters without a tier cannot fight', () => {
    const bulma = catalog.find((entry) => entry.id === 'bulma');
    expect(bulma && fighterOf(bulma)).toBeNull();
  });
});

describe('the fight as a whole (spec 035, criteria 10-11)', () => {
  it('C10: teams of different sizes always end with a winner', () => {
    for (const [sizeA, sizeB] of [[1, 1], [1, 3], [3, 5], [5, 5]] as const) {
      for (const record of records(team(sizeA, 'A'), team(sizeB, 'A'), 50, sizeA * 10 + sizeB)) {
        const last = record.steps.at(-1);
        expect(last?.event).toMatchObject({ type: 'end', winner: record.winner });
        const final = last?.after as FightSnapshot;
        expect(final.hp[otherSide(record.winner)].every((hp) => hp === 0)).toBe(true);
        expect(final.hp[record.winner].some((hp) => hp > 0)).toBe(true);
      }
    }
  });

  it('a team has from 1 to 5 fighters', () => {
    expect(() => runFight({ a: [], b: team(1, 'A') }, DEFAULT_SETTINGS, seededRandom(1))).toThrow();
    expect(() => runFight({ a: team(6, 'A'), b: team(1, 'A') }, DEFAULT_SETTINGS, seededRandom(1))).toThrow();
  });

  it('C11: the same fight told twice is the same; it starts at full health', () => {
    const teams = { a: [fighter('son-goku-meta'), normal('A')], b: [fighter('recoome'), normal('B')] };
    const one = recordFight(teams, DEFAULT_SETTINGS, seededRandom(11));
    const again = recordFight(teams, DEFAULT_SETTINGS, seededRandom(11));
    expect(again).toEqual(one);
    expect(one.start.hp.a).toEqual([4 * BAR_HP, 4 * BAR_HP]);
    expect(one.start.active).toEqual({ a: 0, b: 0 });
  });

  it('the totals of many fights add up', () => {
    const stats = fightStats({ a: team(2, 'A'), b: team(2, 'B') }, DEFAULT_SETTINGS, 100, seededRandom(12));
    expect(stats.wins.a + stats.wins.b).toBe(100);
    expect(stats.exchanges).toBeGreaterThan(100);
  });
});

describe('transformations (spec 037, 2.3 and criteria 4-5)', () => {
  /** A fighter of the list with the forms it can transform into. */
  const withForms = (id: string, blocked?: ReadonlySet<string>) =>
    fighterOf(catalog.find((entry) => entry.id === id) as Character, catalog, blocked) as Fighter;
  const names = (fighter: Fighter | undefined): string[] => (fighter ? [fighter.name, ...names(fighter.next)] : []);

  it('the forms follow "si trasforma in"; a form already elsewhere stops them (D-064)', () => {
    expect(names(withForms('freeza-prima-forma'))).toEqual([
      'Freeza (prima forma)',
      'Freeza (seconda forma)',
      'Freeza (terza forma)',
      'Freeza (forma finale)',
      'Freeza (massima potenza)',
    ]);
    expect(names(withForms('freeza-prima-forma', new Set(['freeza-terza-forma'])))).toEqual([
      'Freeza (prima forma)',
      'Freeza (seconda forma)',
    ]);
    expect(fighter('freeza-prima-forma').next).toBeUndefined();
  });

  it('the worse off, the likelier to transform: up to three times as likely near a KO', () => {
    const full = transformChance(DEFAULT_SETTINGS, 40_000, 40_000);
    expect(transformChance(DEFAULT_SETTINGS, 20_000, 40_000)).toBeGreaterThan(full);
    expect(transformChance(DEFAULT_SETTINGS, 0, 40_000)).toBeCloseTo(3 * full, 10);
  });

  it('C4: one form at a time, with the tier of the new form and the same health', () => {
    let seen = 0;
    for (const record of records([withForms('freeza-prima-forma')], [normal('S')], 200, 41)) {
      for (const { event, before, after } of withBefore(record)) {
        if (event.type !== 'transform') {
          continue;
        }
        seen += 1;
        const at = event.fighter;
        expect(after.forms[event.side][at]).toBe((before.forms[event.side][at] ?? 0) + 1);
        expect(fighterAt(record, after, event.side, at)).toBe(fighterAt(record, before, event.side, at).next);
        const newMax = fighterAt(record, after, event.side, at).sheet.bars * BAR_HP;
        expect(after.hp[event.side][at]).toBe(Math.min(before.hp[event.side][at] as number, newMax));
      }
    }
    expect(seen).toBeGreaterThan(100);
  });

  it('C5: at the same tier, who can transform wins more often than who cannot', () => {
    const base: Character = { id: 'base', name: 'Base', tier: 'A', fight: { transformsInto: 'super' } };
    const stronger: Character = { id: 'super', name: 'Super', tier: 'S' };
    const transforming = fighterOf(base, [base, stronger]) as Fighter;
    expect(winShare([transforming], [normal('A')], 3000, 42)).toBeGreaterThan(0.55);
  });

  it('who ends the fight in another form is what "Aggiorna la squadra" offers (spec 037, 2.4)', () => {
    const goku = withForms('son-goku-meta');
    const fights = records([goku, normal('A')], [normal('A')], 60, 43);
    const changed = fights.find((record) => transformationsOf(record, 'a').length > 0);
    expect(transformationsOf(changed as FightRecord, 'a')).toEqual([{ from: goku, to: goku.next }]);
    expect(fights.every((record) => transformationsOf(record, 'b').length === 0)).toBe(true);
  });
});

describe('drains and the cure of transformations (spec 073)', () => {
  const withForms = (id: string) => fighterOf(catalog.find((entry) => entry.id === id) as Character, catalog) as Fighter;
  const cell = fighter('cell-prima-forma');
  /** Who drained in an event, and the event's drain. */
  const drainer = (event: FightEvent): Side | null =>
    event.type === 'grab' || event.type === 'move' ? event.side : event.type === 'clash' ? event.winner : null;
  const drainedOf = (event: FightEvent) =>
    event.type === 'grab' || event.type === 'move' || event.type === 'clash' ? event.drained : undefined;

  it('C1: a move that drains gives back two thirds of the HP it took, never beyond the bars', () => {
    let drains = 0;
    for (const record of records([cell], [normal('S')], 150, 731)) {
      for (const { event, before, after } of withBefore(record)) {
        if (event.type !== 'move' && event.type !== 'clash') {
          continue;
        }
        const won = event.type === 'move' ? event.outcome === 'hit' : true;
        const side = drainer(event) as Side;
        const move = event.type === 'clash' && event.winner !== event.side ? event.counter : event.move;
        if (!won || !move.drains) {
          expect(event.drained).toBeUndefined();
          continue;
        }
        const target = otherSide(side);
        const taken = Math.min(event.damage, before.hp[target][0] as number);
        const room = cell.sheet.bars * BAR_HP - (before.hp[side][0] as number);
        expect(event.drained).toBe(Math.min(Math.round((taken * 2) / 3), room));
        expect(after.hp[side][0]).toBe((before.hp[side][0] as number) + (event.drained as number));
        drains += (event.drained as number) > 0 ? 1 : 0;
      }
    }
    expect(drains).toBeGreaterThan(10);
  });

  it('C2: a grab only by who drains: it takes 2,500 HP and gives them to who grabs', () => {
    let grabs = 0;
    for (const record of records([cell], [normal('S')], 150, 732)) {
      for (const { event, before, after } of withBefore(record)) {
        if (event.type !== 'grab') {
          continue;
        }
        grabs += 1;
        expect(event.side).toBe('a');
        expect(event.damage).toBe(2500);
        const taken = Math.min(2500, before.hp.b[0] as number);
        expect(after.hp.b[0]).toBe((before.hp.b[0] as number) - taken);
        expect(event.drained).toBe(Math.min(taken, cell.sheet.bars * BAR_HP - (before.hp.a[0] as number)));
      }
    }
    expect(grabs).toBeGreaterThan(20);
    const plain = records([normal('S')], [normal('S')], 100, 733);
    expect(plain.some((record) => record.steps.some(({ event }) => event.type === 'grab'))).toBe(false);
  });

  it('C2: giants are not grabbed; androids and robots are never drained, C-8, Arale and the Robot di Pilaf too', () => {
    const immune = ['c-17', 'c-8', 'arale', 'robot-di-pilaf'].map(fighter);
    expect(immune.every((one) => one.drainImmune)).toBe(true);
    expect(cell.drainImmune).toBeUndefined();
    for (const target of [...immune, fighter('nappa-oozaru')]) {
      for (const record of records([cell], [target], 60, 734)) {
        for (const { event } of record.steps) {
          expect(event.type).not.toBe('grab');
          expect(drainedOf(event)).toBeUndefined();
        }
      }
    }
  });

  it('C3: evened out, who drains wins about half of the fights against a normal sheet of its tier', () => {
    expect(winShare([cell], [normal('S')], 3000, 735)).toBeGreaterThan(0.45);
    expect(winShare([cell], [normal('S')], 3000, 735)).toBeLessThan(0.55);
    expect(winShare([fighter('c-19')], [normal('SS-')], 3000, 736)).toBeGreaterThan(0.45);
    expect(winShare([fighter('c-19')], [normal('SS-')], 3000, 736)).toBeLessThan(0.55);
  });

  it('C4: transforming into a form with «cura trasformandosi» heals that much, never beyond the bars', () => {
    let healed = 0;
    for (const record of records([withForms('cell-prima-forma')], [normal('S')], 300, 737)) {
      for (const { event, before, after } of withBefore(record)) {
        if (event.type !== 'transform') {
          continue;
        }
        const form = fighterAt(record, after, event.side, event.fighter);
        const kept = Math.min(before.hp[event.side][event.fighter] as number, form.sheet.bars * BAR_HP);
        const cure = Math.min(form.sheet.transformHeal ?? 0, form.sheet.bars * BAR_HP - kept);
        expect(event.healed ?? 0).toBe(cure);
        expect(after.hp[event.side][event.fighter]).toBe(kept + cure);
        healed += cure > 0 ? 1 : 0;
      }
    }
    expect(healed).toBeGreaterThan(50);
  });

  it('C5: fights without drains or cures are the same as before spec 073', () => {
    // Digests of the steps, taken with the engine before spec 073 and its transformation chance of then.
    const settings = { ...DEFAULT_SETTINGS, transformChance: 1 / 40 };
    const digest = (text: string) => {
      let hash = 0x811c9dc5;
      for (let index = 0; index < text.length; index++) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
      }
      return (hash >>> 0).toString(16).padStart(8, '0');
    };
    const cases = [
      { a: ['freeza-prima-forma', 'son-goku-meta'], b: ['vegeta', 'c-17'], seed: 101, expected: 'f83788fd' },
      { a: ['nappa-oozaru', 'recoome'], b: ['son-goku-fine', 'piccolo-fine'], seed: 102, expected: '587f27be' },
      {
        a: ['son-gohan', 'c-18', 'arale', 'trunks-spada', 'majin-buu-puro-male'],
        b: ['vegeta-seconda-forma', 'trunks', 'freeza-forma-finale', 'son-gohan-ultimate', 'son-goku-ssj4'],
        seed: 103,
        expected: '3c2c50af',
      },
    ];
    for (const { a, b, seed, expected } of cases) {
      const record = recordFight({ a: a.map(withForms), b: b.map(withForms) }, settings, seededRandom(seed));
      expect(digest(JSON.stringify(record.steps))).toBe(expected);
    }
  });
});
