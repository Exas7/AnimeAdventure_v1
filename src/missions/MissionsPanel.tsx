import { useRef, useState } from 'react';
import { missionLabel, rewardText, type Character, type ItemDefinition } from '../engine';
import screenStyles from '../director/Screens.module.css';
import { InfoButton } from '../ui/InfoButton';
import { MISSION_GROUPS, newCatalogId, type CatalogMission } from './catalog';
import { Dialog } from '../ui/Dialog';
import { CatalogMissionForm, EMPTY_CATALOG_MISSION } from './CatalogMissionForm';
import styles from './CatalogPanels.module.css';

interface MissionsPanelProps {
  missions: CatalogMission[];
  characters: Character[];
  items: ItemDefinition[];
  onChange(missions: CatalogMission[]): void;
  /** "Esporta per Excel": the whole catalog as a CSV file. */
  onExport(): void;
  /** "Importa da Excel": replaces the catalog; resolves with the summary to show. */
  onImport(file: File): Promise<string[]>;
}

/** "Missioni" in the episode library (spec 027, 2.1; D-041). */
export function MissionsPanel(props: MissionsPanelProps) {
  const { missions, characters, items, onChange } = props;
  const [adding, setAdding] = useState(false);
  // "Aggiungi missione" and "Modifica" open the form in a window (spec 029, 2.5).
  const [editing, setEditing] = useState<string | null>(null);
  const [deleteAsked, setDeleteAsked] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [report, setReport] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const name = (id: string) => characters.find((character) => character.id === id)?.name ?? id;
  const giverName = (entry: CatalogMission) =>
    'characterId' in entry.giver
      ? name(entry.giver.characterId)
      : `Gruppo: ${MISSION_GROUPS.find((group) => 'group' in entry.giver && group.group === entry.giver.group)?.label ?? ''}`;
  // The character of the cell is not known in the catalog: "chi la dà" stands for it.
  const prizeText = (entry: CatalogMission) =>
    [
      entry.mission.reward.cellCharacter ? 'chi la dà' : '',
      rewardText({ ...entry.mission.reward, cellCharacter: false }, undefined, characters, items),
    ]
      .filter(Boolean)
      .join(', ');
  const editedEntry = missions.find((entry) => entry.id === editing);
  const wanted = search.trim().toLowerCase();
  const shown = missions.filter((entry) => !wanted || giverName(entry).toLowerCase().includes(wanted));

  return (
    <section className={styles.panel}>
      <h2 className={styles.title}>
        Missioni
        <InfoButton label="Missioni">
          Le missioni che «Randomizza» mette nelle caselle, calibrate sui personaggi. Chi non ne ha di
          sue prende quelle del suo gruppo: cattivi, arruolabili, personaggi della storia. Il catalogo
          si modifica qui o in Excel: «Esporta per Excel», modifica il file, poi «Importa da Excel».
        </InfoButton>
      </h2>

      <div className={styles.buttons}>
        <button className={styles.primary} onClick={() => setAdding(true)} disabled={adding}>
          Aggiungi missione
        </button>
        <button onClick={props.onExport} disabled={missions.length === 0}>
          Esporta per Excel
        </button>
        <button onClick={() => fileRef.current?.click()}>Importa da Excel</button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) {
              void props.onImport(file).then(setReport);
            }
          }}
        />
      </div>
      {report.length > 0 && (
        <div className={styles.report}>
          {report.map((line, index) => (
            <p key={index}>{line}</p>
          ))}
          <button onClick={() => setReport([])}>Chiudi</button>
        </div>
      )}

      <input
        className={styles.search}
        value={search}
        placeholder="Cerca per personaggio…"
        aria-label="Cerca missioni per personaggio"
        onChange={(event) => setSearch(event.target.value)}
      />
      <p className={screenStyles.note}>
        {missions.length === 0
          ? 'Nessuna missione: importa docs/missioni-bt3.csv con «Importa da Excel».'
          : `${shown.length} di ${missions.length} missioni.`}
      </p>

      <ul className={screenStyles.mapList}>
        {shown.map((entry) => (
            <li key={entry.id}>
              <div>
                <strong>
                  {giverName(entry)} · {missionLabel(entry.mission, characters)}
                </strong>
                <span className={screenStyles.note}>
                  Premio: {prizeText(entry) || 'nessuno'}
                  {entry.behindId ? ` · dietro: ${name(entry.behindId)}` : ''} · peso {entry.weight}
                </span>
                {entry.lines[0] && <span className={screenStyles.note}>«{entry.lines[0]}»</span>}
              </div>
              <div className={screenStyles.mapActions}>
                <button onClick={() => setEditing(entry.id)}>Modifica</button>
                <button
                  className={deleteAsked === entry.id ? screenStyles.danger : undefined}
                  onClick={() => {
                    if (deleteAsked === entry.id) {
                      setDeleteAsked(null);
                      onChange(missions.filter((other) => other.id !== entry.id));
                    } else {
                      setDeleteAsked(entry.id);
                    }
                  }}
                >
                  {deleteAsked === entry.id ? 'Clicca di nuovo per eliminare' : 'Elimina'}
                </button>
              </div>
            </li>
        ))}
      </ul>

      {adding && (
        <Dialog title="Nuova missione" onClose={() => setAdding(false)}>
          <CatalogMissionForm
            initial={EMPTY_CATALOG_MISSION}
            characters={characters}
            items={items}
            saveLabel="Aggiungi"
            onSave={(draft) => {
              onChange([...missions, { id: newCatalogId(), ...draft }]);
              setAdding(false);
            }}
            onCancel={() => setAdding(false)}
          />
        </Dialog>
      )}
      {editedEntry && (
        <Dialog title="Modifica missione" onClose={() => setEditing(null)}>
          <CatalogMissionForm
            initial={editedEntry}
            characters={characters}
            items={items}
            saveLabel="Salva"
            onSave={(draft) => {
              onChange(missions.map((other) => (other.id === editedEntry.id ? { ...draft, id: editedEntry.id } : other)));
              setEditing(null);
            }}
            onCancel={() => setEditing(null)}
          />
        </Dialog>
      )}
    </section>
  );
}
