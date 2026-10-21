import { nextLineIndex } from '../engine';
import type { Overlay } from '../sync/liveView';

/**
 * The director's own view (D-032): a character's scene, or the board under
 * the screen the stream shows ("Esplora Regia").
 */
export type DirectorPreview = Overlay | { kind: 'board' };

/**
 * The screens over the board of the director window (D-032): the one the
 * stream shows too, and the director's own preview, shown on top of it.
 */
export interface DirectorScreens {
  shared: Overlay | null;
  preview: DirectorPreview | null;
}

/** The scene of a character, from its first line. */
export function challengeScreen(nodeId: string): Overlay {
  return { kind: 'challenge', nodeId, line: 0 };
}

/** What the director sees: its preview if there is one, otherwise what the stream sees. */
export function shownInDirector({ shared, preview }: DirectorScreens): Overlay | null {
  if (preview?.kind === 'board') {
    return null;
  }
  return preview ?? shared;
}

/** The director looks at the board while the stream keeps its screen. */
export function isExploring({ shared, preview }: DirectorScreens): boolean {
  return preview?.kind === 'board' && shared !== null;
}

/** "Esplora Regia": hides the screen open on both windows, in the director only. */
export function exploreBoard(screens: DirectorScreens): DirectorScreens {
  return screens.shared && !screens.preview ? { ...screens, preview: { kind: 'board' } } : screens;
}

/** A double click: the character's scene for the director only; the stream keeps what it shows. */
export function openPreview(screens: DirectorScreens, nodeId: string): DirectorScreens {
  return { ...screens, preview: challengeScreen(nodeId) };
}

/**
 * "Chiudi" and "Torna allo stream": closes the preview, so the director
 * goes back to what the stream shows; without a preview, closes the screen
 * on both windows.
 */
export function closeShown(screens: DirectorScreens): DirectorScreens {
  return screens.preview ? { ...screens, preview: null } : { ...screens, shared: null };
}

/** "Mostra al pubblico": the scene previewed replaces what the stream shows, from the line shown now. */
export function showPreviewToAll(screens: DirectorScreens): DirectorScreens {
  return screens.preview?.kind === 'challenge' ? { shared: screens.preview, preview: null } : screens;
}

/**
 * A click on the balloon: the next line of the scene the director sees.
 * The stream follows when it shows the same scene, not during a preview.
 */
export function nextLine(screens: DirectorScreens, lineCount: number): DirectorScreens {
  const shown = shownInDirector(screens);
  if (shown?.kind !== 'challenge') {
    return screens;
  }
  const advanced: Overlay = { ...shown, line: nextLineIndex(shown.line, lineCount) };
  return screens.preview ? { ...screens, preview: advanced } : { ...screens, shared: advanced };
}

/**
 * A click on a quiz answer (spec 026, 2.5): the answer the player gave, in
 * the scene the director sees. The stream follows as for the lines.
 */
export function chooseAnswer(screens: DirectorScreens, answer: number): DirectorScreens {
  const shown = shownInDirector(screens);
  if (shown?.kind !== 'challenge') {
    return screens;
  }
  const answered: Overlay = { ...shown, answer };
  return screens.preview ? { ...screens, preview: answered } : { ...screens, shared: answered };
}

/** What the stream keeps showing while the director explores the board, e.g. "sfida di Zangya". */
export function describeScreen(screen: Overlay, cellName: (nodeId: string) => string): string {
  switch (screen.kind) {
    case 'challenge':
      return `sfida di ${cellName(screen.nodeId)}`;
    case 'shop':
      return `negozio di ${cellName(screen.nodeId)}`;
    case 'showdown':
      return 'showdown';
  }
}
