import {
  type CellContent,
  type GameContext,
  type GameMap,
  type GameSetup,
  type PlayerId,
} from '../engine';
import { emptyProposals, type StarterProposals } from '../starters/proposals';
import { readyPowerDefinition } from '../starters/readyPowers';
import { chosenProposal, type StarterChoice } from '../starters/starterChoice';

export interface PlayerForm {
  name: string;
  startNodeId: string;
}

export interface NewGameForm {
  players: Record<PlayerId, PlayerForm>;
  /**
   * The three starters proposed to each player (spec 025, 2.3): those of the
   * episode, changeable for this game only. The starter itself is chosen in
   * the scene of the choice.
   */
  proposals: StarterProposals;
  startingCoins: number;
  firstPlayer: PlayerId;
}

const DEFAULT_NAMES: Record<PlayerId, string> = { p1: 'G1', p2: 'G2' };

/**
 * A ready form: the two start cells of the map and the episode's proposals,
 * copied so that changing them leaves the episode as it is. Without an
 * episode the proposals start empty.
 */
export function defaultNewGameForm(map: GameMap, proposals?: StarterProposals): NewGameForm {
  const starts = map.nodes.filter((node) => node.type === 'start');
  const player = (index: number, playerId: PlayerId): PlayerForm => ({
    name: DEFAULT_NAMES[playerId],
    startNodeId: starts[index]?.id ?? starts[0]?.id ?? map.nodes[0]?.id ?? '',
  });
  return {
    players: { p1: player(0, 'p1'), p2: player(1, 'p2') },
    proposals: proposals ? structuredClone(proposals) : emptyProposals(),
    // As in the channel's graphic, "invece che 1.000$" (spec 030, 2.5).
    startingCoins: 1000,
    firstPlayer: 'p1',
  };
}

/** The players' names as they will be in the game: an empty name becomes G1 or G2. */
export function playerNames(form: NewGameForm): Record<PlayerId, string> {
  const name = (playerId: PlayerId) => form.players[playerId].name.trim() || DEFAULT_NAMES[playerId];
  return { p1: name('p1'), p2: name('p2') };
}

/**
 * Turns the form and the starters chosen in the scene into the setup the
 * engine expects. Both players must have chosen a proposal with a character.
 */
export function buildSetup(
  form: NewGameForm,
  choice: StarterChoice,
  context: GameContext,
  content: Record<string, CellContent>,
): GameSetup {
  const names = playerNames(form);
  const player = (playerId: PlayerId) => {
    const chosen = chosenProposal(form.proposals, choice, playerId);
    if (!chosen?.characterId) {
      throw new Error(`${names[playerId]} non ha ancora scelto lo starter.`);
    }
    return {
      name: names[playerId],
      starter: { characterId: chosen.characterId, powers: chosen.powers.map(readyPowerDefinition) },
      startNodeId: form.players[playerId].startNodeId,
    };
  };
  return {
    map: context.map,
    catalog: context.catalog,
    items: context.items,
    content,
    players: { p1: player('p1'), p2: player('p2') },
    firstPlayer: form.firstPlayer,
    startingCoins: form.startingCoins,
  };
}
