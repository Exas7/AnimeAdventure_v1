import type { BattleView } from '../battle/playback';
import type { Game } from '../engine';
import type { StarterChoiceView } from '../starters/starterChoice';
import { buildLiveView, type Overlay, type StreamLayout } from './liveView';
import { battleMessage, starterChoiceMessage, viewMessage, type SyncMessage } from './messages';

export interface DirectorShows {
  game: Game | null;
  overlay: Overlay | null;
  layout: StreamLayout;
  starterChoice: StarterChoiceView | null;
  /** A simulated fight of the game (spec 037, D-058): while set, the stream shows it. */
  battle: BattleView | null;
}

/**
 * What the director window sends to the stream: a simulated fight while it
 * is open, the starter choice while it is open, otherwise the game. With
 * none, "no game" only when this window was showing something (a game
 * closed, a scene left); a window that never showed anything stays quiet,
 * and the stream keeps what it shows (spec 032, 2.2).
 */
export function directorMessage(shows: DirectorShows, wasShowing: boolean): SyncMessage | null {
  if (shows.battle) {
    return battleMessage(shows.battle);
  }
  if (shows.starterChoice) {
    return starterChoiceMessage(shows.starterChoice);
  }
  if (shows.game) {
    return viewMessage(buildLiveView(shows.game, shows.overlay, shows.layout));
  }
  return wasShowing ? viewMessage(null) : null;
}

/** After sending `message`: is the stream showing something of this window? */
export function isShowing(message: SyncMessage): boolean {
  return (
    message.type === 'starterChoice' ||
    (message.type === 'battle' && message.battle !== null) ||
    (message.type === 'view' && message.view !== null)
  );
}
