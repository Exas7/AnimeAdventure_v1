import { Fragment, useState, type ReactNode } from 'react';
import { PLAYER_IDS, TEAM_SIZE, type Character, type GameState, type PlayerId } from '../engine';
import { Frame } from '../theme/Frame';
import { ownImage } from './characterImages';
import { CloseButton } from './CloseButton';
import { Placeholder } from './Placeholder';
import styles from './Overlay.module.css';

interface ShowdownScreenProps {
  state: GameState;
  catalog: Character[];
  /** Director buttons; absent on the stream. */
  children?: ReactNode;
  /** The red «✕» on the top right corner of the frame (spec 065, 6); absent on the stream and on the phone. */
  onClose?: () => void;
  /** Director and phone: two cards of a team are touched in turn and swap places (spec 081); absent on the stream. */
  onSwap?: (player: PlayerId, a: number, b: number) => void;
}

/** The two teams in two rows, VS between them: the first five characters of each (spec 018). */
export function ShowdownScreen({ state, catalog, children, onClose, onSwap }: ShowdownScreenProps) {
  const [picked, setPicked] = useState<{ player: PlayerId; slot: number } | null>(null);
  const touch = (player: PlayerId, slot: number) => {
    if (!onSwap) {
      return;
    }
    if (picked?.player === player && picked.slot !== slot) {
      onSwap(player, picked.slot, slot);
      setPicked(null);
    } else {
      setPicked(picked?.player === player && picked.slot === slot ? null : { player, slot });
    }
  };
  const nameOf = (characterId: string) =>
    catalog.find((character) => character.id === characterId)?.name ?? characterId;

  return (
    <div className={styles.backdrop}>
      <Frame
        danger
        className={styles.showdownFrame}
        contentClassName={styles.showdown}
        corner={onClose && <CloseButton onClose={onClose} />}
      >
        <h2 className={styles.showdownTitle}>Showdown</h2>
        <div className={styles.teams}>
          {PLAYER_IDS.map((playerId, index) => (
            <Fragment key={playerId}>
              {index > 0 && <span className={styles.versus}>VS</span>}
              <section className={`${styles.team} ${styles[playerId] ?? ''}`}>
                <h3>{state.players[playerId].name}</h3>
                <ol>
                  {state.players[playerId].team.slice(0, TEAM_SIZE).map((characterId, slot) => (
                    <li
                      key={`${characterId}-${slot}`}
                      className={`${styles.showdownSlot} ${picked?.player === playerId && picked.slot === slot ? styles.showdownPicked : ''}`}
                      onClick={onSwap ? () => touch(playerId, slot) : undefined}
                      title={onSwap ? 'Tocca due personaggi della squadra per scambiarli' : undefined}
                    >
                      <Placeholder
                        name={nameOf(characterId)}
                        characterId={characterId}
                        imageData={ownImage(catalog, characterId)}
                        size="fill"
                      />
                    </li>
                  ))}
                </ol>
              </section>
            </Fragment>
          ))}
        </div>
        {children && <div className={styles.actions}>{children}</div>}
      </Frame>
    </div>
  );
}
