import { useEffect, useRef, useState } from 'react';
import type { GameMap, NodeType } from '../engine';
import { boardSize } from '../ui/boardModel';
import { BACKGROUNDS } from './backgroundAssets';
import type { BackgroundAsset } from './backgrounds';
import { EditorCanvas, type Tool } from './EditorCanvas';
import { EditorPanel, TypeSelect } from './EditorPanel';
import { commit, redoEdit, startHistory, undoEdit, type EditorHistory } from './history';
import {
  checkMap,
  deleteSelection,
  duplicateSelection,
  existingSelection,
  nextVersionName,
  renameMap,
  NO_SELECTION,
  setBackground,
  type Selection,
} from './mapEdit';
import { fullView, type ViewBox } from './viewBox';
import styles from './MapEditor.module.css';
import { describeError } from '../describeError';

/** Above this size the background still works, but files get heavy (D-008 guide). */
const LARGE_IMAGE_BYTES = 10 * 1024 * 1024;

interface MapEditorProps {
  initialMap: GameMap;
  onSave(map: GameMap): Promise<void>;
  /** Saves the drawing as a new map of the library; the old one stays (spec 015). */
  onSaveAs(map: GameMap): Promise<void>;
  /** Names already in the library, to suggest a free version name. */
  existingNames: string[];
  onExport(map: GameMap): void;
  onExit(): void;
}

type Message = { kind: 'info' | 'warning'; text: string } | null;

/** The drawing tools, also used by the map mode of an episode (spec 015). */
export const TOOLS: { tool: Tool; label: string }[] = [
  { tool: 'select', label: 'Seleziona' },
  { tool: 'cell', label: 'Casella' },
  { tool: 'path', label: 'Percorso' },
];

/** The map editor (spec 006). Director window only: the stream never sees it. */
export function MapEditor(props: MapEditorProps) {
  const { initialMap, onSave, onExport, onExit } = props;
  const [history, setHistory] = useState<EditorHistory>(() => startHistory(initialMap));
  const [savedMap, setSavedMap] = useState<GameMap>(initialMap);
  const [tool, setTool] = useState<Tool>('select');
  const [newCellType, setNewCellType] = useState<NodeType>('empty');
  const [selection, setSelection] = useState<Selection>(NO_SELECTION);
  const [message, setMessage] = useState<Message>(null);
  const [exitAsked, setExitAsked] = useState(false);
  const [panning, setPanning] = useState(false);
  // Path whose opening cell is being chosen on the map (D-027).
  const [pickingFor, setPickingFor] = useState<string | null>(null);

  const map = history.present;
  const size = boardSize(map);
  const [view, setView] = useState<ViewBox>(() => fullView(initialMap));
  const dirty = map !== savedMap;
  const issues = checkMap(map);

  // A new background changes the proportions: show the whole map again.
  useEffect(() => {
    setView({ x: 0, y: 0, w: size.width, h: size.height });
  }, [size.width, size.height]);

  // Latest values for the keyboard handler.
  const latest = useRef({ history, selection });
  latest.current = { history, selection };

  const apply = (next: GameMap, nextSelection?: Selection) => {
    setHistory((current) => commit(current, next));
    if (nextSelection) {
      setSelection(nextSelection);
    }
    setExitAsked(false);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof Element && event.target.closest('input, select, textarea')) {
        return;
      }
      const { history: current, selection: selected } = latest.current;
      const ctrl = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (key === ' ') {
        event.preventDefault();
        setPanning(true);
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selected.nodes.length + selected.edges.length > 0) {
          setHistory(commit(current, deleteSelection(current.present, selected)));
          setSelection(NO_SELECTION);
        }
      } else if (ctrl && key === 'd') {
        event.preventDefault();
        if (selected.nodes.length > 0) {
          const copy = duplicateSelection(current.present, selected, { x: 0.03, y: 0.03 });
          setHistory(commit(current, copy.map));
          setSelection(copy.selection);
        }
      } else if (ctrl && (key === 'y' || (key === 'z' && event.shiftKey))) {
        event.preventDefault();
        setHistory(redoEdit(current));
      } else if (ctrl && key === 'z') {
        event.preventDefault();
        setHistory(undoEdit(current));
      } else if (event.key === 'Escape') {
        setSelection(NO_SELECTION);
        setPickingFor(null);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === ' ') {
        setPanning(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  /** A chosen file, or an image of assets/maps (spec 011): copied into the map (D-018). */
  const loadBackground = (file: Blob) => {
    const reader = new FileReader();
    reader.onerror = () => setMessage({ kind: 'warning', text: 'Impossibile leggere l\'immagine.' });
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const image = new Image();
      image.onerror = () =>
        setMessage({ kind: 'warning', text: 'Il file scelto non è un\'immagine leggibile.' });
      image.onload = () => {
        apply(
          setBackground(map, {
            image: dataUrl,
            width: image.naturalWidth,
            height: image.naturalHeight,
          }),
        );
        setMessage(
          file.size > LARGE_IMAGE_BYTES
            ? {
                kind: 'warning',
                text: `Sfondo caricato, ma pesa ${(file.size / 1048576).toFixed(1)} MB: mappa e salvataggi saranno pesanti.`,
              }
            : { kind: 'info', text: 'Sfondo caricato.' },
        );
      };
      image.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const loadAsset = (asset: BackgroundAsset) => {
    fetch(asset.url)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`risposta ${response.status}`);
        }
        return response.blob();
      })
      .then(loadBackground)
      .catch((cause: unknown) =>
        setMessage({
          kind: 'warning',
          text: `Impossibile leggere lo sfondo "${asset.name}": ${describeError(cause)}`,
        }),
      );
  };

  const save = () => {
    const toSave = map;
    onSave(toSave)
      .then(() => {
        setSavedMap(toSave);
        setMessage({ kind: 'info', text: `"${toSave.name}" salvata nella libreria.` });
      })
      .catch((cause: unknown) =>
        setMessage({
          kind: 'warning',
          text: `Salvataggio non riuscito: ${describeError(cause)}`,
        }),
      );
  };

  // "Salva come…" (spec 015): the name to give the new version, while asking.
  const [saveAsName, setSaveAsName] = useState<string | null>(null);

  const saveAs = (name: string) => {
    const renamed = renameMap(map, name.trim() || nextVersionName(map.name, props.existingNames));
    props
      .onSaveAs(renamed)
      .then(() => {
        setHistory((current) => commit(current, renamed));
        setSavedMap(renamed);
        setSaveAsName(null);
        setMessage({
          kind: 'info',
          text: `Salvata come "${renamed.name}". "${map.name}" è rimasta com'era nella libreria.`,
        });
      })
      .catch((cause: unknown) =>
        setMessage({
          kind: 'warning',
          text: `Salvataggio non riuscito: ${describeError(cause)}`,
        }),
      );
  };

  // Leaving with unsaved changes asks for a second click (spec 006, 2.6).
  const exit = () => {
    if (dirty && !exitAsked) {
      setExitAsked(true);
      return;
    }
    onExit();
  };

  return (
    <div className={styles.editor}>
      <header className={styles.toolbar}>
        <button onClick={exit}>← Libreria</button>
        <div className={styles.group}>
          {TOOLS.map((entry) => (
            <button
              key={entry.tool}
              className={tool === entry.tool ? styles.active : undefined}
              aria-pressed={tool === entry.tool}
              onClick={() => setTool(entry.tool)}
            >
              {entry.label}
            </button>
          ))}
          {tool === 'cell' && (
            <label className={styles.inline}>
              nuove caselle:
              <TypeSelect value={newCellType} onChange={setNewCellType} />
            </label>
          )}
        </div>
        <div className={styles.group}>
          <button
            className={styles.arrow}
            onClick={() => setHistory(undoEdit(history))}
            disabled={history.past.length === 0}
            title="Annulla (Ctrl+Z)"
            aria-label="Annulla"
          >
            ↺
          </button>
          <button
            className={styles.arrow}
            onClick={() => setHistory(redoEdit(history))}
            disabled={history.future.length === 0}
            title="Ripeti (Ctrl+Y)"
            aria-label="Ripeti"
          >
            ↻
          </button>
          <button onClick={() => setView(fullView(map))}>Adatta</button>
        </div>
        <div className={styles.group}>
          <label className={styles.fileButton}>
            Carica sfondo
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) {
                  loadBackground(file);
                }
              }}
            />
          </label>
          {BACKGROUNDS.length > 0 && (
            <select
              className={styles.backgroundMenu}
              value=""
              aria-label="Sfondi della cartella assets"
              title="Sfondi della cartella assets/maps"
              onChange={(event) => {
                const chosen = BACKGROUNDS.find((entry) => entry.url === event.target.value);
                if (chosen) {
                  loadAsset(chosen);
                }
              }}
            >
              <option value="">Sfondi…</option>
              {BACKGROUNDS.map((entry) => (
                <option key={entry.url} value={entry.url}>
                  {entry.name}
                </option>
              ))}
            </select>
          )}
          {map.background && (
            <button onClick={() => apply(setBackground(map, undefined))}>Togli sfondo</button>
          )}
        </div>
        <div className={styles.group}>
          <button className={styles.primary} onClick={save}>
            Salva{dirty ? ' *' : ''}
          </button>
          {saveAsName === null ? (
            <button onClick={() => setSaveAsName(nextVersionName(map.name, props.existingNames))}>
              Salva come…
            </button>
          ) : (
            <span className={styles.inline}>
              <input
                className={styles.nameInput}
                aria-label="Nome della nuova versione"
                value={saveAsName}
                autoFocus
                onChange={(event) => setSaveAsName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    saveAs(saveAsName);
                  } else if (event.key === 'Escape') {
                    setSaveAsName(null);
                  }
                }}
              />
              <button className={styles.primary} onClick={() => saveAs(saveAsName)}>
                Salva la nuova versione
              </button>
              <button onClick={() => setSaveAsName(null)}>Annulla</button>
            </span>
          )}
          <button onClick={() => onExport(map)}>Esporta file</button>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.canvasArea}>
          <EditorCanvas
            map={map}
            tool={tool}
            newCellType={newCellType}
            selection={existingSelection(map, selection)}
            view={view}
            panning={panning}
            onViewChange={setView}
            onSelect={setSelection}
            onCommit={apply}
            pickingFor={pickingFor}
            onPickingChange={setPickingFor}
          />
        </div>
        {/* Messages live in the side column, so the drawing area never jumps. */}
        <div className={styles.side}>
          <div className={styles.messages}>
            {exitAsked && (
              <p className={styles.warning}>
                Ci sono modifiche non salvate: clicca di nuovo "← Libreria" per uscire senza salvare.
              </p>
            )}
            {message && <p className={styles[message.kind]}>{message.text}</p>}
            {issues.map((issue) => (
              <p key={issue.kind} className={styles.issue}>
                ⚠ {issue.message}
              </p>
            ))}
          </div>
          <EditorPanel
            map={map}
            selection={existingSelection(map, selection)}
            onCommit={(next) => apply(next)}
            pickingFor={pickingFor}
            onPickingChange={setPickingFor}
          />
        </div>
      </main>
    </div>
  );
}
