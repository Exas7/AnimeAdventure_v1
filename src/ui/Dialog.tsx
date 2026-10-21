import { useEffect, type ReactNode } from 'react';
import styles from './Dialog.module.css';

interface DialogProps {
  title: string;
  /** A window for a few lines, not as wide as the others. */
  narrow?: boolean;
  onClose(): void;
  children: ReactNode;
}

/** A window over the page (spec 029, 2.5): Esc closes it, like "Annulla". */
export function Dialog({ title, narrow, onClose, children }: DialogProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className={styles.backdrop}>
      <div
        className={narrow ? `${styles.dialog} ${styles.narrow}` : styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <h2 className={styles.title}>{title}</h2>
        {children}
      </div>
    </div>
  );
}
