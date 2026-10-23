import { useCallback, useEffect, useState } from 'react';
import { testItems, type Character } from '../engine';
import { downloadCsv, downloadEpisode } from '../director/fileIO';
import type { CatalogMission, QuestionEntry } from '../missions/catalog';
import { catalogFromCsv, catalogToCsv, questionsFromCsv, questionsToCsv } from '../missions/catalogCsv';
import { MissionsPanel } from '../missions/MissionsPanel';
import { QuestionsPanel } from '../missions/QuestionsPanel';
import {
  loadMissionCatalog,
  loadQuestions,
  saveMissionCatalog,
  saveQuestions,
} from '../storage/missionStore';
import {
  deleteEpisode,
  listEpisodes,
  loadEpisode,
  newEpisodeId,
  saveEpisode,
  type EpisodeSummary,
} from '../storage/episodeLibrary';
import {
  deleteSpecialKeeper,
  listSpecialKeepers,
  saveSpecialKeeper,
} from '../storage/keeperStore';
import { listMaps } from '../storage/mapLibrary';
import { listIncludedMaps, loadAnyMap } from '../included/includedMaps';
import {
  deleteReadyPower,
  listReadyPowers,
  replaceReadyPower,
  saveReadyPower,
} from '../storage/powerStore';
import { powersMissingFrom } from '../starters/proposals';
import type { ReadyPowerDraft } from '../starters/ReadyPowerForm';
import { makeReadyPower, newReadyPowerId, type ReadyPower } from '../starters/readyPowers';
import { makeSpecialKeeper, newSpecialKeeperId } from '../catalog/specialKeepers';
import { shrinkImage } from '../ui/shrinkImage';
import { loadTexts, saveTexts } from '../storage/textStore';
import { EpisodeEditor } from './EpisodeEditor';
import { EpisodeFileError, parseEpisode, type Episode } from './episodeFile';
import { EpisodeLibraryScreen, type LibraryTab, type MapOption } from './EpisodeLibraryScreen';
import { NewEpisodeWizard } from './NewEpisodeWizard';
import { SpecialKeepersPanel } from './SpecialKeepersPanel';
import { PowersPanel } from '../starters/PowersPanel';
import { EMPTY_TEXT_LIBRARY, type TextLibrary } from './textLibrary';
import { describeError } from '../describeError';

interface EpisodesSectionProps {
  /** The imported character list; empty when none was imported (spec 010). */
  catalog: Character[];
  onBack(): void;
  showError(message: string): void;
}

interface Editing {
  /** Library id; null until the first save of a new episode. */
  id: string | null;
  episode: Episode;
  /** Changes on every opening, so the editor starts fresh. */
  session: number;
}

/** Episode library and preparation (spec 007): director window only. */
export function EpisodesSection({ catalog, onBack, showError }: EpisodesSectionProps) {
  const [episodes, setEpisodes] = useState<EpisodeSummary[]>([]);
  const [maps, setMaps] = useState<MapOption[]>([]);
  const [texts, setTexts] = useState<TextLibrary>(EMPTY_TEXT_LIBRARY);
  const [editing, setEditing] = useState<Editing | null>(null);
  // Special shopkeepers (D-035): apart from the character list.
  const [keepers, setKeepers] = useState<Character[]>([]);
  // Ready powers for the proposed starters (D-037): apart from the character list too.
  const [powers, setPowers] = useState<ReadyPower[]>([]);
  // The catalog of missions and the quiz questions (D-041).
  const [missions, setMissions] = useState<CatalogMission[]>([]);
  const [questions, setQuestions] = useState<QuestionEntry[]>([]);
  // "＋ Nuova puntata": the guided creation (spec 028, 3.3).
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(() => {
    listEpisodes()
      .then(setEpisodes)
      .catch((cause: unknown) => showError(`Impossibile leggere le puntate: ${describeError(cause)}`));
  }, [showError]);

  useEffect(refresh, [refresh]);

  const refreshKeepers = useCallback(() => {
    listSpecialKeepers()
      .then(setKeepers)
      .catch((cause: unknown) =>
        showError(`Impossibile leggere i negozianti speciali: ${describeError(cause)}`),
      );
  }, [showError]);

  useEffect(refreshKeepers, [refreshKeepers]);

  const refreshPowers = useCallback(() => {
    listReadyPowers()
      .then(setPowers)
      .catch((cause: unknown) => showError(`Impossibile leggere i poteri: ${describeError(cause)}`));
  }, [showError]);

  useEffect(refreshPowers, [refreshPowers]);

  useEffect(() => {
    loadMissionCatalog()
      .then(setMissions)
      .catch((cause: unknown) => showError(`Impossibile leggere le missioni: ${describeError(cause)}`));
    loadQuestions()
      .then(setQuestions)
      .catch((cause: unknown) => showError(`Impossibile leggere le domande: ${describeError(cause)}`));
  }, [showError]);

  const changeMissions = (next: CatalogMission[]) => {
    setMissions(next);
    saveMissionCatalog(next).catch((cause: unknown) =>
      showError(`Impossibile salvare le missioni: ${describeError(cause)}`),
    );
  };

  const changeQuestions = (next: QuestionEntry[]) => {
    setQuestions(next);
    saveQuestions(next).catch((cause: unknown) =>
      showError(`Impossibile salvare le domande: ${describeError(cause)}`),
    );
  };

  // "Importa da Excel" (D-041): the file replaces the list, unless nothing in it can be read.
  const importMissions = async (file: File): Promise<string[]> => {
    const result = catalogFromCsv(await file.text(), catalog, testItems);
    if (result.entries.length > 0) {
      changeMissions(result.entries);
    }
    return importReport('missioni', result.entries.length, result.skipped);
  };

  const importQuestions = async (file: File): Promise<string[]> => {
    const result = questionsFromCsv(await file.text(), catalog);
    if (result.entries.length > 0) {
      changeQuestions(result.entries);
    }
    return importReport('domande', result.entries.length, result.skipped);
  };

  const addPower = (draft: ReadyPowerDraft) => {
    saveReadyPower(makeReadyPower(newReadyPowerId(), draft.cardText, draft.effect))
      .then(refreshPowers)
      .catch((cause: unknown) => showError(`Potere non aggiunto. ${describeError(cause)}`));
  };

  // "Nuovo potere…" in the guided creation: into the list, then into the proposal.
  const createPower = async (draft: ReadyPowerDraft): Promise<ReadyPower | null> => {
    const power = makeReadyPower(newReadyPowerId(), draft.cardText, draft.effect);
    try {
      await saveReadyPower(power);
      refreshPowers();
      return power;
    } catch (cause) {
      showError(`Potere non aggiunto. ${describeError(cause)}`);
      return null;
    }
  };

  // Editing makes a new version: episodes already saved keep the old one (spec 025, 2.1).
  const editPower = (power: ReadyPower, draft: ReadyPowerDraft) => {
    replaceReadyPower(power.id, makeReadyPower(newReadyPowerId(), draft.cardText, draft.effect))
      .then(refreshPowers)
      .catch((cause: unknown) => showError(`Potere non modificato. ${describeError(cause)}`));
  };

  // A picture that cannot be read gets a message for the host, not a technical one.
  const picture = (file: File) =>
    shrinkImage(file).catch(() => {
      throw new Error(`"${file.name}" non è un'immagine leggibile: scegli un file PNG, JPG o WebP.`);
    });

  const addKeeper = (name: string, file: File) => {
    picture(file)
      .then((image) => saveSpecialKeeper(makeSpecialKeeper(newSpecialKeeperId(), name, image)))
      .then(refreshKeepers)
      .catch((cause: unknown) => showError(`Negoziante non aggiunto. ${describeError(cause)}`));
  };

  // Editing makes a new version: episodes already saved keep the old one (spec 022).
  const editKeeper = (keeper: Character, name: string, file: File | null) => {
    (file ? picture(file) : Promise.resolve(keeper.imageData ?? ''))
      .then(async (image) => {
        await saveSpecialKeeper(makeSpecialKeeper(newSpecialKeeperId(), name, image));
        await deleteSpecialKeeper(keeper.id);
      })
      .then(refreshKeepers)
      .catch((cause: unknown) => showError(`Negoziante non modificato. ${describeError(cause)}`));
  };

  useEffect(() => {
    Promise.all([listMaps(), listIncludedMaps()])
      .then(([list, included]) => {
        if (included.errors.length > 0) {
          showError(`Mappe base non lette: ${included.errors.join(' ')}`);
        }
        // The host's maps first, the base maps last (spec 033, 2.2).
        setMaps([
          ...list.map((entry) => ({ id: entry.id, name: entry.name })),
          ...included.maps.map((entry) => ({ id: entry.id, name: entry.map.name, included: true })),
        ]);
      })
      .catch((cause: unknown) => showError(`Impossibile leggere le mappe: ${describeError(cause)}`));
    loadTexts()
      .then(setTexts)
      .catch((cause: unknown) =>
        showError(`Impossibile leggere la libreria delle battute: ${describeError(cause)}`),
      );
  }, [showError]);

  const open = (id: string | null, episode: Episode) =>
    setEditing({ id, episode, session: Date.now() });

  const changeTexts = (next: TextLibrary) => {
    setTexts(next);
    saveTexts(next).catch((cause: unknown) =>
      showError(`Impossibile salvare la libreria delle battute: ${describeError(cause)}`),
    );
  };

  if (editing) {
    return (
      <EpisodeEditor
        key={editing.session}
        initialEpisode={editing.episode}
        catalog={catalog}
        specialKeepers={keepers}
        readyPowers={powers}
        missionCatalog={missions}
        questions={questions}
        texts={texts}
        onTextsChange={changeTexts}
        onExport={downloadEpisode}
        onSave={async (episode) => {
          const id = editing.id ?? newEpisodeId();
          await saveEpisode(id, episode);
          setEditing((current) => (current ? { ...current, id } : current));
        }}
        onExit={() => {
          setEditing(null);
          refresh();
        }}
      />
    );
  }

  const withEpisode = (id: string, use: (episode: Episode) => void) => {
    loadEpisode(id)
      .then((episode) =>
        episode ? use(episode) : showError('Questa puntata non si riesce più a leggere.'),
      )
      .catch((cause: unknown) => showError(`Impossibile aprire la puntata: ${describeError(cause)}`));
  };

  const deleteKeeper = (id: string) => {
    deleteSpecialKeeper(id)
      .then(refreshKeepers)
      .catch((cause: unknown) => showError(`Impossibile eliminare il negoziante: ${describeError(cause)}`));
  };

  if (creating) {
    return (
      <NewEpisodeWizard
        maps={maps}
        loadMap={loadAnyMap}
        episodeNames={episodes.map((entry) => entry.name)}
        catalog={catalog}
        readyPowers={powers}
        specialKeepers={keepers}
        missions={missions}
        questions={questions}
        texts={texts}
        onCreatePower={createPower}
        onAddKeeper={addKeeper}
        onEditKeeper={editKeeper}
        onDeleteKeeper={deleteKeeper}
        onImportMissions={importMissions}
        onImportQuestions={importQuestions}
        onSave={async (episode) => {
          const id = newEpisodeId();
          await saveEpisode(id, episode);
          refresh();
          return id;
        }}
        onOpenInEditor={(id, episode) => {
          setCreating(false);
          open(id, episode);
        }}
        onClose={() => {
          setCreating(false);
          refresh();
        }}
        showError={showError}
      />
    );
  }

  // Shopkeepers of the character list, next to the special ones (spec 029, 2.5).
  const listKeepers = catalog.filter((character) => character.shopkeeper);
  const libraries: LibraryTab[] = [
    {
      id: 'powers',
      label: 'Poteri',
      count: powers.length,
      warn: powers.length === 0,
      content: (
        <PowersPanel
          powers={powers}
          onAdd={addPower}
          onEdit={editPower}
          onDelete={(id) => {
            deleteReadyPower(id)
              .then(refreshPowers)
              .catch((cause: unknown) => showError(`Impossibile eliminare il potere: ${describeError(cause)}`));
          }}
        />
      ),
    },
    {
      id: 'keepers',
      label: 'Negozianti',
      count: listKeepers.length + keepers.length,
      warn: listKeepers.length + keepers.length === 0,
      content: (
        <SpecialKeepersPanel
          listKeepers={listKeepers}
          keepers={keepers}
          onAdd={addKeeper}
          onEdit={editKeeper}
          onDelete={deleteKeeper}
        />
      ),
    },
    {
      id: 'missions',
      label: 'Missioni',
      count: missions.length,
      warn: missions.length === 0,
      content: (
        <MissionsPanel
          missions={missions}
          characters={catalog}
          items={testItems}
          onChange={changeMissions}
          onExport={() => downloadCsv(catalogToCsv(missions, catalog, testItems), 'missioni.csv')}
          onImport={importMissions}
        />
      ),
    },
    {
      id: 'questions',
      label: 'Domande',
      count: questions.length,
      warn: questions.length === 0,
      content: (
        <QuestionsPanel
          questions={questions}
          characters={catalog}
          onChange={changeQuestions}
          onExport={() => downloadCsv(questionsToCsv(questions, catalog), 'domande.csv')}
          onImport={importQuestions}
        />
      ),
    },
  ];

  return (
    <EpisodeLibraryScreen
      episodes={episodes}
      onBack={onBack}
      onNew={() => setCreating(true)}
      onOpen={(id) => withEpisode(id, (episode) => open(id, episode))}
      onExport={(id) => withEpisode(id, downloadEpisode)}
      onImport={(file) => {
        file
          .text()
          .then(async (text) => {
            const episode = parseEpisode(text);
            // Its special shopkeepers join the library when they are missing (spec 022).
            const known = new Set(keepers.map((keeper) => keeper.id));
            for (const keeper of episode.keepers ?? []) {
              if (!known.has(keeper.id)) {
                await saveSpecialKeeper(keeper);
              }
            }
            // So do the powers of its proposed starters (spec 025, 2.1).
            for (const power of powersMissingFrom(powers, episode.starters)) {
              await saveReadyPower(power);
            }
            await saveEpisode(newEpisodeId(), episode);
          })
          .then(() => {
            refresh();
            refreshKeepers();
            refreshPowers();
          })
          .catch((cause: unknown) =>
            showError(cause instanceof EpisodeFileError ? cause.message : describeError(cause)),
          );
      }}
      onDelete={(id) => {
        deleteEpisode(id)
          .then(refresh)
          .catch((cause: unknown) =>
            showError(`Impossibile eliminare la puntata: ${describeError(cause)}`),
          );
      }}
      libraries={libraries}
    />
  );
}

/** "142 missioni importate. 3 righe saltate: …", or why nothing changed. */
function importReport(what: string, imported: number, skipped: string[]): string[] {
  const head =
    imported > 0
      ? `${imported} ${what} importate: prendono il posto di quelle di prima.`
      : `Nessuna riga leggibile: le ${what} restano quelle di prima.`;
  const shown = skipped.slice(0, 8);
  const more = skipped.length - shown.length;
  return [
    head,
    ...(skipped.length > 0 ? [`${skipped.length} righe saltate:`] : []),
    ...shown,
    ...(more > 0 ? [`E altre ${more}.`] : []),
  ];
}
