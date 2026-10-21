import type { GameAction, Warning, WarningKind } from '../engine';

/**
 * An off-rule move, interaction or purchase, an end of turn with actions
 * left or a drop of the other pawn, waiting for a second click (D-013, D-033).
 */
export interface PendingAction {
  key: string;
  action: GameAction;
  warnings: Warning[];
}

export type ClickDecision =
  // Do it now; `alreadyShown` are warnings the host has just seen and confirmed.
  | { kind: 'perform'; action: GameAction; alreadyShown: WarningKind[] }
  // Show the warnings in the director window and wait for a second click.
  | { kind: 'ask'; pending: PendingAction };

/**
 * A click with no turn-rule warnings acts at once. With warnings, the
 * first click only asks; a second click on the same target (cell or
 * "Acquista" button) acts. A click on anything else starts over.
 */
export function decideClick(
  pending: PendingAction | null,
  action: GameAction,
  warnings: Warning[],
): ClickDecision {
  const key = actionKey(action);
  if (pending && pending.key === key) {
    return {
      kind: 'perform',
      action,
      alreadyShown: pending.warnings.map((warning) => warning.kind),
    };
  }
  if (warnings.length === 0) {
    return { kind: 'perform', action, alreadyShown: [] };
  }
  return { kind: 'ask', pending: { key, action, warnings } };
}

function actionKey(action: GameAction): string {
  switch (action.type) {
    case 'move':
      return `move:${action.to}`;
    case 'interact':
      return `interact:${action.nodeId}`;
    case 'buyCharacter':
      return `buyCharacter:${action.shopNodeId}:${action.characterId}`;
    case 'buyItem':
      return `buyItem:${action.shopNodeId}:${action.itemId}`;
    // The other player's pawn: confirmed by a second drop on the same cell (D-033).
    case 'placePawn':
      return `placePawn:${action.player}:${action.nodeId}`;
    default:
      return action.type;
  }
}
