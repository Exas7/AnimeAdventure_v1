import { useRef, useState } from 'react';
import screenStyles from '../director/Screens.module.css';
import { InfoButton } from '../ui/InfoButton';
import { newCatalogId, type QuestionEntry } from './catalog';
import styles from './CatalogPanels.module.css';

interface QuestionsPanelProps {
  questions: QuestionEntry[];
  onChange(questions: QuestionEntry[]): void;
  onExport(): void;
  /** Replaces the questions; resolves with the summary to show. */
  onImport(file: File): Promise<string[]>;
}

const LETTERS = ['A', 'B', 'C', 'D'];

type Draft = Omit<QuestionEntry, 'id'>;

const EMPTY: Draft = { question: '', answers: ['', '', '', ''], correct: 0 };

/** "Domande" in the episode library (spec 027, 2.3): the quiz questions. */
export function QuestionsPanel({ questions, onChange, onExport, onImport }: QuestionsPanelProps) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [deleteAsked, setDeleteAsked] = useState<string | null>(null);
  const [report, setReport] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const save = () => {
    if (!draft) {
      return;
    }
    const answers = draft.answers.map((answer) => answer.trim()).filter(Boolean);
    const clean = { question: draft.question.trim(), answers, correct: Math.min(draft.correct, answers.length - 1) };
    onChange(
      editing
        ? questions.map((entry) => (entry.id === editing ? { ...clean, id: editing } : entry))
        : [...questions, { ...clean, id: newCatalogId() }],
    );
    setDraft(null);
    setEditing(null);
  };
  const ready =
    draft !== null &&
    draft.question.trim() !== '' &&
    draft.answers.filter((answer) => answer.trim()).length >= 3 &&
    Boolean(draft.answers[draft.correct]?.trim());

  return (
    <section className={styles.panel}>
      <h2 className={styles.title}>
        Domande
        <InfoButton label="Domande">
          Le domande a risposta multipla dei quiz: «Randomizza» ne mette una diversa in ogni casella
          con un quiz. Controllale prima della diretta: una risposta sbagliata in onda è peggio di
          nessuna domanda.
        </InfoButton>
      </h2>
      <div className={styles.buttons}>
        <button
          className={styles.primary}
          disabled={draft !== null}
          onClick={() => {
            setEditing(null);
            setDraft(EMPTY);
          }}
        >
          Aggiungi domanda
        </button>
        <button onClick={onExport} disabled={questions.length === 0}>
          Esporta per Excel
        </button>
        <button onClick={() => fileRef.current?.click()}>Importa da Excel</button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) {
              void onImport(file).then(setReport);
            }
          }}
        />
      </div>
      {report.length > 0 && (
        <div className={styles.report}>
          {report.map((line, index) => (
            <p key={index}>{line}</p>
          ))}
          <button onClick={() => setReport([])}>Chiudi</button>
        </div>
      )}

      {draft && (
        <div className={styles.form}>
          <label className={styles.field}>
            Domanda
            <input value={draft.question} onChange={(event) => setDraft({ ...draft, question: event.target.value })} />
          </label>
          {LETTERS.map((letter, index) => (
            <span key={letter} className={styles.row}>
              <label className={styles.correct} title="Risposta giusta">
                <input
                  type="radio"
                  checked={draft.correct === index}
                  onChange={() => setDraft({ ...draft, correct: index })}
                />
                {letter}
              </label>
              <input
                value={draft.answers[index] ?? ''}
                aria-label={`Risposta ${letter}`}
                placeholder={index === 3 ? 'Facoltativa' : ''}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    answers: LETTERS.map((_, at) => (at === index ? event.target.value : (draft.answers[at] ?? ''))),
                  })
                }
              />
            </span>
          ))}
          <div className={styles.buttons}>
            <button className={styles.primary} disabled={!ready} onClick={save}>
              {editing ? 'Salva' : 'Aggiungi'}
            </button>
            <button
              onClick={() => {
                setDraft(null);
                setEditing(null);
              }}
            >
              Annulla
            </button>
          </div>
        </div>
      )}

      <p className={screenStyles.note}>
        {questions.length === 0
          ? 'Nessuna domanda: importa docs/domande.csv con «Importa da Excel».'
          : `${questions.length} domande.`}
      </p>
      <ul className={screenStyles.mapList}>
        {questions.map((entry) => (
          <li key={entry.id}>
            <div>
              <strong>{entry.question}</strong>
              <span className={screenStyles.note}>
                {entry.answers
                  .map((answer, index) => `${LETTERS[index]}) ${answer}${index === entry.correct ? ' ✓' : ''}`)
                  .join('   ')}
              </span>
            </div>
            <div className={screenStyles.mapActions}>
              <button
                onClick={() => {
                  setEditing(entry.id);
                  setDraft({
                    question: entry.question,
                    answers: LETTERS.map((_, index) => entry.answers[index] ?? ''),
                    correct: entry.correct,
                  });
                }}
              >
                Modifica
              </button>
              <button
                className={deleteAsked === entry.id ? screenStyles.danger : undefined}
                onClick={() => {
                  if (deleteAsked === entry.id) {
                    setDeleteAsked(null);
                    onChange(questions.filter((other) => other.id !== entry.id));
                  } else {
                    setDeleteAsked(entry.id);
                  }
                }}
              >
                {deleteAsked === entry.id ? 'Clicca di nuovo per eliminare' : 'Elimina'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
