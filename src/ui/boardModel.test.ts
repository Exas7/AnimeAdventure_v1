import { describe, expect, it } from 'vitest';
import {
  act,
  createGame,
  currentState,
  testCatalog,
  testContent,
  testMap,
  testSetup,
  type Game,
  type GameAction,
} from '../engine';
import {
  PAWN_HALF_WIDTH,
  boardView,
  contentView,
  edgePath,
  nodeAtPoint,
  pawnLabel,
  wrapLabel,
  type NodeView,
} from './boardModel';

function play(game: Game, ...actions: GameAction[]): Game {
  return actions.reduce(act, game);
}

function viewOf(game: Game) {
  const state = currentState(game);
  return boardView(game.map, game.catalog, state, state.currentPlayer);
}

describe('board as seen by the current player (spec 003, criterion 1)', () => {
  it('a path unlocked only for G1 is open on their turn and closed on the turn of G2', () => {
    const game = play(createGame(testSetup()), {
      type: 'setEdgeLock',
      edgeId: 'e8',
      players: 'p1',
      locked: false,
    });
    const e8 = (g: Game) => viewOf(g).edges.find((edge) => edge.id === 'e8');
    expect(e8(game)?.closed).toBe(false);
    expect(e8(act(game, { type: 'endTurn' }))?.closed).toBe(true);
    expect(e8(game)?.lockNote).toBe('Si apre dopo aver battuto Personaggio A');
  });

  it('a conquered cell is grey for both players', () => {
    const game = play(createGame(testSetup()), { type: 'setConquest', nodeId: 'c1', player: 'p1' });
    const c1 = (g: Game) => viewOf(g).nodes.find((node) => node.id === 'c1');
    expect(c1(game)?.conqueredBy).toBe('p1');
    expect(c1(act(game, { type: 'endTurn' }))?.conqueredBy).toBe('p1');
  });

  it('labels large cells with the placeholder name', () => {
    const nodes = viewOf(createGame(testSetup())).nodes;
    expect(nodes.find((node) => node.id === 'c1')).toMatchObject({ label: 'Personaggio A' });
    expect(nodes.find((node) => node.id === 'sh1')).toMatchObject({
      label: 'Negoziante Uno',
      caption: 'Negozio',
    });
    expect(nodes.find((node) => node.id === 'n1')?.label).toBeNull();
  });
});

describe('cells with a character (spec 004, criterion 1, D-016)', () => {
  it('a passage cell with a character is drawn large; without it, small again', () => {
    const withCharacter = act(createGame(testSetup()), {
      type: 'setCellContent',
      nodeId: 'n1',
      content: { characterId: 'char-e' },
    });
    const n1 = (g: Game) => viewOf(g).nodes.find((node) => node.id === 'n1');
    expect(n1(withCharacter)).toMatchObject({ role: 'character', label: 'Personaggio E' });
    expect(n1(withCharacter)?.radius).toBeGreaterThan(20);

    const emptied = act(withCharacter, { type: 'setCellContent', nodeId: 'n1', content: {} });
    expect(n1(emptied)).toMatchObject({ role: 'passage', label: null });
    expect(n1(emptied)?.radius).toBeLessThan(20);
  });
});

describe('character cells (spec 013, criterion 4)', () => {
  it('a character cell is large with a character and a plain passage without one', () => {
    const map = {
      ...testMap,
      nodes: testMap.nodes.map((node) => (node.id === 'n1' ? { ...node, type: 'character' as const } : node)),
    };
    const n1 = (cells: Record<string, { characterId?: string }>) =>
      contentView(map, testCatalog, cells).nodes.find((node) => node.id === 'n1');
    expect(n1({ n1: { characterId: 'char-e' } })).toMatchObject({
      role: 'character',
      label: 'Personaggio E',
      characterId: 'char-e',
    });
    expect(n1({})).toMatchObject({ role: 'passage', label: null, characterId: null });
  });

  it('a shop shows its shopkeeper, for the image', () => {
    const shop = contentView(testMap, testCatalog, testContent).nodes.find((node) => node.id === 'sh1');
    expect(shop?.characterId).toBe(testContent.sh1?.characterId);
  });
});

describe('board before the game (spec 007)', () => {
  it('draws the cells with their content like the game board, without pawns or conquests', () => {
    const game = createGame(testSetup());
    const before = contentView(testMap, testCatalog, testContent);
    const during = viewOf(game);
    expect(before.pawns).toEqual([]);
    expect(before.nodes.every((node) => node.conqueredBy === null)).toBe(true);
    expect(before.nodes.map((node) => [node.id, node.label, node.radius])).toEqual(
      during.nodes.map((node) => [node.id, node.label, node.radius]),
    );
    expect(before.edges.map((edge) => edge.closed)).toEqual(testMap.edges.map((edge) => edge.locked));
  });
});

describe('special cells (spec 034, 2.5)', () => {
  it('carry the meaning written in the editor, for the director', () => {
    const map = {
      ...testMap,
      nodes: [
        { id: 's1', x: 0.1, y: 0.1, type: 'special' as const, color: '#aa00ff', note: '  Soldi extra ' },
        { id: 's2', x: 0.2, y: 0.1, type: 'special' as const, note: '   ' },
        { id: 'e1', x: 0.3, y: 0.1, type: 'empty' as const, note: 'Ignorata' },
      ],
      edges: [],
    };
    const nodes = contentView(map, testCatalog, {}).nodes;
    expect(nodes.map((node) => node.note)).toEqual(['Soldi extra', undefined, undefined]);
  });
});

describe('paths (spec 003, criterion 2)', () => {
  it('a path without curve points is a straight line', () => {
    expect(
      edgePath([
        { x: 0, y: 0 },
        { x: 100, y: 50 },
      ]),
    ).toBe('M 0 0 L 100 50');
  });

  it('a path with curve points passes through them', () => {
    const path = edgePath([
      { x: 0, y: 0 },
      { x: 50, y: 40 },
      { x: 100, y: 0 },
    ]);
    const segments = path.split(' C ');
    expect(segments).toHaveLength(3);
    expect(segments[1]?.endsWith(' 50 40')).toBe(true);
    expect(segments[2]?.endsWith(' 100 0')).toBe(true);
  });
});

describe('pawns (spec 003, criterion 3)', () => {
  it('two pawns on the same cell do not overlap', () => {
    const game = play(createGame(testSetup()), { type: 'placePawn', player: 'p2', nodeId: 's1' });
    const [first, second] = viewOf(game).pawns;
    expect(first?.y).toBe(second?.y);
    expect(first?.x).not.toBe(second?.x);
  });

  it('pawns on different cells stand on their cell', () => {
    const pawns = viewOf(createGame(testSetup())).pawns;
    expect(pawns.map((pawn) => pawn.player)).toEqual(['p1', 'p2']);
    expect(pawns[0]?.isCurrent).toBe(true);
    expect(pawns[1]?.isCurrent).toBe(false);
  });

  it('keeps short names and uses the initial of longer ones', () => {
    expect(pawnLabel('G1')).toBe('G1');
    expect(pawnLabel('marco')).toBe('M');
  });
});

describe('humanoid pawns and dropping them (spec 016)', () => {
  it('two pawns on the same cell stand apart by at least their width', () => {
    const game = play(createGame(testSetup()), { type: 'placePawn', player: 'p2', nodeId: 's1' });
    const [first, second] = viewOf(game).pawns;
    expect(Math.abs((first?.x ?? 0) - (second?.x ?? 0))).toBeGreaterThanOrEqual(
      2 * PAWN_HALF_WIDTH,
    );
    expect(first?.nodeId).toBe('s1');
    expect(second?.nodeId).toBe('s1');
  });

  function cell(id: string, x: number, y: number, radius: number): NodeView {
    return {
      id,
      role: radius > 20 ? 'character' : 'passage',
      x,
      y,
      radius,
      label: null,
      caption: null,
      conqueredBy: null,
      color: null,
      characterId: null,
    };
  }

  const cells = [cell('dot', 100, 100, 10), cell('big', 300, 100, 48), cell('near', 140, 100, 10)];

  it('finds the cell under the point, small cells included', () => {
    expect(nodeAtPoint(cells, { x: 300, y: 140 })).toBe('big');
    // A dot of radius 10 still takes a point 20 units away.
    expect(nodeAtPoint(cells, { x: 100, y: 120 })).toBe('dot');
  });

  it('between two cells, takes the nearest', () => {
    expect(nodeAtPoint(cells, { x: 118, y: 100 })).toBe('dot');
    expect(nodeAtPoint(cells, { x: 122, y: 100 })).toBe('near');
  });

  it('away from every cell, finds none', () => {
    expect(nodeAtPoint(cells, { x: 200, y: 300 })).toBeNull();
  });
});

describe('labels', () => {
  it('wraps long names on up to three lines', () => {
    expect(wrapLabel('Goku')).toEqual(['Goku']);
    expect(wrapLabel('Personaggio A')).toEqual(['Personaggio', 'A']);
    expect(wrapLabel('Super Saiyan Goku SSJ3 Ultra Instinct')).toHaveLength(3);
  });
});
