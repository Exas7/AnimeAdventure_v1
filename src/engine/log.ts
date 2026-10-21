import { cellNumber } from './cellNumber';
import { cellLabel, findCharacter, findEdge, findItem, findPower } from './lookup';
import { isRepeatInteraction } from './rules';
import { characterPrice, itemPrice } from './shop';
import type { Game, GameContext, GameState, PlayerId, RecordedAction } from './types';

export interface LogEntry {
  turn: number;
  player: PlayerId;
  playerName: string;
  text: string;
  /** Automatic consequences: powers fired, turns skipped. */
  details: string[];
}

/**
 * The game log, in order. It is rebuilt from the history, so an undone
 * action disappears from it: the log only shows what really happened.
 */
export function gameLog(game: Game): LogEntry[] {
  return game.history.map((entry, index) => {
    const before = game.history[index - 1]?.state ?? entry.state;
    return {
      turn: entry.turn,
      player: entry.player,
      playerName: before.players[entry.player].name,
      text: describeAction(entry.action, before, game),
      details: entry.events,
    };
  });
}

/** Italian description of an action, using the names in the state before it. */
function describeAction(action: RecordedAction, before: GameState, context: GameContext): string {
  const name = (playerId: PlayerId) => before.players[playerId].name;
  const current = name(before.currentPlayer);
  const cell = (nodeId: string) => cellLabel(before, context.map, context.catalog, nodeId);
  const character = (characterId: string) =>
    context.catalog.find((candidate) => candidate.id === characterId)?.name ?? characterId;
  const item = (itemId: string) =>
    context.items.find((candidate) => candidate.id === itemId)?.name ?? itemId;

  switch (action.type) {
    case 'startGame':
      return 'Inizio della partita';
    case 'move':
      return `${current} si sposta su ${cell(action.to)}`;
    case 'interact':
      return isRepeatInteraction(before, action.nodeId)
        ? `${current} riapre la scena di ${cell(action.nodeId)}`
        : `${current} interagisce con ${cell(action.nodeId)}`;
    case 'usePower': {
      const power = findPower(before.players[action.player], action.powerId);
      return `${name(action.player)} usa ${power.definition.name}`;
    }
    case 'endTurn':
      return `${current} termina il turno`;
    case 'addCharacter':
      return `${character(action.characterId)} entra nella squadra di ${name(action.player)}`;
    case 'removeCharacter':
      return `${character(action.characterId)} esce dalla squadra di ${name(action.player)}`;
    case 'setConquest':
      return action.player === null
        ? `${cell(action.nodeId)} di nuovo sfidabile`
        : `${name(action.player)} conquista ${cell(action.nodeId)}`;
    case 'assign': {
      const assigned = before.cells[action.nodeId]?.characterId;
      const who = assigned ? character(assigned) : cell(action.nodeId);
      return `${name(action.player)} riceve ${who} e conquista la sua casella`;
    }
    case 'setEdgeLock': {
      const edge = findEdge(context.map, action.edgeId);
      const who = action.players === 'both' ? 'entrambi' : name(action.players);
      const what = action.locked ? 'bloccato' : 'sbloccato';
      return `Percorso ${cell(edge.from)} – ${cell(edge.to)} ${what} per ${who}`;
    }
    case 'buyCharacter': {
      const bought = findCharacter(context.catalog, action.characterId);
      return `${current} compra ${bought.name} per ${characterPrice(before, bought)} monete`;
    }
    case 'buyItem': {
      const bought = findItem(context.items, action.itemId);
      return `${current} compra ${bought.name} per ${itemPrice(before, bought)} monete`;
    }
    case 'setCoins':
      return `Correzione: monete di ${name(action.player)} portate a ${action.coins}`;
    case 'setTurn':
      return `Correzione: contatore dei turni portato a ${action.turn}`;
    case 'setCurrentPlayer':
      return `Correzione: ora tocca a ${name(action.player)}`;
    case 'setActions':
      return 'Correzione: azioni del turno';
    case 'setTurnsToSkip':
      return `Correzione: turni da saltare di ${name(action.player)} portati a ${action.turns}`;
    case 'setPowerUses': {
      const power = findPower(before.players[action.player], action.powerId);
      return `Correzione: usi di ${power.definition.name} di ${name(action.player)} portati a ${action.uses}`;
    }
    case 'placePawn':
      return `Correzione: pedina di ${name(action.player)} su ${cell(action.nodeId)}`;
    case 'addToInventory':
      return `Inventario di ${name(action.player)}: entra ${item(action.itemId)}`;
    case 'removeFromInventory':
      return `Inventario di ${name(action.player)}: esce ${item(action.itemId)}`;
    case 'setCharacterPrice':
      return `Correzione: prezzo di ${character(action.characterId)} portato a ${action.price}`;
    case 'setItemPrice':
      return `Correzione: prezzo di ${item(action.itemId)} portato a ${action.price}`;
    case 'acceptMission':
      return `${name(action.player)} accetta la missione di ${cell(action.nodeId)}`;
    case 'completeMission':
      return `${name(action.player)} completa la missione di ${cell(action.nodeId)}`;
    case 'abandonMission': {
      const active = before.activeMissions?.find((mission) => mission.id === action.missionId);
      return active
        ? `${name(active.player)} abbandona la missione di ${cell(active.nodeId)}`
        : 'Missione abbandonata';
    }
    case 'setCellContent': {
      const previous = before.cells[action.nodeId]?.characterId;
      const next = action.content.characterId;
      if (previous !== next) {
        return next
          ? `Casella ${cellNumber(action.nodeId)}: ora c'è ${character(next)}`
          : `Casella ${cellNumber(action.nodeId)}: personaggio tolto`;
      }
      return `Casella ${cellNumber(action.nodeId)}: contenuto modificato`;
    }
  }
}

