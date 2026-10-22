import { useState } from 'react';
import {
  nextForms,
  trainingRule,
  trainingRuleText,
  trainingWarnings,
  type Game,
  type GameState,
  type PlayerId,
  type TrainingChoice,
} from '../engine';
import { Dialog } from '../ui/Dialog';
import styles from './TrainingDialog.module.css';

interface TrainingDialogProps {
  game: Game;
  state: GameState;
  player: PlayerId;
  itemId: string;
  onConfirm(choices: TrainingChoice[]): void;
  onClose(): void;
}

/**
 * "Usa" on a training item (spec 041, 2.2): the host chooses who goes up and
 * by how many forms, the window shows the new forms and the guides of the
 * item (D-008); "Conferma" does it all in one action.
 */
export function TrainingDialog({ game, state, player, itemId, onConfirm, onClose }: TrainingDialogProps) {
  const [forms, setForms] = useState<Record<string, number>>({});
  const item = game.items.find((candidate) => candidate.id === itemId);
  const rule = item ? trainingRule(item) : undefined;
  if (!item || !rule) {
    return null;
  }
  const { team, starterId, name: playerName } = state.players[player];
  const nameOf = (id: string) => game.catalog.find((character) => character.id === id)?.name ?? id;
  const choices: TrainingChoice[] = Object.entries(forms).map(([characterId, count]) => ({
    characterId,
    forms: count,
  }));
  const warnings = trainingWarnings(state, game, itemId, choices);

  const toggle = (characterId: string, count: number) =>
    setForms((current) => {
      const next = { ...current };
      if (next[characterId] === count) {
        delete next[characterId];
      } else {
        next[characterId] = count;
      }
      return next;
    });

  return (
    <Dialog title={`${item.name} · ${playerName}`} onClose={onClose}>
      <p className={styles.rule}>{trainingRuleText(rule)}</p>
      <ul className={styles.team}>
        {[...new Set(team)].map((characterId) => {
          const later = nextForms(game.catalog, characterId, rule.formsEach);
          const chosen = forms[characterId];
          return (
            <li key={characterId} className={later.length === 0 ? styles.none : undefined}>
              <span className={styles.name}>
                {nameOf(characterId)}
                {characterId === starterId && <span title="Starter"> ★</span>}
              </span>
              {later.length === 0 ? (
                <span className={styles.muted}>non ha altre forme</span>
              ) : (
                <span className={styles.steps}>
                  {later.map((formId, index) => (
                    <button
                      key={formId}
                      type="button"
                      className={chosen === index + 1 ? styles.chosen : undefined}
                      aria-pressed={chosen === index + 1}
                      onClick={() => toggle(characterId, index + 1)}
                    >
                      +{index + 1}
                    </button>
                  ))}
                </span>
              )}
              {chosen !== undefined && (
                <span className={styles.change}>→ {nameOf(later[chosen - 1] ?? characterId)}</span>
              )}
            </li>
          );
        })}
      </ul>
      {warnings.map((warning) => (
        <p key={warning.message} className={styles.warning}>
          {warning.message}
        </p>
      ))}
      <div className={styles.buttons}>
        <button
          type="button"
          className={styles.confirm}
          disabled={choices.length === 0}
          onClick={() => onConfirm(choices)}
        >
          Conferma
        </button>
      </div>
    </Dialog>
  );
}
