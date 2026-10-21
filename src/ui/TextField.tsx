import { useEffect, useState } from 'react';
import styles from './NumberField.module.css';

interface TextFieldProps {
  value: string;
  /** Called once, when the host confirms with Enter or leaves the field. */
  onCommit: (value: string) => void;
  label: string;
  placeholder?: string;
}

/** Text input that changes data only when editing is finished, like NumberField. */
export function TextField({ value, onCommit, label, placeholder }: TextFieldProps) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <input
      className={`${styles.field} ${styles.text}`}
      aria-label={label}
      placeholder={placeholder}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (draft !== value) {
          onCommit(draft);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur();
        } else if (event.key === 'Escape') {
          setDraft(value);
        }
      }}
    />
  );
}
