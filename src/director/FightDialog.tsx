import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_SETTINGS, fighterOf, recordFight, SIDES, type FightRecord } from '../battle/fight';
import type { Sides } from '../battle/inGame';
import { FightPanel } from '../battle/page/FightPanel';
import { TeamColumn } from '../battle/page/TeamColumn';
import type { BattleView, SideNames } from '../battle/playback';
import { usePlayback } from '../battle/usePlayback';
import type { Character } from '../engine';
import pageStyles from '../battle/page/BattlePage.module.css';
import styles from './FightDialog.module.css';

interface FightDialogProps {
  title: string;
  names: SideNames;
  catalog: Character[];
  /** Who is proposed on the field; the host can change it before the fight. */
  initial: Sides;
  /** Forms a transformation may not take: already elsewhere in the game (D-064). */
  blocked: ReadonlySet<string>;
  /** Sends the fight to the stream while it is told; null when it closes. */
  onView(view: BattleView | null): void;
  /** What the host can do once the fight is over. */
  outcome(record: FightRecord): ReactNode;
  onClose(): void;
}

/**
 * A simulated fight inside the game (spec 037, 2.4-2.5, D-058): first who
 * fights, then the fight told step by step in the director and on the
 * stream, then the proposed outcome. The host always has the last click.
 */
export function FightDialog(props: FightDialogProps) {
  const { title, names, catalog, initial, blocked, onView, outcome, onClose } = props;
  const fighters = useMemo(
    () =>
      new Map(
        catalog.flatMap((character) => {
          const fighter = fighterOf(character, catalog, blocked);
          return fighter ? [[fighter.id, { character, fighter }] as const] : [];
        }),
      ),
    [catalog, blocked],
  );
  // Characters without a tier cannot fight (spec 037, 2.4): left out, and said.
  const [left] = useState(() =>
    SIDES.flatMap((side) => initial[side])
      .filter((id) => !fighters.has(id))
      .map((id) => catalog.find((character) => character.id === id)?.name ?? id),
  );
  const [teams, setTeams] = useState<Sides>(() => ({
    a: initial.a.filter((id) => fighters.has(id)),
    b: initial.b.filter((id) => fighters.has(id)),
  }));
  const [record, setRecord] = useState<FightRecord | null>(null);
  const playback = usePlayback(record);
  const { shown, speed } = playback;
  const ready = SIDES.every((side) => teams[side].length > 0);

  useEffect(() => {
    if (record) {
      onView({ record, shown, speed, switchRecharge: DEFAULT_SETTINGS.switchRecharge, names });
    }
  }, [record, shown, speed, names, onView]);
  // Closing the fight gives the stream back to the game.
  useEffect(() => () => onView(null), [onView]);

  const start = () => {
    const side = (ids: string[]) => ids.flatMap((id) => fighters.get(id)?.fighter ?? []);
    setRecord(recordFight({ a: side(teams.a), b: side(teams.b) }, DEFAULT_SETTINGS, Math.random));
    playback.restart();
  };

  return (
    <div className={styles.backdrop}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-label={title}>
        <h2 className={styles.title}>{title}</h2>
        {!record ? (
          <>
            <p className={styles.note}>
              Chi combatte e in che ordine: puoi aggiungere, togliere e riordinare. Lo scontro va sulla
              stream appena lo avvii.
            </p>
            {left.length > 0 && (
              <p className={styles.warning}>
                ⚠ Senza tier, non combattono nel simulatore: {left.join(', ')}.
              </p>
            )}
            <div className={styles.teams}>
              {SIDES.map((side) => (
                <TeamColumn
                  key={side}
                  side={side}
                  name={names[side]}
                  ids={teams[side]}
                  fighters={fighters}
                  onChange={(ids) => setTeams({ ...teams, [side]: ids })}
                />
              ))}
            </div>
            <div className={pageStyles.actions}>
              <button type="button" className={pageStyles.primary} disabled={!ready} onClick={start}>
                Avvia lo scontro
              </button>
              <button type="button" onClick={onClose}>
                Annulla
              </button>
            </div>
          </>
        ) : (
          <>
            <FightPanel
              record={record}
              settings={DEFAULT_SETTINGS}
              shown={shown}
              playing={playback.playing}
              speed={speed}
              onShown={playback.jump}
              onPlaying={playback.setPlaying}
              onSpeed={playback.setSpeed}
              names={names}
            />
            {shown >= record.steps.length && <div className={styles.outcome}>{outcome(record)}</div>}
            <div className={pageStyles.actions}>
              <button type="button" onClick={onClose}>
                Chiudi lo scontro
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
