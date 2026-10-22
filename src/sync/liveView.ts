import {
  currentState,
  type Character,
  type Game,
  type GameMap,
  type GameState,
  type ItemDefinition,
} from '../engine';

/** Screen shown in the foreground on both windows. */
export type Overlay =
  // `line`: the line shown in the balloon (D-031); `answer`: the quiz
  // answer the host clicked, if any (spec 026, 2.5).
  | { kind: 'challenge'; nodeId: string; line: number; answer?: number }
  | { kind: 'showdown' }
  | { kind: 'shop'; nodeId: string };

export interface StreamLayout {
  /** Player panels on the stream: below the map, or hidden if the channel uses its own. */
  playerPanels: 'below' | 'hidden';
}

export const DEFAULT_LAYOUT: StreamLayout = { playerPanels: 'below' };

/** Everything the stream window needs to draw, sent by the director window (D-010). */
export interface LiveView {
  map: GameMap;
  catalog: Character[];
  items: ItemDefinition[];
  state: GameState;
  overlay: Overlay | null;
  layout: StreamLayout;
  /** Cells where a travel item can take the pawn, while the host chooses (spec 047). */
  highlight?: string[] | null;
}

export function buildLiveView(
  game: Game,
  overlay: Overlay | null,
  layout: StreamLayout,
  highlight: string[] | null = null,
): LiveView {
  return {
    map: game.map,
    catalog: game.catalog,
    items: game.items,
    state: currentState(game),
    overlay,
    layout,
    highlight,
  };
}
