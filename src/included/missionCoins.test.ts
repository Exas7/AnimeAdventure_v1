import { describe, expect, it } from 'vitest';
import type { Character } from '../engine';
import { isGuest } from '../catalog/guests';
import type { CatalogMission } from '../missions/catalog';
import {
  MISSIONS_BEFORE_063,
  MISSIONS_BEFORE_066,
  MISSIONS_BEFORE_069,
  MISSIONS_BEFORE_071,
  MISSIONS_BEFORE_074,
  MISSIONS_BEFORE_079,
  PRICES_BEFORE_066,
  QUESTIONS_BEFORE_074,
  withGuestsOf,
  withPricesOf,
} from './fillIncluded';
import { missionsFingerprint, pricesFingerprint, questionsFingerprint } from './fingerprint';
import { includedCatalog, includedMissions, includedQuestions } from './includedLists';

const missions = () => includedMissions(includedCatalog());

/** Spec 079, fuori spec: the lines of the missions of Broli and Janemba before they stopped speaking. */
const SPOKEN_LINES: [string[], string[]][] = [
  [['(Fissa il vuoto, senza dire una parola.)', 'Fallo trasformare e si unirà a te.'], ['Kakaroth... KAKAROTH!', 'Se mi fai trasformare, ti seguirò.']],
  [['(Il suo sguardo è perso nel vuoto.)', 'Costringilo a trasformarsi: ti lascerà passare e avrai {monete} monete.'], ['Kakaroth...', 'Costringimi a trasformarmi: ti lascerò passare e avrai {monete} monete.']],
  [['(Non parla: immobile, guarda nel vuoto.)', 'Costringilo a trasformarsi e verrà con te.'], ['Kakaroth... KAKAROTH!', 'Costringimi a trasformarmi e verrò con te.']],
  [['Kakaroth... KAKAROTH!', 'Costringilo a trasformarsi: ti lascerà passare e avrai {monete} monete.'], ['Il mio potere non ha limiti!', 'Costringimi a trasformarmi: ti lascerò passare e avrai {monete} monete.']],
  [['(Ghigna e fa un verso gutturale.)', 'Costringilo a trasformarsi e verrà con te.'], ['Il mondo dei morti è sottosopra per colpa mia!', 'Costringimi a trasformarmi e verrò con te.']],
  [["(Un ruggito basso fa tremare l'aria.)",'Costringilo a trasformarsi: ti lascerà passare e avrai {monete} monete.'], ["L'inferno si sta riversando sulla Terra...", 'Costringimi a trasformarmi: ti lascerò passare e avrai {monete} monete.']],
];
const withSpokenLines = (list: CatalogMission[]) =>
  list.map((entry) => {
    const old = SPOKEN_LINES.find(([now]) => now.join('|') === entry.lines.join('|'));
    return old ? { ...entry, lines: old[1] } : entry;
  });
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

  it("Bulma and Chichi's waits of 3 turns give 1,500 coins as well as their characters; Babidi's fight 2,000", () => {
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

  /** Before spec 063: coins only from the story, Chichi's quiz and Babidi's fight. */
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
    const before = [MISSIONS_BEFORE_063, MISSIONS_BEFORE_066, MISSIONS_BEFORE_069, MISSIONS_BEFORE_071];
    expect(new Set(before).size).toBe(4);
    expect(before).not.toContain(missionsFingerprint(missions()));
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
  // The guests came later (spec 074): the list of before did not have them.
  const pricesBefore066 = (): Character[] =>
    includedCatalog()
      .filter((character) => !isGuest(character.id))
      .map((character) =>
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
    const today = includedCatalog().filter((character) => !isGuest(character.id));
    expect(updated.map((character) => character.price)).toEqual(today.map((character) => character.price));
    expect(updated.map((character) => character.villain)).toEqual(before.map((character) => character.villain));
  });
});

describe('a browser with the untouched lists of before gets the guests (spec 074, 2.7 and criterion 8)', () => {
  const ofGuest = (entry: CatalogMission) => 'characterId' in entry.giver && isGuest(entry.giver.characterId);

  it("the missions of before are today's without the guests' ones", () => {
    // Spec 079 changed the lines of Broli and Janemba after that: they are put back as they were.
    expect(missionsFingerprint(withSpokenLines(missions()).filter((entry) => !ofGuest(entry)))).toBe(MISSIONS_BEFORE_074);
    expect(missionsFingerprint(missions())).not.toBe(MISSIONS_BEFORE_074);
  });

  it("the missions of before spec 079 are today's with the old lines of Broli and Janemba", () => {
    expect(missionsFingerprint(withSpokenLines(missions()))).toBe(MISSIONS_BEFORE_079);
    expect(missionsFingerprint(missions())).not.toBe(MISSIONS_BEFORE_079);
  });

  it("the questions of before are today's without those of one character", () => {
    const questions = includedQuestions();
    expect(questionsFingerprint(questions.filter((entry) => entry.giverId === undefined))).toBe(QUESTIONS_BEFORE_074);
    expect(questionsFingerprint(questions)).not.toBe(QUESTIONS_BEFORE_074);
    const recoded = questions.map((entry, index) => ({ ...entry, id: `other-${index}` }));
    expect(questionsFingerprint(recoded)).toBe(questionsFingerprint(questions));
  });

  it('a list without the guests gets them at the end, and its missions read; one with them is left as it is', () => {
    const included = includedCatalog();
    const before = included.filter((character) => !isGuest(character.id));
    const updated = withGuestsOf(before, included);
    expect(updated?.slice(before.length).map((character) => character.name)).toEqual(['Livio', 'Maggi', 'Meliador']);
    expect(includedMissions(updated ?? []).filter(ofGuest)).toHaveLength(3);
    expect(withGuestsOf(included, included)).toBeNull();
  });
});

