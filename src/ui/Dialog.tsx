import { useEffect, type ReactNode } from 'react';
import { Frame, FrameTitle } from '../theme/Frame';
import { CloseButton } from './CloseButton';
import styles from './Dialog.module.css';

interface DialogProps {
  title: string;
  /** A window for a few lines, not as wide as the others. */
  narrow?: boolean;
  onClose(): void;
  children: ReactNode;
}

/**
 * A window over the page (spec 029, 2.5): Esc closes it, like "Annulla".
 * The title and «✕ Chiudi» stay at the top while the window scrolls (spec 065).
 */
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
      <Frame
        className={narrow ? `${styles.dialog} ${styles.narrow}` : styles.dialog}
        contentClassName={styles.content}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className={styles.head}>
          <FrameTitle className={styles.title}>{title}</FrameTitle>
          <CloseButton onClose={onClose} />
        </div>
        {children}
      </Frame>
    </div>
  );
}
