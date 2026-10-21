import type { BattleView } from '../battle/playback';
import { looksLikeStarterChoiceView, type StarterChoiceView } from '../starters/starterChoice';
import type { LiveView } from './liveView';

export const SYNC_CHANNEL_NAME = 'arkanite-sync';

const APP = 'arkanite';

export type SyncMessage =
  // The stream asks for the current view, e.g. right after opening.
  | { app: typeof APP; type: 'requestView' }
  // The director sends what to show; null when no game is in progress.
  | { app: typeof APP; type: 'view'; view: LiveView | null }
  // The starter choice scene (spec 025, 2.4): shown instead of the game while open.
  | { app: typeof APP; type: 'starterChoice'; choice: StarterChoiceView }
  // The simulated fight (spec 035, D-055): shown instead of the game while
  // the test page has one open; null when it closes.
  | { app: typeof APP; type: 'battle'; battle: BattleView | null };

export function requestViewMessage(): SyncMessage {
  return { app: APP, type: 'requestView' };
}

export function viewMessage(view: LiveView | null): SyncMessage {
  return { app: APP, type: 'view', view };
}

export function starterChoiceMessage(choice: StarterChoiceView): SyncMessage {
  return { app: APP, type: 'starterChoice', choice };
}

export function battleMessage(battle: BattleView | null): SyncMessage {
  return { app: APP, type: 'battle', battle };
}

/** Accepts only well-formed messages of this app; anything else gives null and is ignored. */
export function parseSyncMessage(data: unknown): SyncMessage | null {
  if (!isRecord(data) || data.app !== APP) {
    return null;
  }
  if (data.type === 'requestView') {
    return requestViewMessage();
  }
  if (data.type === 'view' && (data.view === null || looksLikeLiveView(data.view))) {
    return viewMessage(data.view);
  }
  if (data.type === 'starterChoice' && looksLikeStarterChoiceView(data.choice)) {
    return starterChoiceMessage(data.choice);
  }
  if (data.type === 'battle' && (data.battle === null || looksLikeBattleView(data.battle))) {
    return battleMessage(data.battle);
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function looksLikeLiveView(value: unknown): value is LiveView {
  if (!isRecord(value)) {
    return false;
  }
  const { map, catalog, state, layout } = value;
  return (
    isRecord(map) &&
    Array.isArray(map.nodes) &&
    Array.isArray(map.edges) &&
    Array.isArray(catalog) &&
    isRecord(state) &&
    isRecord(state.players) &&
    isRecord(layout)
  );
}

function looksLikeBattleView(value: unknown): value is BattleView {
  if (!isRecord(value) || !isRecord(value.record)) {
    return false;
  }
  const { record, shown, speed, switchRecharge } = value;
  const { teams } = record;
  return (
    isRecord(teams) &&
    Array.isArray(teams.a) &&
    Array.isArray(teams.b) &&
    Array.isArray(record.steps) &&
    isRecord(record.start) &&
    typeof shown === 'number' &&
    typeof speed === 'number' &&
    typeof switchRecharge === 'number'
  );
}
