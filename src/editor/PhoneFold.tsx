import { useState, type ReactNode } from 'react';
import styles from './MapEditor.module.css';

/** The toolbar and the side column of an editor on the phone, open or folded away (spec 054, 2.4). */
export interface PhoneFold {
  /** Class names for the editor's root: they hide what is folded. */
  rootClass: string;
  /** At the start of the toolbar: folds it. */
  closeBar: ReactNode;
  /** At the top of the side column: folds it. */
  closeSide: ReactNode;
  /** Over the map: brings back what is folded. */
  reopen: ReactNode;
}

export function usePhoneFold(phone: boolean): PhoneFold {
  const [barOpen, setBarOpen] = useState(true);
  const [sideOpen, setSideOpen] = useState(true);
  if (!phone) {
    return { rootClass: '', closeBar: null, closeSide: null, reopen: null };
  }
  return {
    rootClass: [styles.phone, barOpen ? '' : styles.barClosed, sideOpen ? '' : styles.sideClosed].join(' '),
    closeBar: (
      <button className={styles.fold} aria-label="Chiudi il menu" title="Chiudi il menu" onClick={() => setBarOpen(false)}>
        ▴
      </button>
    ),
    closeSide: (
      <button className={`${styles.fold} ${styles.foldSide}`} onClick={() => setSideOpen(false)}>
        Chiudi pannello ⟩
      </button>
    ),
    reopen:
      barOpen && sideOpen ? null : (
        <>
          {!barOpen && (
            <button className={`${styles.reopen} ${styles.reopenBar}`} onClick={() => setBarOpen(true)}>
              ☰ Menu
            </button>
          )}
          {!sideOpen && (
            <button className={`${styles.reopen} ${styles.reopenSide}`} onClick={() => setSideOpen(true)}>
              ⟨ Pannello
            </button>
          )}
        </>
      ),
  };
}
