import { DirectorApp } from '../director/DirectorApp';
import styles from './PhoneShell.module.css';

/**
 * The phone version (spec 052, D-083): the app without director lock or
 * stream, landscape only. Held upright, the phone shows only «Ruota il
 * telefono» (2.1).
 */
export function PhoneShell() {
  return (
    <div className={styles.shell}>
      <div className={styles.app}>
        <DirectorApp phone />
      </div>
      <div className={styles.rotate} role="alert">
        <span className={styles.icon} aria-hidden="true">
          ⟳
        </span>
        <p>Ruota il telefono</p>
        <p className={styles.note}>Anime Adventure si gioca in orizzontale.</p>
      </div>
    </div>
  );
}
