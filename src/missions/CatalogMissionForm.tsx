import { useMemo, useState } from 'react';
import type { Character, ItemDefinition, Mission } from '../engine';
import { CharacterPicker } from '../ui/CharacterPicker';
import { groupBySaga, withoutSpecialKeepers } from '../ui/characterGroups';
import { MissionEditor } from '../ui/MissionEditor';
import { NumberField } from '../ui/NumberField';
import { MISSION_GROUPS, type CatalogMission, type MissionGroup } from './catalog';
import styles from './CatalogPanels.module.css';

/** What the form edits: everything of a catalog mission but its code. */
export type CatalogMissionDraft = Omit<CatalogMission, 'id'>;

export const EMPTY_CATALOG_MISSION: CatalogMissionDraft = {
  giver: { group: 'recruitable' },
  mission: { type: 'fight', condition: 'win', reward: { cellCharacter: true } },
  lines: [],
  weight: 1,
};

interface CatalogMissionFormProps {
  initial: CatalogMissionDraft;
  characters: Character[];
  items: ItemDefinition[];
  saveLabel: string;
  onSave(draft: CatalogMissionDraft): void;
  onCancel(): void;
}

/** One mission of the catalog (spec 027, 2.1): who gives it, the mission, the lines, the chain, the weight. */
export function CatalogMissionForm(props: CatalogMissionFormProps) {
  const { characters, items } = props;
  const groups = useMemo(() => groupBySaga(withoutSpecialKeepers(characters)), [characters]);
  const [draft, setDraft] = useState<CatalogMissionDraft>(props.initial);
  const [linesText, setLinesText] = useState(props.initial.lines.join('\n'));
  const giverKind = 'group' in draft.giver ? draft.giver.group : 'character';

  return (
    <div className={styles.form}>
      <div className={styles.row}>
        <label className={styles.field}>
          Chi la dà
          <select
            value={giverKind}
            onChange={(event) => {
              const value = event.target.value;
              setDraft({
                ...draft,
                giver: value === 'character' ? { characterId: '' } : { group: value as MissionGroup },
              });
            }}
          >
            <option value="character">Un personaggio preciso</option>
            {MISSION_GROUPS.map((group) => (
              <option key={group.group} value={group.group}>
                Gruppo: {group.label}
              </option>
            ))}
          </select>
        </label>
        {'characterId' in draft.giver && (
          <label className={styles.field}>
            Personaggio
            <CharacterPicker
              catalog={characters}
              groups={groups}
              value={draft.giver.characterId}
              onChange={(characterId) => setDraft({ ...draft, giver: { characterId } })}
              placeholder="Scegli il personaggio…"
              ariaLabel="Chi dà la missione"
            />
          </label>
        )}
      </div>

      <MissionEditor
        mission={draft.mission}
        onChange={(mission: Mission | undefined) => mission && setDraft({ ...draft, mission })}
        catalog={characters}
        groups={groups}
        items={items}
      />
      <p className={styles.hint}>
        Obiettivo, formato o domanda lasciati vuoti li sceglie «Randomizza» quando mette la missione in
        una casella.
      </p>

      <label className={styles.field}>
        Battute, una per riga: {'{obiettivo}'}, {'{premio}'}, {'{n}'} e {'{monete}'} si riempiono da soli
        <textarea
          rows={3}
          value={linesText}
          onChange={(event) => setLinesText(event.target.value)}
        />
      </label>

      <div className={styles.row}>
        <label className={styles.field}>
          Catena: chi va dietro il percorso che questa casella apre (facoltativo)
          <CharacterPicker
            catalog={characters}
            groups={groups}
            value={draft.behindId ?? ''}
            onChange={(behindId) => setDraft({ ...draft, behindId: behindId || undefined })}
            placeholder="Nessuno"
            ariaLabel="Chi va dietro il percorso"
          />
        </label>
        <label className={styles.field}>
          Peso
          <NumberField
            label="Peso"
            value={draft.weight}
            onCommit={(weight) => setDraft({ ...draft, weight: Math.max(0, weight) })}
          />
        </label>
      </div>

      <div className={styles.buttons}>
        <button
          className={styles.primary}
          disabled={'characterId' in draft.giver && !draft.giver.characterId}
          onClick={() =>
            props.onSave({
              ...draft,
              lines: linesText
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean),
            })
          }
        >
          {props.saveLabel}
        </button>
        <button onClick={props.onCancel}>Annulla</button>
      </div>
    </div>
  );
}
