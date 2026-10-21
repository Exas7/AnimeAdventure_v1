import type { PlayerId } from '../engine';
import type { StarterChoiceView } from '../starters/starterChoice';
import { StarterChoiceScreen } from '../ui/StarterChoiceScreen';
import styles from './StarterChoiceStage.module.css';

interface StarterChoiceStageProps {
  view: StarterChoiceView;
  /** Who chooses first: "Avanti" goes from them to the other player and back. */
  firstPlayer: PlayerId;
  canStart: boolean;
  onChoose(index: number): void;
  onShowOther(): void;
  onBack(): void;
  onStart(): void;
  onOpenStream(): void;
}

/**
 * The starter choice in the director window (spec 025, 2.4): the same scene
 * the stream shows, with the cards to click and the host's commands above.
 */
export function StarterChoiceStage(props: StarterChoiceStageProps) {
  const { view, firstPlayer } = props;
  const second: PlayerId = firstPlayer === 'p1' ? 'p2' : 'p1';
  return (
    <div className={styles.page}>
      <header className={styles.bar}>
        <button onClick={props.onBack}>← Nuova partita</button>
        <button onClick={props.onShowOther}>
          {view.showing === firstPlayer
            ? `Avanti: sceglie ${view.teams[second].name}`
            : `← Torna a ${view.teams[firstPlayer].name}`}
        </button>
        <button className={styles.primary} disabled={!props.canStart} onClick={props.onStart}>
          Inizia partita
        </button>
        <button onClick={props.onOpenStream}>Apri stream</button>
        <span className={styles.note}>
          {props.canStart
            ? 'Tutti e due hanno scelto: «Inizia partita» apre il tabellone.'
            : 'Clic su una scheda per sceglierla: lo stream mostra la stessa scena.'}
        </span>
      </header>
      <div className={styles.area}>
        <div className={styles.stage}>
          <StarterChoiceScreen view={view} onChoose={props.onChoose} />
        </div>
      </div>
    </div>
  );
}
