import { PLAYER_IDS, type Character, type PlayerId } from '../engine';
import { looksLikeReadyPower, type ReadyPower } from './readyPowers';

// The starters proposed to each player (spec 025, D-038): three each, six
// different characters in all, prepared in the episode and changeable in
// "Nuova partita" for one game.

export const PROPOSALS_PER_PLAYER = 3;

/** One of the starters a player chooses from: a character and its powers. */
export interface StarterProposal {
  /** Missing until the host picks one. */
  characterId?: string;
  /** Copies of the ready powers (D-037): the card shows their texts in order. */
  powers: ReadyPower[];
}

export type StarterProposals = Record<PlayerId, StarterProposal[]>;

/** How the players are called where their names are not known yet, as in the episode. */
export const PROPOSAL_PLAYER_NAMES: Record<PlayerId, string> = {
  p1: 'Giocatore 1',
  p2: 'Giocatore 2',
};

export function emptyProposals(): StarterProposals {
  const three = () =>
    Array.from({ length: PROPOSALS_PER_PLAYER }, (): StarterProposal => ({ powers: [] }));
  return { p1: three(), p2: three() };
}

/** The same proposals with one of them replaced. */
export function withProposal(
  proposals: StarterProposals,
  player: PlayerId,
  index: number,
  proposal: StarterProposal,
): StarterProposals {
  return {
    ...proposals,
    [player]: proposals[player].map((current, i) => (i === index ? proposal : current)),
  };
}

/**
 * "Stessi poteri del Giocatore 1" (spec 025, 2.2): the second player's
 * proposals get the first player's powers, proposal by proposal. The
 * characters stay.
 */
export function copyPowersFromFirst(proposals: StarterProposals): StarterProposals {
  return {
    ...proposals,
    p2: proposals.p2.map((proposal, index) => ({
      ...proposal,
      powers: [...(proposals.p1[index]?.powers ?? [])],
    })),
  };
}

/** Nothing chosen yet: no character and no power in any proposal. */
export function areEmpty(proposals: StarterProposals): boolean {
  return PLAYER_IDS.every((player) =>
    proposals[player].every((proposal) => !proposal.characterId && proposal.powers.length === 0),
  );
}

/** The characters of the proposals: they never go on the map (D-044). */
export function proposedCharacters(proposals: StarterProposals | undefined): string[] {
  return proposals
    ? PLAYER_IDS.flatMap((player) =>
        proposals[player].flatMap((proposal) => (proposal.characterId ? [proposal.characterId] : [])),
      )
    : [];
}

/** Every power the proposals use, once each, in order: for the copies and the import. */
export function powersInProposals(proposals: StarterProposals): ReadyPower[] {
  const seen = new Set<string>();
  const result: ReadyPower[] = [];
  for (const player of PLAYER_IDS) {
    for (const proposal of proposals[player]) {
      for (const power of proposal.powers) {
        if (!seen.has(power.id)) {
          seen.add(power.id);
          result.push(power);
        }
      }
    }
  }
  return result;
}

/** The powers of the proposals the list does not have: they join it when an episode is imported. */
export function powersMissingFrom(
  library: ReadyPower[],
  proposals: StarterProposals | undefined,
): ReadyPower[] {
  const known = new Set(library.map((power) => power.id));
  return proposals ? powersInProposals(proposals).filter((power) => !known.has(power.id)) : [];
}

export type ProposalIssueKind =
  | 'repeatedCharacter'
  | 'repeatedPower'
  | 'missingCharacter'
  | 'missingPower';

/** A guide about the proposals (D-008): shown, never blocking. */
export interface ProposalIssue {
  kind: ProposalIssueKind;
  message: string;
}

/**
 * Guides of spec 025 (2.2): the same character in more than one of the six
 * proposals; proposals without a character or without a power. Spec 029
 * (2.5): the same power twice for one player, in one proposal or in two.
 * The same power for both players is normal.
 */
export function proposalIssues(
  proposals: StarterProposals,
  catalog: Character[],
  names: Record<PlayerId, string> = PROPOSAL_PLAYER_NAMES,
): ProposalIssue[] {
  const issues: ProposalIssue[] = [];
  const nameOf = (id: string) => catalog.find((character) => character.id === id)?.name ?? id;
  const where = (player: PlayerId, index: number) => `${names[player]} n. ${index + 1}`;

  const counts = new Map<string, number>();
  for (const player of PLAYER_IDS) {
    for (const proposal of proposals[player]) {
      if (proposal.characterId) {
        counts.set(proposal.characterId, (counts.get(proposal.characterId) ?? 0) + 1);
      }
    }
  }
  const repeated = [...counts].filter(([, count]) => count > 1).map(([id]) => nameOf(id));
  if (repeated.length > 0) {
    issues.push({
      kind: 'repeatedCharacter',
      message: `${listed(repeated)} ${repeated.length === 1 ? 'è proposto' : 'sono proposti'} più di una volta: i 6 starter proposti dovrebbero essere tutti diversi.`,
    });
  }

  const repeatedPowers = PLAYER_IDS.flatMap((player) => {
    const seen = new Map<string, { text: string; at: string[] }>();
    proposals[player].forEach((proposal, index) => {
      for (const power of proposal.powers) {
        const entry = seen.get(power.id) ?? { text: power.cardText, at: [] };
        entry.at.push(`n. ${index + 1}`);
        seen.set(power.id, entry);
      }
    });
    return [...seen.values()]
      .filter((entry) => entry.at.length > 1)
      .map((entry) => `«${entry.text}» per ${names[player]} (${entry.at.join(', ')})`);
  });
  if (repeatedPowers.length > 0) {
    issues.push({
      kind: 'repeatedPower',
      message: `Poteri ripetuti nello stesso giocatore: ${repeatedPowers.join('; ')}.`,
    });
  }

  const without = (missing: (proposal: StarterProposal) => boolean) =>
    PLAYER_IDS.flatMap((player) =>
      proposals[player].flatMap((proposal, index) => (missing(proposal) ? [where(player, index)] : [])),
    );
  const noCharacter = without((proposal) => !proposal.characterId);
  if (noCharacter.length > 0) {
    issues.push({
      kind: 'missingCharacter',
      message: `Proposte senza personaggio: ${noCharacter.join(', ')}.`,
    });
  }
  const noPower = without((proposal) => proposal.powers.length === 0);
  if (noPower.length > 0) {
    issues.push({ kind: 'missingPower', message: `Proposte senza potere: ${noPower.join(', ')}.` });
  }
  return issues;
}

/** Checks the shape of the proposals read from the browser or from a file. */
export function looksLikeProposals(value: unknown): value is StarterProposals {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const proposals = value as Record<string, unknown>;
  return PLAYER_IDS.every((player) => {
    const list = proposals[player];
    return (
      Array.isArray(list) &&
      list.length === PROPOSALS_PER_PLAYER &&
      list.every(looksLikeProposal)
    );
  });
}

function looksLikeProposal(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const proposal = value as Record<string, unknown>;
  return (
    (proposal.characterId === undefined || typeof proposal.characterId === 'string') &&
    Array.isArray(proposal.powers) &&
    proposal.powers.every(looksLikeReadyPower)
  );
}

/** "Krilin", "Krilin e Yamcha", "Krilin, Yamcha e Raditz". */
function listed(names: string[]): string {
  return names.length < 2
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
}
