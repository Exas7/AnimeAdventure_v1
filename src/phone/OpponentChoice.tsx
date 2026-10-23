import { LEVEL_NAMES } from '../ai/brain';
import type { AiLevel } from '../engine';
import styles from './OpponentChoice.module.css';

interface OpponentChoiceProps {
  /** Null: another player on the same phone. */
  level: AiLevel | null;
  /** False in a PvP / PvIA game on the PC (spec 076, 2.1). */
  phone: boolean;
  onChange(level: AiLevel | null): void;
}

const OPTIONS: { level: AiLevel | null; label: string }[] = [
  { level: null, label: 'Un altro giocatore' },
  { level: 'easy', label: `IA · ${LEVEL_NAMES.easy}` },
  { level: 'normal', label: `IA · ${LEVEL_NAMES.normal}` },
  { level: 'hard', label: `IA · ${LEVEL_NAMES.hard}` },
];

/** «Avversario» in «Nuova partita» on the phone (spec 053, 2.1) and for PvP / PvIA on the PC (spec 076, 2.1). */
export function OpponentChoice({ level, phone, onChange }: OpponentChoiceProps) {
  return (
    <section className={styles.choice} aria-label="Avversario">
      <h2 className={styles.title}>Avversario</h2>
      <div className={styles.options}>
        {OPTIONS.map((option) => (
          <button
            key={option.label}
            className={option.level === level ? `${styles.option} ${styles.chosen}` : styles.option}
            aria-pressed={option.level === level}
            onClick={() => onChange(option.level)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className={styles.note}>
        {level
          ? "L'IA è G2 e sceglie da sola il suo starter. Il suo turno si vede passo passo."
          : phone
            ? 'Una partita a due sullo stesso telefono: a ogni turno lo si passa.'
            : 'Una partita a due sullo stesso PC: a ogni turno ci si dà il cambio.'}
      </p>
    </section>
  );
}
