import { useEffect, useMemo, useRef, useState } from 'react';
import {
  cellMission,
  cellNumber,
  missionLabel,
  nextLineIndex,
  rewardText,
  testItems,
  type CellContent,
  type Character,
  type GameMap,
  type NodeType,
} from '../engine';
import { EditorCanvas, type Tool } from '../editor/EditorCanvas';
import { EditorPanel, TypeSelect } from '../editor/EditorPanel';
import { commit, redoEdit, startHistory, undoEdit, type History } from '../editor/history';
import { TOOLS } from '../editor/MapEditor';
import {
  checkMap,
  deleteSelection,
  duplicateSelection,
  existingSelection,
  NO_SELECTION,
  type Selection,
} from '../editor/mapEdit';
import { fullView, type ViewBox } from '../editor/viewBox';
import { CellContentForm } from '../ui/CellContentForm';
import { ChallengeScreen } from '../ui/ChallengeScreen';
import { NumberField } from '../ui/NumberField';
import { TextField } from '../ui/TextField';
import { availableKeepers, keepersUsedIn } from '../catalog/specialKeepers';
import { PlayerProposals } from '../starters/PlayerProposals';
import {
  areEmpty,
  copyPowersFromFirst,
  emptyProposals,
  powersInProposals,
  PROPOSAL_PLAYER_NAMES,
  proposedCharacters,
  proposalIssues,
  withProposal,
  type StarterProposals,
} from '../starters/proposals';
import { availablePowers, type ReadyPower } from '../starters/readyPowers';
import { checkEpisode, checkMissions, emptyCharacterCells } from './checks';
import type { Episode } from './episodeFile';
import { clearCells, type Content } from './fill';
import { randomizeWithMissions } from './missionFill';
import { missionRows } from '../missions/missionList';
import { MissionTable } from '../missions/MissionTable';
import type { CatalogMission, QuestionEntry } from '../missions/catalog';
import { contentAfterMapChange, type DroppedContent } from './mapChange';
import { forgetLine, rememberLines, type TextLibrary } from './textLibrary';
import { PrepCanvas } from './PrepCanvas';
import mapStyles from '../editor/MapEditor.module.css';
import styles from './EpisodeEditor.module.css';
import { describeError } from '../describeError';

interface EpisodeEditorProps {
  initialEpisode: Episode;
  catalog: Character[];
  /** The library of special shopkeepers (D-035). */
  specialKeepers: Character[];
  /** The list of ready powers for the proposed starters (D-037). */
  readyPowers: ReadyPower[];
  /** The catalog of missions and the quiz questions, for "Randomizza" (D-041). */
  missionCatalog: CatalogMission[];
  questions: QuestionEntry[];
  /** Remembered lines (spec 007, 2.5; D-031). */
  texts: TextLibrary;
  onTextsChange(texts: TextLibrary): void;
  onSave(episode: Episode): Promise<void>;
  onExport(episode: Episode): void;
  onExit(): void;
}

type Message = { kind: 'info' | 'warning'; text: string } | null;

/** Characters per shop when filling shops at random, unless the host changes it. */
const DEFAULT_PER_SHOP = 3;

/** Preparing an episode (spec 007). Director window only: the stream never sees it. */
export function EpisodeEditor(props: EpisodeEditorProps) {
  const { initialEpisode, catalog, texts } = props;
  const [history, setHistory] = useState<History<Episode>>(() => startHistory(initialEpisode));
  const [savedEpisode, setSavedEpisode] = useState<Episode>(initialEpisode);
  const [selected, setSelected] = useState<string[]>([]);
  const [view, setView] = useState<ViewBox>(() => fullView(initialEpisode.map));
  const [panning, setPanning] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [exitAsked, setExitAsked] = useState(false);
  const [preview, setPreview] = useState<{
    nodeId: string;
    content: CellContent;
    line: number;
    /** The quiz answer clicked in the preview (spec 026, 2.5). */
    answer?: number;
  } | null>(null);
  const [perShop, setPerShop] = useState(DEFAULT_PER_SHOP);
  // Modes (spec 015, spec 025): characters on the map as in a game, the map
  // itself, or the starters proposed to the players.
  const [mode, setMode] = useState<'content' | 'map' | 'starters'>('content');
  // "Personaggi" mode shows the map or the list of all the missions (spec 029, 2.2).
  const [listView, setListView] = useState(false);
  const [tool, setTool] = useState<Tool>('select');
  const [newCellType, setNewCellType] = useState<NodeType>('empty');
  const [mapSelection, setMapSelection] = useState<Selection>(NO_SELECTION);
  // Path whose opening cell is being chosen on the map (D-027).
  const [pickingFor, setPickingFor] = useState<string | null>(null);

  // Special shopkeepers: the library's, and the older versions this episode
  // still has (spec 022). Menus, board and checks know them all.
  const keepers = useMemo(
    () => availableKeepers(props.specialKeepers, initialEpisode.keepers ?? []),
    [props.specialKeepers, initialEpisode.keepers],
  );
  const allKeepers = useMemo(() => [...keepers.library, ...keepers.onlyInEpisode], [keepers]);
  const known = useMemo(() => [...catalog, ...allKeepers], [catalog, allKeepers]);
  const onlyInEpisode = useMemo(() => keepers.onlyInEpisode.map((keeper) => keeper.id), [keepers]);
  // What gets saved or exported keeps a copy of the special shopkeepers in use (D-035).
  const withKeeperCopies = (draft: Episode): Episode => {
    const { keepers: _previous, ...rest } = draft;
    const used = keepersUsedIn(draft.content, allKeepers);
    return used.length > 0 ? { ...rest, keepers: used } : rest;
  };

  const episode = history.present;
  const { map, content } = episode;
  // Proposed starters (spec 025, D-038): an episode without them starts from three empty ones each.
  const starters = episode.starters ?? emptyProposals();
  const powerChoices = availablePowers(props.readyPowers, powersInProposals(starters));
  const starterIssues = episode.starters ? proposalIssues(episode.starters, catalog) : [];
  const applyStarters = (next: StarterProposals) => {
    const { starters: _previous, ...rest } = episode;
    apply(areEmpty(next) ? rest : { ...rest, starters: next });
  };
  const dirty = episode !== savedEpisode;
  const issues = [...checkEpisode(content, known, map), ...checkMissions(content, known)];
  const mapIssues = checkMap(map);
  // Character cells left empty become passage cells in a game (D-023).
  const emptyCells = emptyCharacterCells(map, content);
  const nodeTypes = new Map(map.nodes.map((node) => [node.id, node.type]));

  const latest = useRef({ history, preview, mode, mapSelection, catalog });
  latest.current = { history, preview, mode, mapSelection, catalog };

  const apply = (next: Episode) => {
    setHistory((current) => commit(current, next));
  };

  // Any change (an edit, undo or redo) asks again before leaving.
  useEffect(() => {
    setExitAsked(false);
  }, [history]);
  const applyContent = (next: Content) => apply({ ...episode, content: next });

  /**
   * A change to the episode's own map (D-025): content that no longer has a
   * place is removed, and the director is told (↺ brings it back).
   */
  const changeMap = (current: History<Episode>, nextMap: GameMap, nextSelection?: Selection) => {
    const before = current.present;
    const result = contentAfterMapChange(before.map, nextMap, before.content);
    setHistory(commit(current, { ...before, map: nextMap, content: result.content }));
    if (nextSelection) {
      setMapSelection(nextSelection);
    }
    if (result.dropped.length > 0) {
      setMessage({ kind: 'warning', text: droppedText(result.dropped, latest.current.catalog) });
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof Element && event.target.closest('input, select, textarea')) {
        return;
      }
      const ctrl = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      const { history: current, mode: currentMode, mapSelection: selectedOnMap } = latest.current;
      const visible = existingSelection(current.present.map, selectedOnMap);
      const anySelected = visible.nodes.length + visible.edges.length > 0;
      if (key === ' ') {
        event.preventDefault();
        setPanning(true);
      } else if (currentMode === 'map' && (event.key === 'Delete' || event.key === 'Backspace')) {
        if (anySelected) {
          changeMap(current, deleteSelection(current.present.map, visible), NO_SELECTION);
        }
      } else if (currentMode === 'map' && ctrl && key === 'd') {
        event.preventDefault();
        if (visible.nodes.length > 0) {
          const copy = duplicateSelection(current.present.map, visible, { x: 0.03, y: 0.03 });
          changeMap(current, copy.map, copy.selection);
        }
      } else if (ctrl && (key === 'y' || (key === 'z' && event.shiftKey))) {
        event.preventDefault();
        setHistory(redoEdit(latest.current.history));
      } else if (ctrl && key === 'z') {
        event.preventDefault();
        setHistory(undoEdit(latest.current.history));
      } else if (event.key === 'Escape') {
        if (latest.current.preview) {
          setPreview(null);
        } else {
          setSelected([]);
          setMapSelection(NO_SELECTION);
          setPickingFor(null);
        }
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

  const saveCell = (nodeId: string, cell: CellContent) => {
    const next = { ...content };
    if (isEmptyCell(cell)) {
      delete next[nodeId];
    } else {
      next[nodeId] = cell;
    }
    applyContent(next);
    props.onTextsChange(rememberLines(texts, cell.lines));
    setMessage({ kind: 'info', text: `Casella ${cellNumber(nodeId)} aggiornata.` });
  };

  // "Randomizza" (spec 022): character cells and shops among the selected cells.
  const randomizeSelected = () => {
    const targets = selected.filter((id) => nodeTypes.has(id));
    const result = randomizeWithMissions(
      map,
      content,
      catalog,
      keepers.library,
      texts,
      targets,
      perShop,
      Math.random,
      { catalog: props.missionCatalog, questions: props.questions, items: testItems },
      // The proposed starters never go on the map (D-044).
      proposedCharacters(episode.starters),
    );
    applyContent(result.content);
    const cells = targets.filter((id) => nodeTypes.get(id) === 'character').length;
    const others = targets.length - cells - result.shops;
    const parts: string[] = [];
    if (cells > 0) {
      parts.push(`Randomizzate ${result.cellsFilled} caselle personaggio.`);
    }
    if (result.cellsLeftEmpty > 0) {
      parts.push(
        `${result.cellsLeftEmpty} restano senza personaggio: non ci sono abbastanza personaggi arruolabili, dal C- in su, non usati nella puntata.`,
      );
    }
    if (result.shops > 0) {
      parts.push(`${result.shops} negozi: ${result.forSaleFilled} personaggi in vendita.`);
    }
    if (result.forSaleLeftEmpty > 0) {
      parts.push(
        `Ne mancano ${result.forSaleLeftEmpty}: non ci sono abbastanza personaggi con prezzo, dal C- in su, non usati.`,
      );
    }
    if (result.keepersKept > 0) {
      parts.push(`${result.keepersKept} negozi tengono il loro negoziante: non ce n'erano altri liberi.`);
    }
    if (others > 0) {
      parts.push(`${others} caselle selezionate non sono Caselle personaggio né negozi e non sono cambiate.`);
    }
    if (result.missions > 0) {
      parts.push(`${result.missions} missioni dal catalogo.`);
    }
    parts.push(...result.notes);
    if (cells > 0 && props.missionCatalog.length === 0) {
      parts.push('Il catalogo delle missioni è vuoto: importalo in Puntate → «Missioni».');
    }
    const short = result.cellsLeftEmpty > 0 || result.forSaleLeftEmpty > 0 || result.keepersKept > 0;
    setMessage({ kind: short ? 'warning' : 'info', text: parts.join(' ') });
  };

  const save = () => {
    const toSave = episode;
    props
      .onSave(withKeeperCopies(toSave))
      .then(() => {
        setSavedEpisode(toSave);
        setMessage({ kind: 'info', text: `"${toSave.name}" salvata nella libreria.` });
      })
      .catch((cause: unknown) =>
        setMessage({
          kind: 'warning',
          text: `Salvataggio non riuscito: ${describeError(cause)}`,
        }),
      );
  };

  // Leaving with unsaved changes or empty character cells asks for a second click.
  const exit = () => {
    if ((dirty || emptyCells.length > 0) && !exitAsked) {
      setExitAsked(true);
      return;
    }
    props.onExit();
  };

  const visibleSelected = selected.filter((id) => nodeTypes.has(id));
  const single = visibleSelected.length === 1 ? (visibleSelected[0] as string) : null;
  const shownMapSelection = existingSelection(map, mapSelection);
  const previewCharacter = known.find((character) => character.id === preview?.content.characterId);
  const previewMission = cellMission(preview?.content);

  return (
    <div className={mapStyles.editor}>
      <header className={mapStyles.toolbar}>
        <button onClick={exit}>← Puntate</button>
        <label className={mapStyles.inline}>
          Puntata
          <TextField
            label="Nome della puntata"
            value={episode.name}
            onCommit={(name) => apply({ ...episode, name: name.trim() || episode.name })}
          />
        </label>
        <span className={mapStyles.inline}>mappa: {map.name}</span>
        <div className={mapStyles.group}>
          <button
            className={mode === 'content' ? mapStyles.active : undefined}
            aria-pressed={mode === 'content'}
            onClick={() => {
              setMode('content');
              setPickingFor(null);
            }}
          >
            Personaggi
          </button>
          <button
            className={mode === 'map' ? mapStyles.active : undefined}
            aria-pressed={mode === 'map'}
            onClick={() => {
              setMode('map');
              setPreview(null);
            }}
          >
            Mappa
          </button>
          <button
            className={mode === 'starters' ? mapStyles.active : undefined}
            aria-pressed={mode === 'starters'}
            onClick={() => {
              setMode('starters');
              setPreview(null);
              setPickingFor(null);
            }}
          >
            Starter
          </button>
        </div>
        {mode === 'map' && (
          <div className={mapStyles.group}>
            {TOOLS.map((entry) => (
              <button
                key={entry.tool}
                className={tool === entry.tool ? mapStyles.active : undefined}
                aria-pressed={tool === entry.tool}
                onClick={() => setTool(entry.tool)}
              >
                {entry.label}
              </button>
            ))}
            {tool === 'cell' && (
              <label className={mapStyles.inline}>
                nuove caselle:
                <TypeSelect value={newCellType} onChange={setNewCellType} />
              </label>
            )}
          </div>
        )}
        <div className={mapStyles.group}>
          <button
            className={mapStyles.arrow}
            onClick={() => setHistory(undoEdit(history))}
            disabled={history.past.length === 0}
            title="Annulla (Ctrl+Z)"
            aria-label="Annulla"
          >
            ↺
          </button>
          <button
            className={mapStyles.arrow}
            onClick={() => setHistory(redoEdit(history))}
            disabled={history.future.length === 0}
            title="Ripeti (Ctrl+Y)"
            aria-label="Ripeti"
          >
            ↻
          </button>
          <button onClick={() => setView(fullView(map))}>Adatta</button>
        </div>
        {mode === 'content' && (
          <div className={mapStyles.group}>
            <button
              className={!listView ? mapStyles.active : undefined}
              aria-pressed={!listView}
              onClick={() => setListView(false)}
            >
              Mappa
            </button>
            <button
              className={listView ? mapStyles.active : undefined}
              aria-pressed={listView}
              onClick={() => {
                setListView(true);
                setPreview(null);
              }}
            >
              Elenco
            </button>
            <button onClick={() => setSelected(map.nodes.map((node) => node.id))}>
              Tutte le caselle
            </button>
            <button onClick={() => setSelected([])} disabled={visibleSelected.length === 0}>
              Nessuna
            </button>
          </div>
        )}
        <div className={mapStyles.group}>
          <button className={mapStyles.primary} onClick={save}>
            Salva{dirty ? ' *' : ''}
          </button>
          <button onClick={() => props.onExport(withKeeperCopies(episode))}>Esporta file</button>
        </div>
      </header>

      <main className={mapStyles.main}>
        {/* The stage's button style is for the scene over the map; the proposals keep their own. */}
        <div
          className={`${mapStyles.canvasArea} ${
            mode === 'starters' || (mode === 'content' && listView) ? '' : styles.stage
          }`}
        >
          {mode === 'starters' ? (
            <div className={styles.starters}>
              {(['p1', 'p2'] as const).map((player) => (
                <PlayerProposals
                  key={player}
                  withHeading
                  playerName={PROPOSAL_PLAYER_NAMES[player]}
                  proposals={starters[player]}
                  catalog={catalog}
                  powers={powerChoices}
                  onChange={(index, proposal) =>
                    applyStarters(withProposal(starters, player, index, proposal))
                  }
                />
              ))}
            </div>
          ) : mode === 'content' && listView ? (
            <div className={styles.missionList}>
              <MissionTable
                rows={missionRows(map, content, known, testItems)}
                onRowClick={(nodeId) => {
                  // Back to the map with that cell open in the panel, ready to correct.
                  setSelected([nodeId]);
                  setListView(false);
                }}
              />
            </div>
          ) : mode === 'content' ? (
            <PrepCanvas
              map={map}
              catalog={known}
              content={content}
              selected={visibleSelected}
              view={view}
              panning={panning}
              onViewChange={setView}
              onSelect={setSelected}
            />
          ) : (
            <EditorCanvas
              map={map}
              tool={tool}
              newCellType={newCellType}
              selection={shownMapSelection}
              view={view}
              panning={panning}
              onViewChange={setView}
              onSelect={setMapSelection}
              onCommit={(next, nextSelection) => changeMap(history, next, nextSelection)}
              pickingFor={pickingFor}
              onPickingChange={setPickingFor}
            />
          )}
          {mode === 'content' && preview && (
            <ChallengeScreen
              nodeId={preview.nodeId}
              content={preview.content}
              character={previewCharacter}
              line={preview.line}
              missionTitle={previewMission ? missionLabel(previewMission, known) : undefined}
              reward={
                previewMission
                  ? rewardText(previewMission.reward, preview.content.characterId, known, testItems) ||
                    undefined
                  : undefined
              }
              quiz={previewMission?.type === 'quiz' ? previewMission.quiz : undefined}
              answer={preview.answer}
              onAnswer={(answer) => setPreview({ ...preview, answer })}
              onBalloonClick={() =>
                setPreview({
                  ...preview,
                  line: nextLineIndex(preview.line, preview.content.lines?.length ?? 0),
                })
              }
            >
              <button onClick={() => setPreview(null)}>Chiudi anteprima</button>
            </ChallengeScreen>
          )}
        </div>

        <div className={mapStyles.side}>
          <div className={mapStyles.messages}>
            {exitAsked && (
              <p className={mapStyles.warning}>
                {dirty && 'Ci sono modifiche non salvate. '}
                {emptyCells.length > 0 && `${emptyCellsText(emptyCells.length)} `}
                Clicca di nuovo "← Puntate" per uscire comunque.
              </p>
            )}
            {message && <p className={mapStyles[message.kind]}>{message.text}</p>}
            {mapIssues.map((issue) => (
              <p key={`map-${issue.kind}`} className={mapStyles.issue}>
                ⚠ {issue.message}
              </p>
            ))}
            {issues.map((issue) => (
              <p key={issue.kind} className={mapStyles.issue}>
                ⚠ {issue.message}
              </p>
            ))}
            {starterIssues.map((issue) => (
              <p key={`starters-${issue.kind}`} className={mapStyles.issue}>
                ⚠ {issue.message}
              </p>
            ))}
            {emptyCells.length > 0 && (
              <p className={mapStyles.issue}>
                ⚠ {emptyCells.length === 1 ? 'Casella personaggio vuota' : 'Caselle personaggio vuote'}:{' '}
                {emptyCells.map(cellNumber).join(', ')}.{' '}
                {emptyCells.length === 1
                  ? 'In partita diventerà un pallino di passaggio.'
                  : 'In partita diventeranno pallini di passaggio.'}
              </p>
            )}
          </div>

          {mode === 'map' && (
            <>
              <p className={`${mapStyles.small} ${styles.modeNote}`}>
                Le modifiche al disegno valgono solo per questa puntata: la mappa nella libreria resta
                com'è.
              </p>
              <EditorPanel
                map={map}
                selection={shownMapSelection}
                onCommit={(next) => changeMap(history, next)}
                pickingFor={pickingFor}
                onPickingChange={setPickingFor}
              />
            </>
          )}

          {mode === 'starters' && (
            <div className={mapStyles.panel}>
              <section>
                <h3>Starter proposti</h3>
                <p className={mapStyles.small}>
                  Tre starter per giocatore, sei personaggi diversi in tutto: in partita ognuno sceglie
                  il suo tra i tre, nella scena della scelta, su regia e stream. I poteri vengono dalla
                  lista in Puntate → «Poteri». In «Nuova partita» si possono ancora cambiare, solo per
                  quella partita.
                </p>
                <div className={styles.buttons}>
                  <button onClick={() => applyStarters(copyPowersFromFirst(starters))}>
                    Stessi poteri del Giocatore 1
                  </button>
                </div>
                <p className={mapStyles.small}>
                  Copia i poteri del Giocatore 1 sul Giocatore 2, proposta per proposta. I personaggi
                  non cambiano.
                </p>
              </section>
            </div>
          )}

          {mode === 'content' && (
            <div className={mapStyles.panel}>
              {visibleSelected.length === 0 && (
                <div className={mapStyles.small}>
                  <p>
                    Seleziona le caselle: clic, Maiusc+clic o trascinando un rettangolo. Rotellina per lo
                    zoom; tasto centrale o barra spaziatrice per spostare la vista.
                  </p>
                </div>
              )}

              {single && (
                <section>
                  <h3>
                    Casella {cellNumber(single)}
                    {nodeTypes.get(single) === 'shop' ? ' · negozio' : ''}
                    {nodeTypes.get(single) === 'character' ? ' · personaggio' : ''}
                  </h3>
                  <CellContentForm
                    key={`${single}:${JSON.stringify(content[single] ?? {})}`}
                    catalog={known}
                    onlyInEpisode={onlyInEpisode}
                    isShop={nodeTypes.get(single) === 'shop'}
                    canHoldCharacter={
                      nodeTypes.get(single) === 'character' ||
                      nodeTypes.get(single) === 'shop' ||
                      Boolean(content[single]?.characterId)
                    }
                    initial={content[single] ?? {}}
                    items={testItems}
                    suggestions={texts}
                    onSave={(cell) => saveCell(single, cell)}
                    onCancel={() => setSelected([])}
                    onPreview={(cell) => setPreview({ nodeId: single, content: cell, line: 0 })}
                  />
                </section>
              )}

              {visibleSelected.length > 1 && (
                <section>
                  <h3>{visibleSelected.length} caselle selezionate</h3>
                  <div className={styles.buttons}>
                    <button className={styles.primary} onClick={randomizeSelected}>
                      Randomizza
                    </button>
                    <button
                      onClick={() => {
                        applyContent(clearCells(content, visibleSelected));
                        setMessage({ kind: 'info', text: `Svuotate ${visibleSelected.length} caselle.` });
                      }}
                    >
                      Svuota
                    </button>
                  </div>
                  <p className={mapStyles.small}>
                    Caselle personaggio: personaggi mai usati, dal tier C- in su, i più deboli vicino
                    alle partenze e i più forti lontano e dietro i percorsi bloccati, in equilibrio tra
                    i due giocatori; una battuta dalla libreria, se la casella non ne ha. Negozi: un
                    negoziante e i personaggi in vendita.
                  </p>
                </section>
              )}

              <section>
                <h3>Negozi</h3>
                <label className={mapStyles.inline}>
                  Personaggi per negozio
                  <NumberField label="Personaggi per negozio" value={perShop} onCommit={setPerShop} />
                </label>
                <p className={mapStyles.small}>
                  Quanti personaggi in vendita mette «Randomizza» in ogni negozio selezionato: con
                  prezzo, dal tier C- in su, mai usati altrove nella puntata. Il negoziante si
                  sceglie tra i negozianti della lista e quelli speciali.
                </p>
              </section>

              <TextLibraryList
                texts={texts}
                onForget={(line) => props.onTextsChange(forgetLine(texts, line))}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

interface TextLibraryListProps {
  texts: TextLibrary;
  onForget(line: string): void;
}

/** The remembered lines, with a way to drop the useless ones (spec 007, 2.5; D-031). */
function TextLibraryList({ texts, onForget }: TextLibraryListProps) {
  return (
    <details className={styles.library}>
      <summary>Libreria delle battute ({texts.lines.length})</summary>
      <p className={mapStyles.small}>
        Si riempie da sola con le battute salvate nelle caselle; le battute compaiono come
        suggerimenti mentre scrivi.
      </p>
      {texts.lines.length === 0 ? (
        <p className={mapStyles.small}>Nessuna.</p>
      ) : (
        <ul>
          {texts.lines.map((line) => (
            <li key={line}>
              <span>{line}</span>
              <button onClick={() => onForget(line)} aria-label={`Togli "${line}"`}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

/** Nothing worth keeping: no character, lines, format or characters for sale. */
function isEmptyCell(cell: CellContent): boolean {
  return Object.values(cell).every(
    (value) => value === undefined || (Array.isArray(value) && value.length === 0),
  );
}

/** "Restano 3 Caselle personaggio vuote: …", in the singular for one. */
function emptyCellsText(count: number): string {
  return count === 1
    ? 'Resta 1 Casella personaggio vuota: in partita diventerà un pallino di passaggio.'
    : `Restano ${count} Caselle personaggio vuote: in partita diventeranno pallini di passaggio.`;
}

/** "Tolti dalla puntata: Muten Roshi (casella #2 eliminata)…" for the director. */
function droppedText(dropped: DroppedContent[], catalog: Character[]): string {
  const nameOf = (id: string) => catalog.find((character) => character.id === id)?.name ?? id;
  const parts = dropped.map(({ nodeId, reason, lost }) => {
    const what = [
      lost.characterId ? nameOf(lost.characterId) : null,
      lost.forSale?.length ? `${lost.forSale.length} personaggi in vendita` : null,
      reason === 'type' && lost.mission ? 'la missione' : null,
      reason === 'type' && lost.lines?.length ? 'le battute' : null,
      reason === 'deleted' && !lost.characterId && !lost.forSale?.length ? 'il contenuto' : null,
    ]
      .filter(Boolean)
      .join(' e ');
    return `${what} (casella ${cellNumber(nodeId)} ${reason === 'deleted' ? 'eliminata' : 'di un altro tipo'})`;
  });
  return `Tolti dalla puntata: ${parts.join(', ')}. ↺ per rimetterli.`;
}

