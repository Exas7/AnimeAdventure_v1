import { TEAM_SIZE, type Character } from '../engine';
import { tierRank, type Random } from '../episode/fill';
import { gaussian, seededRandom } from './random';
import { NORMAL_SHEET, sheetOf, type Move, type Sheet } from './sheets';

// The simulated fight (spec 035, D-053): a series of exchanges between the two
// fighters on the field, teams of 1 to 5 in the order chosen by the player.
// The whole fight is worked out at once; the director and the stream only
// tell it, step by step (2.9).

export const BAR_HP = 10_000;

export type Side = 'a' | 'b';

export const SIDES: readonly Side[] = ['a', 'b'];

export function otherSide(side: Side): Side {
  return side === 'a' ? 'b' : 'a';
}

/** A character that can fight: one with a tier (spec 035, 2.6). */
export interface Fighter {
  id: string;
  name: string;
  tier: string;
  /** Steps from E (0) to SS+ (19), as in "Randomizza" (spec 007). */
  rank: number;
  sheet: Sheet;
}

/** The fighter of a character of the list; null without a tier. */
export function fighterOf(character: Character): Fighter | null {
  const rank = tierRank(character.tier);
  if (rank === null || character.tier === undefined) {
    return null;
  }
  return {
    id: character.id,
    name: character.name,
    tier: character.tier,
    rank,
    sheet: sheetOf(character),
  };
}

/** The knobs of the test page (spec 035, 2.10); DEFAULT_SETTINGS holds the starting values. */
export interface FightSettings {
  /** Spread of the team form die (2.5): 0 is no form at all. */
  formSpread: number;
  /** Chance that an attack is one of the two base moves (2.3). */
  moveChance: number;
  /** Chance that an attack is the finale (2.3). */
  finaleChance: number;
  /** Chance that a special move is countered (2.4). */
  counterChance: number;
  /** Exchanges the switch gauge takes to fill (2.8). */
  switchRecharge: number;
}

export const DEFAULT_SETTINGS: FightSettings = {
  formSpread: 0.22,
  moveChance: 1 / 12,
  finaleChance: 1 / 50,
  counterChance: 0.3,
  switchRecharge: 15,
};

/** Each tier step makes a fighter this much stronger, in attacks and in damage. */
const TIER_STEP = 1.065;
/** Damage at equal tiers and power 3, before the dice (2.3). */
const BLOW_DAMAGE = 1500;
const MOVE_DAMAGE = 9000;
const FINALE_DAMAGE = 18_000;
/** A special move is dodged this often between equally fast fighters (2.4). */
const DODGE_CHANCE = 0.15;
const FAIL_CHANCE = 0.1;
/** How often a counter is the finale (2.4: "di rado"). */
const FINALE_COUNTER_SHARE = 0.2;
/** Chance to switch with the gauge full, for a whole bar to win back (2.8). */
const SWITCH_WILL = 0.5;
/** A guard against endless loops: real fights last a few hundred exchanges. */
const MAX_EXCHANGES = 20_000;

/** The waves clash pays 150% to the winner (2.4). */
export const CLASH_DAMAGE: Record<ClashKind, number> = { waves: 1.5, rushes: 1, rushVsWave: 1 };

export type MoveOutcome = 'hit' | 'dodged' | 'failed' | 'giant';

/** Wave against wave, rush against rush, or a rush against a wave (always won by the wave). */
export type ClashKind = 'waves' | 'rushes' | 'rushVsWave';

export function clashKind(move: Move, counter: Move): ClashKind {
  if (move.kind !== counter.kind) {
    return 'rushVsWave';
  }
  return move.kind === 'wave' ? 'waves' : 'rushes';
}

/** A rush does not work on giants, unless it does in BT3 (spec 035, 2.4; D-057). */
export function worksOn(move: Move, target: Sheet): boolean {
  return !(move.kind === 'rush' && target.giant && !move.hitsGiants);
}

/** What matters of a move to the engine: its name does not. */
const moveStyle = (move: Move) => `${move.kind}${move.hitsGiants ? '+giants' : ''}`;

// In every event `side` is the side that acts: the attacker, or the team
// that switches, loses a fighter, sends one in.
export type FightEvent =
  | { type: 'blow'; exchange: number; side: Side; damage: number }
  | {
      type: 'move';
      exchange: number;
      side: Side;
      move: Move;
      finale: boolean;
      outcome: MoveOutcome;
      damage: number;
    }
  | {
      type: 'clash';
      exchange: number;
      side: Side;
      move: Move;
      finale: boolean;
      counter: Move;
      counterFinale: boolean;
      kind: ClashKind;
      winner: Side;
      damage: number;
    }
  | {
      type: 'switch';
      exchange: number;
      side: Side;
      out: number;
      in: number;
      /** HP won back by the fighter leaving the field. */
      recovered: number;
      /** Made in the exchange the gauge got full (criterion 7). */
      immediate: boolean;
    }
  | { type: 'ko'; exchange: number; side: Side; fighter: number }
  | { type: 'enter'; exchange: number; side: Side; fighter: number }
  | { type: 'end'; exchange: number; winner: Side };

export interface FightSnapshot {
  /** HP of every fighter, in team order. */
  hp: Record<Side, number[]>;
  /** Who is on the field: a position in the team. */
  active: Record<Side, number>;
  /** Exchanges in the switch gauge, up to the recharge. */
  gauge: Record<Side, number>;
}

export interface FightOutcome {
  winner: Side;
  /** The team form die (2.5): above 1 a good day, below 1 a bad one. */
  form: Record<Side, number>;
}

export type FightListener = (event: FightEvent, snapshot: () => FightSnapshot) => void;

/** HP after leaving the field (2.8): up to the end of the current bar minus 1, never above the full bar. */
export function hpAfterSwitch(hp: number, maxHp: number): number {
  const barEnd = (Math.floor(hp / BAR_HP) + 1) * BAR_HP - 1;
  return Math.max(hp, Math.min(barEnd, maxHp));
}

/**
 * Who enters, for a switch or after a KO (2.7): a teammate at most 3 steps
 * below the opponent on the field, at random; anyone at random if there is
 * none. Returns a position in `ranks`.
 */
export function chooseEntrant(ranks: readonly number[], opponentRank: number, random: Random): number {
  const upToIt = ranks.flatMap((rank, index) => (rank >= opponentRank - 3 ? [index] : []));
  const pool = upToIt.length > 0 ? upToIt : ranks.map((_, index) => index);
  return pool[Math.floor(random() * pool.length)] as number;
}

/** Plays a whole fight; `onEvent` hears every event as it happens. */
export function runFight(
  teams: Record<Side, readonly Fighter[]>,
  settings: FightSettings,
  random: Random,
  onEvent: FightListener = () => {},
): FightOutcome {
  return simulate(teams, settings, random, onEvent, (sheet) => balanceFactor(sheet, settings));
}

export interface FightRecord {
  teams: Record<Side, readonly Fighter[]>;
  form: Record<Side, number>;
  /** Before the first exchange: full health, the first of each team on the field. */
  start: FightSnapshot;
  steps: { event: FightEvent; after: FightSnapshot }[];
  winner: Side;
}

/** The whole fight, event by event with the state after each: what the director and the stream tell. */
export function recordFight(
  teams: Record<Side, readonly Fighter[]>,
  settings: FightSettings,
  random: Random,
): FightRecord {
  const steps: FightRecord['steps'] = [];
  const outcome = runFight(teams, settings, random, (event, snapshot) =>
    steps.push({ event, after: snapshot() }),
  );
  const fullHp = (fighters: readonly Fighter[]) => fighters.map((fighter) => fighter.sheet.bars * BAR_HP);
  return {
    teams,
    form: outcome.form,
    start: {
      hp: { a: fullHp(teams.a), b: fullHp(teams.b) },
      active: { a: 0, b: 0 },
      gauge: { a: 0, b: 0 },
    },
    steps,
    winner: outcome.winner,
  };
}

/** Totals of many fights between the same teams ("Lancia 1000 scontri", 2.10). */
export interface FightStats {
  fights: number;
  wins: Record<Side, number>;
  exchanges: number;
  switches: number;
  immediateSwitches: number;
  /** Special moves not countered, by outcome; countered ones are in `clashes`. */
  moves: Record<MoveOutcome, number>;
  clashes: Record<ClashKind, number>;
}

export function fightStats(
  teams: Record<Side, readonly Fighter[]>,
  settings: FightSettings,
  fights: number,
  random: Random,
): FightStats {
  const stats: FightStats = {
    fights,
    wins: { a: 0, b: 0 },
    exchanges: 0,
    switches: 0,
    immediateSwitches: 0,
    moves: { hit: 0, dodged: 0, failed: 0, giant: 0 },
    clashes: { waves: 0, rushes: 0, rushVsWave: 0 },
  };
  for (let fight = 0; fight < fights; fight++) {
    runFight(teams, settings, random, (event) => {
      if (event.type === 'end') {
        stats.wins[event.winner] += 1;
        stats.exchanges += event.exchange;
      } else if (event.type === 'switch') {
        stats.switches += 1;
        stats.immediateSwitches += event.immediate ? 1 : 0;
      } else if (event.type === 'move') {
        stats.moves[event.outcome] += 1;
      } else if (event.type === 'clash') {
        stats.clashes[event.kind] += 1;
      }
    });
  }
  return stats;
}

// ---------------------------------------------------------------------------
// The tier is the judge (2.2)
// ---------------------------------------------------------------------------

/** Fights per trial, and trials, when evening out a sheet. */
const BALANCE_FIGHTS = 1000;
const BALANCE_STEPS = 8;
const BALANCE_SEED = 35;
const REFERENCE_RANK = tierRank('A') as number;

const factors = new Map<string, number>();

/**
 * How much a sheet's damage is scaled so that it wins about half of its 1v1
 * fights against the normal sheet of the same tier: more bars, being a giant
 * or having two rushes change the style of a fight, not who wins it.
 * Worked out by trial with repeatable dice, so it is the same every time.
 */
export function balanceFactor(sheet: Sheet, settings: FightSettings): number {
  if (sameStyle(sheet, NORMAL_SHEET)) {
    return 1;
  }
  const key = JSON.stringify([
    sheet.bars,
    sheet.power,
    sheet.speed,
    sheet.giant,
    sheet.moves.map(moveStyle),
    moveStyle(sheet.finale),
    settings.moveChance,
    settings.finaleChance,
    settings.counterChance,
  ]);
  const known = factors.get(key);
  if (known !== undefined) {
    return known;
  }
  // A first guess: a fighter is worth about HP × speed × power.
  const guess = Math.log(
    (NORMAL_SHEET.bars * NORMAL_SHEET.speed * NORMAL_SHEET.power) /
      (sheet.bars * sheet.speed * sheet.power),
  );
  let low = guess - Math.LN2;
  let high = guess + Math.LN2;
  for (let step = 0; step < BALANCE_STEPS; step++) {
    const middle = (low + high) / 2;
    if (winShareAgainstNormal(sheet, Math.exp(middle), settings) > 0.5) {
      high = middle;
    } else {
      low = middle;
    }
  }
  const factor = Math.exp((low + high) / 2);
  factors.set(key, factor);
  return factor;
}

function winShareAgainstNormal(sheet: Sheet, factor: number, settings: FightSettings): number {
  const tested: Fighter = { id: 'tested', name: 'tested', tier: 'A', rank: REFERENCE_RANK, sheet };
  const normal: Fighter = { id: 'normal', name: 'normal', tier: 'A', rank: REFERENCE_RANK, sheet: NORMAL_SHEET };
  const teams = { a: [tested], b: [normal] };
  const noForm = { ...settings, formSpread: 0 };
  const random = seededRandom(BALANCE_SEED);
  let wins = 0;
  for (let fight = 0; fight < BALANCE_FIGHTS; fight++) {
    const outcome = simulate(teams, noForm, random, () => {}, (other) => (other === sheet ? factor : 1));
    wins += outcome.winner === 'a' ? 1 : 0;
  }
  return wins / BALANCE_FIGHTS;
}

function sameStyle(one: Sheet, other: Sheet): boolean {
  return (
    one.bars === other.bars &&
    one.power === other.power &&
    one.speed === other.speed &&
    one.giant === other.giant &&
    one.moves.every((move, index) => {
      const otherMove = other.moves[index];
      return otherMove !== undefined && moveStyle(move) === moveStyle(otherMove);
    }) &&
    moveStyle(one.finale) === moveStyle(other.finale)
  );
}

// ---------------------------------------------------------------------------
// The exchanges
// ---------------------------------------------------------------------------

interface FighterState {
  fighter: Fighter;
  hp: number;
  maxHp: number;
  /** Tier and team form together. */
  strength: number;
  /** From balanceFactor. */
  factor: number;
}

interface TeamState {
  members: FighterState[];
  active: number;
  gauge: number;
  /** The exchange in which the gauge last got full. */
  fullSince: number;
}

function simulate(
  teams: Record<Side, readonly Fighter[]>,
  settings: FightSettings,
  random: Random,
  onEvent: FightListener,
  factorOf: (sheet: Sheet) => number,
): FightOutcome {
  for (const side of SIDES) {
    if (teams[side].length < 1 || teams[side].length > TEAM_SIZE) {
      throw new Error(`A team has from 1 to ${TEAM_SIZE} fighters, not ${teams[side].length}`);
    }
  }
  const form = {
    a: settings.formSpread > 0 ? Math.exp(gaussian(random) * settings.formSpread) : 1,
    b: settings.formSpread > 0 ? Math.exp(gaussian(random) * settings.formSpread) : 1,
  };
  const team = (side: Side): TeamState => ({
    members: teams[side].map((fighter) => ({
      fighter,
      hp: fighter.sheet.bars * BAR_HP,
      maxHp: fighter.sheet.bars * BAR_HP,
      strength: TIER_STEP ** fighter.rank * form[side],
      factor: factorOf(fighter.sheet),
    })),
    active: 0,
    gauge: 0,
    fullSince: 0,
  });
  const state: Record<Side, TeamState> = { a: team('a'), b: team('b') };
  const snapshot = (): FightSnapshot => ({
    hp: { a: state.a.members.map((member) => member.hp), b: state.b.members.map((member) => member.hp) },
    active: { a: state.a.active, b: state.b.active },
    gauge: { a: state.a.gauge, b: state.b.gauge },
  });
  const emit = (event: FightEvent) => onEvent(event, snapshot);
  const onField = (side: Side) => state[side].members[state[side].active] as FighterState;
  const reservesOf = (side: Side) =>
    state[side].members.flatMap((member, index) =>
      index !== state[side].active && member.hp > 0 ? [index] : [],
    );
  const entrant = (side: Side, reserves: number[]): number => {
    const ranks = reserves.map((index) => (state[side].members[index] as FighterState).fighter.rank);
    return reserves[chooseEntrant(ranks, onField(otherSide(side)).fighter.rank, random)] as number;
  };

  const maybeSwitch = (side: Side, exchange: number) => {
    const current = state[side];
    if (current.gauge < settings.switchRecharge) {
      current.gauge += 1;
      if (current.gauge < settings.switchRecharge) {
        return;
      }
      current.fullSince = exchange;
    }
    const reserves = reservesOf(side);
    if (reserves.length === 0) {
      return;
    }
    const leaving = onField(side);
    const recovered = hpAfterSwitch(leaving.hp, leaving.maxHp) - leaving.hp;
    if (random() >= (SWITCH_WILL * recovered) / BAR_HP) {
      return;
    }
    const out = current.active;
    leaving.hp += recovered;
    current.active = entrant(side, reserves);
    current.gauge = 0;
    emit({
      type: 'switch',
      exchange,
      side,
      out,
      in: current.active,
      recovered,
      immediate: current.fullSince === exchange,
    });
  };

  const damage = (attacker: FighterState, defender: FighterState, base: number): number =>
    Math.max(
      1,
      Math.round(
        base *
          (0.7 + 0.6 * random()) *
          (attacker.fighter.sheet.power / 3) *
          attacker.factor *
          Math.sqrt(attacker.strength / defender.strength),
      ),
    );
  const hurt = (fighter: FighterState, amount: number) => {
    fighter.hp = Math.max(0, fighter.hp - amount);
  };
  /** Tier and power decide clashes, with luck (2.4). */
  const winsClash = (one: FighterState, other: FighterState): boolean => {
    const oneWeight = one.strength * one.fighter.sheet.power;
    return random() < oneWeight / (oneWeight + other.strength * other.fighter.sheet.power);
  };
  /** The defender's answer: never a move that does not work on the attacker; rarely the finale. */
  const counterOf = (defender: FighterState, attacker: FighterState) => {
    const works = (move: Move) => worksOn(move, attacker.fighter.sheet);
    const base = defender.fighter.sheet.moves.filter(works);
    const finale = defender.fighter.sheet.finale;
    if (works(finale) && (base.length === 0 || random() < FINALE_COUNTER_SHARE)) {
      return { move: finale, finale: true };
    }
    const move = base[Math.floor(random() * base.length)];
    return move ? { move, finale: false } : null;
  };

  const special = (side: Side, exchange: number, move: Move, finale: boolean) => {
    const attacker = onField(side);
    const defender = onField(otherSide(side));
    const base = (isFinale: boolean) => (isFinale ? FINALE_DAMAGE : MOVE_DAMAGE);
    const plain = (outcome: MoveOutcome, amount: number) => {
      hurt(defender, amount);
      emit({ type: 'move', exchange, side, move, finale, outcome, damage: amount });
    };
    if (!worksOn(move, defender.fighter.sheet)) {
      plain('giant', 0);
      return;
    }
    const dodge =
      DODGE_CHANCE * Math.sqrt(defender.fighter.sheet.speed / attacker.fighter.sheet.speed);
    const roll = random();
    if (roll < dodge) {
      plain('dodged', 0);
      return;
    }
    if (roll < dodge + FAIL_CHANCE) {
      plain('failed', 0);
      return;
    }
    const counter =
      roll < dodge + FAIL_CHANCE + settings.counterChance ? counterOf(defender, attacker) : null;
    if (!counter) {
      plain('hit', damage(attacker, defender, base(finale)));
      return;
    }
    const kind = clashKind(move, counter.move);
    const attackerWins =
      kind === 'rushVsWave' ? move.kind === 'wave' : winsClash(attacker, defender);
    const [winner, loser] = attackerWins ? [attacker, defender] : [defender, attacker];
    const winnerFinale = attackerWins ? finale : counter.finale;
    const amount = Math.round(damage(winner, loser, base(winnerFinale)) * CLASH_DAMAGE[kind]);
    hurt(loser, amount);
    emit({
      type: 'clash',
      exchange,
      side,
      move,
      finale,
      counter: counter.move,
      counterFinale: counter.finale,
      kind,
      winner: attackerWins ? side : otherSide(side),
      damage: amount,
    });
  };

  const attack = (exchange: number) => {
    const weight = (side: Side) => onField(side).strength * onField(side).fighter.sheet.speed;
    const side: Side = random() < weight('a') / (weight('a') + weight('b')) ? 'a' : 'b';
    const attacker = onField(side);
    const roll = random();
    if (roll < settings.finaleChance) {
      special(side, exchange, attacker.fighter.sheet.finale, true);
    } else if (roll < settings.finaleChance + settings.moveChance) {
      const move = attacker.fighter.sheet.moves[random() < 0.5 ? 0 : 1];
      special(side, exchange, move, false);
    } else {
      const amount = damage(attacker, onField(otherSide(side)), BLOW_DAMAGE);
      hurt(onField(otherSide(side)), amount);
      emit({ type: 'blow', exchange, side, damage: amount });
    }
  };

  for (let exchange = 1; exchange <= MAX_EXCHANGES; exchange++) {
    for (const side of SIDES) {
      maybeSwitch(side, exchange);
    }
    attack(exchange);
    // Only one fighter takes damage in an exchange, so at most one KO.
    for (const side of SIDES) {
      if (onField(side).hp > 0) {
        continue;
      }
      emit({ type: 'ko', exchange, side, fighter: state[side].active });
      const reserves = reservesOf(side);
      if (reserves.length === 0) {
        const winner = otherSide(side);
        emit({ type: 'end', exchange, winner });
        return { winner, form };
      }
      state[side].active = entrant(side, reserves);
      emit({ type: 'enter', exchange, side, fighter: state[side].active });
    }
  }
  throw new Error(`The fight did not end within ${MAX_EXCHANGES} exchanges`);
}
