import type { ReactNode } from 'react';
import { cellNumber, type CellContent, type Character, type QuizQuestion } from '../engine';
import { CloseButton } from './CloseButton';
import { Placeholder } from './Placeholder';
import overlayStyles from './Overlay.module.css';
import styles from './ChallengeScreen.module.css';

interface ChallengeScreenProps {
  nodeId: string;
  content: CellContent | undefined;
  character: Character | undefined;
  /** Index of the line in the balloon (D-031). */
  line: number;
  /** Director only: a click on the balloon shows the next line, with a "2/3" counter. */
  onBalloonClick?: () => void;
  /** Director only: a note in the corner, e.g. "Solo in regia" for a preview (D-032). */
  label?: string;
  /** The mission in words, e.g. "Combattimento 2v2" (spec 026, 2.3). */
  missionTitle?: string;
  /** What the mission gives, e.g. "Krilin, 500 monete". */
  reward?: string;
  /** A quiz: the question in the balloon and the answers below (spec 026, 2.5). */
  quiz?: QuizQuestion;
  /** The answer the host clicked, if any. */
  answer?: number;
  /** Director only: the right answer is marked, and a click gives the player's answer. */
  onAnswer?: (index: number) => void;
  /** The phone (spec 052, 2.6): the player answers, so the right answer is not marked before. */
  hideRightAnswer?: boolean;
  /** Director buttons; absent on the stream. */
  children?: ReactNode;
  /** «✕ Chiudi» in the corner (spec 065); absent on the stream. */
  onClose?: () => void;
}

/**
 * The challenge scene (spec 020): the whole character on the left, its
 * line in a horizontal balloon on the right. Same on director and stream,
 * except for the director's buttons, counter and label.
 */
export function ChallengeScreen(props: ChallengeScreenProps) {
  const { nodeId, content, character, onBalloonClick, label, children } = props;
  const { missionTitle, reward, quiz } = props;
  const name = character?.name ?? `Casella ${cellNumber(nodeId)}`;
  const lines = content?.lines ?? [];
  // Lines removed while the scene is open: start again from the first one.
  const index = props.line < lines.length ? props.line : 0;
  const text = lines[index];

  return (
    <div className={overlayStyles.backdrop}>
      {props.onClose && <CloseButton className={overlayStyles.corner} onClose={props.onClose} />}
      <div className={styles.scene}>
        <div className={styles.figure}>
          <Placeholder
            name={name}
            characterId={character?.id}
            imageData={character?.imageData}
            size="fill"
            figure
          />
        </div>
        <div className={styles.speech}>
          <h2 className={styles.name}>
            {name}
            {missionTitle && <span className={styles.format}>{missionTitle}</span>}
          </h2>
          {reward && <p className={styles.reward}>Premio: {reward}</p>}
          {quiz ? (
            <Quiz quiz={quiz} answer={props.answer} onAnswer={props.onAnswer} hideRightAnswer={props.hideRightAnswer} />
          ) : (
            text !== undefined &&
            (onBalloonClick ? (
              <button
                className={`${styles.balloon} ${styles.clickable}`}
                onClick={onBalloonClick}
                title={lines.length > 1 ? 'Battuta successiva' : undefined}
              >
                {text}
              </button>
            ) : (
              <p className={styles.balloon}>{text}</p>
            ))
          )}
          {!quiz && onBalloonClick && lines.length > 1 && (
            <span className={styles.counter}>
              Battuta {index + 1}/{lines.length} · clic sul balloon per la successiva
            </span>
          )}
          {children && <div className={overlayStyles.actions}>{children}</div>}
        </div>
        {label && <span className={styles.label}>{label}</span>}
      </div>
    </div>
  );
}

const LETTERS = ['A', 'B', 'C', 'D'];

interface QuizProps {
  quiz: QuizQuestion;
  answer: number | undefined;
  onAnswer?: (index: number) => void;
  hideRightAnswer?: boolean;
}

/**
 * The question in the balloon and the answers under it (spec 026, 2.5).
 * Once the host clicks the player's answer, it turns green or red and the
 * right one lights up; before that, only the director sees which is right.
 */
function Quiz({ quiz, answer, onAnswer, hideRightAnswer = false }: QuizProps) {
  const answered = answer !== undefined;
  const marked = onAnswer !== undefined && !hideRightAnswer;
  return (
    <>
      <p className={styles.balloon}>{quiz.question}</p>
      <ol className={styles.answers}>
        {quiz.answers.map((text, index) => {
          const classes = [
            styles.answer,
            answered && index === quiz.correct ? styles.right : '',
            answered && index === answer && index !== quiz.correct ? styles.wrong : '',
            !answered && marked && index === quiz.correct ? styles.hint : '',
          ].join(' ');
          const body = (
            <>
              <span className={styles.letter}>{LETTERS[index]}</span>
              <span>{text}</span>
            </>
          );
          return (
            <li key={index}>
              {onAnswer ? (
                <button
                  className={classes}
                  onClick={() => onAnswer(index)}
                  disabled={hideRightAnswer && answered}
                  title={marked && index === quiz.correct ? 'Risposta giusta' : undefined}
                >
                  {body}
                </button>
              ) : (
                <div className={classes}>{body}</div>
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}
