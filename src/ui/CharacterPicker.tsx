import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import type { Character } from '../engine';
import { filterGroups, groupBySaga, searchPick, type CharacterGroup } from './characterGroups';
import styles from './CharacterPicker.module.css';

interface CharacterPickerProps {
  catalog: Character[];
  /** The tiles; by saga unless given (the starter menu puts its own first). */
  groups?: CharacterGroup[];
  /** The chosen character id, or '' for none. */
  value: string;
  onChange(characterId: string): void;
  placeholder: string;
  ariaLabel: string;
  /** Enter on the closed field with a character chosen, e.g. to add it. */
  onSubmit?: () => void;
}

/** Room kept between the menu and the window edges, in pixels. */
const MARGIN = 8;
const MIN_WIDTH = 280;
const MAX_HEIGHT = 420;

/**
 * Character menu (spec 017, D-028): a field that opens a search bar and
 * one tile per saga, one tile open at a time. Choosing a character only
 * fills the field.
 */
export function CharacterPicker(props: CharacterPickerProps) {
  const { catalog, value, onChange, placeholder, ariaLabel, onSubmit } = props;
  const groups = useMemo(() => props.groups ?? groupBySaga(catalog), [props.groups, catalog]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [openTile, setOpenTile] = useState<string | null>(null);
  // The menu is drawn on the page itself, above everything: side panels that
  // scroll do not cut it, and their styles for buttons and fields do not reach it.
  const [place, setPlace] = useState<CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const chosen = catalog.find((character) => character.id === value);

  const close = () => {
    setOpen(false);
    setSearch('');
    setOpenTile(null);
  };

  const choose = (character: Character) => {
    onChange(character.id);
    close();
    fieldRef.current?.focus();
  };

  useLayoutEffect(() => {
    if (!open) {
      return undefined;
    }
    const placeMenu = () => {
      const field = fieldRef.current?.getBoundingClientRect();
      if (!field) {
        return;
      }
      const width = Math.max(field.width, MIN_WIDTH);
      const left = Math.max(MARGIN, Math.min(field.left, window.innerWidth - width - MARGIN));
      const below = window.innerHeight - field.bottom - MARGIN;
      const above = field.top - MARGIN;
      setPlace(
        below >= MAX_HEIGHT || below >= above
          ? { left, width, top: field.bottom + 4, maxHeight: Math.min(MAX_HEIGHT, below) }
          : {
              left,
              width,
              bottom: window.innerHeight - field.top + 4,
              maxHeight: Math.min(MAX_HEIGHT, above),
            },
      );
    };
    placeMenu();
    window.addEventListener('resize', placeMenu);
    window.addEventListener('scroll', placeMenu, true);
    return () => {
      window.removeEventListener('resize', placeMenu);
      window.removeEventListener('scroll', placeMenu, true);
    };
  }, [open]);

  // A click anywhere else closes the menu.
  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        close();
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const searching = search.trim() !== '';
  const shown = filterGroups(groups, search);

  const menu = (
    <div
      ref={menuRef}
      className={styles.menu}
      style={place}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          close();
          fieldRef.current?.focus();
        }
      }}
    >
      <input
        className={styles.search}
        autoFocus
        value={search}
        placeholder="Cerca personaggio…"
        aria-label="Cerca personaggio"
        onChange={(event) => setSearch(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            const picked = searchPick(groups, search);
            if (picked) {
              choose(picked);
            }
          }
        }}
      />
      <div className={styles.tiles} role="listbox" aria-label={ariaLabel}>
        {shown.length === 0 && <p className={styles.empty}>Nessun personaggio trovato.</p>}
        {shown.map((group) => {
          // While searching every saga with a match is open; otherwise one at a time.
          const expanded = searching || openTile === group.label;
          return (
            <section key={group.label} className={styles.tile}>
              <button
                type="button"
                className={styles.tileHeader}
                aria-expanded={expanded}
                onClick={
                  searching
                    ? undefined
                    : () => setOpenTile(openTile === group.label ? null : group.label)
                }
              >
                <span className={styles.tileArrow} aria-hidden="true">
                  {expanded ? '▾' : '▸'}
                </span>
                <span className={styles.tileLabel}>{group.label}</span>
                <span className={styles.count}>{group.characters.length}</span>
              </button>
              {expanded && (
                <ul className={styles.characters}>
                  {group.characters.map((character) => (
                    <li key={character.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={character.id === value}
                        className={character.id === value ? styles.chosen : undefined}
                        onClick={() => choose(character)}
                      >
                        {character.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className={styles.picker} ref={rootRef}>
      <button
        ref={fieldRef}
        type="button"
        className={styles.field}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !open && chosen && onSubmit) {
            event.preventDefault();
            onSubmit();
          }
        }}
      >
        <span className={chosen ? styles.value : styles.placeholder}>
          {chosen?.name ?? placeholder}
        </span>
        <span className={styles.arrow} aria-hidden="true">
          ▾
        </span>
      </button>

      {open && createPortal(menu, document.body)}
    </div>
  );
}
