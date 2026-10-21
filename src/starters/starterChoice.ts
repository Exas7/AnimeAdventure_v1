import { PLAYER_IDS, type Character, type PlayerId } from '../engine';
import type { StarterProposals } from './proposals';
import { readyPowerDefinition, type ReadyPower } from './readyPowers';

// The scene of the starter choice (spec 025, 2.4): shown on director and
// stream, one player's proposals at a time.

/** Where the choice stands: whose proposals are shown, and what each player picked. */
export interface StarterChoice {
  showing: PlayerId;
  /** Index of the chosen proposal of each player; null until chosen. */
  chosen: Record<PlayerId, number | null>;
}

/** One card of the scene: the character and the texts of its powers. */
export interface StarterCard {
  character: Character | null;
  texts: string[];
  /** Chosen by the player whose proposals are shown. */
  chosen: boolean;
}

export interface ChoiceTeam {
  name: string;
  /** What the player will start with; null where it is not known yet. */
  coins: number | null;
  starter: Character | null;
}

/** Everything the scene draws, on the director and on the stream. */
export interface StarterChoiceView {
  showing: PlayerId;
  cards: StarterCard[];
  teams: Record<PlayerId, ChoiceTeam>;
}

/** The scene opens on the proposals of the player who starts (spec 025, 2.4). */
export function startChoice(firstPlayer: PlayerId): StarterChoice {
  return { showing: firstPlayer, chosen: { p1: null, p2: null } };
}

export function otherPlayer(player: PlayerId): PlayerId {
  return player === 'p1' ? 'p2' : 'p1';
}

/** A click on a card: it becomes the starter of the player shown; another click changes it. */
export function chooseCard(choice: StarterChoice, index: number): StarterChoice {
  return { ...choice, chosen: { ...choice.chosen, [choice.showing]: index } };
}

/** "Avanti" and back: the other player's proposals. */
export function showOther(choice: StarterChoice): StarterChoice {
  return { ...choice, showing: otherPlayer(choice.showing) };
}

/** Coins at the start of the game: the starting coins plus the extra ones of the powers. */
export function startingCoinsWith(startingCoins: number, powers: ReadyPower[]): number {
  return powers.reduce((total, power) => {
    const { trigger, effect } = readyPowerDefinition(power);
    return trigger.type === 'gameStart' && effect.type === 'addCoins' ? total + effect.amount : total;
  }, startingCoins);
}

/**
 * The card text with the coins of the game (spec 029, 2.5): {iniziali} are
 * the starting coins, {totale} the coins whoever takes this power starts
 * with. Without known coins (null) the text stays as written.
 */
export function cardTextFor(power: ReadyPower, startingCoins: number | null): string {
  if (startingCoins === null) {
    return power.cardText;
  }
  return power.cardText
    .replaceAll('{iniziali}', formatCoins(startingCoins))
    .replaceAll('{totale}', formatCoins(startingCoinsWith(startingCoins, [power])));
}

/** "1.000$", as in the channel's graphic. */
export function formatCoins(coins: number): string {
  return `${String(coins).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}$`;
}

/** The chosen proposal of a player, if any. */
export function chosenProposal(
  proposals: StarterProposals,
  choice: StarterChoice,
  player: PlayerId,
): StarterProposals[PlayerId][number] | undefined {
  const index = choice.chosen[player];
  return index === null ? undefined : proposals[player][index];
}

/** Both players have chosen a proposal with a character: the game can start. */
export function canStart(proposals: StarterProposals, choice: StarterChoice): boolean {
  return PLAYER_IDS.every((player) => Boolean(chosenProposal(proposals, choice, player)?.characterId));
}

/**
 * What the scene shows. `startingCoins` null: the coins are not known yet
 * (they are set in "Nuova partita") and the scene leaves them out.
 */
export function starterChoiceView(
  proposals: StarterProposals,
  choice: StarterChoice,
  names: Record<PlayerId, string>,
  startingCoins: number | null,
  catalog: Character[],
): StarterChoiceView {
  const find = (id: string | undefined) =>
    (id && catalog.find((character) => character.id === id)) || null;
  const team = (player: PlayerId): ChoiceTeam => {
    const chosen = chosenProposal(proposals, choice, player);
    return {
      name: names[player],
      coins: startingCoins === null ? null : startingCoinsWith(startingCoins, chosen?.powers ?? []),
      starter: find(chosen?.characterId),
    };
  };
  return {
    showing: choice.showing,
    cards: proposals[choice.showing].map((proposal, index) => ({
      character: find(proposal.characterId),
      texts: proposal.powers.map((power) => cardTextFor(power, startingCoins)),
      chosen: choice.chosen[choice.showing] === index,
    })),
    teams: { p1: team('p1'), p2: team('p2') },
  };
}

/** Checks the shape of a scene received by the stream window. */
export function looksLikeStarterChoiceView(value: unknown): value is StarterChoiceView {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const view = value as Record<string, unknown>;
  const teams = view.teams as Record<string, unknown> | null | undefined;
  return (
    PLAYER_IDS.includes(view.showing as PlayerId) &&
    Array.isArray(view.cards) &&
    view.cards.every(
      (card: unknown) =>
        typeof card === 'object' &&
        card !== null &&
        Array.isArray((card as StarterCard).texts) &&
        typeof (card as StarterCard).chosen === 'boolean',
    ) &&
    typeof teams === 'object' &&
    teams !== null &&
    PLAYER_IDS.every((player) => {
      const team = teams[player] as Partial<ChoiceTeam> | undefined;
      return typeof team === 'object' && team !== null && typeof team.name === 'string';
    })
  );
}
