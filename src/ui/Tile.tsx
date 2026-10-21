import type { ReactNode } from 'react';
import styles from './Tile.module.css';

interface TileProps {
  title: ReactNode;
  /** How many things are inside, next to the title. */
  count?: number;
  /** Grey text after the title, on the same line when it fits. */
  detail?: ReactNode;
  /** Given with `onToggle`, the tile opens and closes as the caller says; otherwise it starts closed. */
  open?: boolean;
  onToggle?: (open: boolean) => void;
  children: ReactNode;
}

/** A box that opens and closes with a click on its header (spec 033). */
export function Tile({ title, count, detail, open, onToggle, children }: TileProps) {
  return (
    <details
      className={styles.tile}
      open={open}
      onToggle={(event) => onToggle?.(event.currentTarget.open)}
    >
      <summary className={styles.header}>
        <span className={styles.title}>{title}</span>
        {count !== undefined && <span className={styles.count}>{count}</span>}
        {detail && <span className={styles.detail}>{detail}</span>}
      </summary>
      <div className={styles.body}>{children}</div>
    </details>
  );
}
