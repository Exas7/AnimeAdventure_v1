import { useId, useMemo, useState } from 'react';
import {
  cellMission,
  cleanLines,
  type CellContent,
  type Character,
  type ItemDefinition,
  type Mission,
} from '../engine';
import { CharacterPicker } from './CharacterPicker';
import { groupBySaga, keeperGroups, withoutSpecialKeepers } from './characterGroups';
import { moveItem } from './lineList';
import { MissionEditor } from './MissionEditor';
import styles from './CellContentForm.module.css';

interface CellContentFormProps {
  catalog: Character[];
  isShop: boolean;
  /**
   * Character cells and shops (D-023); also a cell that already has a
   * character, from data saved before D-023.
   */
  canHoldCharacter: boolean;
  initial: CellContent;
  /** The items of the game, for the rewards of the missions (spec 026). */
  items: ItemDefinition[];
  /** Remembered lines to suggest while typing (spec 007, 2.5; D-031). */
  suggestions?: { lines: string[] };
  onSave(content: CellContent): void;
  onCancel(): void;
  /** Shows the challenge as it will look, with what is in the form now (spec 007). */
  onPreview?: (content: CellContent) => void;
  /** Older versions of special shopkeepers that only this episode has (spec 022). */
  onlyInEpisode?: string[];
}

/**
 * The content of one cell (D-016): character, lines (D-031), the mission
 * with its reward (spec 026) and, for shops, the characters for sale. Used by the edit mode (spec 004) and by
 * episode preparation (spec 007).
 */
export function CellContentForm(props: CellContentFormProps) {
  const { catalog, isShop, canHoldCharacter, initial, suggestions, onlyInEpisode } = props;
  const lineList = useId();
  // Special shopkeepers only keep shops (D-035): the other menus leave them out.
  const sagas = useMemo(() => groupBySaga(withoutSpecialKeepers(catalog)), [catalog]);
  const keepers = useMemo(() => keeperGroups(catalog, onlyInEpisode), [catalog, onlyInEpisode]);
  const nameOf = (characterId: string | undefined) =>
    catalog.find((character) => character.id === characterId)?.name ?? '';
  // A character missing from the list starts empty, as before the menus by saga.
  const known = (characterId: string | undefined) =>
    catalog.some((character) => character.id === characterId) ? (characterId ?? '') : '';

  const [characterId, setCharacterId] = useState(known(initial.characterId));
  // A cell without lines starts with one empty field, ready to write in.
  const [lines, setLines] = useState<string[]>(initial.lines?.length ? initial.lines : ['']);
  // A format saved before missions starts as a fight in that format (D-039).
  const [mission, setMission] = useState<Mission | undefined>(cellMission(initial));
  const [forSale, setForSale] = useState<string[]>(initial.forSale ?? []);
  const [newForSale, setNewForSale] = useState('');

  const current = (): CellContent => {
    const content: CellContent = {};
    if (characterId) {
      content.characterId = characterId;
    }
    const written = cleanLines(lines);
    if (written.length > 0) {
      content.lines = written;
    }
    // Only Character cells give missions (spec 034, 2.5).
    const givesMission = canHoldCharacter && !isShop;
    if (mission && givesMission) {
      content.mission = mission;
    }
    if (isShop) {
      content.forSale = forSale;
    }
    return content;
  };

  const addForSale = () => {
    if (newForSale && !forSale.includes(newForSale)) {
      setForSale([...forSale, newForSale]);
      setNewForSale('');
    }
  };

  return (
    <div className={styles.form}>
      {suggestions && (
        <datalist id={lineList}>
          {suggestions.lines.map((text) => (
            <option key={text} value={text} />
          ))}
        </datalist>
      )}

      {canHoldCharacter && (
        <label className={styles.field}>
          {isShop ? 'Negoziante' : 'Personaggio'}
          <span className={styles.row}>
            <CharacterPicker
              catalog={catalog}
              groups={isShop ? keepers : sagas}
              value={characterId}
              onChange={setCharacterId}
              placeholder="Nessuno"
              ariaLabel={isShop ? 'Negoziante' : 'Personaggio'}
            />
            {characterId && (
              <button onClick={() => setCharacterId('')} title="Nessun personaggio">
                ×
              </button>
            )}
          </span>
        </label>
      )}

      <div className={styles.field}>
        Battute
        <ol className={styles.lines}>
          {lines.map((line, index) => (
            // Fields are controlled: the position is enough as a key.
            <li key={index} className={styles.row}>
              <input
                list={suggestions ? lineList : undefined}
                value={line}
                aria-label={`Battuta ${index + 1}`}
                onChange={(event) =>
                  setLines(lines.map((other, at) => (at === index ? event.target.value : other)))
                }
              />
              <button
                onClick={() => setLines(moveItem(lines, index, -1))}
                disabled={index === 0}
                title="Sposta su"
              >
                ↑
              </button>
              <button
                onClick={() => setLines(moveItem(lines, index, 1))}
                disabled={index === lines.length - 1}
                title="Sposta giù"
              >
                ↓
              </button>
              <button
                onClick={() => setLines(lines.filter((_, at) => at !== index))}
                title="Togli battuta"
              >
                ×
              </button>
            </li>
          ))}
        </ol>
        <span className={styles.row}>
          <button onClick={() => setLines([...lines, ''])}>Aggiungi battuta</button>
        </span>
        <span className={styles.hint}>
          La task si scrive dentro la battuta. Nella scena un clic sul balloon passa alla
          battuta successiva.
        </span>
      </div>
      {canHoldCharacter && !isShop && (
        <MissionEditor
          mission={mission}
          onChange={setMission}
          catalog={catalog}
          groups={sagas}
          items={props.items}
        />
      )}

      {isShop && (
        <div className={styles.field}>
          In vendita
          <ul className={styles.forSale}>
            {forSale.map((id) => (
              <li key={id}>
                {nameOf(id)}
                <button onClick={() => setForSale(forSale.filter((other) => other !== id))}>×</button>
              </li>
            ))}
          </ul>
          <span className={styles.row}>
            <CharacterPicker
              catalog={catalog}
              groups={sagas}
              value={newForSale}
              onChange={setNewForSale}
              placeholder="Aggiungi personaggio in vendita…"
              ariaLabel="Aggiungi personaggio in vendita"
              onSubmit={addForSale}
            />
            <button onClick={addForSale} disabled={!newForSale}>
              Aggiungi
            </button>
          </span>
        </div>
      )}

      <div className={styles.buttons}>
        <button className={styles.primary} onClick={() => props.onSave(current())}>
          Salva
        </button>
        <button onClick={props.onCancel}>Annulla</button>
        {props.onPreview && (
          <button onClick={() => props.onPreview?.(current())}>
            Anteprima sfida
          </button>
        )}
      </div>
    </div>
  );
}
