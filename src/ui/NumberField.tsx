import { useEffect, useState } from 'react';
import styles from './NumberField.module.css';

interface NumberFieldProps {
  value: number;
  /** Called once, when the host confirms with Enter or leaves the field. */
  onCommit: (value: number) => void;
  label: string;
}

/**
 * Number input that changes the game only when editing is finished: typing
 * "120" makes one change, not three (each change is an action in the log).
 */
export function NumberField({ value, onCommit, label }: NumberFieldProps) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    const parsed = Number(draft);
    if (draft.trim() !== '' && Number.isFinite(parsed) && Math.trunc(parsed) !== value) {
      onCommit(Math.trunc(parsed));
    } else {
      setDraft(String(value));
    }
  };

  return (
    <input
      className={styles.field}
      type="number"
      aria-label={label}
      title={label}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur();
        } else if (event.key === 'Escape') {
          setDraft(String(value));
        }
      }}
    />
  );
}
