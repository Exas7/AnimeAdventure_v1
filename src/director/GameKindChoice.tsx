import type { GameKind } from '../phone/gameKind';
import styles from './GameKindChoice.module.css';

interface GameKindChoiceProps {
  kind: GameKind;
  onChange(kind: GameKind): void;
}

const OPTIONS: { kind: GameKind; label: string; note: string }[] = [
  { kind: 'director', label: 'Regia + Stream', note: 'Conduci tu la partita, con lo stream per la diretta.' },
  {
    kind: 'arbitrated',
    label: 'PvP / PvIA',
    note: "L'app fa da arbitro: contro un'altra persona sullo stesso PC, o contro l'IA.",
  },
];

/** «Tipo di partita» at the top of «Nuova partita» on the PC (spec 076, 2.1; D-101). */
export function GameKindChoice({ kind, onChange }: GameKindChoiceProps) {
  const chosen = OPTIONS.find((option) => option.kind === kind);
  return (
    <section className={styles.choice} aria-label="Tipo di partita">
      <h2 className={styles.title}>Tipo di partita</h2>
      <div className={styles.options}>
        {OPTIONS.map((option) => (
          <button
            key={option.kind}
            className={option.kind === kind ? `${styles.option} ${styles.chosen}` : styles.option}
            aria-pressed={option.kind === kind}
            onClick={() => onChange(option.kind)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className={styles.note}>{chosen?.note}</p>
    </section>
  );
}
