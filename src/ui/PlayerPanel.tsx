import { useLayoutEffect, useRef, useState } from 'react';
import {
  rechargesStarter,
  TEAM_SIZE,
  trainingRule,
  travelRule,
  type PanelMission,
  type Character,
  type ItemDefinition,
  type PlayerId,
  type PlayerState,
} from '../engine';
import { placesIn, visibleItems } from './carriedItems';
import { CharacterPicker } from './CharacterPicker';
import { NumberField } from './NumberField';
import { ownImage } from './characterImages';
import { itemImage } from './itemImages';
import { Placeholder } from './Placeholder';
import styles from './PlayerPanel.module.css';

/** Editing commands, available only in the director window. */
export interface PlayerPanelActions {
  setCoins(coins: number): void;
  addCharacter(characterId: string): void;
  removeCharacter(characterId: string): void;
  usePower(powerId: string): void;
  setPowerUses(powerId: string, uses: number): void;
  addItem(itemId: string): void;
  removeItem(itemId: string): void;
  /** "Usa" (spec 041, 047): training opens its window, travel highlights cells, the Senzu recharges. */
  useItem(itemId: string): void;
  /** "Completata": the reward by hand, even if the app has not noticed (spec 026, 2.4). */
  completeMission(nodeId: string): void;
  abandonMission(missionId: number): void;
}

interface PlayerPanelProps {
  playerId: PlayerId;
  player: PlayerState;
  catalog: Character[];
  items: ItemDefinition[];
  isCurrent: boolean;
  /** Missions in progress (spec 026, 2.4), on director and stream. */
  missions?: PanelMission[];
  actions?: PlayerPanelActions;
}

export function PlayerPanel(props: PlayerPanelProps) {
  const { playerId, player, catalog, items, isCurrent, actions } = props;
  const itemName = (itemId: string) =>
    items.find((item) => item.id === itemId)?.name ?? itemId;
  // What "Usa" does with each item (spec 041, 047); an item without an effect has only the ×.
  const useHint = (itemId: string): string | null => {
    const item = items.find((candidate) => candidate.id === itemId);
    if (!item) {
      return null;
    }
    if (trainingRule(item)) {
      return 'scegli chi sale di forma';
    }
    if (travelRule(item)) {
      return 'scegli dove va la pedina';
    }
    return rechargesStarter(item) ? 'ricarica il potere dello starter' : null;
  };
  const nameOf = (characterId: string) =>
    catalog.find((character) => character.id === characterId)?.name ?? characterId;
  const slots = Array.from({ length: TEAM_SIZE }, (_, index) => player.team[index]);
  const extras = player.team.slice(TEAM_SIZE);
  const manualPowers = player.powers.filter((power) => power.usesLeft !== null);
  const automaticPowers = player.powers.filter((power) => power.usesLeft === null);

  return (
    <section
      className={[
        styles.panel,
        styles[playerId] ?? '',
        isCurrent ? styles.current : '',
        // Without editing commands the panel is the stream's (spec 024, 2.2).
        actions ? '' : styles.onStream,
      ].join(' ')}
    >
      <header className={styles.header}>
        <span className={styles.name}>{player.name}</span>
        {isCurrent && <span className={styles.badge}>di turno</span>}
        <span className={styles.coins}>
          {actions ? (
            <NumberField
              value={player.coins}
              label={`Monete di ${player.name}`}
              onCommit={actions.setCoins}
            />
          ) : (
            player.coins
          )}{' '}
          monete
        </span>
      </header>

      <div className={styles.teamRow}>
        <ol className={styles.team}>
          {slots.map((characterId, index) => (
            <li key={index} className={characterId ? styles.slot : styles.emptySlot}>
              {characterId && (
                <>
                  <Placeholder
                    name={nameOf(characterId)}
                    characterId={characterId}
                    imageData={ownImage(catalog, characterId)}
                  />
                  {characterId === player.starterId && (
                    <span className={styles.starter} title="Starter">
                      ★
                    </span>
                  )}
                  {actions && (
                    <button
                      className={styles.remove}
                      title={`Togli ${nameOf(characterId)}`}
                      onClick={() => actions.removeCharacter(characterId)}
                    >
                      ×
                    </button>
                  )}
                </>
              )}
            </li>
          ))}
        </ol>
        {/* On the stream the items are pictures at the right of the team: the panel never grows (spec 045). */}
        {!actions && <CarriedItems itemIds={player.inventory} itemName={itemName} />}
      </div>

      {actions && extras.length > 0 && (
        <div className={styles.extras}>
          <span>Oltre i {TEAM_SIZE} posti:</span>
          {extras.map((characterId, index) => (
            <button
              key={`${characterId}-${index}`}
              title="Togli"
              onClick={() => actions.removeCharacter(characterId)}
            >
              {nameOf(characterId)} ×
            </button>
          ))}
        </div>
      )}

      {actions && (
        <AddCharacter
          catalog={catalog}
          onAdd={actions.addCharacter}
          playerName={player.name}
        />
      )}

      {manualPowers.length > 0 && (
        <ul className={styles.powers}>
          {manualPowers.map((power) => (
            <li key={power.id}>
              <span className={styles.powerName}>{power.definition.name}</span>
              <span className={styles.dots} aria-label={`${power.usesLeft ?? 0} usi rimasti`}>
                {(power.usesLeft ?? 0) > 0 ? '●'.repeat(power.usesLeft ?? 0) : '–'}
              </span>
              {actions && (
                <span className={styles.powerActions}>
                  <button onClick={() => actions.usePower(power.id)}>Usa</button>
                  <button
                    title="Togli un uso"
                    onClick={() => actions.setPowerUses(power.id, Math.max(0, (power.usesLeft ?? 0) - 1))}
                  >
                    −
                  </button>
                  <button
                    title="Aggiungi un uso"
                    onClick={() => actions.setPowerUses(power.id, (power.usesLeft ?? 0) + 1)}
                  >
                    +
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {actions && automaticPowers.length > 0 && (
        <p className={styles.automatic}>
          Automatici: {automaticPowers.map((power) => power.definition.name).join(', ')}
        </p>
      )}

      {actions && (
        <div className={styles.inventory}>
          {player.inventory.map((itemId, index) => (
            <span key={`${itemId}-${index}`} className={styles.item}>
              <ItemPicture name={itemName(itemId)} className={styles.itemIcon} />
              {itemName(itemId)}
              {actions && useHint(itemId) && (
                <button
                  className={styles.use}
                  title={`Usa ${itemName(itemId)}: ${useHint(itemId)}`}
                  onClick={() => actions.useItem(itemId)}
                >
                  Usa
                </button>
              )}
              {actions && (
                <button
                  title={`Togli ${itemName(itemId)} (usato)`}
                  onClick={() => actions.removeItem(itemId)}
                >
                  ×
                </button>
              )}
            </span>
          ))}
          {actions && (
            <select
              value=""
              aria-label={`Aggiungi oggetto all'inventario di ${player.name}`}
              onChange={(event) => {
                if (event.target.value) {
                  actions.addItem(event.target.value);
                }
              }}
            >
              <option value="">Aggiungi oggetto…</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {props.missions && props.missions.length > 0 && (
        <div className={styles.missions}>
          <span className={styles.missionsTitle}>Missioni in corso</span>
          <ul>
            {props.missions.map((mission) => (
              <li key={mission.id}>
                <span>{mission.text}</span>
                {actions && (
                  <span className={styles.missionActions}>
                    <button onClick={() => actions.completeMission(mission.nodeId)}>Completata</button>
                    <button onClick={() => actions.abandonMission(mission.id)}>Abbandona</button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {player.turnsToSkip > 0 && (
        <p className={styles.skip}>
          Salta {player.turnsToSkip} {player.turnsToSkip === 1 ? 'turno' : 'turni'}
        </p>
      )}
    </section>
  );
}

/** The picture of an item, if the host has one (spec 045). */
function ItemPicture({ name, className }: { name: string; className?: string }) {
  const image = itemImage(name);
  return image ? <img className={className} src={image} alt="" /> : null;
}

/** Size and gap of the item pictures, as .carriedItem in PlayerPanel.module.css. */
const CARRIED_SIZE = 80;
const CARRIED_GAP = 6;

/**
 * The items on the stream, in the room at the right of the team: pictures
 * only (a name for an item without one), as many as fit, then "+N".
 */
function CarriedItems({ itemIds, itemName }: { itemIds: string[]; itemName: (itemId: string) => string }) {
  const room = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(Infinity);

  useLayoutEffect(() => {
    const element = room.current;
    if (!element) {
      return;
    }
    const measure = () => setFit(placesIn(element.clientWidth, CARRIED_SIZE, CARRIED_GAP));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const { shown, more } = visibleItems(itemIds, fit);
  return (
    <div ref={room} className={styles.carried}>
      {shown.map((itemId, index) => {
        const name = itemName(itemId);
        const image = itemImage(name);
        return image ? (
          <img key={`${itemId}-${index}`} className={styles.carriedItem} src={image} alt={name} title={name} />
        ) : (
          <span key={`${itemId}-${index}`} className={styles.carriedName}>
            {name}
          </span>
        );
      })}
      {more > 0 && <span className={styles.carriedMore}>+{more}</span>}
    </div>
  );
}

interface AddCharacterProps {
  catalog: Character[];
  onAdd: (characterId: string) => void;
  playerName: string;
}

/** Character menu by saga (spec 017): choose a character, then "Aggiungi". */
function AddCharacter({ catalog, onAdd, playerName }: AddCharacterProps) {
  const [chosenId, setChosenId] = useState('');

  const submit = () => {
    if (chosenId) {
      onAdd(chosenId);
      setChosenId('');
    }
  };

  return (
    <div className={styles.add}>
      <CharacterPicker
        catalog={catalog}
        value={chosenId}
        onChange={setChosenId}
        placeholder="Aggiungi personaggio…"
        ariaLabel={`Aggiungi personaggio alla squadra di ${playerName}`}
        onSubmit={submit}
      />
      <button onClick={submit} disabled={!chosenId}>
        Aggiungi
      </button>
    </div>
  );
}
