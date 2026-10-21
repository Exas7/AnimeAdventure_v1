import { useRef, useState } from 'react';
import { cellNumber, testItems, type Character, type GameMap } from '../engine';
import { fullView, type ViewBox } from '../editor/viewBox';
import type { CatalogMission, QuestionEntry } from '../missions/catalog';
import { missionRows } from '../missions/missionList';
import { MissionTable } from '../missions/MissionTable';
import { PlayerProposals } from '../starters/PlayerProposals';
import { PowerDialog } from '../starters/PowerDialog';
import {
  areEmpty,
  copyPowersFromFirst,
  emptyProposals,
  powersInProposals,
  PROPOSAL_PLAYER_NAMES,
  proposalIssues,
  withProposal,
} from '../starters/proposals';
import type { ReadyPowerDraft } from '../starters/ReadyPowerForm';
import { availablePowers, type ReadyPower } from '../starters/readyPowers';
import { InfoButton } from '../ui/InfoButton';
import { NumberField } from '../ui/NumberField';
import { checkEpisode, checkMissions, emptyCharacterCells } from './checks';
import type { Episode } from './episodeFile';
import type { MapOption } from './EpisodeLibraryScreen';
import type { Content } from './fill';
import { libraryStatus, newEpisode, type LibraryId } from './newEpisode';
import { PrepCanvas } from './PrepCanvas';
import { SpecialKeepersPanel } from './SpecialKeepersPanel';
import {
  DEFAULT_PER_SHOP,
  nextEpisodeName,
  pickPlayableMap,
  randomEpisode,
  randomizeCellsStep,
  randomizeShopsStep,
  randomizeStartersStep,
  shopRows,
  type RandomSources,
} from './stepRandomize';
import type { TextLibrary } from './textLibrary';
import screenStyles from '../director/Screens.module.css';
import styles from './NewEpisodeWizard.module.css';
import { describeError } from '../describeError';

interface NewEpisodeWizardProps {
  /** The host's maps, then the base maps that come with the app (spec 033, 2.2). */
  maps: MapOption[];
  loadMap(id: string): Promise<GameMap | null>;
  /** The names of the episodes already saved: a new name takes the first free number. */
  episodeNames: string[];
  /** The imported character list (D-017). */
  catalog: Character[];
  readyPowers: ReadyPower[];
  specialKeepers: Character[];
  missions: CatalogMission[];
  questions: QuestionEntry[];
  texts: TextLibrary;
  onCreatePower(draft: ReadyPowerDraft): Promise<ReadyPower | null>;
  onAddKeeper(name: string, image: File): void;
  onEditKeeper(keeper: Character, name: string, image: File | null): void;
  onDeleteKeeper(id: string): void;
  onImportMissions(file: File): Promise<string[]>;
  onImportQuestions(file: File): Promise<string[]>;
  /** Saves the new episode in the library and resolves with its code. */
  onSave(episode: Episode): Promise<string>;
  onOpenInEditor(id: string, episode: Episode): void;
  onClose(): void;
  showError(message: string): void;
}

const STEPS = [
  'Prima di cominciare',
  'Mappa e nome',
  'Starter',
  'Negozi',
  'Personaggi e missioni',
  'Fine',
];

/** "＋ Nuova puntata" (spec 028, 3.3): an episode built step by step, nothing blocks. */
export function NewEpisodeWizard(props: NewEpisodeWizardProps) {
  const { catalog, maps } = props;
  const [step, setStep] = useState(0);
  const [mapId, setMapId] = useState(maps[0]?.id ?? '');
  const [map, setMap] = useState<GameMap | null>(null);
  // Which map of the library `map` is a copy of: choosing another one loads it again.
  const [loadedMapId, setLoadedMapId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [starters, setStarters] = useState(emptyProposals);
  const [perShop, setPerShop] = useState(DEFAULT_PER_SHOP);
  const [content, setContent] = useState<Content | null>(null);
  // What each "Randomizza" did, under its button (spec 030, 2.2).
  const [starterNotes, setStarterNotes] = useState<string[]>([]);
  const [shopSummary, setShopSummary] = useState<string[]>([]);
  const [cellSummary, setCellSummary] = useState<string[]>([]);
  const [view, setView] = useState<ViewBox | null>(null);
  const [newPowerFor, setNewPowerFor] = useState<((power: ReadyPower) => void) | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [exitAsked, setExitAsked] = useState(false);
  const [report, setReport] = useState<string[]>([]);

  const known = [...catalog, ...props.specialKeepers];
  const powers = availablePowers(props.readyPowers, powersInProposals(starters));
  const started = map !== null || content !== null;

  const status = libraryStatus({
    characters: catalog,
    powers: props.readyPowers.length,
    specialKeepers: props.specialKeepers.length,
    missions: props.missions.length,
    questions: props.questions.length,
  });

  // Past "Mappa e nome" the chosen map is loaded; a different map drops what
  // "Randomizza" did on the old one, which no longer fits.
  const goTo = async (next: number) => {
    if (next > 1 && loadedMapId !== mapId) {
      const loaded = mapId ? await props.loadMap(mapId) : null;
      if (!loaded) {
        props.showError('Scegli una mappa che si riesca a leggere, al passo «Mappa e nome».');
        setStep(1);
        return;
      }
      setMap(loaded);
      setLoadedMapId(mapId);
      setView(fullView(loaded));
      setContent(null);
      setShopSummary([]);
      setCellSummary([]);
      if (!name.trim()) {
        // The first free number, as with "Randomizza" (spec 033, 2.5).
        setName(nextEpisodeName(loaded.name, props.episodeNames));
      }
    }
    setExitAsked(false);
    setStep(next);
  };

  // Reading a map can fail (the browser's storage): the director is told (spec 034, 2.5).
  const mapNotRead = (cause: unknown) => props.showError(`Mappa non letta: ${describeError(cause)}`);

  const sources = (): RandomSources => ({
    catalog,
    specialKeepers: props.specialKeepers,
    powers: props.readyPowers,
    texts: props.texts,
    missions: { catalog: props.missions, questions: props.questions, items: testItems },
    perShop,
    random: Math.random,
  });

  const noPlayableMap = () =>
    props.showError("Nessuna mappa ha Caselle personaggio: aggiungile con l'editor delle mappe.");

  // Step "Mappa e nome": a map of the library or an included one, and its first free name.
  const randomizeMap = async () => {
    const picked = await pickPlayableMap(maps, props.loadMap, Math.random);
    if (!picked) {
      noPlayableMap();
      return;
    }
    setMapId(picked.option.id);
    setName(nextEpisodeName(picked.option.name, props.episodeNames));
  };

  // Never characters already on the map (D-044): the map can stay as it is.
  const randomizeStarters = () => {
    const result = randomizeStartersStep(content, sources());
    setStarters(result.proposals);
    setStarterNotes(result.notes);
    setSavedId(null);
  };

  const randomizeShops = () => {
    if (!map) {
      return;
    }
    const result = randomizeShopsStep(map, content ?? {}, starters, sources());
    setContent(result.content);
    setShopSummary(result.summary);
    setSavedId(null);
  };

  const randomizeCells = () => {
    if (!map) {
      return;
    }
    const result = randomizeCellsStep(map, content ?? {}, starters, sources());
    setContent(result.content);
    setCellSummary(result.summary);
    setSavedId(null);
  };

  // "Puntata casuale": every step in order, then "Fine" to look at the result.
  const randomizeEverything = async () => {
    const picked = await pickPlayableMap(maps, props.loadMap, Math.random);
    if (!picked) {
      noPlayableMap();
      return;
    }
    const { option, map: loaded } = picked;
    const result = randomEpisode(loaded, sources());
    setMapId(option.id);
    setMap(loaded);
    setLoadedMapId(option.id);
    setView(fullView(loaded));
    setName(nextEpisodeName(loaded.name, props.episodeNames));
    setStarters(result.starters);
    setStarterNotes(result.starterNotes);
    setContent(result.content);
    setShopSummary(result.shopSummary);
    setCellSummary(result.cellSummary);
    setSavedId(null);
    setExitAsked(false);
    setStep(STEPS.length - 1);
  };

  const episode = map && content ? newEpisode({ name, map, content, starters }, props.specialKeepers) : null;
  const guides = map && content
    ? [
        ...checkEpisode(content, known, map).map((issue) => issue.message),
        ...checkMissions(content, known).map((issue) => issue.message),
        ...(emptyCharacterCells(map, content).length > 0
          ? [`Caselle personaggio vuote: ${emptyCharacterCells(map, content).map(cellNumber).join(', ')}.`]
          : []),
      ]
    : [];

  const save = () => {
    if (!episode) {
      return;
    }
    props
      .onSave(episode)
      .then(setSavedId)
      .catch((cause: unknown) =>
        props.showError(`Puntata non salvata: ${describeError(cause)}`),
      );
  };

  const exit = () => {
    if (started && !savedId && !exitAsked) {
      setExitAsked(true);
      return;
    }
    props.onClose();
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button onClick={exit}>← Puntate</button>
        <h1 className={screenStyles.title}>Nuova puntata</h1>
      </header>
      {exitAsked && (
        <p className={styles.warning}>
          La puntata non è ancora salvata. Clicca di nuovo «← Puntate» per uscire comunque.
        </p>
      )}

      <ol className={styles.steps}>
        {STEPS.map((label, index) => (
          <li key={label}>
            <button
              className={index === step ? styles.current : index < step ? styles.done : undefined}
              onClick={() => void goTo(index).catch(mapNotRead)}
              aria-current={index === step ? 'step' : undefined}
            >
              <span className={styles.number}>{index + 1}</span> {label}
            </button>
          </li>
        ))}
      </ol>

      <section className={styles.body}>
        {step === 0 && (
          <>
            <h2 className={styles.stepTitle}>
              Prima di cominciare
              <InfoButton label="Prima di cominciare">
                Le librerie valgono per tutte le puntate. Se ne manca una puoi andare avanti lo stesso:
                la puntata verrà più povera. Qui sotto puoi sistemare missioni e domande; poteri e
                negozianti si aggiungono ai passi 3 e 4.
              </InfoButton>
            </h2>
            <div className={styles.buttons}>
              <button className={styles.primary} onClick={() => void randomizeEverything().catch(mapNotRead)} disabled={maps.length === 0}>
                Puntata casuale
              </button>
              <span className={styles.small}>
                Fa tutti i passi a caso, poi ti porta a «Fine»: da lì puoi tornare a ogni passo e rifarlo.
              </span>
            </div>
            <ul className={styles.checks}>
              {status.map((check) => (
                <li key={check.id} className={check.ready ? styles.ready : styles.missing}>
                  <span className={styles.mark}>{check.ready ? '✓' : '⚠'}</span>
                  <strong>{check.label}</strong>
                  <span>{check.text}</span>
                  <LibraryAction
                    id={check.id}
                    ready={check.ready}
                    onImportMissions={(file) => props.onImportMissions(file).then(setReport)}
                    onImportQuestions={(file) => props.onImportQuestions(file).then(setReport)}
                  />
                </li>
              ))}
            </ul>
            {report.length > 0 && (
              <div className={styles.report}>
                {report.map((line, index) => (
                  <p key={index}>{line}</p>
                ))}
              </div>
            )}
          </>
        )}

        {step === 1 && (
          <>
            <h2 className={styles.stepTitle}>
              Mappa e nome
              <InfoButton label="Mappa e nome">
                La puntata tiene una copia della mappa: se poi modifichi la mappa nell'editor delle mappe,
                la puntata resta com'era.
              </InfoButton>
            </h2>
            {maps.length === 0 ? (
              <p className={styles.warning}>Non c'è nessuna mappa: disegnane una con l'editor delle mappe.</p>
            ) : (
              <>
                <div className={styles.buttons}>
                  <button onClick={() => void randomizeMap().catch(mapNotRead)}>Randomizza</button>
                </div>
                <div className={styles.fields}>
                  <label>
                    Mappa
                    <select value={mapId} onChange={(event) => setMapId(event.target.value)}>
                      <MapOptions maps={maps} />
                    </select>
                  </label>
                  <label>
                    Nome della puntata
                    <input
                      value={name}
                      placeholder={nextEpisodeName(
                        maps.find((option) => option.id === mapId)?.name ?? 'Puntata',
                        props.episodeNames,
                      )}
                      onChange={(event) => setName(event.target.value)}
                    />
                  </label>
                </div>
              </>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <h2 className={styles.stepTitle}>
              Starter proposti
              <InfoButton label="Starter proposti">
                Tre starter per giocatore, sei personaggi diversi in tutto: in partita ognuno sceglie il
                suo nella scena della scelta, su regia e stream. I poteri vengono dalla lista dei poteri;
                «Nuovo potere…» in fondo al menu ne aggiunge uno. In «Nuova partita» si possono ancora
                cambiare, solo per quella partita.
              </InfoButton>
            </h2>
            <div className={styles.buttons}>
              <button className={styles.primary} onClick={randomizeStarters}>
                {areEmpty(starters) ? 'Randomizza gli starter' : 'Randomizza gli starter di nuovo'}
              </button>
              <button onClick={() => setStarters(copyPowersFromFirst(starters))}>
                Stessi poteri del Giocatore 1
              </button>
            </div>
            <Report lines={starterNotes} />
            <div className={styles.columns}>
              {(['p1', 'p2'] as const).map((player) => (
                <PlayerProposals
                  key={player}
                  withHeading
                  playerName={PROPOSAL_PLAYER_NAMES[player]}
                  proposals={starters[player]}
                  catalog={catalog}
                  powers={powers}
                  onChange={(index, proposal) => setStarters(withProposal(starters, player, index, proposal))}
                  onNewPower={(use) => setNewPowerFor(() => use)}
                />
              ))}
            </div>
            <Guides lines={proposalIssues(starters, catalog).map((issue) => issue.message)} />
          </>
        )}

        {step === 3 && (
          <>
            <h2 className={styles.stepTitle}>
              Negozi
              <InfoButton label="Negozi">
                «Randomizza» dà a ogni negozio un negoziante diverso, scelto tra quelli segnati nella lista
                dei personaggi (colonna «negoziante») e quelli speciali, e i personaggi in vendita: con un
                prezzo, dal tier C- in su, mai usati altrove nella puntata.
              </InfoButton>
            </h2>
            <div className={styles.fields}>
              <label>
                Personaggi in vendita per negozio
                <NumberField label="Personaggi per negozio" value={perShop} onCommit={(value) => setPerShop(Math.max(0, value))} />
              </label>
            </div>
            <div className={styles.buttons}>
              <button className={styles.primary} onClick={randomizeShops} disabled={!map}>
                {shopSummary.length > 0 ? 'Randomizza i negozi di nuovo' : 'Randomizza i negozi'}
              </button>
            </div>
            <Report lines={shopSummary} />
            {map && content && shopSummary.length > 0 && (
              <ul className={styles.recap}>
                {shopRows(map, content, known).map((row) => (
                  <li key={row.nodeId}>
                    <strong>
                      {cellNumber(row.nodeId)} · {row.keeper}
                    </strong>
                    : {row.forSale.join(', ') || 'niente in vendita'}
                  </li>
                ))}
              </ul>
            )}
            <SpecialKeepersPanel
              listKeepers={catalog.filter((character) => character.shopkeeper)}
              keepers={props.specialKeepers}
              onAdd={props.onAddKeeper}
              onEdit={props.onEditKeeper}
              onDelete={props.onDeleteKeeper}
            />
          </>
        )}

        {step === 4 && (
          <>
            <h2 className={styles.stepTitle}>
              Personaggi e missioni
              <InfoButton label="Personaggi e missioni">
                «Randomizza personaggi e missioni» riempie tutte le Caselle personaggio: i più deboli
                vicino alle partenze, i più forti lontano e dietro i percorsi bloccati, in equilibrio tra i
                due lati; per ognuno una missione del catalogo adatta al posto. I negozi del passo 4
                restano; se sono ancora vuoti, li riempie anche. Si può ripetere finché il risultato non
                piace; i ritocchi a mano si fanno poi nell'editor.
              </InfoButton>
            </h2>
            <div className={styles.buttons}>
              <button className={styles.primary} onClick={randomizeCells} disabled={!map}>
                {cellSummary.length > 0 ? 'Randomizza personaggi e missioni di nuovo' : 'Randomizza personaggi e missioni'}
              </button>
            </div>
            <Report lines={cellSummary} />
            <Guides lines={guides} />
            {map && view && (
              <div className={styles.preview}>
                <PrepCanvas
                  map={map}
                  catalog={known}
                  content={content ?? {}}
                  selected={[]}
                  view={view}
                  panning={false}
                  onViewChange={setView}
                  onSelect={() => undefined}
                />
              </div>
            )}
            {map && content && (
              <>
                <h3 className={styles.listTitle}>Tutte le missioni</h3>
                <MissionTable rows={missionRows(map, content, known, testItems)} />
              </>
            )}
          </>
        )}

        {step === 5 && (
          <>
            <h2 className={styles.stepTitle}>Fine</h2>
            <ul className={styles.recap}>
              <li>
                <strong>Nome:</strong> {name.trim() || 'Puntata senza nome'}
              </li>
              <li>
                <strong>Mappa:</strong> {map?.name ?? 'non scelta'}
              </li>
              <li>
                <strong>Starter proposti:</strong>{' '}
                {(['p1', 'p2'] as const)
                  .map(
                    (player) =>
                      `${PROPOSAL_PLAYER_NAMES[player]}: ${
                        starters[player]
                          .map((proposal) => known.find((character) => character.id === proposal.characterId)?.name)
                          .filter(Boolean)
                          .join(', ') || 'nessuno'
                      }`,
                  )
                  .join(' · ')}
              </li>
              <li>
                <strong>Negozi:</strong> {shopSummary[0] ?? cellSummary.find((line) => line.includes('negozi')) ?? 'non ancora: torna al passo 4'}
              </li>
              <li>
                <strong>Personaggi e missioni:</strong> {cellSummary[0] ?? 'non ancora: torna al passo 5'}
              </li>
            </ul>
            {savedId ? (
              <div className={styles.buttons}>
                <p className={styles.ok}>Puntata salvata nella libreria.</p>
                <button className={styles.primary} onClick={() => episode && props.onOpenInEditor(savedId, episode)}>
                  Apri nell'editor
                </button>
                <button onClick={props.onClose}>Torna alle puntate</button>
              </div>
            ) : (
              <div className={styles.buttons}>
                <button className={styles.primary} onClick={save} disabled={!episode}>
                  Salva la puntata
                </button>
                {!episode && <span className={styles.small}>Serve almeno la mappa e «Randomizza» (passo 5).</span>}
              </div>
            )}
          </>
        )}
      </section>

      <footer className={styles.footer}>
        <button onClick={() => void goTo(step - 1).catch(mapNotRead)} disabled={step === 0}>
          ← Indietro
        </button>
        <span className={styles.small}>
          Passo {step + 1} di {STEPS.length}
        </span>
        <button className={styles.primary} onClick={() => void goTo(step + 1).catch(mapNotRead)} disabled={step === STEPS.length - 1 || (step === 1 && !mapId)}>
          Avanti →
        </button>
      </footer>

      {newPowerFor && (
        <PowerDialog
          onClose={() => setNewPowerFor(null)}
          onSave={(draft) => {
            const use = newPowerFor;
            setNewPowerFor(null);
            void props.onCreatePower(draft).then((power) => {
              if (power) {
                use(power);
              }
            });
          }}
        />
      )}
    </div>
  );
}

interface LibraryActionProps {
  id: LibraryId;
  ready: boolean;
  onImportMissions(file: File): Promise<void>;
  onImportQuestions(file: File): Promise<void>;
}

/** Next to a library: the file to import for missions and questions. */
function LibraryAction({ id, ready, onImportMissions, onImportQuestions }: LibraryActionProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  if (id !== 'missions' && id !== 'questions') {
    return <span />;
  }
  const onImport = id === 'missions' ? onImportMissions : onImportQuestions;
  return (
    <span>
      <button onClick={() => fileRef.current?.click()}>{ready ? 'Reimporta…' : 'Importa…'}</button>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) {
            void onImport(file);
          }
        }}
      />
    </span>
  );
}

/** What a "Randomizza" did, under its button. */
function Report({ lines }: { lines: string[] }) {
  if (lines.length === 0) {
    return null;
  }
  return (
    <div className={styles.report}>
      {lines.map((line, index) => (
        <p key={index}>{line}</p>
      ))}
    </div>
  );
}

/** The host's maps, then the base maps, each in its own group (spec 033, 2.2). */
function MapOptions({ maps }: { maps: MapOption[] }) {
  const options = (included: boolean) =>
    maps
      .filter((option) => (option.included ?? false) === included)
      .map((option) => (
        <option key={option.id} value={option.id}>
          {option.name}
        </option>
      ));
  if (!maps.some((option) => option.included)) {
    return <>{options(false)}</>;
  }
  const own = options(false);
  return (
    <>
      {own.length > 0 && <optgroup label="Le mie mappe">{own}</optgroup>}
      <optgroup label="Mappe base">{options(true)}</optgroup>
    </>
  );
}

/** Guides (D-008): shown, never blocking. */
function Guides({ lines }: { lines: string[] }) {
  if (lines.length === 0) {
    return null;
  }
  return (
    <div className={styles.guides}>
      {lines.map((line) => (
        <p key={line}>⚠ {line}</p>
      ))}
    </div>
  );
}
