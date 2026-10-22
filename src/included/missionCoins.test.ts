import { describe, expect, it } from 'vitest';
import type { CatalogMission } from '../missions/catalog';
import { MISSIONS_BEFORE_063 } from './fillIncluded';
import { missionsFingerprint } from './fingerprint';
import { includedCatalog, includedMissions } from './includedLists';

const missions = () => includedMissions(includedCatalog());
const isStory = (entry: CatalogMission) => 'group' in entry.giver && entry.giver.group === 'story';

describe('the missions give coins (spec 063, criterion 1)', () => {
  it('every mission that gives the character of the cell gives 300 coins, plus 400 a turn to wait or skip', () => {
    for (const { mission } of missions().filter((entry) => entry.mission.reward.cellCharacter)) {
      const turns = mission.type === 'wait' || mission.type === 'skipTurns' ? (mission.turns ?? 0) : 0;
      expect(mission.reward.coins).toBe(300 + 400 * turns);
    }
  });

  it('the missions of the story pay more: 1,200 to wait 2 turns or skip 1, 600 for a quiz', () => {
    const story = missions().filter(isStory);
    const coins = (type: string) => story.filter((entry) => entry.mission.type === type).map((entry) => entry.mission.reward.coins);
    expect(coins('wait')).toEqual([1200]);
    expect(coins('skipTurns')).toEqual([1200]);
    expect(coins('quiz')).toEqual([600]);
  });

  it("Bulma and Chichi's waits of 3 turns give 1,200 coins as well as their characters", () => {
    const waits = missions().filter(
      (entry) => !isStory(entry) && entry.mission.type === 'wait' && !entry.mission.reward.cellCharacter,
    );
    expect(waits).toHaveLength(2);
    for (const { mission } of waits) {
      expect(mission.reward.coins).toBe(1200);
      expect(mission.reward.characters?.length).toBe(1);
    }
  });
});

describe('a browser with the untouched missions of before gets the new ones (spec 063, criterion 3)', () => {
  /** The included list as it was before spec 063: the same missions with the coins of then. */
  function before(list: CatalogMission[]): CatalogMission[] {
    // Story: wait, skip, quiz; Chichi's quiz; Bobbidi's fight.
    const then: Record<string, number> = { 'story:wait': 400, 'story:skipTurns': 600, 'story:quiz': 300, quiz: 300, fight: 800 };
    return list.map((entry) => {
      const { coins, ...reward } = entry.mission.reward;
      const key = isStory(entry) ? `story:${entry.mission.type}` : entry.mission.reward.cellCharacter ? '' : entry.mission.type;
      const old = coins === 1500 && key === 'fight' ? 800 : then[key];
      return { ...entry, mission: { ...entry.mission, reward: old ? { ...reward, coins: old } : reward } };
    });
  }

  it('the list of before has the fingerprint the app looks for; the new one does not', () => {
    expect(missionsFingerprint(before(missions()))).toBe(MISSIONS_BEFORE_063);
    expect(missionsFingerprint(missions())).not.toBe(MISSIONS_BEFORE_063);
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
});
