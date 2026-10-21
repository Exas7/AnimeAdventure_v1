import { describe, expect, it } from 'vitest';
import { createGame, testSetup } from '../engine';
import { buildLiveView, DEFAULT_LAYOUT } from './liveView';
import { emptyProposals } from '../starters/proposals';
import { startChoice, starterChoiceView } from '../starters/starterChoice';
import { DEFAULT_SETTINGS, fighterOf, recordFight, type Fighter } from '../battle/fight';
import { seededRandom } from '../battle/random';
import {
  battleMessage,
  parseSyncMessage,
  requestViewMessage,
  starterChoiceMessage,
  viewMessage,
} from './messages';

describe('messages between windows (spec 003, criterion 5)', () => {
  it('accepts valid messages', () => {
    const view = buildLiveView(createGame(testSetup()), null, DEFAULT_LAYOUT);
    expect(parseSyncMessage(requestViewMessage())).toEqual(requestViewMessage());
    expect(parseSyncMessage(viewMessage(view))).toEqual(viewMessage(view));
    expect(parseSyncMessage(viewMessage(null))).toEqual(viewMessage(null));
  });

  it('carries the shop screen to the stream (spec 004, criterion 9)', () => {
    const view = buildLiveView(createGame(testSetup()), { kind: 'shop', nodeId: 'sh1' }, DEFAULT_LAYOUT);
    const message = parseSyncMessage(viewMessage(view));
    expect(message).toEqual(viewMessage(view));
    expect(message?.type === 'view' ? message.view?.overlay : null).toEqual({
      kind: 'shop',
      nodeId: 'sh1',
    });
    expect(message?.type === 'view' ? message.view?.items.length : 0).toBeGreaterThan(0);
  });

  it('carries the starter choice scene to the stream (spec 025, 2.4)', () => {
    const choice = starterChoiceView(
      emptyProposals(),
      startChoice('p1'),
      { p1: 'Maggi', p2: 'Melia' },
      1000,
      [],
    );
    const sent = JSON.parse(JSON.stringify(starterChoiceMessage(choice))) as unknown;
    expect(parseSyncMessage(sent)).toEqual(starterChoiceMessage(choice));
    expect(parseSyncMessage({ app: 'arkanite', type: 'starterChoice', choice: {} })).toBeNull();
  });

  it('carries the simulated fight to the stream (spec 035, D-055)', () => {
    const fighter = (tier: string) => fighterOf({ id: tier, name: tier, tier }) as Fighter;
    const record = recordFight({ a: [fighter('A')], b: [fighter('B')] }, DEFAULT_SETTINGS, seededRandom(1));
    const battle = { record, shown: 3, speed: 2, switchRecharge: 15 };
    const sent = JSON.parse(JSON.stringify(battleMessage(battle))) as unknown;
    expect(parseSyncMessage(sent)).toEqual(battleMessage(battle));
    expect(parseSyncMessage(battleMessage(null))).toEqual(battleMessage(null));
    expect(parseSyncMessage({ app: 'arkanite', type: 'battle', battle: { shown: 1 } })).toBeNull();
    expect(parseSyncMessage({ app: 'arkanite', type: 'battle' })).toBeNull();
  });

  it('ignores malformed messages or messages from another app', () => {
    for (const data of [
      null,
      'hello',
      42,
      [],
      { type: 'requestView' },
      { app: 'other-app', type: 'requestView' },
      { app: 'arkanite', type: 'unknown' },
      { app: 'arkanite', type: 'view' },
      { app: 'arkanite', type: 'view', view: { map: {} } },
    ]) {
      expect(parseSyncMessage(data)).toBeNull();
    }
  });
});
