import { describe, expect, it } from 'vitest';
import type { Character } from '../engine';
import type { CatalogMission } from '../missions/catalog';
import { MISSIONS_BEFORE_063, MISSIONS_BEFORE_066, MISSIONS_BEFORE_069, PRICES_BEFORE_066, withPricesOf } from './fillIncluded';
import { missionsFingerprint, pricesFingerprint } from './fingerprint';
import { includedCatalog, includedMissions } from './includedLists';

const missions = () => includedMissions(includedCatalog());
const isStory = (entry: CatalogMission) => 'group' in entry.giver && entry.giver.group === 'story';
const turnsToWait = ({ mission }: CatalogMission) =>
  mission.type === 'wait' || mission.type === 'skipTurns' ? (mission.turns ?? 0) : 0;

/** The prices of spec 066 (spec 066, 2.1): new price -> price of before. */
const PRICES_THEN: Record<number, number> = {
  1000: 1500, 1100: 1700, 1200: 1900, 1400: 2200, 1600: 2500, 1800: 2800,
  2200: 3400, 2500: 3800, 2700: 4200, 3200: 5000, 3600: 5500, 3900: 6000,
};

describe('the missions give coins (spec 063 and 066, criterion 1)', () => {
  it('every mission that gives the character of the cell gives 400 coins, plus 500 a turn to wait or skip', () => {
    for (const entry of missions().filter((candidate) => candidate.mission.reward.cellCharacter)) {
      expect(entry.mission.reward.coins).toBe(400 + 500 * turnsToWait(entry));
    }
  });

  it('the missions of the story pay more: 1,500 to wait 2 turns or skip 1, 800 for a quiz', () => {
    const story = missions().filter(isStory);
    const coins = (type: string) => story.filter((entry) => entry.mission.type === type).map((entry) => entry.mission.reward.coins);
    expect(coins('wait')).toEqual([1500]);
    expect(coins('skipTurns')).toEqual([1500]);
    expect(coins('quiz')).toEqual([800]);
  });

  it("Bulma and Chichi's waits of 3 turns give 1,500 coins as well as their characters; Bobbidi's fight 2,000", () => {
    const others = missions().filter((entry) => !isStory(entry) && !entry.mission.reward.cellCharacter);
    const waits = others.filter((entry) => entry.mission.type === 'wait');
    expect(waits).toHaveLength(2);
    for (const { mission } of waits) {
      expect(mission.reward.coins).toBe(1500);
      expect(mission.reward.characters?.length).toBe(1);
    }
    // The other fights that do not recruit open a chain of one person (spec 069, 2.2).
    const fights = others.filter((entry) => entry.mission.type === 'fight');
    expect(fights.filter((entry) => !entry.behindId).map((entry) => entry.mission.reward.coins)).toEqual([2000]);
  });

  it('who opens a chain of one person gives 1,200 coins, not themselves (spec 069, 2.2; D-096)', () => {
    const catalog = includedCatalog();
    const person = (id: string | undefined) => catalog.find((character) => character.id === id)?.person;
    const chains = missions().filter((entry) => entry.behindId && 'characterId' in entry.giver);
    const samePerson = chains.filter((entry) => 'characterId' in entry.giver && person(entry.giver.characterId) === person(entry.behindId));
    expect(samePerson.length).toBeGreaterThan(0);
    for (const { mission } of samePerson) {
      expect(mission.reward).toEqual({ coins: 1200 });
    }
  });
});

describe('the characters cost 35% less (spec 066, criterion 1)', () => {
  it('from 1,000 to 3,900, by tier; the tiers C, D, E are not sold', () => {
    const prices = includedCatalog().map((character) => character.price);
    const sold = prices.filter((price): price is number => price !== undefined);
    expect(Math.min(...sold)).toBe(1000);
    expect(Math.max(...sold)).toBe(3900);
    expect(sold.every((price) => PRICES_THEN[price] !== undefined)).toBe(true);
  });
});

describe('a browser with the untouched lists of before gets the new values (spec 063, criterion 3; spec 066, criterion 2)', () => {
  /** The included missions with the coins given by `coins` (none where it gives undefined). */
  function withCoins(list: CatalogMission[], coins: (entry: CatalogMission) => number | undefined): CatalogMission[] {
    return list.map((entry) => {
      const { coins: _now, ...reward } = entry.mission.reward;
      const then = coins(entry);
      return { ...entry, mission: { ...entry.mission, reward: then === undefined ? reward : { ...reward, coins: then } } };
    });
  }

  /** Before spec 063: coins only from the story, Chichi's quiz and Bobbidi's fight. */
  const before063 = (entry: CatalogMission) => {
    if (entry.mission.reward.cellCharacter) {
      return undefined;
    }
    const then: Record<string, number> = { 'story:wait': 400, 'story:skipTurns': 600, 'story:quiz': 300, quiz: 300, fight: 800 };
    return then[isStory(entry) ? `story:${entry.mission.type}` : entry.mission.type];
  };

  /** Spec 063: 300 + 400 a turn with the character; 1,200, 600 and 1,500 without. */
  const before066 = (entry: CatalogMission) => {
    if (entry.mission.reward.cellCharacter) {
      return 300 + 400 * turnsToWait(entry);
    }
    return entry.mission.type === 'quiz' ? 600 : entry.mission.type === 'fight' ? 1500 : 1200;
  };

  it('the mission lists of before are known to the app; the new one is not among them', () => {
    // Spec 069 changed which missions there are, so the lists of before can no longer be
    // rebuilt from today's: their fingerprints were taken from the files of those versions.
    expect(new Set([MISSIONS_BEFORE_063, MISSIONS_BEFORE_066, MISSIONS_BEFORE_069]).size).toBe(3);
    expect([MISSIONS_BEFORE_063, MISSIONS_BEFORE_066, MISSIONS_BEFORE_069]).not.toContain(missionsFingerprint(missions()));
  });

  it('a list with other coins is a list of before only if every mission matches', () => {
    expect(missionsFingerprint(withCoins(missions(), before063))).not.toBe(missionsFingerprint(missions()));
    expect(missionsFingerprint(withCoins(missions(), before066))).not.toBe(missionsFingerprint(missions()));
  });

  it('the fingerprint leaves out the codes, and changes with any reward', () => {
    const list = missions();
    const recoded = list.map((entry, index) => ({ ...entry, id: `other-${index}` }));
    expect(missionsFingerprint(recoded)).toBe(missionsFingerprint(list));
    const changed = list.map((entry, index) =>
      index === 0 ? { ...entry, mission: { ...entry.mission, reward: { ...entry.mission.reward, coins: 1 } } } : entry,
    );
    expect(missionsFingerprint(changed)).not.toBe(missionsFingerprint(list));
  });

  /** The included characters with the prices of before spec 066. */
  const pricesBefore066 = (): Character[] =>
    includedCatalog().map((character) =>
      character.price === undefined ? character : { ...character, price: PRICES_THEN[character.price] },
    );

  it('the character list of before has the fingerprint the app looks for; the new one does not', () => {
    expect(pricesFingerprint(pricesBefore066())).toBe(PRICES_BEFORE_066);
    expect(pricesFingerprint(includedCatalog())).not.toBe(PRICES_BEFORE_066);
  });

  it('the prices fingerprint looks only at codes and prices: one price changed is enough to keep the list', () => {
    const before = pricesBefore066();
    const otherColumns = before.map((character) => ({ ...character, villain: !character.villain }));
    expect(pricesFingerprint(otherColumns)).toBe(PRICES_BEFORE_066);
    const onePrice = before.map((character, index) => (index === 0 ? { ...character, price: 1234 } : character));
    expect(pricesFingerprint(onePrice)).not.toBe(PRICES_BEFORE_066);
  });

  it('the list of before takes the new prices and keeps everything else', () => {
    const before = pricesBefore066().map((character) => ({ ...character, villain: !character.villain }));
    const updated = withPricesOf(before, includedCatalog());
    expect(updated.map((character) => character.price)).toEqual(includedCatalog().map((character) => character.price));
    expect(updated.map((character) => character.villain)).toEqual(before.map((character) => character.villain));
  });
});
