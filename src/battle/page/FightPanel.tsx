import { BAR_HP, SIDES, type FightRecord, type FightSettings, type Side } from '../fight';
import {
  afterNextExchange,
  describeStep,
  fighterAt,
  formatHp,
  SIDE_NAMES,
  snapshotAt,
  type SideNames,
} from '../playback';
import type { Speed } from '../usePlayback';
import styles from './BattlePage.module.css';

const SPEEDS: readonly Speed[] = [1, 2, 4];

interface FightPanelProps {
  record: FightRecord;
  /** The knobs the fight was played with. */
  settings: FightSettings;
  /** How many events are on screen. */
  shown: number;
  playing: boolean;
  speed: Speed;
  /** Jumps to a number of events shown, and pauses. */
  onShown: (shown: number) => void;
  onPlaying: (playing: boolean) => void;
  onSpeed: (speed: Speed) => void;
  /** Missing: "Squadra A" and "Squadra B". */
  names?: SideNames;
}

function formText(form: number): string {
  if (form === 1) {
    return 'forma: nessun dado';
  }
  const change = Math.round(Math.abs(form - 1) * 100);
  return form > 1 ? `giornata buona (+${change}%)` : `giornata storta (−${change}%)`;
}

/** One fight told step by step (2.10): who is on the field, health, switch gauges and the log. */
export function FightPanel(props: FightPanelProps) {
  const { record, settings, shown, playing, speed, onShown, onPlaying, onSpeed } = props;
  const names = props.names ?? SIDE_NAMES;
  const snapshot = snapshotAt(record, shown);
  const finished = shown >= record.steps.length;
  const lastEvent = record.steps[shown - 1]?.event;
  const log = Array.from({ length: shown }, (_, index) => ({
    exchange: record.steps[index]?.event.exchange ?? 0,
    text: describeStep(record, index, names),
  })).reverse();

  return (
    <section className={styles.fight}>
      <div className={styles.controls}>
        {playing ? (
          <button type="button" onClick={() => onPlaying(false)}>
            Pausa
          </button>
        ) : (
          <button type="button" disabled={finished} onClick={() => onPlaying(true)}>
            Avvia
          </button>
        )}
        <span className={styles.speeds}>
          {SPEEDS.map((value) => (
            <button
              key={value}
              type="button"
              className={value === speed ? styles.chosen : undefined}
              onClick={() => onSpeed(value)}
            >
              {value}×
            </button>
          ))}
        </span>
        <button type="button" disabled={finished} onClick={() => onShown(afterNextExchange(record, shown))}>
          Avanti di uno scambio
        </button>
        <button type="button" disabled={finished} onClick={() => onShown(record.steps.length)}>
          Vai alla fine
        </button>
        <button type="button" disabled={shown === 0} onClick={() => onShown(0)}>
          Dall'inizio
        </button>
        <span className={styles.note}>
          Scambio {lastEvent?.exchange ?? 0} di {record.steps.at(-1)?.event.exchange ?? 0}
        </span>
      </div>

      <p className={styles.banner}>{shown > 0 ? describeStep(record, shown - 1, names) : 'Si comincia!'}</p>

      {SIDES.map((side: Side) => (
        <div key={side} className={`${styles.board} ${styles[side]}`}>
          <div className={styles.boardHead}>
            <span className={styles.teamName}>{names[side]}</span>
            <span className={styles.note}>{formText(record.form[side])}</span>
            <span className={styles.gauge} title="Barra di ricarica del cambio">
              Cambio
              <span className={styles.gaugeTrack}>
                <span
                  className={styles.gaugeFill}
                  style={{ width: `${(100 * snapshot.gauge[side]) / settings.switchRecharge}%` }}
                />
              </span>
            </span>
          </div>
          <div className={styles.cards}>
            {record.teams[side].map((_, index) => {
              const fighter = fighterAt(record, snapshot, side, index);
              const hp = snapshot.hp[side][index] ?? 0;
              const classes = [
                styles.card,
                index === snapshot.active[side] && hp > 0 ? styles.onField : '',
                hp === 0 ? styles.out : '',
              ];
              return (
                <div key={index} className={classes.join(' ')}>
                  <div className={styles.cardName}>
                    {fighter.name} <span className={styles.tier}>{fighter.tier}</span>
                  </div>
                  <div className={styles.hpBars}>
                    {Array.from({ length: fighter.sheet.bars }, (_, bar) => (
                      <span key={bar} className={styles.hpBar}>
                        <span
                          className={styles.hpFill}
                          style={{ width: `${Math.min(100, Math.max(0, (100 * (hp - bar * BAR_HP)) / BAR_HP))}%` }}
                        />
                      </span>
                    ))}
                  </div>
                  <div className={styles.hpText}>
                    {hp === 0 ? 'KO' : `${formatHp(hp)} / ${formatHp(fighter.sheet.bars * BAR_HP)}`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <ol className={styles.log}>
        {log.map((line, index) => (
          <li key={log.length - index}>
            <span className={styles.exchange}>{line.exchange}</span> {line.text}
          </li>
        ))}
      </ol>
    </section>
  );
}
