import { useId, useState, type ReactNode } from 'react';
import styles from './InfoButton.module.css';

interface InfoButtonProps {
  /** What the explanation is about, for screen readers: "Informazioni: Poteri". */
  label: string;
  children: ReactNode;
}

/**
 * A small "i" (spec 028, 3.2): the explanation shows while the mouse is on
 * it, and a click keeps it open until the next click or Esc.
 */
export function InfoButton({ label, children }: InfoButtonProps) {
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const id = useId();
  const open = pinned || hovered;
  return (
    <span
      className={styles.wrap}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        className={`${styles.button} ${pinned ? styles.pinned : ''}`}
        aria-label={`Informazioni: ${label}`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setPinned((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setPinned(false);
          }
        }}
      >
        i
      </button>
      {open && (
        <span id={id} role="tooltip" className={styles.popover}>
          {children}
        </span>
      )}
    </span>
  );
}
