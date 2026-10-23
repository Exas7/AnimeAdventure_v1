import { useEffect, useRef } from 'react';

/** Two presses of the space bar at most this far apart count as a double press (spec 083). */
export const DOUBLE_PRESS_MS = 450;

/** Whether a press at `now` follows another at `previous` closely enough (times in ms). */
export function isDoublePress(previous: number | null, now: number): boolean {
  return previous !== null && now - previous <= DOUBLE_PRESS_MS;
}

const typingIn = (target: EventTarget | null) =>
  target instanceof Element && target.closest('input, select, textarea, [contenteditable="true"]') !== null;

/**
 * PC shortcut (spec 085): while `enabled`, one press of the space bar calls
 * `onPress`: it presses the only button of a small window («Inizia il turno»).
 */
export function useSpaceKey(enabled: boolean, onPress: () => void): void {
  const latest = useRef(onPress);
  latest.current = onPress;
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    const wanted = (event: KeyboardEvent) => event.code === 'Space' && !typingIn(event.target);
    const onKeyDown = (event: KeyboardEvent) => {
      if (wanted(event)) {
        event.preventDefault();
        if (!event.repeat) {
          latest.current();
        }
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (wanted(event)) {
        event.preventDefault();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [enabled]);
}

/**
 * PC shortcut (spec 083): the space bar twice in a row calls `onDouble`, as the
 * «Fine turno» button. It does nothing while `enabled` is false, while someone
 * types, or while a window with `aria-modal` is open. While enabled the key is
 * taken by the game: it neither scrolls the page nor presses the focused button.
 */
export function useDoubleSpace(enabled: boolean, onDouble: () => void): void {
  const latest = useRef(onDouble);
  latest.current = onDouble;
  const lastPress = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      lastPress.current = null;
      return undefined;
    }
    const wanted = (event: KeyboardEvent) =>
      event.code === 'Space' &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      !typingIn(event.target) &&
      document.querySelector('[aria-modal="true"]') === null;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!wanted(event)) {
        return;
      }
      event.preventDefault();
      if (event.repeat) {
        return;
      }
      const now = Date.now();
      if (isDoublePress(lastPress.current, now)) {
        lastPress.current = null;
        latest.current();
      } else {
        lastPress.current = now;
      }
    };
    // A focused button is pressed by the space bar when it is released.
    const onKeyUp = (event: KeyboardEvent) => {
      if (wanted(event)) {
        event.preventDefault();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [enabled]);
}
