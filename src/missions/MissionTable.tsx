import { useState } from 'react';
import type { PlayerId } from '../engine';
import {
  countFor,
  KIND_FILTERS,
  matchesFilter,
  STATUS_FILTERS,
  type MissionFilter,
  type MissionRow,
  type MissionStatus,
} from './missionList';
import styles from './MissionTable.module.css';

interface MissionTableProps {
  rows: MissionRow[];
  /** In a game: the players' names for the status column. */
  playerNames?: Record<PlayerId, string>;
  /** A click on a row: open that cell (editor) or its scene (director). */
  onRowClick?: (nodeId: string) => void;
  /** The narrow side panel of the director: one card per mission. */
  compact?: boolean;
}

const LETTERS = ['A', 'B', 'C', 'D'];

/** Every mission of the episode in one place (spec 029). */
export function MissionTable({ rows, playerNames, onRowClick, compact }: MissionTableProps) {
  const [filter, setFilter] = useState<MissionFilter>('all');
  const withStatus = playerNames !== undefined;
  const filters = [...KIND_FILTERS, ...(withStatus ? STATUS_FILTERS : [])].filter(
    (entry) => entry.filter === 'all' || countFor(rows, entry.filter) > 0,
  );
  const shown = rows.filter((row) => matchesFilter(row, filter));
  const statusText = (status: MissionStatus | undefined) => {
    if (!status || !playerNames) {
      return '';
    }
    if (status.kind === 'done') {
      return `completata da ${playerNames[status.player]}`;
    }
    if (status.kind === 'active') {
      return `in corso: ${status.players.map((player) => playerNames[player]).join(' e ')}`;
    }
    return 'libera';
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.filters} role="group" aria-label="Filtra le missioni">
        {filters.map((entry) => (
          <button
            key={entry.filter}
            className={entry.filter === filter ? styles.activeFilter : undefined}
            aria-pressed={entry.filter === filter}
            onClick={() => setFilter(entry.filter)}
          >
            {entry.label} <span className={styles.count}>{countFor(rows, entry.filter)}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className={styles.empty}>Nessuna missione.</p>
      ) : compact ? (
        <ul className={styles.cards}>
          {shown.map((row) => (
            <li key={row.nodeId}>
              <button className={styles.card} onClick={() => onRowClick?.(row.nodeId)} disabled={!onRowClick}>
                <span className={styles.head}>
                  <strong>
                    {row.cell} {row.character}
                  </strong>
                  {row.status && (
                    <span className={`${styles.status} ${styles[row.status.kind] ?? ''}`}>{statusText(row.status)}</span>
                  )}
                </span>
                <span>{row.mission}</span>
                {row.reward !== '—' && <span className={styles.muted}>Premio: {row.reward}</span>}
                {row.quiz && <Quiz quiz={row.quiz} />}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.scroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Casella</th>
                <th>Personaggio</th>
                <th>Missione</th>
                <th>Premio</th>
                <th>Battute</th>
                {withStatus && <th>Stato</th>}
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr
                  key={row.nodeId}
                  className={onRowClick ? styles.clickable : undefined}
                  onClick={() => onRowClick?.(row.nodeId)}
                  title={onRowClick ? `Apri ${row.cell}` : undefined}
                >
                  <td className={styles.cell}>{row.cell}</td>
                  <td>{row.character}</td>
                  <td>
                    {row.mission}
                    {row.quiz && <Quiz quiz={row.quiz} />}
                  </td>
                  <td>{row.reward}</td>
                  <td>
                    {row.lines.length > 0
                      ? row.lines.map((line, index) => <p key={index}>«{line}»</p>)
                      : '—'}
                  </td>
                  {withStatus && <td>{statusText(row.status)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** The question and the answers, the right one marked: the list is for the director only. */
function Quiz({ quiz }: { quiz: NonNullable<MissionRow['quiz']> }) {
  return (
    <span className={styles.quiz}>
      <em>{quiz.question}</em>
      {quiz.answers.map((answer, index) => (
        <span key={index} className={index === quiz.correct ? styles.right : undefined}>
          {LETTERS[index]}) {answer}
          {index === quiz.correct ? ' ✓' : ''}
        </span>
      ))}
    </span>
  );
}
