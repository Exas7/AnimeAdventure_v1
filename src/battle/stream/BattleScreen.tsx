import { useEffect, useState, type CSSProperties } from 'react';
import { Placeholder } from '../../ui/Placeholder';
import { BAR_HP, otherSide, SIDES, type FightEvent, type FightSnapshot, type Fighter, type Side } from '../fight';
import {
  captionOf,
  eventDuration,
  fighterAt,
  formatHp,
  SIDE_NAMES,
  snapshotAt,
  type BattleView,
} from '../playback';
import styles from './BattleScreen.module.css';

interface BattleScreenProps {
  view: BattleView;
}

/**
 * The simulated fight on the stream (spec 035, 2.11): the health of the two
 * on the field at the top, as in BT3; the teams at the sides; the two
 * fighters in the middle, with blows, moves and clashes animated; the big
 * writing at the bottom. Each event plays for as long as the test page shows
 * it, so the two windows stay in step.
 */
export function BattleScreen({ view }: BattleScreenProps) {
  const { record, shown, speed } = view;
  const names = view.names ?? SIDE_NAMES;
  const event = record.steps[shown - 1]?.event;
  const beat = event ? eventDuration(event) / speed : 0;
  // Health changes when the blow lands, not when the move starts: a waves
  // clash must not tell the winner before the beams have pushed (2.11).
  const impact = event ? beat * impactShare(event) : 0;
  const [impactedAt, setImpactedAt] = useState(-1);
  useEffect(() => {
    const timer = setTimeout(() => setImpactedAt(shown), impact);
    return () => clearTimeout(timer);
  }, [shown, impact]);
  const impacted = impact === 0 || impactedAt === shown;
  const snapshot = snapshotAt(record, impacted ? shown : shown - 1);
  const caption =
    shown === 0
      ? { title: 'SI COMINCIA!', detail: `${names.a} contro ${names.b}` }
      : captionOf(record, shown - 1, names);
  // Everyone in the form they have at this moment (spec 037, 2.3).
  const current = (side: Side) => record.teams[side].map((_, index) => fighterAt(record, snapshot, side, index));
  const onField = (side: Side) => fighterAt(record, snapshot, side, snapshot.active[side]);

  return (
    <div className={styles.scene} style={{ '--beat': `${beat}ms` } as CSSProperties}>
      <div className={styles.hud}>
        {SIDES.map((side) => (
          <div key={side} className={`${styles.hudSide} ${styles[side]}`}>
            <div className={styles.hudName}>
              {onField(side).name} <span className={styles.tier}>{onField(side).tier}</span>
            </div>
            <HealthBars fighter={onField(side)} hp={snapshot.hp[side][snapshot.active[side]] ?? 0} large />
            <div className={styles.hudLine}>
              <span className={styles.hpText}>{formatHp(snapshot.hp[side][snapshot.active[side]] ?? 0)} HP</span>
              <span className={styles.gauge} title="Cambio">
                <span
                  className={styles.gaugeFill}
                  style={{ width: `${(100 * snapshot.gauge[side]) / view.switchRecharge}%` }}
                />
              </span>
            </div>
          </div>
        ))}
        <span className={styles.vs}>VS</span>
      </div>

      <div className={styles.middle}>
        <TeamList side="a" name={names.a} fighters={current('a')} snapshot={snapshot} />
        <div className={styles.arena}>
          {SIDES.map((side) => {
            const fighter = onField(side);
            return (
              <div
                // A new key restarts the animation at every event.
                key={`${side}-${shown}`}
                className={[styles.fighter, styles[side], motionOf(event, side)].join(' ')}
              >
                <Placeholder name={fighter.name} characterId={fighter.id} size="fill" />
              </div>
            );
          })}
          <Effects key={shown} event={event} />
        </div>
        <TeamList side="b" name={names.b} fighters={current('b')} snapshot={snapshot} />
      </div>

      <div key={shown} className={styles.caption}>
        {caption && (
          <>
            <p className={styles.title}>{caption.title}</p>
            {/* The detail tells the outcome: it waits for the blow to land too. */}
            {caption.detail && impacted && <p className={styles.detail}>{caption.detail}</p>}
          </>
        )}
      </div>
    </div>
  );
}

/** One segment per bar of 10,000 HP, as in BT3. */
function HealthBars({ fighter, hp, large }: { fighter: Fighter; hp: number; large?: boolean }) {
  return (
    <div className={`${styles.bars} ${large ? styles.large : ''}`}>
      {Array.from({ length: fighter.sheet.bars }, (_, bar) => (
        <span key={bar} className={styles.bar}>
          <span
            className={styles.barFill}
            style={{ width: `${Math.min(100, Math.max(0, (100 * (hp - bar * BAR_HP)) / BAR_HP))}%` }}
          />
        </span>
      ))}
    </div>
  );
}

interface TeamListProps {
  side: Side;
  name: string;
  fighters: readonly Fighter[];
  snapshot: FightSnapshot;
}

function TeamList({ side, name, fighters, snapshot }: TeamListProps) {
  return (
    <div className={`${styles.team} ${styles[side]}`}>
      <p className={styles.teamName}>{name}</p>
      {fighters.map((fighter, index) => {
        const hp = snapshot.hp[side][index] ?? 0;
        const classes = [
          styles.member,
          index === snapshot.active[side] && hp > 0 ? styles.onField : '',
          hp === 0 ? styles.out : '',
        ];
        return (
          <div key={index} className={classes.join(' ')}>
            <div className={styles.memberPicture}>
              <Placeholder name={fighter.name} characterId={fighter.id} size="fill" />
            </div>
            <HealthBars fighter={fighter} hp={hp} />
          </div>
        );
      })}
    </div>
  );
}

/** When, as a share of the event's beat, the blow lands and the health changes. */
function impactShare(event: FightEvent): number {
  switch (event.type) {
    case 'blow':
      return 0.15;
    case 'move':
      return 0.45;
    case 'clash':
      return { waves: 0.85, rushes: 0.6, rushVsWave: 0.45 }[event.kind];
    default:
      return 0;
  }
}

/** How the fighter on the field of `side` moves during an event; undefined: it stands still. */
function motionOf(event: FightEvent | undefined, side: Side): string | undefined {
  if (!event) {
    return undefined;
  }
  switch (event.type) {
    case 'blow':
      return event.side === side ? styles.lunge : styles.shake;
    case 'move': {
      if (event.side === side) {
        if (event.move.kind === 'wave') {
          return styles.cast;
        }
        return event.outcome === 'giant' ? styles.bounce : styles.dash;
      }
      const reactions = { hit: styles.hit, dodged: styles.dodge, failed: undefined, giant: undefined };
      return reactions[event.outcome];
    }
    case 'clash': {
      const won = event.winner === side;
      const own = event.side === side ? event.move : event.counter;
      if (event.kind === 'rushes') {
        return won ? styles.meet : styles.meetLose;
      }
      if (own.kind === 'rush') {
        return styles.swept;
      }
      return won ? styles.cast : styles.knockback;
    }
    case 'switch':
    case 'enter':
      return event.side === side ? styles.slideIn : undefined;
    case 'ko':
      return event.side === side ? styles.fall : undefined;
    case 'transform':
      return event.side === side ? styles.powerUp : undefined;
    case 'end':
      return event.winner === side ? styles.victory : styles.defeated;
  }
}

/** Beams, sparks and damage numbers between the two fighters. */
function Effects({ event }: { event: FightEvent | undefined }) {
  if (!event) {
    return null;
  }
  const damage = (side: Side, amount: number, timing: 'early' | 'mid' | 'late') => (
    <span className={`${styles.damage} ${styles[`on${side.toUpperCase()}`]} ${styles[timing]}`}>
      −{formatHp(amount)}
    </span>
  );
  const beam = (from: Side, kind: 'reach' | 'fizzle') => (
    <span className={`${styles.beam} ${styles[`from${from.toUpperCase()}`]} ${styles[kind]}`} />
  );

  switch (event.type) {
    case 'blow':
      return damage(otherSide(event.side), event.damage, 'early');
    case 'move':
      return (
        <>
          {event.move.kind === 'wave' && beam(event.side, event.outcome === 'failed' ? 'fizzle' : 'reach')}
          {event.outcome === 'hit' && damage(otherSide(event.side), event.damage, 'mid')}
        </>
      );
    case 'clash': {
      const loser = otherSide(event.winner);
      if (event.kind === 'waves') {
        const wins = event.winner === 'a' ? styles.winsA : styles.winsB;
        return (
          <>
            <span className={`${styles.struggle} ${styles.fromA} ${wins}`} />
            <span className={`${styles.struggle} ${styles.fromB} ${wins}`} />
            <span className={`${styles.junction} ${wins}`} />
            {damage(loser, event.damage, 'late')}
          </>
        );
      }
      if (event.kind === 'rushes') {
        return (
          <>
            <span className={styles.spark} />
            {damage(loser, event.damage, 'late')}
          </>
        );
      }
      return (
        <>
          {beam(event.winner, 'reach')}
          {damage(loser, event.damage, 'mid')}
        </>
      );
    }
    default:
      return null;
  }
}
