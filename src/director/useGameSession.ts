import { useCallback, useEffect, useRef, useState } from 'react';
import {
  act,
  currentState,
  dismissNotification,
  dismissRedoNotification,
  lastWarnings,
  redo as redoGame,
  undoKeepingRedo,
  type Game,
  type GameAction,
  type HistoryEntry,
  type Warning,
  type WarningKind,
} from '../engine';
import { clearAutosave, saveAutosave } from '../storage/autosave';
import { openSyncChannel, type SyncChannel } from '../sync/channel';
import { directorMessage, isShowing } from '../sync/directorMessage';
import { DEFAULT_LAYOUT, type Overlay, type StreamLayout } from '../sync/liveView';
import type { StarterChoiceView } from '../starters/starterChoice';
import { describeError } from '../describeError';

/** Notifications close by themselves after this time (spec 003, 2.9). */
const NOTIFICATION_MS = 6000;
/** Warnings for the host disappear after this time, or at the next action. */
const WARNING_MS = 6000;
const AUTOSAVE_DELAY_MS = 400;

export interface GameSession {
  game: Game | null;
  overlay: Overlay | null;
  layout: StreamLayout;
  warnings: Warning[];
  error: string | null;
  /**
   * Applies a host action; returns the new game, or null if it failed.
   * `alreadyShown`: warnings the host just confirmed, not to be shown again.
   */
  perform(action: GameAction, options?: { alreadyShown?: WarningKind[] }): Game | null;
  undo(): void;
  /** "Ripeti" (spec 021): brings back the last action undone, if any. */
  redo(): void;
  canRedo: boolean;
  /** Replaces the game in progress (new game or loaded from file). */
  start(game: Game): void;
  /**
   * Closes the game in progress and deletes its automatic save (spec 019).
   * The stream shows that no game is in progress.
   */
  discard(): Promise<void>;
  setOverlay(overlay: Overlay | null): void;
  setLayout(layout: StreamLayout): void;
  /**
   * The starter choice scene (spec 025, 2.4): while set, the stream shows it
   * instead of the game; null gives the stream back to the game.
   */
  setStarterChoice(choice: StarterChoiceView | null): void;
  closeNotification(notificationId: number): void;
  showError(message: string): void;
  clearError(): void;
}

/**
 * Holds the game in the director window. Every change is sent to the
 * stream window (D-010) and saved in the browser (D-011).
 */
export function useGameSession(): GameSession {
  const [game, setGameState] = useState<Game | null>(null);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [layout, setLayout] = useState<StreamLayout>(DEFAULT_LAYOUT);
  const [starterChoice, setStarterChoice] = useState<StarterChoiceView | null>(null);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [error, setError] = useState<string | null>(null);
  // What "Ripeti" can bring back: kept in this session only, never saved (spec 021).
  const [redoEntries, setRedoState] = useState<HistoryEntry[]>([]);

  // The latest values, readable from callbacks and timers without waiting for a render.
  const gameRef = useRef<Game | null>(null);
  const redoRef = useRef<HistoryEntry[]>([]);
  const viewRef = useRef({ game, overlay, layout, starterChoice });
  viewRef.current = { game, overlay, layout, starterChoice };

  const setGame = useCallback((next: Game | null) => {
    gameRef.current = next;
    setGameState(next);
  }, []);

  const setRedo = useCallback((next: HistoryEntry[]) => {
    redoRef.current = next;
    setRedoState(next);
  }, []);

  const perform = useCallback(
    (action: GameAction, options?: { alreadyShown?: WarningKind[] }): Game | null => {
      const current = gameRef.current;
      if (!current) {
        return null;
      }
      try {
        const next = act(current, action);
        const alreadyShown = options?.alreadyShown ?? [];
        setGame(next);
        // A new action: what was undone can no longer be repeated.
        setRedo([]);
        setWarnings(lastWarnings(next).filter((warning) => !alreadyShown.includes(warning.kind)));
        return next;
      } catch (cause) {
        // Only a bug can get here (an unknown cell, power, ...): report it, keep the game.
        setError(`Errore interno: ${describeError(cause)}`);
        return null;
      }
    },
    [setGame, setRedo],
  );

  const undo = useCallback(() => {
    const current = gameRef.current;
    if (current) {
      const timeline = undoKeepingRedo({ game: current, redo: redoRef.current });
      setGame(timeline.game);
      setRedo(timeline.redo);
      setWarnings([]);
    }
  }, [setGame, setRedo]);

  const redo = useCallback(() => {
    const current = gameRef.current;
    if (current) {
      const timeline = redoGame({ game: current, redo: redoRef.current });
      setGame(timeline.game);
      setRedo(timeline.redo);
      setWarnings([]);
    }
  }, [setGame, setRedo]);

  const start = useCallback(
    (next: Game) => {
      setGame(next);
      setRedo([]);
      setOverlay(null);
      setWarnings([]);
      setError(null);
    },
    [setGame, setRedo],
  );

  const discard = useCallback(async () => {
    // With no game, the pending automatic save is cancelled and nothing is saved again.
    setGame(null);
    setRedo([]);
    setOverlay(null);
    setWarnings([]);
    setError(null);
    await clearAutosave();
  }, [setGame, setRedo]);

  const closeNotification = useCallback(
    (notificationId: number) => {
      const current = gameRef.current;
      if (current) {
        setGame(dismissNotification(current, notificationId));
        setRedo(dismissRedoNotification(redoRef.current, notificationId));
      }
    },
    [setGame, setRedo],
  );

  // --- Sync with the stream window (D-010) ---------------------------------
  const channelRef = useRef<SyncChannel | null>(null);
  // Is the stream showing something of this window? Until then, no "no game" (spec 032, 2.2).
  const showingRef = useRef(false);

  useEffect(() => {
    const channel = openSyncChannel((message) => {
      if (message.type === 'requestView') {
        const answer = directorMessage(viewRef.current, showingRef.current);
        if (answer) {
          channel.send(answer);
        }
      }
    });
    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      channel.close();
    };
  }, []);

  useEffect(() => {
    const message = directorMessage({ game, overlay, layout, starterChoice }, showingRef.current);
    if (message) {
      channelRef.current?.send(message);
      showingRef.current = isShowing(message);
    }
  }, [game, overlay, layout, starterChoice]);

  // --- Automatic save (D-011) ----------------------------------------------
  useEffect(() => {
    if (!game) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      saveAutosave(game).catch((cause: unknown) => {
        setError(
          `Salvataggio automatico non riuscito (${describeError(cause)}). Salva la partita su file.`,
        );
      });
    }, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [game]);

  // --- Notifications close by themselves ------------------------------------
  const notificationTimers = useRef(new Map<number, number>());

  useEffect(() => {
    const timers = notificationTimers.current;
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };
  }, []);

  useEffect(() => {
    if (!game) {
      return;
    }
    const timers = notificationTimers.current;
    for (const notification of currentState(game).notifications) {
      if (!timers.has(notification.id)) {
        timers.set(
          notification.id,
          window.setTimeout(() => {
            timers.delete(notification.id);
            closeNotification(notification.id);
          }, NOTIFICATION_MS),
        );
      }
    }
  }, [game, closeNotification]);

  // --- Warnings disappear after a while -------------------------------------
  useEffect(() => {
    if (warnings.length === 0) {
      return undefined;
    }
    const timer = window.setTimeout(() => setWarnings([]), WARNING_MS);
    return () => window.clearTimeout(timer);
  }, [warnings]);

  return {
    game,
    overlay,
    layout,
    warnings,
    error,
    perform,
    undo,
    redo,
    canRedo: redoEntries.length > 0,
    start,
    discard,
    setOverlay,
    setLayout,
    setStarterChoice,
    closeNotification,
    showError: setError,
    clearError: () => setError(null),
  };
}
