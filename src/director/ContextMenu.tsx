import { useEffect, useRef } from 'react';
import { Frame } from '../theme/Frame';
import type { ScreenPoint } from '../ui/Board';
import styles from './ContextMenu.module.css';

export interface MenuItem {
  label: string;
  run(): void;
}

export interface MenuState {
  at: ScreenPoint;
  title?: string;
  items: MenuItem[];
}

interface ContextMenuProps {
  menu: MenuState;
  onClose(): void;
}

/** Small menu opened with the right mouse button on a cell or a path. */
export function ContextMenu({ menu, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        onClose();
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [onClose]);

  return (
    <Frame
      thin
      ref={ref}
      className={styles.menu}
      contentClassName={styles.items}
      style={{ left: menu.at.x, top: menu.at.y }}
      role="menu"
    >
      {menu.title && <div className={styles.title}>{menu.title}</div>}
      {menu.items.map((item) => (
        <button
          key={item.label}
          role="menuitem"
          onClick={() => {
            item.run();
            onClose();
          }}
        >
          {item.label}
        </button>
      ))}
    </Frame>
  );
}
