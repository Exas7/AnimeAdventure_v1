import { useMemo } from 'react';
import { TEAM_SIZE, type Character } from '../../engine';
import { CharacterPicker } from '../../ui/CharacterPicker';
import type { Fighter, Side } from '../fight';
import { SIDE_NAMES } from '../playback';
import type { Move } from '../sheets';
import styles from './BattlePage.module.css';

interface TeamColumnProps {
  side: Side;
  /** The chosen characters, in the order they fight. */
  ids: string[];
  fighters: Map<string, { character: Character; fighter: Fighter }>;
  onChange: (ids: string[]) => void;
  /** Missing: "Squadra A" or "Squadra B". */
  name?: string;
}

const KIND_NAMES = { wave: 'onda', rush: 'impeto' } as const;

function moveText(move: Move): string {
  const giants = move.hitsGiants ? ', funziona sui giganti' : '';
  return `${move.name} (${KIND_NAMES[move.kind]}${giants})`;
}

/** One team (2.10): from 1 to 5 characters in order, each with its sheet. */
export function TeamColumn({ side, ids, fighters, onChange, name = SIDE_NAMES[side] }: TeamColumnProps) {
  const catalog = useMemo(() => [...fighters.values()].map((entry) => entry.character), [fighters]);
  const move = (index: number, step: -1 | 1) => {
    const next = [...ids];
    const [taken] = next.splice(index, 1);
    next.splice(index + step, 0, taken as string);
    onChange(next);
  };

  return (
    <section className={`${styles.team} ${styles[side]}`}>
      <h2 className={styles.teamName}>{name}</h2>
      <ol className={styles.lineUp}>
        {ids.map((id, index) => {
          const fighter = fighters.get(id)?.fighter;
          if (!fighter) {
            return null;
          }
          const { sheet } = fighter;
          return (
            <li key={`${id}-${index}`} className={styles.member}>
              <div className={styles.memberHead}>
                <span className={styles.memberName}>{fighter.name}</span>
                <span className={styles.tier}>{fighter.tier}</span>
                {sheet.giant && <span className={styles.badge}>gigante</span>}
                <span className={styles.memberButtons}>
                  <button type="button" disabled={index === 0} onClick={() => move(index, -1)} aria-label="Più su">
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={index === ids.length - 1}
                    onClick={() => move(index, 1)}
                    aria-label="Più giù"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange(ids.filter((_, other) => other !== index))}
                    aria-label="Togli"
                  >
                    ✕
                  </button>
                </span>
              </div>
              <div className={styles.sheet}>
                {sheet.bars} barre · Potenza {sheet.power} · Velocità {sheet.speed}
                {!fighters.get(id)?.character.fight && ' · scheda normale'}
                {fighter.next && ` · si trasforma in ${fighter.next.name}`}
              </div>
              <div className={styles.sheet}>
                {sheet.moves.map(moveText).join(' · ')} · Finale: {moveText(sheet.finale)}
              </div>
            </li>
          );
        })}
      </ol>
      {ids.length < TEAM_SIZE ? (
        <CharacterPicker
          catalog={catalog}
          value=""
          onChange={(id) => id && onChange([...ids, id])}
          placeholder="Aggiungi un personaggio…"
          ariaLabel={`Aggiungi un personaggio: ${name}`}
        />
      ) : (
        <p className={styles.note}>Squadra completa.</p>
      )}
    </section>
  );
}
