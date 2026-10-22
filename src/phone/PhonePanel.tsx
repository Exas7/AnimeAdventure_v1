import { useState } from 'react';
import {
  rechargesStarter,
  TEAM_SIZE,
  trainingRule,
  travelRule,
  type Character,
  type GameState,
  type ItemDefinition,
  type PlayerId,
} from '../engine';
import { ownImage } from '../ui/characterImages';
import { Dialog } from '../ui/Dialog';
import { itemImage } from '../ui/itemImages';
import { Placeholder } from '../ui/Placeholder';
import { playerInfo } from './playerInfo';
import styles from './PhonePanel.module.css';

interface PhonePanelProps {
  playerId: PlayerId;
  state: GameState;
  catalog: Character[];
  items: ItemDefinition[];
  /** G1 at the left of the map, G2 at the right: the team on the outer edge (spec 064, 2.1). */
  side: 'left' | 'right';
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
 * One player's column at a side of the map on the phone (spec 064, 2.1):
 * name, coins and «i»; the team top to bottom on the outer edge; «Usa
 * potere» with its uses and the items inside; «Annulla» and «Fine turno»
 * for the player whose turn it is, «Menu» for the other. Nothing is
 * edited by hand (D-085).
 */
export function PhonePanel(props: PhonePanelProps) {
  const { playerId, state, catalog, items, side } = props;
  const player = state.players[playerId];
  const current = state.currentPlayer === playerId;
  const active = current && !props.locked;
  const { actions } = state;
  const movesLeft = Math.max(0, actions.available - actions.used);
  const missions = (state.activeMissions ?? []).filter((mission) => mission.player === playerId).length;
  const nameOf = (id: string) => catalog.find((character) => character.id === id)?.name ?? id;
  const item = (id: string) => items.find((candidate) => candidate.id === id);
  const usable = (id: string) => {
    const definition = item(id);
    return Boolean(definition && (trainingRule(definition) || travelRule(definition) || rechargesStarter(definition)));
  };
  const manualPowers = player.powers.filter((power) => power.usesLeft !== null);
  const slots = Array.from({ length: TEAM_SIZE }, (_, index) => player.team[index]);
  const [info, setInfo] = useState(false);

  const classes = [styles.panel, styles[side], styles[playerId], current ? styles.current : ''];
  return (
    <aside className={classes.join(' ')}>
      <header className={styles.head}>
        <span className={styles.name}>{player.name}</span>
        <button className={styles.info} onClick={() => setInfo(true)} aria-label={`Informazioni su ${player.name}`}>
          i{missions > 0 && <span className={styles.badge}>{missions}</span>}
        </button>
      </header>
      <div className={styles.coins}>{player.coins} monete</div>
      {current && (
        <div className={styles.turn}>
          Turno {state.turn} · Azioni {movesLeft}
        </div>
      )}

      <div className={styles.body}>
        <ol className={styles.team}>
          {slots.map((id, index) => (
            <li key={index} className={id ? styles.slot : styles.empty}>
              {id && <Placeholder name={nameOf(id)} characterId={id} imageData={ownImage(catalog, id)} size="fill" />}
            </li>
          ))}
        </ol>
        <div className={styles.inner}>
          {manualPowers.map((power) => (
            <button
              key={power.id}
              className={styles.power}
              disabled={!active || (power.usesLeft ?? 0) <= 0}
              onClick={() => props.onUsePower(power.id)}
              title={power.definition.name}
            >
              <strong>Usa potere</strong>
              <small>
                {power.usesLeft === 1 ? '1 uso rimasto' : `${power.usesLeft ?? 0} usi rimasti`}
              </small>
            </button>
          ))}
          {player.inventory.length > 0 && (
            <div className={styles.items}>
              {player.inventory.map((id, index) => {
                const name = item(id)?.name ?? id;
                const image = itemImage(name);
                return (
                  <button
                    key={`${id}-${index}`}
                    className={styles.item}
                    disabled={!active || !usable(id)}
                    onClick={() => props.onUseItem(id)}
                    title={`Usa ${name}`}
                    aria-label={`Usa ${name}`}
                  >
                    {image ? <img src={image} alt="" /> : name}
                  </button>
                );
              })}
            </div>
          )}
          {player.team.length > TEAM_SIZE && (
            <p className={styles.note}>Oltre i {TEAM_SIZE}: {player.team.slice(TEAM_SIZE).map(nameOf).join(', ')}</p>
          )}
          {player.turnsToSkip > 0 && (
            <p className={styles.note}>
              Salta {player.turnsToSkip} {player.turnsToSkip === 1 ? 'turno' : 'turni'}
            </p>
          )}
        </div>
      </div>

      <div className={styles.commands}>
        {current ? (
          <>
            <button
              disabled={props.locked || !props.canUndo}
              onClick={props.onUndo}
              title="Toglie l'ultima mossa, acquisto o uso del turno"
            >
              Annulla
            </button>
            <button className={styles.primary} disabled={props.locked} onClick={props.onEndTurn}>
              Fine turno
            </button>
          </>
        ) : (
          <button onClick={props.onMenu}>Menu</button>
        )}
      </div>

      {info && (
        <PlayerInfoDialog
          {...props}
          onClose={() => setInfo(false)}
          canAbandon={active}
        />
      )}
    </aside>
  );
}

/** «i»: the game of a player in full (spec 064, 2.1). */
function PlayerInfoDialog(props: PhonePanelProps & { onClose(): void; canAbandon: boolean }) {
  const { state, catalog, items, playerId } = props;
  const player = state.players[playerId];
  const info = playerInfo(state, catalog, items, playerId);
  return (
    <Dialog title={`${player.name} · la partita`} narrow onClose={props.onClose}>
      <section className={styles.section}>
        <h3>{info.powers.length === 1 ? 'Potere dello starter' : 'Poteri dello starter'}</h3>
        {info.powers.length === 0 && <p>Nessun potere.</p>}
        {info.powers.map((power, index) => (
          <p key={index}>
            <strong>{power.name}</strong>: {power.text}.
            {power.usesLeft !== null && ` Usi rimasti: ${power.usesLeft}.`}
          </p>
        ))}
      </section>
      <section className={styles.section}>
        <h3>Oggetti</h3>
        {info.items.length === 0 && <p>Nessun oggetto.</p>}
        {info.items.map((owned, index) => (
          <p key={index}>
            <strong>{owned.name}</strong>
            {owned.text && `: ${owned.text}.`}
          </p>
        ))}
      </section>
      <section className={styles.section}>
        <h3>Missioni in corso</h3>
        {info.missions.length === 0 && <p>Nessuna missione in corso.</p>}
        {info.missions.map((mission) => (
          <div key={mission.id} className={styles.mission}>
            <p>
              <strong>{mission.giver}</strong>: {mission.task}
            </p>
            {props.canAbandon && <button onClick={() => props.onAbandonMission(mission.id)}>Abbandona</button>}
          </div>
        ))}
      </section>
      <section className={styles.section}>
        <h3>Sfide perse</h3>
        {info.lostTo.length === 0 ? (
          <p>Nessuna.</p>
        ) : (
          <p>
            {info.lostTo.join(', ')}: non puoi {info.lostTo.length === 1 ? 'sfidarlo' : 'sfidarli'} di nuovo senza il
            potere per ritentare.
          </p>
        )}
      </section>
      <section className={styles.section}>
        <h3>Sesto personaggio</h3>
        <p>{info.sixth[0]?.toUpperCase() + info.sixth.slice(1)}.</p>
      </section>
    </Dialog>
  );
}
