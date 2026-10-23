import { formOf, otherSide, type FightEvent, type FightRecord, type FightSnapshot, type Fighter, type Side } from './fight';

// Telling a recorded fight (spec 035, 2.9-2.11): the texts of the log and of
// the stream, how long each event stays on screen, and where "Avanti di uno
// scambio" stops. Shared by the test page (director) and the stream.

/** How the two sides are called: "Squadra A" on the test page, the players' names in the game. */
export type SideNames = Record<Side, string>;

export const SIDE_NAMES: SideNames = { a: 'Squadra A', b: 'Squadra B' };

/** "Vince la Squadra A", "Vince Maggi". */
function winsText(names: SideNames, side: Side): string {
  return `Vince ${names[side] === SIDE_NAMES[side] ? 'la ' : ''}${names[side]}`;
}

/** "19.999", with the dot for thousands, as the coins of the game. */
export function formatHp(hp: number): string {
  return String(hp).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** The shout of a drain that lands (spec 073, 2.6). */
export const DRAIN_SHOUT = 'CIUCCIAAAAA';

/** A second more on screen for a drain, so «CIUCCIAAAAA» can be read (spec 073, 2.6). */
const DRAIN_TIME = 1000;

/**
 * The drain of an event (spec 073): the side that drained and the HP it won
 * back; null when nothing was drained, against androids too.
 */
export function drainOf(event: FightEvent): { side: Side; won: number } | null {
  switch (event.type) {
    case 'grab':
    case 'move':
      return event.drained === undefined ? null : { side: event.side, won: event.drained };
    case 'clash':
      return event.drained === undefined ? null : { side: event.winner, won: event.drained };
    default:
      return null;
  }
}

/** "+2.500 HP", or that the health was already full. */
function wonText(won: number): string {
  return won > 0 ? `+${formatHp(won)} HP` : 'la vita era già piena';
}

/**
 * Milliseconds an event stays on screen at speed 1× (2.11): blows run in
 * half a second, moves, clashes, switches and KOs take 2 or 3 seconds.
 */
export function eventDuration(event: FightEvent): number {
  const drain = drainOf(event) ? DRAIN_TIME : 0;
  switch (event.type) {
    case 'blow':
      return 500;
    case 'grab':
      return 500 + drain;
    case 'move':
      return (event.finale ? 2500 : 2000) + drain;
    case 'clash':
      return (event.kind === 'waves' ? 3000 : 2500) + drain;
    case 'switch':
    case 'ko':
      return 2000;
    case 'transform':
      return 2500;
    case 'enter':
      return 1500;
    case 'end':
      return 3000;
  }
}

/** The whole fight told at speed 1×, in milliseconds. */
export function fightDuration(record: FightRecord): number {
  return record.steps.reduce((total, step) => total + eventDuration(step.event), 0);
}

/** The state shown after `shown` steps: the start, or the state after the last one. */
export function snapshotAt(record: FightRecord, shown: number): FightSnapshot {
  return shown === 0 ? record.start : (record.steps[shown - 1]?.after ?? record.start);
}

/** The fighter at `position` of a side, in the form it has in `snapshot` (spec 037, 2.3). */
export function fighterAt(record: FightRecord, snapshot: FightSnapshot, side: Side, position: number): Fighter {
  return formOf(record.teams[side][position] as Fighter, snapshot.forms[side][position] ?? 0);
}

/** How many steps are shown after "Avanti di uno scambio": all those of the next exchange. */
export function afterNextExchange(record: FightRecord, shown: number): number {
  const next = record.steps[shown];
  if (!next) {
    return shown;
  }
  let end = shown;
  while (record.steps[end]?.event.exchange === next.event.exchange) {
    end += 1;
  }
  return end;
}

/** The log line of the step at `index`, with the names of who was on the field. */
export function describeStep(record: FightRecord, index: number, names: SideNames = SIDE_NAMES): string {
  const step = record.steps[index];
  if (!step) {
    return '';
  }
  const before = snapshotAt(record, index);
  const fighter = (side: Side, position: number) => fighterAt(record, before, side, position).name;
  const onField = (side: Side) => fighter(side, before.active[side]);
  const other = (side: Side): Side => (side === 'a' ? 'b' : 'a');
  const { event } = step;

  switch (event.type) {
    case 'blow':
      return `${onField(event.side)} colpisce ${onField(other(event.side))}: −${formatHp(event.damage)}`;
    case 'grab':
      return `${onField(event.side)} afferra ${onField(other(event.side))}: −${formatHp(event.damage)}, ${DRAIN_SHOUT}! ${wonText(event.drained)}`;
    case 'move': {
      const opening = `${onField(event.side)}${event.finale ? ', mossa finale' : ''}: ${event.move.name}!`;
      const target = onField(other(event.side));
      const drained = event.drained === undefined ? '' : `, ${DRAIN_SHOUT}! ${wonText(event.drained)}`;
      const outcomes = {
        hit: `A segno: −${formatHp(event.damage)}${drained}`,
        dodged: `${target} la schiva`,
        failed: 'Fallita',
        giant: 'Non funziona sui giganti',
      };
      return `${opening} ${outcomes[event.outcome]}`;
    }
    case 'clash': {
      const opening = `${onField(event.side)}${event.finale ? ', mossa finale' : ''}: ${event.move.name}!`;
      const answer = `${onField(other(event.side))} risponde con ${event.counter.name}${event.counterFinale ? ' (mossa finale)' : ''}`;
      const winner = onField(event.winner);
      const loser = onField(other(event.winner));
      const result = {
        waves: `scontro di onde, vince ${winner}: −${formatHp(event.damage)} (150%) a ${loser}`,
        rushes: `scontro di impeti, vince ${winner}: −${formatHp(event.damage)} a ${loser}`,
        rushVsWave: `l'onda travolge l'impeto, −${formatHp(event.damage)} a ${loser}`,
      };
      const drained = event.drained === undefined ? '' : `, ${DRAIN_SHOUT}! ${winner}: ${wonText(event.drained)}`;
      return `${opening} ${answer}: ${result[event.kind]}${drained}`;
    }
    case 'switch': {
      const hp = step.after.hp[event.side][event.out] as number;
      return `Cambio: esce ${fighter(event.side, event.out)} (torna a ${formatHp(hp)} HP), entra ${fighter(event.side, event.in)}`;
    }
    case 'ko':
      return `KO! ${fighter(event.side, event.fighter)} è a terra`;
    case 'enter':
      return `Entra ${fighter(event.side, event.fighter)}`;
    case 'transform': {
      const healed = event.healed ? ` (+${formatHp(event.healed)} HP)` : '';
      return `${fighter(event.side, event.fighter)} si trasforma: ${fighterAt(record, step.after, event.side, event.fighter).name}!${healed}`;
    }
    case 'end':
      return `${winsText(names, event.winner)}!`;
  }
}

/** What the stream needs to tell the fight in step with the test page (spec 035, 2.11; D-055). */
export interface BattleView {
  record: FightRecord;
  /** How many events the test page shows. */
  shown: number;
  /** 1, 2 or 4: the stream's animations follow the test page's speed. */
  speed: number;
  /** Exchanges the switch gauge takes to fill, to draw it. */
  switchRecharge: number;
  /** Missing: "Squadra A" and "Squadra B". */
  names?: SideNames;
}

/** The big writing of the stream for an event; null for plain blows, which only show the damage. */
export interface Caption {
  title: string;
  detail: string;
}

/** The big writing of the stream for the step at `index` (2.11). */
export function captionOf(record: FightRecord, index: number, names: SideNames = SIDE_NAMES): Caption | null {
  const step = record.steps[index];
  if (!step) {
    return null;
  }
  const before = snapshotAt(record, index);
  const fighter = (side: Side, position: number) => fighterAt(record, before, side, position).name;
  const onField = (side: Side) => fighter(side, before.active[side]);
  const shout = (name: string) => `${name.toUpperCase()}!`;
  const { event } = step;

  switch (event.type) {
    case 'blow':
      return null;
    case 'grab':
      return {
        title: 'PRESA!',
        detail: `${onField(event.side)} afferra ${onField(otherSide(event.side))} · −${formatHp(event.damage)}, ${wonText(event.drained)}`,
      };
    case 'move': {
      const drained = event.drained === undefined ? '' : `, ${wonText(event.drained)}`;
      const outcomes = {
        hit: `A segno: −${formatHp(event.damage)}${drained}`,
        dodged: 'Schivata!',
        failed: 'Fallita!',
        giant: 'Non funziona sui giganti!',
      };
      const who = event.finale ? `${onField(event.side)}, mossa finale` : onField(event.side);
      return { title: shout(event.move.name), detail: `${who} · ${outcomes[event.outcome]}` };
    }
    case 'clash': {
      const titles = {
        waves: 'SCONTRO DI ONDE!',
        rushes: 'SCONTRO DI IMPETI!',
        rushVsWave: "L'ONDA TRAVOLGE L'IMPETO!",
      };
      const bonus = event.kind === 'waves' ? ' (150%)' : '';
      const drained = event.drained === undefined ? '' : `, ${wonText(event.drained)}`;
      return {
        title: titles[event.kind],
        detail: `${event.move.name} contro ${event.counter.name} · vince ${onField(event.winner)}: −${formatHp(event.damage)}${bonus}${drained}`,
      };
    }
    case 'switch':
      return {
        title: 'CAMBIO!',
        detail: `Esce ${fighter(event.side, event.out)}, entra ${fighter(event.side, event.in)}`,
      };
    case 'ko':
      return { title: 'KO!', detail: `${fighter(event.side, event.fighter)} è a terra` };
    case 'enter':
      return { title: 'IN CAMPO!', detail: fighter(event.side, event.fighter) };
    case 'transform':
      return {
        title: 'TRASFORMAZIONE!',
        detail: `${fighter(event.side, event.fighter)} → ${fighterAt(record, step.after, event.side, event.fighter).name}${event.healed ? ` · +${formatHp(event.healed)} HP` : ''}`,
      };
    case 'end':
      return { title: `${winsText(names, event.winner).toUpperCase()}!`, detail: '' };
  }
}
