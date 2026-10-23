import { useCallback, useEffect, useState } from 'react';
import {
  canUndo,
  cellMission,
  cellNumber,
  LASTING_MISSIONS,
  missionsDone,
  missionsOf,
  createGame,
  fusionOptions,
  currentState,
  isRepeatInteraction,
  PLAYER_IDS,
  SaveFileError,
  stepBackCell,
  turnRuleWarnings,
  testItems,
  trainingRule,
  travelRule,
  type Game,
  type GameMap,
  type CellContent,
  type Character,
  type GameAction,
  type GameContext,
  type GameSetup,
  type PlayerId,
  type Warning,
} from '../engine';
import { importCatalog, summarizeCatalog } from '../catalog/importCatalog';
import { loadAutosave } from '../storage/autosave';
import { saveCatalog } from '../storage/catalogStore';
import { listEpisodes, loadEpisode, newEpisodeId, saveEpisode } from '../storage/episodeLibrary';
import { listSpecialKeepers } from '../storage/keeperStore';
import { listMaps } from '../storage/mapLibrary';
import { loadMissionCatalog, loadQuestions } from '../storage/missionStore';
import { loadTexts } from '../storage/textStore';
import { fillMissingLists } from '../included/fillIncluded';
import { listIncludedMaps, loadAnyMap } from '../included/includedMaps';
import type { CatalogMission, QuestionEntry } from '../missions/catalog';
import { newEpisode } from '../episode/newEpisode';
import { randomReport, type RandomReport } from '../episode/randomReport';
import { DEFAULT_PER_SHOP, nextEpisodeName, randomEpisode } from '../episode/stepRandomize';
import type { TextLibrary } from '../episode/textLibrary';
import { listReadyPowers, saveReadyPower } from '../storage/powerStore';
import type { StarterProposals } from '../starters/proposals';
import type { ReadyPowerDraft } from '../starters/ReadyPowerForm';
import { makeReadyPower, newReadyPowerId, type ReadyPower } from '../starters/readyPowers';
import {
  canStart,
  chooseCard,
  showOther,
  startChoice,
  starterChoiceView,
  type StarterChoice,
} from '../starters/starterChoice';
import { MapsSection } from '../editor/MapsSection';
import { EpisodesSection } from '../episode/EpisodesSection';
import {
  preparationReport,
  prepareEpisodeContent,
  withoutEmptyCharacterCells,
} from '../episode/playEpisode';
import type { ScreenPoint } from '../ui/Board';
import type { ShopActions } from '../ui/ShopScreen';
import { PlayerPanel, type PlayerPanelActions } from '../ui/PlayerPanel';
import { Stage } from '../ui/Stage';
import { CellEditor } from './CellEditor';
import { decideClick, type PendingAction } from './confirmation';
import { ContextMenu, type MenuState } from './ContextMenu';
import { CorrectionsPanel } from './CorrectionsPanel';
import { DiscardGameDialog } from './DiscardGameDialog';
import { GameFight, type FightSetup } from './GameFight';
import { TrainingDialog } from './TrainingDialog';
import { activeTravel, copiesOf, travelCells, type TravelChoice } from './travel';
import { downloadGame, readGameFile } from './fileIO';
import { LogPanel } from './LogPanel';
import { MessageBar } from './MessageBar';
import { MissionNotices } from './MissionNotices';
import { missionRows } from '../missions/missionList';
import { MissionTable } from '../missions/MissionTable';
import { isPostponed, NOTHING_POSTPONED, postpone, type NotYet } from './notYet';
import { buildSetup, defaultNewGameForm, playerNames, type NewGameForm } from './newGame';
import { orderChoices, type MapChoice } from './mapGroups';
import { NewGameScreen, NewGameUnavailable } from './NewGameScreen';
import { pawnDropAction, pawnDropWarnings } from './pawnDrop';
import {
  challengeScreen,
  chooseAnswer,
  closeShown,
  describeScreen,
  exploreBoard,
  isExploring,
  nextLine,
  openPreview,
  showPreviewToAll,
  shownInDirector,
  type DirectorPreview,
  type DirectorScreens,
} from './screens';
import { showdownDue } from './showdown';
import { StarterChoiceStage } from './StarterChoiceStage';
import { catalogImportedNotice } from './startMenu';
import { StartScreen } from './StartScreen';
import { Toolbar } from './Toolbar';
import { useGameSession } from './useGameSession';
import { PhoneGame } from '../phone/PhoneGame';
import { OpponentChoice } from '../phone/OpponentChoice';
import { isArbitrated, markArbitrated, secondPlayerName, type GameKind } from '../phone/gameKind';
import { GameKindChoice } from './GameKindChoice';
import { aiStarterIndex } from '../ai/brain';
import type { AiLevel } from '../engine';
import styles from './DirectorApp.module.css';
import { describeError } from '../describeError';

/** How many import errors to list before "e altri N". */
const MAX_IMPORT_ERRORS = 5;

type Screen = 'loading' | 'start' | 'newGame' | 'starterChoice' | 'play' | 'maps' | 'episodes';

interface DirectorAppProps {
  /**
   * The phone version (spec 052, D-083): the same menu, new game, starter
   * choice and editors, but the game is played on the phone, without stream.
   */
  phone?: boolean;
}

/** The director window: the only one that changes the game (D-005). */
export function DirectorApp({ phone = false }: DirectorAppProps) {
  const session = useGameSession();
  const { game, perform, showError } = session;
  const [screen, setScreen] = useState<Screen>('loading');
  const [saved, setSaved] = useState<Game | null>(null);
  // Imported character list (D-017); null until one is imported (spec 010).
  const [importedCatalog, setImportedCatalog] = useState<Character[] | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  // Edit mode (spec 004, 2.2): what opens is private to the director window.
  const [editMode, setEditMode] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  // Chosen in "Nuova partita": a map of the library (D-018) or a prepared
  // episode with its content (D-019). Null choices: still loading.
  const [mapChoices, setMapChoices] = useState<MapChoice[] | null>(null);
  const [newGameMap, setNewGameMap] = useState<{
    id: string;
    map: GameMap;
    episodeContent: Record<string, CellContent> | null;
    /** The episode's special shopkeepers (D-035): they join the game's list. */
    keepers: Character[];
  } | null>(null);
  // "Randomizza tutto" on a map (spec 030, D-046): what it did, and the
  // name of the episode once saved with "Salva anche come puntata".
  const [randomized, setRandomized] = useState<{
    report: RandomReport;
    round: number;
    savedName: string | null;
  } | null>(null);
  // What "Randomizza tutto" draws from, read when "Nuova partita" opens.
  const [randomLibraries, setRandomLibraries] = useState<{
    specialKeepers: Character[];
    missions: CatalogMission[];
    questions: QuestionEntry[];
    texts: TextLibrary;
    episodeNames: string[];
  } | null>(null);
  // "Nuova partita" and its scene of the starter choice (spec 025): the form
  // and the choice are kept when going from one to the other.
  const [newGameForm, setNewGameForm] = useState<NewGameForm | null>(null);
  const [choice, setChoice] = useState<StarterChoice | null>(null);
  // The list of ready powers for the proposals (D-037).
  const [readyPowers, setReadyPowers] = useState<ReadyPower[]>([]);
  // Completed missions answered "Non ancora": quiet until the turn changes (spec 026, 2.4).
  const [notYet, setNotYet] = useState<NotYet>(NOTHING_POSTPONED);
  // What changed when an episode started (spec 007, 2.7): stays until closed.
  const [startNotice, setStartNotice] = useState<string[]>([]);
  // "Chiudi e cancella partita" waiting for the host's confirmation (D-030).
  const [discardAsked, setDiscardAsked] = useState(false);
  // "Simula" (spec 037, 2.4-2.5): the simulated fight being prepared or told.
  const [fightSetup, setFightSetup] = useState<FightSetup | null>(null);
  // "Usa" on a training item (spec 041): whose inventory, which item.
  const [training, setTraining] = useState<{ player: PlayerId; itemId: string } | null>(null);
  // "Usa" on a travel item (spec 047): the cells it reaches are highlighted until the pawn arrives.
  const [travel, setTravel] = useState<TravelChoice | null>(null);
  // A character's scene, or the board, for the director only, over what the stream shows (D-032).
  const [preview, setPreview] = useState<DirectorPreview | null>(null);
  // On the phone: another player, or the AI at a level (spec 053, 2.1). The AI is always G2.
  const [aiLevel, setAiLevel] = useState<AiLevel | null>(null);
  // On the PC, «Tipo di partita» in «Nuova partita» (spec 076, 2.1); the phone has only PvP / PvIA.
  const [newGameKind, setNewGameKind] = useState<GameKind>('director');
  const arbitratedNewGame = phone || newGameKind === 'arbitrated';
  // PvP / PvIA is the game of the phone, also on the PC (spec 076, 2.2-2.3).
  const arbitratedGame = phone || (game !== null && isArbitrated(game));

  // Any change to the game (another action, undo, end of turn) cancels a pending second click.
  useEffect(() => {
    setPending(null);
  }, [game]);

  // «Nuova partita» opens with «Regia + Stream» every time (spec 076, 2.1).
  useEffect(() => {
    if (screen !== 'newGame' && screen !== 'starterChoice') {
      setNewGameKind('director');
    }
  }, [screen]);

  useEffect(() => {
    let cancelled = false;
    // What the browser lacks comes from the files of the project (D-045).
    fillMissingLists()
      .then(({ catalog }) => {
        if (!cancelled) {
          setImportedCatalog(catalog);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          showError(`La lista dei personaggi salvata non è leggibile: ${describeError(cause)}`);
        }
      });
    loadAutosave()
      .then((autosaved) => {
        if (!cancelled) {
          setSaved(autosaved);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          showError(`Il salvataggio automatico non è leggibile: ${describeError(cause)}`);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setScreen('start');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [showError]);

  const { undo, redo } = session;
  useEffect(() => {
    // On the phone «Annulla» has its own limits (D-085): no keys. So in PvP / PvIA (spec 076, 2.2).
    if (screen !== 'play' || arbitratedGame) {
      return undefined;
    }
    // The same keys as in the editors: Ctrl+Z, and Ctrl+Y or Ctrl+Shift+Z (spec 021).
    const onKeyDown = (event: KeyboardEvent) => {
      const typing =
        event.target instanceof Element && event.target.closest('input, select, textarea');
      if (!(event.ctrlKey || event.metaKey) || typing) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === 'y' || (key === 'z' && event.shiftKey)) {
        event.preventDefault();
        redo();
      } else if (key === 'z') {
        event.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [screen, arbitratedGame, undo, redo]);

  // The cells of the travel item, on both windows (spec 047).
  const { setHighlight } = session;
  const highlight = game ? travelCells(game, currentState(game), travel) : null;
  const highlightKey = highlight ? highlight.join(' ') : null;
  useEffect(() => {
    setHighlight(highlight);
    // The key changes exactly when the highlighted cells change.
  }, [highlightKey, setHighlight]);

  // Esc puts the choice of the cell away, as "Annulla" (spec 047).
  useEffect(() => {
    if (!travel) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setTravel(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [travel]);

  const closeMenu = useCallback(() => setMenu(null), []);

  // While the scene of the starter choice is open, the stream shows it (spec 025, 2.4).
  const choiceView =
    screen === 'starterChoice' && newGameForm && choice && importedCatalog
      ? starterChoiceView(
          newGameForm.proposals,
          choice,
          playerNames(newGameForm),
          newGameForm.startingCoins,
          [...importedCatalog, ...(newGameMap?.keepers ?? [])],
        )
      : null;
  const choiceKey = choiceView ? JSON.stringify(choiceView) : null;
  const { setStarterChoice } = session;
  useEffect(() => {
    setStarterChoice(choiceView);
    // The key changes exactly when what the scene shows changes.
  }, [choiceKey, setStarterChoice]);

  // The AI chooses its starter by itself when the scene shows its proposals (spec 053, 2.1).
  const aiChoosing =
    arbitratedNewGame && aiLevel !== null && screen === 'starterChoice' && choice?.showing === 'p2' && choice.chosen.p2 === null;
  useEffect(() => {
    if (aiChoosing && choice && newGameForm && importedCatalog && aiLevel) {
      const catalog = [...importedCatalog, ...(newGameMap?.keepers ?? [])];
      setChoice(chooseCard(choice, aiStarterIndex(newGameForm.proposals.p2, catalog, aiLevel, Math.random)));
    }
  }, [aiChoosing, choice, newGameForm, importedCatalog, newGameMap, aiLevel]);

  // Another game: the preview of the previous one goes away.
  const startSession = (next: Game) => {
    session.start(next);
    setPreview(null);
  };
  const closeDiscardDialog = useCallback(() => setDiscardAsked(false), []);

  // A PvP / PvIA game remembers it, and the AI too (D-086, D-101).
  const withGameKind = (next: Game): Game => (arbitratedNewGame ? markArbitrated(next, aiLevel) : next);

  const startGame = (setup: GameSetup) => {
    try {
      if (newGameMap?.episodeContent) {
        // The chosen starters leave the episode's map (spec 007, 2.7).
        const shops = setup.map.nodes.filter((node) => node.type === 'shop');
        const prepared = prepareEpisodeContent(
          setup.content,
          setup.catalog,
          [setup.players.p1.starter.characterId, setup.players.p2.starter.characterId],
          new Set(shops.map((node) => node.id)),
        );
        // Character cells left empty do not exist in a game (D-023).
        const map = withoutEmptyCharacterCells(setup.map, prepared.content);
        startSession(withGameKind(createGame({ ...setup, map, content: prepared.content })));
        setStartNotice(preparationReport(prepared));
      } else {
        const map = withoutEmptyCharacterCells(setup.map, setup.content);
        startSession(withGameKind(createGame({ ...setup, map })));
        setStartNotice([]);
      }
      setScreen('play');
    } catch (cause) {
      showError(`Impossibile iniziare la partita: ${describeError(cause)}`);
    }
  };

  const loadFile = (file: File) => {
    readGameFile(file)
      .then((loaded) => {
        startSession(loaded);
        setScreen('play');
      })
      .catch((cause: unknown) => {
        showError(cause instanceof SaveFileError ? cause.message : describeError(cause));
      });
  };

  // New games: cells start empty on a map, or with the episode's content.
  const newGameContext: GameContext | null =
    newGameMap && importedCatalog
      ? {
          map: newGameMap.map,
          catalog: [...importedCatalog, ...newGameMap.keepers],
          items: testItems,
        }
      : null;
  const newGameContent: Record<string, CellContent> = newGameMap?.episodeContent ?? {};

  const refreshPowers = () =>
    listReadyPowers()
      .then(setReadyPowers)
      .catch((cause: unknown) => showError(`Impossibile leggere i poteri: ${describeError(cause)}`));

  // "Nuovo potere…" (spec 025, 2.3): into the list first, then into the proposal.
  const createPower = async (draft: ReadyPowerDraft): Promise<ReadyPower | null> => {
    const power = makeReadyPower(newReadyPowerId(), draft.cardText, draft.effect);
    try {
      await saveReadyPower(power);
      await refreshPowers();
      return power;
    } catch (cause) {
      showError(`Potere non aggiunto: ${describeError(cause)}`);
      return null;
    }
  };

  const openNewGame = () => {
    setScreen('newGame');
    setMapChoices(null);
    void refreshPowers();
    Promise.all([listSpecialKeepers(), loadMissionCatalog(), loadQuestions(), loadTexts(), listEpisodes()])
      .then(([specialKeepers, missions, questions, texts, episodes]) =>
        setRandomLibraries({
          specialKeepers,
          missions,
          questions,
          texts,
          episodeNames: episodes.map((entry) => entry.name),
        }),
      )
      .catch((cause: unknown) => showError(`Impossibile leggere le librerie: ${describeError(cause)}`));
    Promise.all([listMaps(), listIncludedMaps(), listEpisodes()])
      .then(([maps, included, episodes]) => {
        if (included.errors.length > 0) {
          showError(`Mappe base non lette: ${included.errors.join(' ')}`);
        }
        // Episodes, maps, base maps (spec 033, 2.1): the first one is proposed;
        // a new browser has only the base maps (spec 036).
        const choices = orderChoices([
          ...episodes.map(
            (entry): MapChoice => ({ id: entry.id, name: entry.name, kind: 'episode' }),
          ),
          ...maps.map((entry): MapChoice => ({ id: entry.id, name: entry.name, kind: 'map' })),
          ...included.maps.map(
            (entry): MapChoice => ({ id: entry.id, name: entry.map.name, kind: 'included' }),
          ),
        ]);
        setMapChoices(choices);
        // Keep the last choice if it still exists, otherwise take the first one.
        const choice = choices.find((entry) => entry.id === newGameMap?.id) ?? choices[0];
        if (choice) {
          selectNewGameMap(choice);
        } else {
          setNewGameMap(null);
        }
      })
      .catch((cause: unknown) => showError(`Impossibile leggere la libreria: ${describeError(cause)}`));
  };

  // Another map or episode: the form starts again from its proposals (spec 025, 2.3).
  const useNewGameMap = (next: NonNullable<typeof newGameMap>, starters?: StarterProposals) => {
    setNewGameMap(next);
    const form = defaultNewGameForm(next.map, starters);
    // Against the AI, G2 is called «IA» again in the new form (spec 053, 2.1).
    setNewGameForm(
      arbitratedNewGame && aiLevel
        ? { ...form, players: { ...form.players, p2: { ...form.players.p2, name: 'IA' } } }
        : form,
    );
    setChoice(null);
    setRandomized(null);
  };

  // "Randomizza tutto" (spec 030, 2.3): starters, shops, characters and
  // missions on the chosen map; names, coins and start cells stay.
  const randomizeNewGame = () => {
    if (!newGameMap || !newGameForm || !importedCatalog || !randomLibraries) {
      return;
    }
    const { specialKeepers, missions, questions, texts } = randomLibraries;
    const result = randomEpisode(newGameMap.map, {
      catalog: importedCatalog,
      specialKeepers,
      powers: readyPowers,
      texts,
      missions: { catalog: missions, questions, items: testItems },
      perShop: DEFAULT_PER_SHOP,
      random: Math.random,
    });
    const episode = newEpisode(
      { name: '', map: newGameMap.map, content: result.content, starters: result.starters },
      specialKeepers,
    );
    setNewGameMap({ ...newGameMap, episodeContent: episode.content, keepers: episode.keepers ?? [] });
    setNewGameForm({ ...newGameForm, proposals: result.starters });
    setChoice(null);
    const report = randomReport(
      newGameMap.map,
      episode.content,
      [...importedCatalog, ...specialKeepers],
      testItems,
      result,
    );
    setRandomized((current) => ({ report, round: (current?.round ?? 0) + 1, savedName: null }));
  };

  // "Salva anche come puntata": the starters as they are now, changes included.
  const saveRandomAsEpisode = () => {
    if (!newGameMap?.episodeContent || !newGameForm || !randomLibraries || !randomized) {
      return;
    }
    const name = nextEpisodeName(newGameMap.map.name, randomLibraries.episodeNames);
    const episode = newEpisode(
      { name, map: newGameMap.map, content: newGameMap.episodeContent, starters: newGameForm.proposals },
      newGameMap.keepers,
    );
    saveEpisode(newEpisodeId(), episode)
      .then(() => {
        setRandomized({ ...randomized, savedName: name });
        setRandomLibraries({ ...randomLibraries, episodeNames: [...randomLibraries.episodeNames, name] });
      })
      .catch((cause: unknown) => showError(`Puntata non salvata: ${describeError(cause)}`));
  };

  const selectNewGameMap = (mapChoice: MapChoice) => {
    const { id } = mapChoice;
    if (mapChoice.kind === 'episode') {
      loadEpisode(id)
        .then((episode) =>
          episode
            ? useNewGameMap(
                {
                  id,
                  map: episode.map,
                  episodeContent: episode.content,
                  keepers: episode.keepers ?? [],
                },
                episode.starters,
              )
            : showError('Questa puntata non si riesce più a leggere.'),
        )
        .catch((cause: unknown) => showError(`Impossibile aprire la puntata: ${describeError(cause)}`));
      return;
    }
    loadAnyMap(id)
      .then((map) =>
        map
          ? useNewGameMap({ id, map, episodeContent: null, keepers: [] })
          : showError('Questa mappa non si riesce più a leggere.'),
      )
      .catch((cause: unknown) => showError(`Impossibile aprire la mappa: ${describeError(cause)}`));
  };

  const importCatalogFile = (file: File) => {
    // The notice of an earlier import is not about this one.
    setStartNotice([]);
    file
      .text()
      .then(async (text) => {
        const result = importCatalog(text);
        if (!result.ok) {
          const shown = result.errors.slice(0, MAX_IMPORT_ERRORS);
          const more = result.errors.length - shown.length;
          showError(
            `Lista non importata, resta quella di prima. ${shown.join(' ')}` +
              (more > 0 ? ` E altri ${more} errori.` : ''),
          );
          return;
        }
        await saveCatalog(result.catalog);
        setImportedCatalog(result.catalog);
        session.clearError();
        // Wrong sheet values do not stop the import: they count as empty (spec 037, 2.2).
        setStartNotice(catalogImportedNotice(result.summary, result.sheetProblems));
      })
      .catch((cause: unknown) => showError(`Impossibile importare la lista: ${describeError(cause)}`));
  };

  // The game stays in progress and the stream keeps showing it (spec 010).
  const openStartMenu = () => {
    setMenu(null);
    setEditingNodeId(null);
    setPending(null);
    setScreen('start');
  };

  // The game and its automatic save are deleted: no game is left to resume (spec 019).
  const discardGame = () => {
    setDiscardAsked(false);
    setPreview(null);
    setMenu(null);
    setEditMode(false);
    setEditingNodeId(null);
    setPending(null);
    setStartNotice([]);
    setSaved(null);
    setScreen('start');
    session.discard().catch((cause: unknown) =>
      showError(
        `La partita è chiusa, ma il salvataggio automatico non si è cancellato (${describeError(cause)}): ` +
          'ricaricando la pagina potrebbe tornare.',
      ),
    );
  };

  const openStream = () => {
    window.open(`${window.location.pathname}?view=stream`, 'arkanite-stream', 'popup,width=1280,height=800');
  };

  const messages = (
    <MessageBar
      warnings={session.warnings}
      pending={pending?.warnings}
      pendingIsMove={
        pending?.action.type === 'move' ||
        pending?.action.type === 'placePawn' ||
        (pending?.action.type === 'useItem' && pending.action.to !== undefined)
      }
      error={session.error}
      onCloseError={session.clearError}
      notice={startNotice}
      onCloseNotice={() => setStartNotice([])}
    />
  );

  if (screen === 'loading') {
    return <div className={styles.loading}>Caricamento…</div>;
  }
  if (screen === 'maps') {
    return (
      <>
        {messages}
        <MapsSection onBack={() => setScreen('start')} showError={showError} />
      </>
    );
  }
  if (screen === 'episodes') {
    return (
      <>
        {messages}
        <EpisodesSection
          catalog={importedCatalog ?? []}
          onBack={() => setScreen('start')}
          showError={showError}
        />
      </>
    );
  }
  if (screen === 'start' || (screen === 'play' && !game)) {
    return (
      <>
        {messages}
        <StartScreen
          saved={game ?? saved}
          catalog={importedCatalog ? summarizeCatalog(importedCatalog) : null}
          onImportCatalog={importCatalogFile}
          onResume={() => {
            // A game in progress goes on as it was; otherwise the automatic save.
            if (game) {
              setScreen('play');
            } else if (saved) {
              startSession(saved);
              setScreen('play');
            }
          }}
          onNewGame={openNewGame}
          onLoadFile={loadFile}
          onOpenMaps={() => setScreen('maps')}
          onOpenEpisodes={() => setScreen('episodes')}
          phone={phone}
        />
      </>
    );
  }
  if (screen === 'starterChoice' && choiceView && choice && newGameForm && newGameContext) {
    const form = newGameForm;
    return (
      <>
        {messages}
        <StarterChoiceStage
          view={choiceView}
          firstPlayer={form.firstPlayer}
          canStart={canStart(form.proposals, choice)}
          onChoose={(index) => setChoice(chooseCard(choice, index))}
          onShowOther={() => setChoice(showOther(choice))}
          onBack={() => setScreen('newGame')}
          onStart={() => startGame(buildSetup(form, choice, newGameContext, newGameContent))}
          onOpenStream={arbitratedNewGame ? undefined : openStream}
        />
      </>
    );
  }
  if (screen === 'newGame' || screen === 'starterChoice' || !game) {
    // Without a character list or a map there is nothing to start (spec 010).
    const missing = !importedCatalog ? 'catalog' : mapChoices?.length === 0 ? 'map' : null;
    return (
      <>
        {messages}
        {missing ? (
          <NewGameUnavailable
            missing={missing}
            onOpenMaps={() => setScreen('maps')}
            onBack={() => setScreen('start')}
          />
        ) : newGameContext && newGameMap && newGameForm && mapChoices ? (
          <NewGameScreen
            key={newGameMap.id}
            mapChoices={mapChoices}
            selectedMapId={newGameMap.id}
            onSelectMap={(id) => {
              const mapChoice = mapChoices.find((entry) => entry.id === id);
              if (mapChoice) {
                selectNewGameMap(mapChoice);
              }
            }}
            context={newGameContext}
            content={newGameContent}
            form={newGameForm}
            onChange={setNewGameForm}
            readyPowers={readyPowers}
            onCreatePower={createPower}
            onOpenChoice={() => {
              setChoice((current) => current ?? startChoice(newGameForm.firstPlayer));
              setScreen('starterChoice');
            }}
            onBackToMenu={() => setScreen('start')}
            onResumeGame={game ? () => setScreen('play') : undefined}
            onRandomize={
              mapChoices.find((entry) => entry.id === newGameMap.id)?.kind === 'episode'
                ? undefined
                : randomizeNewGame
            }
            random={randomized ? { report: randomized.report, round: randomized.round } : null}
            savedAsEpisode={randomized?.savedName ?? null}
            onSaveAsEpisode={saveRandomAsEpisode}
            header={
              <>
                {!phone && (
                  <GameKindChoice
                    kind={newGameKind}
                    onChange={(kind) => {
                      setNewGameKind(kind);
                      // The AI chosen before comes back with PvP / PvIA, and goes with «Regia + Stream».
                      const p2 = newGameForm.players.p2;
                      const name = secondPlayerName(p2.name, kind === 'arbitrated' ? aiLevel : null);
                      setNewGameForm({ ...newGameForm, players: { ...newGameForm.players, p2: { ...p2, name } } });
                    }}
                  />
                )}
                {arbitratedNewGame && (
                  <OpponentChoice
                    level={aiLevel}
                    phone={phone}
                    onChange={(level) => {
                      setAiLevel(level);
                      // The AI is called «IA» until the player gives it another name.
                      const p2 = newGameForm.players.p2;
                      const name = secondPlayerName(p2.name, level);
                      setNewGameForm({ ...newGameForm, players: { ...newGameForm.players, p2: { ...p2, name } } });
                    }}
                  />
                )}
              </>
            }
          />
        ) : (
          <div className={styles.loading}>Caricamento…</div>
        )}
      </>
    );
  }

  if (arbitratedGame) {
    return (
      <>
        {messages}
        <PhoneGame
          session={session}
          game={game}
          phone={phone}
          onMenu={openStartMenu}
          onGameOver={(next) => {
            // The game is over (spec 052, 2.9): deleted, as «Chiudi e cancella partita».
            discardGame();
            if (next === 'newGame') {
              openNewGame();
            }
          }}
        />
      </>
    );
  }

  const state = currentState(game);
  const name = (playerId: PlayerId) => state.players[playerId].name;
  const traveling = activeTravel(state, travel);
  const travelingItem = traveling && game.items.find((candidate) => candidate.id === traveling.itemId);

  // Off-rule moves, interactions and purchases, and an end of turn with
  // actions left, ask for a second click first (D-013, D-014, D-015, D-033).
  const tryWithRules = (action: GameAction, onDone?: () => void) =>
    askThenPerform(action, turnRuleWarnings(state, action, game), onDone);

  const askThenPerform = (action: GameAction, warnings: Warning[], onDone?: () => void) => {
    const decision = decideClick(pending, action, warnings);
    if (decision.kind === 'ask') {
      setPending(decision.pending);
      return;
    }
    if (perform(decision.action, { alreadyShown: decision.alreadyShown })) {
      onDone?.();
    }
  };

  const isShop = (nodeId: string) =>
    game.map.nodes.find((candidate) => candidate.id === nodeId)?.type === 'shop';
  // A special cell's meaning, after its number in the menu (spec 034, 2.5).
  const specialMeaning = (nodeId: string) => {
    const node = game.map.nodes.find((candidate) => candidate.id === nodeId);
    const note = node?.type === 'special' ? node.note?.trim() : undefined;
    return note ? ` · ${note}` : '';
  };

  // What the stream shows and the director's preview on top of it (D-032).
  const screens: DirectorScreens = { shared: session.overlay, preview };
  const applyScreens = (next: DirectorScreens) => {
    if (next.shared !== session.overlay) {
      session.setOverlay(next.shared);
    }
    setPreview(next.preview);
  };
  // "Esplora Regia": only the double click works on the board (spec 020, 2.3).
  const exploring = isExploring(screens);
  const cellName = (nodeId: string) =>
    game.catalog.find((character) => character.id === state.cells[nodeId]?.characterId)?.name ??
    `casella ${cellNumber(nodeId)}`;

  const handleNodeClick = (nodeId: string) => {
    if (editMode) {
      setEditingNodeId(nodeId);
      return;
    }
    // Pawns move by dragging them (D-026): a click on another cell does nothing.
    if (state.players[state.currentPlayer].position !== nodeId) {
      return;
    }
    if (isShop(nodeId)) {
      // Entering the shop uses no action (spec 002, section 4).
      session.setOverlay({ kind: 'shop', nodeId });
      return;
    }
    // Any cell with a character can be interacted with (D-016). Reopening the
    // scene where the player already interacted counts nothing (spec 020, 2.4).
    if (state.cells[nodeId]?.characterId !== undefined) {
      const open = () => session.setOverlay(challengeScreen(nodeId));
      if (isRepeatInteraction(state, nodeId)) {
        open();
      } else {
        tryWithRules({ type: 'interact', nodeId }, open);
      }
    }
  };

  // A double click shows any character's scene to the director only (D-032).
  // On the cell of the current pawn the click has already opened it for
  // everyone, except on the explored board, where clicks do nothing.
  const handleNodeDoubleClick = (nodeId: string) => {
    if (
      editMode ||
      isShop(nodeId) ||
      state.cells[nodeId]?.characterId === undefined ||
      (!exploring && state.players[state.currentPlayer].position === nodeId)
    ) {
      return;
    }
    applyScreens(openPreview(screens, nodeId));
  };

  // "Mostra al pubblico" (spec 020, 2.3): it is the interaction of the turn
  // only where the current pawn stands, with the same rules as the click.
  const showPreviewToPublic = () => {
    if (preview?.kind !== 'challenge') {
      return;
    }
    const show = () => applyScreens(showPreviewToAll(screens));
    const { nodeId } = preview;
    if (state.players[state.currentPlayer].position === nodeId && !isRepeatInteraction(state, nodeId)) {
      tryWithRules({ type: 'interact', nodeId }, show);
    } else {
      show();
    }
  };

  const showNextLine = () => {
    const shown = shownInDirector(screens);
    const lineCount = shown?.kind === 'challenge' ? (state.cells[shown.nodeId]?.lines?.length ?? 0) : 0;
    applyScreens(nextLine(screens, lineCount));
  };

  const handlePawnDrop = (playerId: PlayerId, nodeId: string) => {
    // With a travel item in use, its owner's pawn goes with the item (spec 047).
    if (traveling && traveling.player === playerId) {
      if (state.players[playerId].position !== nodeId) {
        // Arrived: the choice goes off, also when more copies of the item are left.
        tryWithRules({ type: 'useItem', player: playerId, itemId: traveling.itemId, to: nodeId }, () =>
          setTravel(null),
        );
      }
      return;
    }
    if (playerId === state.currentPlayer && nodeId === stepBackCell(game)) {
      // Back where the last move started: that move is undone, with no warning (D-087).
      undo();
      return;
    }
    const action = pawnDropAction(state, playerId, nodeId);
    if (action?.type === 'move') {
      tryWithRules(action);
    } else if (action) {
      // The other player's pawn: a second drop on the same cell, every time (D-033).
      askThenPerform(action, pawnDropWarnings(state, playerId));
    }
  };

  const openNodeMenu = (nodeId: string, at: ScreenPoint) =>
    setMenu({
      at,
      title: `Casella ${cellNumber(nodeId)}${specialMeaning(nodeId)}`,
      items: [
        ...(isShop(nodeId)
          ? [{ label: 'Apri negozio', run: () => session.setOverlay({ kind: 'shop', nodeId }) }]
          : []),
        ...PLAYER_IDS.map((playerId) => ({
          label: `${name(playerId)} conquista questa casella`,
          run: () => perform({ type: 'setConquest', nodeId, player: playerId }),
        })),
        {
          label: 'Casella di nuovo libera',
          run: () => perform({ type: 'setConquest', nodeId, player: null }),
        },
        ...PLAYER_IDS.map((playerId) => ({
          label: `Metti qui la pedina di ${name(playerId)} (senza contare l'azione)`,
          run: () => perform({ type: 'placePawn', player: playerId, nodeId }),
        })),
      ],
    });

  const openEdgeMenu = (edgeId: string, at: ScreenPoint) => {
    const locks = state.edgeLocks[edgeId];
    const edge = game.map.edges.find((candidate) => candidate.id === edgeId);
    const lockText = (playerId: PlayerId) =>
      `${name(playerId)} ${locks?.[playerId] ? 'chiuso' : 'aperto'}`;
    setMenu({
      at,
      title: [`Percorso: ${lockText('p1')} · ${lockText('p2')}`, edge?.lockNote]
        .filter(Boolean)
        .join(' — '),
      items: [
        { label: 'Sblocca per entrambi', run: () => perform({ type: 'setEdgeLock', edgeId, players: 'both', locked: false }) },
        { label: 'Blocca per entrambi', run: () => perform({ type: 'setEdgeLock', edgeId, players: 'both', locked: true }) },
        ...PLAYER_IDS.flatMap((playerId) => [
          { label: `Sblocca solo per ${name(playerId)}`, run: () => perform({ type: 'setEdgeLock', edgeId, players: playerId, locked: false }) },
          { label: `Blocca solo per ${name(playerId)}`, run: () => perform({ type: 'setEdgeLock', edgeId, players: playerId, locked: true }) },
        ]),
      ],
    });
  };

  /**
   * "Usa" in the inventory: the window of a training item (spec 041); a
   * travel item highlights where the pawn can go (spec 047), after a second
   * click when it is not the owner's turn (D-033); the Senzu at once, after
   * a second click when there is nothing to recharge (D-015).
   */
  const useInventoryItem = (playerId: PlayerId, itemId: string) => {
    const item = game.items.find((candidate) => candidate.id === itemId);
    if (!item) {
      return;
    }
    if (trainingRule(item)) {
      setTraining({ player: playerId, itemId });
      return;
    }
    if (travelRule(item)) {
      const warnings: Warning[] =
        playerId === state.currentPlayer
          ? []
          : [
              {
                kind: 'otherPlayerPawn',
                message: `Non è il turno di ${name(playerId)}: lo spostamento non conta azioni`,
              },
            ];
      const decision = decideClick(pending, { type: 'useItem', player: playerId, itemId }, warnings);
      if (decision.kind === 'ask') {
        setPending(decision.pending);
        return;
      }
      setPending(null);
      setTravel({ player: playerId, itemId, turn: state.turn, copies: copiesOf(state, playerId, itemId) });
      return;
    }
    tryWithRules({ type: 'useItem', player: playerId, itemId });
  };

  const panelActions = (playerId: PlayerId): PlayerPanelActions => ({
    setCoins: (coins) => perform({ type: 'setCoins', player: playerId, coins }),
    addCharacter: (characterId) => perform({ type: 'addCharacter', player: playerId, characterId }),
    removeCharacter: (characterId) =>
      perform({ type: 'removeCharacter', player: playerId, characterId }),
    usePower: (powerId) => perform({ type: 'usePower', player: playerId, powerId }),
    setPowerUses: (powerId, uses) =>
      perform({ type: 'setPowerUses', player: playerId, powerId, uses }),
    addItem: (itemId) => perform({ type: 'addToInventory', player: playerId, itemId }),
    removeItem: (itemId) => perform({ type: 'removeFromInventory', player: playerId, itemId }),
    useItem: (itemId) => useInventoryItem(playerId, itemId),
    completeMission: (nodeId) => perform({ type: 'completeMission', nodeId, player: playerId }),
    abandonMission: (missionId) => perform({ type: 'abandonMission', missionId }),
    fuse: (option) => perform({ type: 'fuse', player: playerId, members: option.members, resultId: option.resultId }),
  });

  // Missions whose condition came true (D-040): the host gives the reward with one click.
  const missionNotices = missionsDone(state)
    .filter((active) => !isPostponed(notYet, state.turn, active.id))
    .map((active) => ({
      id: active.id,
      nodeId: active.nodeId,
      player: active.player,
      text: `Missione di ${cellName(active.nodeId)} completata da ${name(active.player)}`,
    }));

  const priceActions: ShopActions = {
    setCharacterPrice: (characterId, price) =>
      perform({ type: 'setCharacterPrice', characterId, price }),
    setItemPrice: (itemId, price) => perform({ type: 'setItemPrice', itemId, price }),
  };

  const shopActions = (shopNodeId: string): ShopActions => ({
    ...priceActions,
    buyCharacter: (characterId) =>
      tryWithRules({ type: 'buyCharacter', shopNodeId, characterId }),
    buyItem: (itemId) => tryWithRules({ type: 'buyItem', shopNodeId, itemId }),
  });

  // Pawns together at the end of a turn: the showdown opens by itself, and the
  // host can close it and play on (D-029). Ending a turn never moves a pawn,
  // so the positions before it are the ones after it.
  const endTurn = () =>
    tryWithRules({ type: 'endTurn' }, () => {
      if (showdownDue(state)) {
        session.setOverlay({ kind: 'showdown' });
      }
    });

  const toggleEditMode = () => {
    setEditMode((on) => !on);
    setEditingNodeId(null);
  };

  const current = state.currentPlayer;
  // On a screen open on both windows: hide it in the director only (spec 020, 2.3).
  const exploreButton = (
    <button onClick={() => applyScreens(exploreBoard(screens))}>Esplora Regia</button>
  );

  return (
    <div className={styles.director}>
      <Toolbar
        state={state}
        canUndo={canUndo(game)}
        canRedo={session.canRedo}
        layout={session.layout}
        onEndTurn={endTurn}
        onUndo={undo}
        onRedo={redo}
        onShowdown={() => session.setOverlay({ kind: 'showdown' })}
        onSaveFile={() => downloadGame(game)}
        onLoadFile={loadFile}
        onOpenStream={openStream}
        onNewGame={openNewGame}
        onOpenStartMenu={openStartMenu}
        onDiscardGame={() => setDiscardAsked(true)}
        onLayoutChange={session.setLayout}
        editMode={editMode}
        onToggleEditMode={toggleEditMode}
      />
      {messages}
      <main className={styles.main}>
        <div className={`${styles.boardArea} ${editMode ? styles.editing : ''}`}>
          <Stage
            map={game.map}
            catalog={game.catalog}
            items={game.items}
            state={state}
            overlay={shownInDirector(screens)}
            previewOnly={preview !== null}
            onNodeClick={exploring ? undefined : handleNodeClick}
            onNodeDoubleClick={editMode ? undefined : handleNodeDoubleClick}
            onNextLine={showNextLine}
            onAnswer={(answer) => {
              // A wrong answer shown to the public is a lost challenge (spec 061, D-090).
              const shown = shownInDirector(screens);
              const quiz = shown?.kind === 'challenge' ? cellMission(state.cells[shown.nodeId]) : undefined;
              if (
                !preview &&
                shown?.kind === 'challenge' &&
                shown.answer === undefined &&
                quiz?.type === 'quiz' &&
                quiz.quiz?.correct !== answer
              ) {
                perform({ type: 'loseChallenge', nodeId: shown.nodeId, player: current });
              }
              applyScreens(chooseAnswer(screens, answer));
            }}
            onNodeMenu={exploring ? undefined : openNodeMenu}
            onEdgeMenu={exploring ? undefined : openEdgeMenu}
            onEdgeClick={editMode && !exploring ? openEdgeMenu : undefined}
            onPawnDrop={editMode || exploring ? undefined : handlePawnDrop}
            highlighted={highlight ? new Set(highlight) : undefined}
            onCloseNotification={session.closeNotification}
            challengeControls={(nodeId, character) => {
              // The buttons follow the mission (spec 026, 2.3); without one, "Assegna" as before.
              const mission = cellMission(state.cells[nodeId]);
              const shown = shownInDirector(screens);
              const answer = shown?.kind === 'challenge' ? shown.answer : undefined;
              const close = () => applyScreens(closeShown(screens));
              const complete = (label: string) => (
                <button
                  title={`Il premio va a ${name(current)}`}
                  onClick={() => perform({ type: 'completeMission', nodeId, player: current })}
                >
                  {label}
                </button>
              );
              return (
                <>
                  {!mission && character && (
                    <button onClick={() => perform({ type: 'assign', nodeId, player: current })}>
                      Assegna a {name(current)}
                    </button>
                  )}
                  {mission?.type === 'fight' && (
                    <>
                      <button
                        title="Simula lo scontro sulla stream invece di giocarlo in BT3"
                        onClick={() => setFightSetup({ kind: 'mission', nodeId, player: current })}
                      >
                        Simula
                      </button>
                      {complete(mission.condition === 'transform' ? 'Si è trasformato' : 'Vinta')}
                      <button
                        title={`${name(current)} non potrà sfidarlo di nuovo senza il potere per ritentare`}
                        onClick={() => {
                          perform({ type: 'loseChallenge', nodeId, player: current });
                          close();
                        }}
                      >
                        Persa
                      </button>
                    </>
                  )}
                  {mission?.type === 'quiz' &&
                    answer !== undefined &&
                    (answer === mission.quiz?.correct ? (
                      complete('Dai il premio')
                    ) : (
                      <span>Risposta sbagliata: nessun premio, la casella resta libera.</span>
                    ))}
                  {mission?.type === 'quiz' && answer === undefined && (
                    <span>Clicca la risposta data da {name(current)}.</span>
                  )}
                  {mission?.type === 'other' && complete('Completata')}
                  {mission && LASTING_MISSIONS.includes(mission.type) && (
                    <button
                      title={`La missione va tra quelle in corso di ${name(current)}`}
                      onClick={() => perform({ type: 'acceptMission', nodeId, player: current })}
                    >
                      Accetta
                    </button>
                  )}
                  {preview ? (
                    <button onClick={showPreviewToPublic}>Mostra al pubblico</button>
                  ) : (
                    exploreButton
                  )}
                  {/* At the bottom with the others, not at the top (the host's choice, spec 065). */}
                  <button onClick={close}>Chiudi</button>
                </>
              );
            }}
            showdownControls={
              <>
                <button
                  title="Simula lo showdown sulla stream invece di giocarlo in BT3"
                  onClick={() => setFightSetup({ kind: 'showdown' })}
                >
                  Simula
                </button>
                {exploreButton}
              </>
            }
            shopActions={shopActions}
            shopControls={exploreButton}
            onCloseShop={() => session.setOverlay(null)}
            onCloseShowdown={() => session.setOverlay(null)}
            onSwapShowdown={(player, a, b) => session.perform({ type: 'swapTeam', player, a, b })}
          />
          {traveling && travelingItem && (
            <div className={styles.traveling} role="status">
              <span>
                {travelingItem.name} di {name(traveling.player)}: trascina la pedina su una casella
                evidenziata
              </span>
              <button onClick={() => setTravel(null)}>Annulla</button>
            </div>
          )}
          {exploring && session.overlay && (
            <div className={styles.exploring}>
              <span className={styles.directorOnly}>Solo in regia</span>
              <span>
                Sullo stream: {describeScreen(session.overlay, cellName)}. Doppio clic su un
                personaggio per l'anteprima.
              </span>
              <button onClick={() => applyScreens(closeShown(screens))}>Torna allo stream</button>
            </div>
          )}
          {editMode && editingNodeId && (
            <CellEditor
              key={editingNodeId}
              context={game}
              state={state}
              nodeId={editingNodeId}
              shopActions={priceActions}
              onClose={() => setEditingNodeId(null)}
              onSave={(content) => {
                if (perform({ type: 'setCellContent', nodeId: editingNodeId, content })) {
                  setEditingNodeId(null);
                }
              }}
            />
          )}
        </div>
        <aside className={styles.side}>
          <MissionNotices
            notices={missionNotices}
            onReward={(id) => {
              const notice = missionNotices.find((candidate) => candidate.id === id);
              if (notice) {
                perform({ type: 'completeMission', nodeId: notice.nodeId, player: notice.player });
              }
            }}
            onNotYet={(id) => setNotYet((previous) => postpone(previous, state.turn, id))}
          />
          {PLAYER_IDS.map((playerId) => (
            <PlayerPanel
              key={playerId}
              playerId={playerId}
              player={state.players[playerId]}
              catalog={game.catalog}
              items={game.items}
              isCurrent={current === playerId}
              missions={missionsOf(state, playerId, game.catalog)}
              fusions={fusionOptions(state, game.catalog, playerId)}
              actions={panelActions(playerId)}
            />
          ))}
          <details className={styles.section}>
            <summary>Missioni della puntata</summary>
            {/* Director only (spec 029, 2.4): a click opens the scene as a preview. */}
            <MissionTable
              compact
              rows={missionRows(game.map, state.cells, game.catalog, game.items, state)}
              playerNames={{ p1: name('p1'), p2: name('p2') }}
              onRowClick={(nodeId) => applyScreens(openPreview(screens, nodeId))}
            />
          </details>
          <details className={styles.section}>
            <summary>Correzioni</summary>
            <CorrectionsPanel state={state} perform={perform} />
          </details>
          <details className={styles.section} open>
            <summary>Registro</summary>
            <LogPanel game={game} />
          </details>
        </aside>
      </main>
      {menu && <ContextMenu menu={menu} onClose={closeMenu} />}
      {discardAsked && (
        <DiscardGameDialog onCancel={closeDiscardDialog} onConfirm={discardGame} />
      )}
      {fightSetup && (
        <GameFight
          game={game}
          state={state}
          setup={fightSetup}
          perform={perform}
          onView={session.setBattle}
          onLost={() => {
            // «Persa» in the simulated fight: a lost challenge (spec 061, D-090).
            if (fightSetup.kind === 'mission') {
              perform({ type: 'loseChallenge', nodeId: fightSetup.nodeId, player: fightSetup.player });
            }
            applyScreens(closeShown(screens));
          }}
          onClose={() => setFightSetup(null)}
        />
      )}
      {training && (
        <TrainingDialog
          game={game}
          state={state}
          player={training.player}
          itemId={training.itemId}
          onConfirm={(choices) => {
            // The window already showed its guides: not repeated in the message bar.
            const done = perform(
              { type: 'useTraining', player: training.player, itemId: training.itemId, choices },
              { alreadyShown: ['trainingRule', 'characterAlreadyPlaced'] },
            );
            if (done) {
              setTraining(null);
            }
          }}
          onClose={() => setTraining(null)}
        />
      )}
    </div>
  );
}
