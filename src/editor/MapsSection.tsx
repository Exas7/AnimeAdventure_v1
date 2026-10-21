import { useCallback, useEffect, useState } from 'react';
import type { GameMap } from '../engine';
import { downloadMap } from '../director/fileIO';
import {
  deleteMap,
  listMaps,
  loadMap,
  newMapId,
  saveMap,
  type MapSummary,
} from '../storage/mapLibrary';
import { listIncludedMaps, type IncludedMap } from '../included/includedMaps';
import { MapEditor } from './MapEditor';
import { MapLibraryScreen } from './MapLibraryScreen';
import { newMap } from './mapEdit';
import { MapFileError, parseMap } from './mapFile';
import { describeError } from '../describeError';

interface MapsSectionProps {
  onBack(): void;
  showError(message: string): void;
}

interface Editing {
  /** Library id; null until the first save of a new map. */
  id: string | null;
  map: GameMap;
  /** Changes on every opening, so the editor starts fresh. */
  session: number;
}

/** Map library and editor (spec 006): director window only. */
export function MapsSection({ onBack, showError }: MapsSectionProps) {
  const [maps, setMaps] = useState<MapSummary[]>([]);
  const [included, setIncluded] = useState<IncludedMap[]>([]);
  const [editing, setEditing] = useState<Editing | null>(null);

  const refresh = useCallback(() => {
    listMaps()
      .then(setMaps)
      .catch((cause: unknown) => showError(`Impossibile leggere la libreria: ${describeError(cause)}`));
  }, [showError]);

  useEffect(refresh, [refresh]);

  useEffect(() => {
    listIncludedMaps()
      .then((result) => {
        setIncluded(result.maps);
        if (result.errors.length > 0) {
          showError(`Mappe base non lette: ${result.errors.join(' ')}`);
        }
      })
      .catch((cause: unknown) => showError(`Impossibile leggere le mappe base: ${describeError(cause)}`));
  }, [showError]);

  const open = (id: string | null, map: GameMap) =>
    setEditing({ id, map, session: Date.now() });

  if (editing) {
    return (
      <MapEditor
        key={editing.session}
        initialMap={editing.map}
        onExport={downloadMap}
        onSave={async (map) => {
          const id = editing.id ?? newMapId();
          await saveMap(id, map);
          setEditing((current) => (current ? { ...current, id } : current));
        }}
        onSaveAs={async (map) => {
          // A new map of the library; the editor goes on with the new one.
          const id = newMapId();
          await saveMap(id, map);
          setEditing((current) => (current ? { ...current, id } : current));
          refresh();
        }}
        existingNames={maps.map((entry) => entry.name)}
        onExit={() => {
          setEditing(null);
          refresh();
        }}
      />
    );
  }

  const withMap = (id: string, use: (map: GameMap) => void) => {
    loadMap(id)
      .then((map) => (map ? use(map) : showError('Questa mappa non si riesce più a leggere.')))
      .catch((cause: unknown) => showError(`Impossibile aprire la mappa: ${describeError(cause)}`));
  };

  return (
    <MapLibraryScreen
      maps={maps}
      included={included}
      onCopyIncluded={(id) => {
        const entry = included.find((candidate) => candidate.id === id);
        if (entry) {
          saveMap(newMapId(), entry.map)
            .then(refresh)
            .catch((cause: unknown) => showError(`Mappa non copiata: ${describeError(cause)}`));
        }
      }}
      onBack={onBack}
      onNew={() => open(null, newMap())}
      onOpen={(id) => withMap(id, (map) => open(id, map))}
      onExport={(id) => withMap(id, downloadMap)}
      onImport={(file) => {
        file
          .text()
          .then((text) => saveMap(newMapId(), parseMap(text)))
          .then(refresh)
          .catch((cause: unknown) =>
            showError(cause instanceof MapFileError ? cause.message : describeError(cause)),
          );
      }}
      onDelete={(id) => {
        deleteMap(id)
          .then(refresh)
          .catch((cause: unknown) => showError(`Impossibile eliminare la mappa: ${describeError(cause)}`));
      }}
    />
  );
}
