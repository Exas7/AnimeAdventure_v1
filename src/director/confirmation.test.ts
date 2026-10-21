import { describe, expect, it } from 'vitest';
import type { GameAction, Warning } from '../engine';
import { decideClick } from './confirmation';

const moveToS2: GameAction = { type: 'move', to: 's2' };
const notAdjacent: Warning = { kind: 'notAdjacent', message: 'Mossa non adiacente' };

describe('second click (spec 003, criterion 6, D-013)', () => {
  it('a click without warnings acts at once', () => {
    expect(decideClick(null, moveToS2, [])).toEqual({
      kind: 'perform',
      action: moveToS2,
      alreadyShown: [],
    });
  });

  it('a click with warnings only asks', () => {
    expect(decideClick(null, moveToS2, [notAdjacent])).toEqual({
      kind: 'ask',
      pending: { key: 'move:s2', action: moveToS2, warnings: [notAdjacent] },
    });
  });

  it('a second click on the same cell acts, and the warnings already seen are not repeated', () => {
    const first = decideClick(null, moveToS2, [notAdjacent]);
    if (first.kind !== 'ask') {
      throw new Error('expected the first click to ask');
    }
    expect(decideClick(first.pending, moveToS2, [notAdjacent])).toEqual({
      kind: 'perform',
      action: moveToS2,
      alreadyShown: ['notAdjacent'],
    });
  });

  it('the same item in two shops counts as two different buttons (spec 004, criterion 8)', () => {
    const senzuSh1: GameAction = { type: 'buyItem', shopNodeId: 'sh1', itemId: 'senzu' };
    const senzuSh2: GameAction = { type: 'buyItem', shopNodeId: 'sh2', itemId: 'senzu' };
    const soldOut: Warning = { kind: 'itemSoldOut', message: 'Esaurito' };
    const first = decideClick(null, senzuSh1, [soldOut]);
    if (first.kind !== 'ask') {
      throw new Error('expected the first click to ask');
    }
    expect(decideClick(first.pending, senzuSh2, [soldOut])).toMatchObject({ kind: 'ask' });
    expect(decideClick(first.pending, senzuSh1, [soldOut])).toMatchObject({ kind: 'perform' });
  });

  it('a click on another cell starts over', () => {
    const first = decideClick(null, moveToS2, [notAdjacent]);
    if (first.kind !== 'ask') {
      throw new Error('expected the first click to ask');
    }
    const other: GameAction = { type: 'move', to: 'n5' };
    expect(decideClick(first.pending, other, [notAdjacent])).toMatchObject({ kind: 'ask' });
    expect(decideClick(first.pending, other, [])).toMatchObject({ kind: 'perform' });
  });
});

describe('end of turn and the other pawn (spec 021, criteria 1-2, D-033)', () => {
  const endTurn: GameAction = { type: 'endTurn' };
  const actionsLeft: Warning = { kind: 'actionsLeft', message: 'G1 ha ancora 1 azione nel turno' };

  it('"Fine turno" with actions left asks first, and ends the turn at the second click', () => {
    const first = decideClick(null, endTurn, [actionsLeft]);
    expect(first).toMatchObject({ kind: 'ask' });
    if (first.kind !== 'ask') {
      throw new Error('expected the first click to ask');
    }
    expect(decideClick(first.pending, endTurn, [actionsLeft])).toEqual({
      kind: 'perform',
      action: endTurn,
      alreadyShown: ['actionsLeft'],
    });
  });

  it('the other pawn moves at the second drop on the same cell; a drop elsewhere starts over', () => {
    const otherPawn: Warning = { kind: 'otherPlayerPawn', message: 'Non è il turno di G2' };
    const toN4: GameAction = { type: 'placePawn', player: 'p2', nodeId: 'n4' };
    const toN5: GameAction = { type: 'placePawn', player: 'p2', nodeId: 'n5' };
    const first = decideClick(null, toN4, [otherPawn]);
    if (first.kind !== 'ask') {
      throw new Error('expected the first drop to ask');
    }
    expect(decideClick(first.pending, toN5, [otherPawn])).toMatchObject({ kind: 'ask' });
    expect(decideClick(first.pending, toN4, [otherPawn])).toMatchObject({
      kind: 'perform',
      action: toN4,
    });
  });
});
