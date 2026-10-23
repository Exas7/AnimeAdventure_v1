// Spec 085: on a big screen the player columns take all the room the map leaves
// free at its sides, and their writing and pictures grow with them.

/** The narrowest a column is drawn (a small phone held sideways): the content still fits in it. */
export const PANEL_MIN_WIDTH = 124;
/** About the height their content needs at that size: five places, powers, commands. */
export const PANEL_BASE_HEIGHT = 560;
/** Screens smaller than this keep the columns of the phone. */
export const PC_MIN_WIDTH = 1100;
export const PC_MIN_HEIGHT = 650;
const MAX_ZOOM = 2.6;
/** The padding and gaps of the game grid, and the padding of the board (PhoneGame.module.css). */
const GRID_EDGE = 4;
const BOARD_EDGE = 4;

export interface SideColumns {
  /** The scale of a column, and its width before scaling (the column takes `zoom * width` on the screen). */
  zoom: number;
  width: number;
}

/**
 * The size of the two columns for a game area `box` and a map of the given
 * proportions (width / height), or null when the phone's columns are right.
 * The map stays as tall as the area; the columns share what is left and the
 * content is as big as the height allows, in a column as narrow as it can be drawn.
 */
export function sideColumns(box: { width: number; height: number }, mapRatio: number): SideColumns | null {
  if (box.width < PC_MIN_WIDTH || box.height < PC_MIN_HEIGHT || !(mapRatio > 0)) {
    return null;
  }
  const mapWidth = (box.height - 2 * GRID_EDGE - 2 * BOARD_EDGE) * mapRatio + 2 * BOARD_EDGE;
  const side = (box.width - 2 * GRID_EDGE - 2 * GRID_EDGE - mapWidth) / 2;
  if (side <= PANEL_MIN_WIDTH) {
    return null;
  }
  const byWidth = side / PANEL_MIN_WIDTH;
  const byHeight = (box.height - 2 * GRID_EDGE) / PANEL_BASE_HEIGHT;
  const zoom = Math.min(byWidth, byHeight, MAX_ZOOM);
  return { zoom, width: side / zoom };
}
