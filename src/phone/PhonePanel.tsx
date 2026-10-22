import { useState } from 'react';
import {
  activeMissionParts,
  rechargesStarter,
  TEAM_SIZE,
  trainingRule,
  travelRule,
  type Character,
  type ItemDefinition,
  type PlayerId,
  type PlayerState,
} from '../engine';
import { itemImage } from '../ui/itemImages';
import { Placeholder } from '../ui/Placeholder';
import { ownImage } from '../ui/characterImages';
import type { GameState } from '../engine';
import styles from './PhonePanel.module.css';

interface PhonePanelProps {
  state: GameState;
  catalog: Character[];
  items: ItemDefinition[];
  canUndo: boolean;
  /** The AI's turn (spec 053, 2.2): the player's buttons are off, «Menu» stays. */
  locked?: boolean;
  onUsePower(powerId: string): void;
  onUseItem(itemId: string): void;
  onAbandonMission(missionId: number): void;
  onEndTurn(): void;
  onUndo(): void;
  onMenu(): void;
}

/**
 * The narrow column at the right of the map on the phone (spec 052, 2.4):
 * the turn, the current player with what they can use, the opponent in
 * short, and the commands. Nothing is edited by hand (D-085).
 */
export function PhonePanel(props: PhonePanelProps) {
  const { state, catalog, items } = props;
  const current = state.currentPlayer;
  const other: PlayerId = current === 'p1' ? 'p2' : 'p1';
  const { actions } = state;
  const movesLeft = Math.max(0, actions.available - actions.used);
  const interactionsLeft = Math.max(0, actions.interactionsAvailable - actions.interactionsUsed);

  return (
    <aside className={styles.panel}>
      <header className={styles.turn}>
        <span>
          Turno {state.turn} · tocca a <strong className={styles[current]}>{state.players[current].name}</strong>
        </span>
        <span className={styles.actions}>
          Azioni {movesLeft} · interazioni {interactionsLeft}
        </span>
      </header>

      <PlayerBox
        playerId={current}
        player={state.players[current]}
        catalog={catalog}
        items={items}
        missions={(state.activeMissions ?? [])
          .filter((active) => active.player === current)
          .map((active) => ({ id: active.id, ...activeMissionParts(active, state, catalog) }))}
        onUsePower={props.onUsePower}
        onUseItem={props.onUseItem}
        onAbandonMission={props.onAbandonMission}
        locked={props.locked}
      />
      <PlayerBox playerId={other} player={state.players[other]} catalog={catalog} items={items} short />

      <div className={styles.commands}>
        <button className={styles.primary} disabled={props.locked} onClick={props.onEndTurn}>
          Fine turno
        </button>
        <button disabled={props.locked || !props.canUndo} onClick={props.onUndo} title="Toglie l'ultima mossa, acquisto o uso del turno">
          Annulla
        </button>
        <button onClick={props.onMenu}>Menu</button>
      </div>
    </aside>
  );
}

/** A mission in progress: the name of who gave it, the task on a tap (spec 058). */
interface PhoneMission {
  id: number;
  giver: string;
  task: string;
}

interface PlayerBoxProps {
  playerId: PlayerId;
  player: PlayerState;
  catalog: Character[];
  items: ItemDefinition[];
  /** The opponent: name, coins and team only. */
  short?: boolean;
  missions?: PhoneMission[];
  onUsePower?(powerId: string): void;
  onUseItem?(itemId: string): void;
  onAbandonMission?(missionId: number): void;
  locked?: boolean;
}

function PlayerBox(props: PlayerBoxProps) {
  const { playerId, player, catalog, items, short } = props;
  const nameOf = (id: string) => catalog.find((character) => character.id === id)?.name ?? id;
  const item = (id: string) => items.find((candidate) => candidate.id === id);
  const usable = (id: string) => {
    const definition = item(id);
    return Boolean(definition && (trainingRule(definition) || travelRule(definition) || rechargesStarter(definition)));
  };
  const manualPowers = player.powers.filter((power) => power.usesLeft !== null);
  const slots = Array.from({ length: TEAM_SIZE }, (_, index) => player.team[index]);
  // The mission whose task is open: one at a time, not a game action (spec 058).
  const [openMission, setOpenMission] = useState<number | null>(null);

  return (
    <section className={`${styles.player} ${styles[playerId] ?? ''} ${short ? styles.short : ''}`}>
      <div className={styles.head}>
        <span className={styles.name}>{player.name}</span>
        <span className={styles.coins}>{player.coins} monete</span>
      </div>
      <ol className={styles.team}>
        {slots.map((id, index) => (
          <li key={index} className={id ? styles.slot : styles.empty}>
            {id && (
              <Placeholder
                name={nameOf(id)}
                characterId={id}
                imageData={ownImage(catalog, id)}
                size="fill"
              />
            )}
          </li>
        ))}
      </ol>
      {player.team.length > TEAM_SIZE && (
        <p className={styles.note}>Oltre i {TEAM_SIZE} posti: {player.team.slice(TEAM_SIZE).map(nameOf).join(', ')}</p>
      )}
      {player.turnsToSkip > 0 && (
        <p className={styles.note}>
          Salta {player.turnsToSkip} {player.turnsToSkip === 1 ? 'turno' : 'turni'}
        </p>
      )}
      {!short && (
        <>
          {manualPowers.map((power) => (
            <div key={power.id} className={styles.row}>
              <span className={styles.label}>
                {power.definition.name} {'●'.repeat(power.usesLeft ?? 0) || '–'}
              </span>
              <button disabled={props.locked || (power.usesLeft ?? 0) <= 0} onClick={() => props.onUsePower?.(power.id)}>
                Usa
              </button>
            </div>
          ))}
          {player.inventory.map((id, index) => {
            const name = item(id)?.name ?? id;
            const image = itemImage(name);
            return (
              <div key={`${id}-${index}`} className={styles.row}>
                {image && <img className={styles.itemIcon} src={image} alt="" />}
                <span className={styles.label}>{name}</span>
                {usable(id) && (
                  <button disabled={props.locked} onClick={() => props.onUseItem?.(id)}>
                    Usa
                  </button>
                )}
              </div>
            );
          })}
          {(props.missions ?? []).map((mission) => {
            const open = openMission === mission.id;
            return (
              <div key={mission.id}>
                <div className={styles.row}>
                  <button
                    className={styles.giver}
                    aria-expanded={open}
                    title="Mostra la missione"
                    onClick={() => setOpenMission(open ? null : mission.id)}
                  >
                    {open ? '▾' : '▸'} {mission.giver}
                  </button>
                  <button disabled={props.locked} onClick={() => props.onAbandonMission?.(mission.id)}>
                    Abbandona
                  </button>
                </div>
                {open && <p className={styles.task}>{mission.task}</p>}
              </div>
            );
          })}
        </>
      )}
    </section>
  );
}
