import { useState } from 'react';
import {
  defaultMission,
  MISSION_TYPES,
  type ChallengeFormat,
  type Character,
  type ItemDefinition,
  type Mission,
  type MissionReward,
  type MissionType,
} from '../engine';
import { CharacterPicker } from './CharacterPicker';
import type { CharacterGroup } from './characterGroups';
import { NumberField } from './NumberField';
import styles from './MissionEditor.module.css';

interface MissionEditorProps {
  /** Undefined: no mission, the cell works as before with lines and "Assegna". */
  mission: Mission | undefined;
  onChange(mission: Mission | undefined): void;
  catalog: Character[];
  /** The character menus, by saga (spec 017). */
  groups: CharacterGroup[];
  items: ItemDefinition[];
}

const FORMATS: ChallengeFormat[] = ['1v1', '2v2', '3v3'];
const LETTERS = ['A', 'B', 'C', 'D'];

/** The mission of a character cell and its reward (spec 026, 2.2). */
export function MissionEditor({ mission, onChange, catalog, groups, items }: MissionEditorProps) {
  const set = (changes: Partial<Mission>) => mission && onChange({ ...mission, ...changes });
  const setReward = (changes: Partial<MissionReward>) =>
    mission && onChange({ ...mission, reward: { ...mission.reward, ...changes } });

  return (
    <div className={styles.editor}>
      <label className={styles.field}>
        Missione
        <select
          value={mission?.type ?? ''}
          onChange={(event) => {
            const type = event.target.value as MissionType | '';
            onChange(type ? defaultMission(type, mission?.reward) : undefined);
          }}
        >
          <option value="">Nessuna: battute e «Assegna», come prima</option>
          {MISSION_TYPES.map((entry) => (
            <option key={entry.type} value={entry.type}>
              {entry.label}
            </option>
          ))}
        </select>
      </label>

      {mission?.type === 'fight' && (
        <>
          <div className={styles.row}>
            <label className={styles.field}>
              Formato
              <select
                value={mission.format ?? '1v1'}
                onChange={(event) => set({ format: event.target.value as ChallengeFormat })}
              >
                {FORMATS.map((format) => (
                  <option key={format} value={format}>
                    {format}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              Condizione
              <select
                value={mission.condition ?? 'win'}
                onChange={(event) =>
                  set({ condition: event.target.value === 'transform' ? 'transform' : 'win' })
                }
              >
                <option value="win">Vincere</option>
                <option value="transform">L'avversario si trasforma</option>
              </select>
            </label>
          </div>
          <CharacterList
            label="Avversari mandati in campo (vuoto: il personaggio della casella)"
            ids={mission.opponents ?? []}
            onChange={(opponents) => set({ opponents })}
            catalog={catalog}
            groups={groups}
          />
        </>
      )}

      {mission?.type === 'quiz' && mission.quiz && (
        <div className={styles.field}>
          Domanda
          <input
            value={mission.quiz.question}
            aria-label="Domanda"
            onChange={(event) =>
              mission.quiz && set({ quiz: { ...mission.quiz, question: event.target.value } })
            }
          />
          {mission.quiz.answers.map((answer, index) => (
            <span key={index} className={styles.row}>
              <label className={styles.correct} title="Risposta giusta">
                <input
                  type="radio"
                  checked={mission.quiz?.correct === index}
                  onChange={() => mission.quiz && set({ quiz: { ...mission.quiz, correct: index } })}
                />
                {LETTERS[index]}
              </label>
              <input
                value={answer}
                aria-label={`Risposta ${LETTERS[index]}`}
                onChange={(event) =>
                  mission.quiz &&
                  set({
                    quiz: {
                      ...mission.quiz,
                      answers: mission.quiz.answers.map((other, at) =>
                        at === index ? event.target.value : other,
                      ),
                    },
                  })
                }
              />
            </span>
          ))}
          <span className={styles.row}>
            {mission.quiz.answers.length < 4 ? (
              <button
                onClick={() =>
                  mission.quiz && set({ quiz: { ...mission.quiz, answers: [...mission.quiz.answers, ''] } })
                }
              >
                Aggiungi la risposta D
              </button>
            ) : (
              <button
                onClick={() =>
                  mission.quiz &&
                  set({
                    quiz: {
                      ...mission.quiz,
                      answers: mission.quiz.answers.slice(0, 3),
                      correct: Math.min(mission.quiz.correct, 2),
                    },
                  })
                }
              >
                Solo tre risposte
              </button>
            )}
          </span>
          <span className={styles.hint}>Il pallino segna la risposta giusta: la vede solo la regia.</span>
        </div>
      )}

      {(mission?.type === 'goTo' ||
        mission?.type === 'defeat' ||
        mission?.type === 'bring' ||
        mission?.type === 'escort') && (
        <>
          <label className={styles.field}>
            {mission.type === 'goTo'
              ? 'Da chi andare'
              : mission.type === 'escort'
                ? 'Da chi accompagnarlo (deve stare sul tabellone)'
                : mission.type === 'defeat'
                  ? 'Chi battere (deve stare sul tabellone)'
                  : 'Chi avere in squadra'}
            <CharacterPicker
              catalog={catalog}
              groups={groups}
              value={mission.targetId ?? ''}
              onChange={(targetId) => set({ targetId: targetId || undefined })}
              placeholder="Scegli il personaggio…"
              ariaLabel="Obiettivo della missione"
            />
          </label>
          {mission.type === 'goTo' && (
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={mission.returnToGiver ?? false}
                onChange={(event) => set({ returnToGiver: event.target.checked })}
              />
              Poi torna da chi ha dato la missione
            </label>
          )}
        </>
      )}

      {(mission?.type === 'wait' || mission?.type === 'skipTurns') && (
        <label className={styles.field}>
          {mission.type === 'wait' ? 'Turni da attendere (intanto si gioca)' : 'Turni da saltare'}
          <NumberField
            label="Turni"
            value={mission.turns ?? 1}
            onCommit={(turns) => set({ turns: Math.max(0, turns) })}
          />
        </label>
      )}

      {mission?.type === 'other' && (
        <label className={styles.field}>
          Cosa chiede (il conduttore la segna completata)
          <input value={mission.text ?? ''} onChange={(event) => set({ text: event.target.value })} />
        </label>
      )}

      {mission && (
        <fieldset className={styles.reward}>
          <legend>Premio</legend>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={mission.reward.cellCharacter ?? false}
              onChange={(event) => setReward({ cellCharacter: event.target.checked || undefined })}
            />
            Il personaggio della casella entra in squadra
          </label>
          <CharacterList
            label="Altri personaggi in squadra"
            ids={mission.reward.characters ?? []}
            onChange={(characters) => setReward({ characters: characters.length ? characters : undefined })}
            catalog={catalog}
            groups={groups}
          />
          <label className={styles.field}>
            Monete
            <NumberField
              label="Monete del premio"
              value={mission.reward.coins ?? 0}
              onCommit={(coins) => setReward({ coins: coins || undefined })}
            />
          </label>
          <ItemList
            ids={mission.reward.items ?? []}
            items={items}
            onChange={(chosen) => setReward({ items: chosen.length ? chosen : undefined })}
          />
        </fieldset>
      )}
    </div>
  );
}

interface CharacterListProps {
  label: string;
  ids: string[];
  onChange(ids: string[]): void;
  catalog: Character[];
  groups: CharacterGroup[];
}

/** A few characters, each removable, and a menu to add one more. */
function CharacterList({ label, ids, onChange, catalog, groups }: CharacterListProps) {
  const [adding, setAdding] = useState('');
  const nameOf = (id: string) => catalog.find((character) => character.id === id)?.name ?? id;
  const add = () => {
    if (adding && !ids.includes(adding)) {
      onChange([...ids, adding]);
    }
    setAdding('');
  };
  return (
    <div className={styles.field}>
      {label}
      {ids.length > 0 && (
        <ul className={styles.chips}>
          {ids.map((id) => (
            <li key={id}>
              {nameOf(id)}
              <button onClick={() => onChange(ids.filter((other) => other !== id))} aria-label={`Togli ${nameOf(id)}`}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <span className={styles.row}>
        <CharacterPicker
          catalog={catalog}
          groups={groups}
          value={adding}
          onChange={setAdding}
          placeholder="Aggiungi personaggio…"
          ariaLabel={label}
          onSubmit={add}
        />
        <button onClick={add} disabled={!adding}>
          Aggiungi
        </button>
      </span>
    </div>
  );
}

interface ItemListProps {
  ids: string[];
  items: ItemDefinition[];
  onChange(ids: string[]): void;
}

/** Items of the reward: they go to the inventory. */
function ItemList({ ids, items, onChange }: ItemListProps) {
  const nameOf = (id: string) => items.find((item) => item.id === id)?.name ?? id;
  return (
    <div className={styles.field}>
      Oggetti
      {ids.length > 0 && (
        <ul className={styles.chips}>
          {ids.map((id, index) => (
            <li key={`${id}-${index}`}>
              {nameOf(id)}
              <button onClick={() => onChange(ids.filter((_, at) => at !== index))} aria-label={`Togli ${nameOf(id)}`}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <select
        value=""
        aria-label="Aggiungi oggetto al premio"
        onChange={(event) => event.target.value && onChange([...ids, event.target.value])}
      >
        <option value="">Aggiungi oggetto…</option>
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
    </div>
  );
}
