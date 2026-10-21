import { useMemo } from 'react';
import { gameLog, type Game } from '../engine';
import styles from './SidePanel.module.css';

/** The game log, most recent first (spec 003, 2.11). */
export function LogPanel({ game }: { game: Game }) {
  const entries = useMemo(() => gameLog(game).reverse(), [game]);
  return (
    <ol className={styles.log}>
      {entries.map((entry, index) => (
        <li key={entries.length - index}>
          <span className={styles.logMeta}>
            T{entry.turn} · {entry.playerName}
          </span>{' '}
          {entry.text}
          {entry.details.length > 0 && (
            <ul className={styles.logDetails}>
              {entry.details.map((detail, detailIndex) => (
                <li key={detailIndex}>{detail}</li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
}
