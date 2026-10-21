import { useSyncExternalStore } from 'react';
import { DirectorApp } from './DirectorApp';
import { directorWindow, type DirectorWindow } from './directorLock';
import styles from './Screens.module.css';

// One per page: the window keeps the lock for as long as it is open.
let thisWindow: DirectorWindow | null = null;

function director(): DirectorWindow {
  thisWindow ??= directorWindow(navigator.locks);
  return thisWindow;
}

/** The director only in the window that holds it; the others say where it is (spec 032). */
export function DirectorGate() {
  const here = director();
  const status = useSyncExternalStore(here.subscribe, here.status);

  if (status === 'active') {
    return <DirectorApp />;
  }
  if (status === 'checking') {
    return <div className={styles.screen} />;
  }
  return (
    <div className={styles.screen}>
      <h1 className={styles.title}>Regia</h1>
      <p className={styles.note}>
        {status === 'taken'
          ? "La regia è passata a un'altra finestra."
          : "La regia è già aperta in un'altra finestra."}
      </p>
      <div className={styles.choices}>
        <button className={styles.primary} onClick={here.takeOver}>
          Usa questa finestra
        </button>
      </div>
      <p className={styles.note}>
        L'altra finestra si spegne: ciò che lì non è salvato (una mappa o una puntata in preparazione) si
        perde. La partita no, si salva da sola a ogni azione.
      </p>
    </div>
  );
}
