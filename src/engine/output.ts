import type { GameState, Warning, WarningKind } from './types';

/** What an action produces besides the new state. */
export interface ActionOutput {
  warnings: Warning[];
  /** Log lines for automatic consequences. */
  events: string[];
}

export function emptyOutput(): ActionOutput {
  return { warnings: [], events: [] };
}

/** Non-blocking warning for the host (D-008). */
export function warn(out: ActionOutput, kind: WarningKind, message: string): void {
  out.warnings.push({ kind, message });
}

/** Shows a message on screen, stream included, and writes it in the log. */
export function notify(state: GameState, out: ActionOutput, text: string): void {
  state.notifications.push({ id: state.nextNotificationId, text });
  state.nextNotificationId += 1;
  out.events.push(text);
}

export function signed(amount: number): string {
  return amount >= 0 ? `+${amount}` : `${amount}`;
}
