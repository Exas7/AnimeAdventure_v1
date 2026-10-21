import { describe, expect, it } from 'vitest';
import type { Character } from '../engine';
import { tierRank } from '../episode/fill';
import { proposalIssues, proposedCharacters, type StarterProposals } from './proposals';
import { randomStarters } from './randomStarters';
import { DEFAULT_READY_POWERS, makeReadyPower } from './readyPowers';
import { newPowerForm } from './powerForm';

/** A repeatable source of "random" numbers. */
function sequence(...values: number[]) {
  let index = 0;
  return () => values[index++ % values.length] as number;
}

const RANDOMS = [sequence(0.1), sequence(0.9), sequence(0.3, 0.7, 0.5), sequence(0.42, 0.13, 0.77, 0.61)];

function starter(id: string, tier: string): Character {
  return { id, name: id, price: 0, tier, possibleStarter: true };
}

const catalog: Character[] = [
  starter('c-1', 'C'),
  starter('c-2', 'C'),
  starter('c-3', 'C'),
  starter('c-4', 'C'),
  starter('cplus-1', 'C+'),
  starter('cplus-2', 'C+'),
  starter('bminus-1', 'B-'),
  starter('bminus-2', 'B-'),
  { id: 'strong', name: 'Forte', price: 0, tier: 'A' },
  { id: 'weak', name: 'Debole', price: 0, tier: 'C-' },
  { id: 'weaker', name: 'Più debole', price: 0, tier: 'D' },
  { id: 'keeper', name: 'Negoziante', price: 0, tier: 'C-', shopkeeper: true },
];

const powers = [
  ...DEFAULT_READY_POWERS,
  makeReadyPower('potere-quattro', 'Quarto potere', { ...newPowerForm('extraStartingCoins'), amount: 100 }),
];

const byId = (id: string | undefined) => catalog.find((character) => character.id === id);

function pairs(proposals: StarterProposals) {
  return proposals.p1.map((proposal, index) => [proposal, proposals.p2[index]] as const);
}

describe('random starters (spec 030, criterion 1)', () => {
  it('six different possible starters, in pairs of the same tier and the same power', () => {
    for (const random of RANDOMS) {
      const { proposals, notes } = randomStarters(catalog, powers, new Set(), random);
      const ids = proposedCharacters(proposals);
      expect(ids).toHaveLength(6);
      expect(ids.every((id) => byId(id)?.possibleStarter)).toBe(true);
      for (const [mine, theirs] of pairs(proposals)) {
        expect(tierRank(byId(mine.characterId)?.tier)).toBe(tierRank(byId(theirs?.characterId)?.tier));
        expect(mine.powers.map((power) => power.id)).toEqual(theirs?.powers.map((power) => power.id));
        expect(mine.powers).toHaveLength(1);
      }
      expect(new Set(proposals.p1.map((proposal) => proposal.powers[0]?.id)).size).toBe(3);
      expect(proposalIssues(proposals, catalog)).toEqual([]);
      expect(notes).toEqual([]);
    }
  });

  it('never takes a character already in the episode (D-044)', () => {
    const taken = new Set(['c-1', 'c-2', 'cplus-1']);
    for (const random of RANDOMS) {
      const ids = proposedCharacters(randomStarters(catalog, powers, taken, random).proposals);
      expect(ids.some((id) => taken.has(id))).toBe(false);
    }
  });

  it('few possible starters: the weakest recruitable characters make up the six, never a shopkeeper', () => {
    const taken = new Set(['c-1', 'c-2', 'c-3', 'cplus-1', 'cplus-2']);
    const withMore: Character[] = [...catalog, { id: 'weak-2', name: 'Debole due', price: 0, tier: 'C' }];
    const { proposals, notes } = randomStarters(withMore, powers, taken, RANDOMS[2] as () => number);
    const ids = proposedCharacters(proposals);
    expect(ids).toHaveLength(6);
    expect(ids).toEqual(expect.arrayContaining(['c-4', 'bminus-1', 'bminus-2', 'weak', 'weak-2', 'strong']));
    // Below C- (D) and shopkeepers are never drawn (D-034).
    expect(notes).toEqual(['Possibili starter liberi: 3; aggiunti i più deboli della lista: Debole, Debole due, Forte.']);
  });

  it('never two forms of the same person among the six (spec 031, criterion 4)', () => {
    const forms: Character[] = [
      ...catalog.map((character) => (character.id.startsWith('c-') ? { ...character, person: 'Zarbon' } : character)),
      starter('c-5', 'C'),
      starter('c-6', 'C'),
    ];
    for (const random of RANDOMS) {
      const ids = proposedCharacters(randomStarters(forms, powers, new Set(), random).proposals);
      expect(ids).toHaveLength(6);
      expect(ids.filter((id) => ['c-1', 'c-2', 'c-3', 'c-4'].includes(id))).toHaveLength(1);
    }
  });

  it('tiers that do not pair up go with the nearest ones', () => {
    const odd: Character[] = [
      starter('c', 'C'),
      starter('c-bis', 'C'),
      starter('b-minus', 'B-'),
      starter('b', 'B'),
      starter('a', 'A'),
      starter('a-bis', 'A'),
    ];
    const { proposals } = randomStarters(odd, powers, new Set(), RANDOMS[3] as () => number);
    const tierOf = (id: string | undefined) => odd.find((character) => character.id === id)?.tier;
    const tiers = pairs(proposals)
      .map(([mine, theirs]) => [tierOf(mine.characterId), tierOf(theirs?.characterId)].sort().join('+'))
      .sort();
    expect(tiers).toEqual(['A+A', 'B+B-', 'C+C']);
  });

  it('with fewer than 3 powers they repeat, and the guide says so', () => {
    const { proposals, notes } = randomStarters(catalog, powers.slice(0, 2), new Set(), RANDOMS[0] as () => number);
    expect(notes).toEqual(['La lista ha solo 2 poteri: si ripetono.']);
    expect(proposalIssues(proposals, catalog).map((issue) => issue.kind)).toContain('repeatedPower');
  });

  it('not enough characters: the proposals left keep their power, without a character', () => {
    const { proposals, notes } = randomStarters(catalog.slice(0, 4), powers, new Set(), RANDOMS[1] as () => number);
    expect(proposedCharacters(proposals)).toHaveLength(4);
    expect(proposals.p1[2]).toEqual({ powers: [proposals.p1[2]?.powers[0]] });
    expect(notes).toEqual(['Mancano personaggi liberi: 1 proposte per giocatore restano senza personaggio.']);
  });
});
