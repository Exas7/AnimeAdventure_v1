import { onePerPerson, personOf } from '../catalog/person';
import type { Character } from '../engine';
import { canBeDrawn, shuffle, tierRank, type Random } from '../episode/fill';
import { PROPOSALS_PER_PLAYER, type StarterProposal, type StarterProposals } from './proposals';
import type { ReadyPower } from './readyPowers';

// "Randomizza gli starter" (spec 030, 2.1): three pairs of characters of the
// same strength, one of each pair per player, and the same power for the
// two characters of a pair. The players start even.

export interface RandomStarters {
  proposals: StarterProposals;
  /** For the summary: what could not go as planned. */
  notes: string[];
}

/**
 * The six proposals, drawn among the "possibili starter" of the list that
 * are not in `taken` (already in the episode, D-044). Missing ones are
 * made up with the weakest recruitable characters.
 */
export function randomStarters(
  catalog: Character[],
  powers: ReadyPower[],
  taken: ReadonlySet<string>,
  random: Random,
): RandomStarters {
  const needed = PROPOSALS_PER_PLAYER * 2;
  const free = catalog.filter((character) => !taken.has(character.id));
  // Never two forms of the same person among the six (D-048).
  const starters = onePerPerson(shuffle(free.filter((character) => character.possibleStarter), random));
  const notes: string[] = [];
  let candidates = starters;
  if (starters.length < needed) {
    // The sort keeps the random order among characters of the same tier.
    const weakest = shuffle(
      free.filter((character) => !character.possibleStarter && canBeDrawn(character)),
      random,
    ).sort((a, b) => rankOf(a) - rankOf(b));
    const extra = onePerPerson(weakest, new Set(starters.map(personOf))).slice(0, needed - starters.length);
    candidates = [...starters, ...extra];
    if (extra.length > 0) {
      notes.push(
        `Possibili starter liberi: ${starters.length}; aggiunti i più deboli della lista: ` +
          `${extra.map((character) => character.name).join(', ')}.`,
      );
    }
  }

  const pairs = pairsByTier(candidates, random).slice(0, PROPOSALS_PER_PLAYER);
  if (pairs.length < PROPOSALS_PER_PLAYER) {
    notes.push(
      `Mancano personaggi liberi: ${PROPOSALS_PER_PLAYER - pairs.length} proposte per giocatore ` +
        'restano senza personaggio.',
    );
  }
  const chosenPowers = shuffle(powers, random).slice(0, PROPOSALS_PER_PLAYER);
  if (powers.length > 0 && powers.length < PROPOSALS_PER_PLAYER) {
    notes.push(`La lista ha solo ${powers.length} poteri: si ripetono.`);
  }

  const p1: StarterProposal[] = [];
  const p2: StarterProposal[] = [];
  for (let index = 0; index < PROPOSALS_PER_PLAYER; index++) {
    const power = chosenPowers.length > 0 ? chosenPowers[index % chosenPowers.length] : undefined;
    const proposal = (character: Character | undefined): StarterProposal => ({
      ...(character ? { characterId: character.id } : {}),
      powers: power ? [power] : [],
    });
    const pair = pairs[index];
    const [first, second] = pair && random() < 0.5 ? [pair[1], pair[0]] : (pair ?? []);
    p1.push(proposal(first));
    p2.push(proposal(second));
  }
  return { proposals: { p1, p2 }, notes };
}

/** No tier counts as the weakest: such a character pairs with the others without one. */
function rankOf(character: Character): number {
  return tierRank(character.tier) ?? -Infinity;
}

/**
 * Pairs of the same tier first, in random order; then, with the characters
 * left over, pairs of the nearest tiers.
 */
function pairsByTier(candidates: Character[], random: Random): [Character, Character][] {
  const byRank = new Map<number, Character[]>();
  for (const character of candidates) {
    const rank = rankOf(character);
    byRank.set(rank, [...(byRank.get(rank) ?? []), character]);
  }
  const pairs: [Character, Character][] = [];
  const leftOver: Character[] = [];
  for (const group of byRank.values()) {
    for (let index = 0; index + 1 < group.length; index += 2) {
      pairs.push([group[index] as Character, group[index + 1] as Character]);
    }
    if (group.length % 2 === 1) {
      leftOver.push(group[group.length - 1] as Character);
    }
  }
  const nearest = leftOver.sort((a, b) => rankOf(a) - rankOf(b));
  const extraPairs: [Character, Character][] = [];
  for (let index = 0; index + 1 < nearest.length; index += 2) {
    extraPairs.push([nearest[index] as Character, nearest[index + 1] as Character]);
  }
  return [...shuffle(pairs, random), ...extraPairs];
}
