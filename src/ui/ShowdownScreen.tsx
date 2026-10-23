import { Fragment, type ReactNode } from 'react';
import { PLAYER_IDS, TEAM_SIZE, type Character, type GameState } from '../engine';
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
}

/** The two teams in two rows, VS between them: the first five characters of each (spec 018). */
export function ShowdownScreen({ state, catalog, children, onClose }: ShowdownScreenProps) {
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
                    <li key={`${characterId}-${slot}`} className={styles.showdownSlot}>
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
