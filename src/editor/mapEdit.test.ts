import { describe, expect, it } from 'vitest';
import {
  createGame,
  currentState,
  testCatalog,
  testItems,
  testMap,
  type GameMap,
} from '../engine';
import { buildSetup, defaultNewGameForm } from '../director/newGame';
import { emptyProposals, withProposal } from '../starters/proposals';
import { chooseCard, showOther, startChoice } from '../starters/starterChoice';
import { boardSize } from '../ui/boardModel';
import { commit, redoEdit, startHistory, undoEdit } from './history';
import {
  addCurvePoint,
  addNode,
  checkMap,
  connect,
  deleteSelection,
  duplicateSelection,
  moveCurvePoint,
  moveNodes,
  newMap,
  nextVersionName,
  nodesInRect,
  removeCurvePoint,
  setBackground,
  updateEdge,
  updateNodes,
} from './mapEdit';
import { MapFileError, parseMap, serializeMap } from './mapFile';

/** A small valid map: two starts, two shops, a path joining them all. */
function smallMap(): GameMap {
  let map = newMap('Prova');
  const ids: string[] = [];
  for (const [x, type] of [
    [0.1, 'start'],
    [0.3, 'shop'],
    [0.5, 'empty'],
    [0.7, 'shop'],
    [0.9, 'start'],
  ] as const) {
    const added = addNode(map, { x, y: 0.5 }, type);
    map = added.map;
    ids.push(added.nodeId);
  }
  for (let i = 0; i < ids.length - 1; i++) {
    map = connect(map, ids[i] as string, ids[i + 1] as string)?.map ?? map;
  }
  return map;
}

describe('map editing (spec 006, criteria 1-6)', () => {
  it('C1: a new cell is created where clicked, in coordinates relative to the background', () => {
    const { map, nodeId } = addNode(newMap(), { x: 0.25, y: 0.75 }, 'empty');
    expect(map.nodes).toEqual([{ id: nodeId, x: 0.25, y: 0.75, type: 'empty' }]);
    expect(nodeId).toBe('n1');
    expect(addNode(map, { x: 1.4, y: -0.2 }, 'shop').map.nodes[1]).toMatchObject({ x: 1, y: 0 });
  });

  it('C2: connecting creates one path, never twice, never a cell to itself', () => {
    const map = smallMap();
    expect(map.edges).toHaveLength(4);
    expect(connect(map, 'n1', 'n2')).toBeNull();
    expect(connect(map, 'n2', 'n1')).toBeNull();
    expect(connect(map, 'n3', 'n3')).toBeNull();
    const joined = connect(map, 'n1', 'n5');
    expect(joined?.edgeId).toBe('e5');
    expect(joined?.map.edges.at(-1)).toEqual({
      id: 'e5',
      from: 'n1',
      to: 'n5',
      curve: [],
      locked: false,
    });
  });

  it('C3: deleting cells also deletes their paths', () => {
    const map = deleteSelection(smallMap(), { nodes: ['n3'], edges: ['e1'] });
    expect(map.nodes.map((node) => node.id)).toEqual(['n1', 'n2', 'n4', 'n5']);
    expect(map.edges.map((edge) => edge.id)).toEqual(['e4']);
  });

  it('C4: moving a group moves its cells and the curves between them', () => {
    let map = addCurvePoint(smallMap(), 'e1', 0, { x: 0.2, y: 0.4 });
    map = addCurvePoint(map, 'e2', 0, { x: 0.4, y: 0.4 });
    const moved = moveNodes(map, ['n1', 'n2'], { x: 0.05, y: 0.1 });
    expect(moved.nodes.slice(0, 3).map(({ x, y }) => ({ x, y }))).toEqual([
      { x: 0.15, y: 0.6 },
      { x: 0.35, y: 0.6 },
      { x: 0.5, y: 0.5 },
    ]);
    expect(moved.edges[0]?.curve).toEqual([{ x: 0.25, y: 0.5 }]);
    // Path n2-n3 has only one moved end: its curve stays.
    expect(moved.edges[1]?.curve).toEqual([{ x: 0.4, y: 0.4 }]);
  });

  it('C5: duplicating copies cells and the paths between them, with new ids', () => {
    const { map, selection } = duplicateSelection(
      smallMap(),
      { nodes: ['n1', 'n2'], edges: [] },
      { x: 0, y: 0.2 },
    );
    expect(selection).toEqual({ nodes: ['n6', 'n7'], edges: ['e5'] });
    expect(map.nodes.at(-1)).toEqual({ id: 'n7', x: 0.3, y: 0.7, type: 'shop' });
    expect(map.edges.at(-1)).toMatchObject({ id: 'e5', from: 'n6', to: 'n7' });
  });

  it('C6: a curve point can be added, moved and removed', () => {
    let map = addCurvePoint(smallMap(), 'e1', 0, { x: 0.2, y: 0.3 });
    map = addCurvePoint(map, 'e1', 1, { x: 0.25, y: 0.35 });
    map = moveCurvePoint(map, 'e1', 0, { x: 0.18, y: 0.32 });
    expect(map.edges[0]?.curve).toEqual([
      { x: 0.18, y: 0.32 },
      { x: 0.25, y: 0.35 },
    ]);
    expect(removeCurvePoint(map, 'e1', 0).edges[0]?.curve).toEqual([{ x: 0.25, y: 0.35 }]);
  });

  it('selects cells inside a rectangle', () => {
    expect(nodesInRect(smallMap(), { x: 0.6, y: 0.6 }, { x: 0.2, y: 0.4 })).toEqual(['n2', 'n3']);
  });

  it('edits cell and path properties, dropping cleared notes', () => {
    let map = updateNodes(smallMap(), ['n3'], { type: 'special', color: '#ff0000', note: 'Bonus' });
    expect(map.nodes[2]).toEqual({
      id: 'n3',
      x: 0.5,
      y: 0.5,
      type: 'special',
      color: '#ff0000',
      note: 'Bonus',
    });
    map = updateNodes(map, ['n3'], { note: '' });
    expect(map.nodes[2]?.note).toBeUndefined();
    map = updateEdge(map, 'e2', { locked: true, lockNote: 'Dopo il negozio' });
    expect(map.edges[1]).toMatchObject({ locked: true, lockNote: 'Dopo il negozio' });
  });
});

describe('cells that open paths (spec 016, D-027)', () => {
  // e2 joins n2 and n3; n4 is a shop further on.
  function keyedMap(key: string): GameMap {
    return updateEdge(smallMap(), 'e2', { locked: true, unlockNodeId: key });
  }

  it('a locked path keeps the cell that opens it, also through the map file', () => {
    const map = keyedMap('n4');
    expect(map.edges[1]).toMatchObject({ locked: true, unlockNodeId: 'n4' });
    expect(parseMap(serializeMap(map)).edges[1]?.unlockNodeId).toBe('n4');
  });

  it('removing the cell or unlocking the path drops the link', () => {
    const cleared = updateEdge(keyedMap('n4'), 'e2', { unlockNodeId: undefined });
    expect(cleared.edges[1]).toEqual({ id: 'e2', from: 'n2', to: 'n3', curve: [], locked: true });

    const unlocked = updateEdge(keyedMap('n4'), 'e2', { locked: false });
    expect(unlocked.edges[1]).not.toHaveProperty('unlockNodeId');

    const deleted = deleteSelection(keyedMap('n4'), { nodes: ['n4'], edges: [] });
    expect(deleted.edges.find((edge) => edge.id === 'e2')).not.toHaveProperty('unlockNodeId');
  });

  it('a duplicated path points to the copy of its cell, or keeps the original one', () => {
    const withCopiedKey = duplicateSelection(
      keyedMap('n2'),
      { nodes: ['n2', 'n3'], edges: [] },
      { x: 0, y: 0.2 },
    );
    expect(withCopiedKey.map.edges.at(-1)).toMatchObject({ from: 'n6', to: 'n7', unlockNodeId: 'n6' });

    const withOtherKey = duplicateSelection(
      keyedMap('n4'),
      { nodes: ['n2', 'n3'], edges: [] },
      { x: 0, y: 0.2 },
    );
    expect(withOtherKey.map.edges.at(-1)).toMatchObject({ unlockNodeId: 'n4' });
  });
});

describe('map checks (spec 006, criterion 7)', () => {
  it('a correct map has no issues', () => {
    // Like smallMap, with a passage cell between each start and its shop (spec 014).
    let map = newMap('Prova');
    const ids: string[] = [];
    for (const [x, type] of [
      [0.1, 'start'],
      [0.2, 'empty'],
      [0.3, 'shop'],
      [0.5, 'empty'],
      [0.7, 'shop'],
      [0.8, 'empty'],
      [0.9, 'start'],
    ] as const) {
      const added = addNode(map, { x, y: 0.5 }, type);
      map = added.map;
      ids.push(added.nodeId);
    }
    for (let i = 0; i < ids.length - 1; i++) {
      map = connect(map, ids[i] as string, ids[i + 1] as string)?.map ?? map;
    }
    expect(checkMap(map)).toEqual([]);
  });

  it('a start joined directly to a cell that is not a passage is listed (spec 014)', () => {
    const issue = checkMap(smallMap()).find((entry) => entry.kind === 'startNeighbours');
    expect(issue?.message).toContain('#1–#2, #5–#4');
  });

  it('warns about shops, starts, isolated and unreachable cells', () => {
    let map = updateNodes(smallMap(), ['n4', 'n5'], { type: 'empty' });
    map = addNode(map, { x: 0.5, y: 0.9 }, 'empty').map; // n6, isolated
    map = addNode(map, { x: 0.6, y: 0.9 }, 'empty').map; // n7
    map = addNode(map, { x: 0.7, y: 0.9 }, 'empty').map; // n8
    map = connect(map, 'n7', 'n8')?.map ?? map; // a separate island
    expect(checkMap(map).map((issue) => issue.message)).toEqual([
      'Negozi: 1. Ne servono almeno 2.',
      'Partenze: 1. Ne servono 2.',
      'Caselle senza percorsi: #6.',
      'Caselle non raggiungibili da una partenza: #7, #8.',
      'Partenze attaccate ad altre caselle: #1–#2. Tra una partenza e qualsiasi casella che ' +
        'non sia di passaggio ci vuole almeno un pallino.',
      // Since spec 034 (D-051): #5 ends the line, #7 and #8 form an island.
      'Vicoli ciechi: #5, #7, #8. Solo una casella personaggio dietro una strada grigia può esserlo.',
    ]);
  });
});

describe('the map rules in the editor (spec 034, 2.4; D-051)', () => {
  /**
   * A ring: start, dot, Character, shop, dot, start, dot, Character, shop,
   * dot (n1-n10), and a grey road from n3 to n11, a Character cell in a
   * dead end.
   */
  function ringMap(): GameMap {
    let map = newMap('Anello');
    const types = ['start', 'empty', 'character', 'shop', 'empty', 'start', 'empty', 'character', 'shop', 'empty'] as const;
    types.forEach((type, index) => {
      map = addNode(map, { x: 0.09 * (index + 1), y: 0.5 }, type).map;
    });
    for (let i = 1; i <= types.length; i++) {
      map = connect(map, `n${i}`, `n${(i % types.length) + 1}`)?.map ?? map;
    }
    map = addNode(map, { x: 0.3, y: 0.8 }, 'character').map; // n11, behind the road
    const road = connect(map, 'n3', 'n11');
    return updateEdge(road?.map ?? map, road?.edgeId ?? '', { locked: true, unlockNodeId: 'n3' });
  }
  const kinds = (map: GameMap) => checkMap(map).map((issue) => issue.kind);

  it('a map that follows the rules has no warnings', () => {
    expect(checkMap(ringMap())).toEqual([]);
  });

  it('a dead end is listed, except a Character cell behind a grey road', () => {
    const map = connect(addNode(ringMap(), { x: 0.5, y: 0.9 }, 'empty').map, 'n2', 'n12')?.map;
    const issue = checkMap(map as GameMap).find((entry) => entry.kind === 'deadEnds');
    expect(issue?.message).toBe('Vicoli ciechi: #12. Solo una casella personaggio dietro una strada grigia può esserlo.');
  });

  it('a grey road without the cell that opens it', () => {
    const map = ringMap();
    const road = map.edges.find((edge) => edge.locked)?.id ?? '';
    expect(kinds(updateEdge(map, road, { unlockNodeId: undefined }))).toEqual(['roadWithoutOpener']);
  });

  it('a grey road that opens from another cell, or from a cell that is not a Character cell', () => {
    const map = ringMap();
    const road = map.edges.find((edge) => edge.locked)?.id ?? '';
    expect(kinds(updateEdge(map, road, { unlockNodeId: 'n8' }))).toEqual(['roadOpenerWrong']);
    expect(kinds(updateNodes(map, ['n3'], { type: 'empty' }))).toEqual(['roadOpenerWrong']);
  });

  it('a grey road that does not lead to a Character cell at the end of a dead end', () => {
    // A dot behind the road is also a dead end.
    const toDot = updateNodes(ringMap(), ['n11'], { type: 'empty' });
    expect(kinds(toDot)).toEqual(['deadEnds', 'roadNotDeadEnd']);
    // A second way in: the cell behind is no longer at the end of a dead end.
    const secondWay = connect(ringMap(), 'n11', 'n8')?.map as GameMap;
    expect(kinds(secondWay)).toEqual(['deadEnds', 'roadNotDeadEnd']);
  });
});

describe('map versions (spec 015)', () => {
  it('suggests the next free version name', () => {
    expect(nextVersionName('Pianeta Nameck', [])).toBe('Pianeta Nameck 2');
    expect(nextVersionName('Nameck 2', ['Nameck', 'Nameck 2'])).toBe('Nameck 3');
    expect(nextVersionName('Nameck', ['Nameck', 'nameck 2', 'Nameck 3'])).toBe('Nameck 4');
    expect(nextVersionName('  ', [])).toBe('Mappa 2');
  });
});

describe('map file (spec 006, criterion 8)', () => {
  it('saved and reloaded it is identical', () => {
    const map = setBackground(smallMap(), {
      image: 'data:image/png;base64,AAAA',
      width: 2000,
      height: 1000,
    });
    expect(parseMap(serializeMap(map))).toEqual(map);
  });

  it('keeps character cells (spec 013, criterion 5)', () => {
    const map = addNode(smallMap(), { x: 0.5, y: 0.5 }, 'character').map;
    expect(parseMap(serializeMap(map)).nodes.at(-1)?.type).toBe('character');
  });

  it('a damaged or unknown file gives a clear error', () => {
    const text = serializeMap(smallMap());
    expect(() => parseMap(text.slice(0, 40))).toThrow(MapFileError);
    expect(() => parseMap(text.slice(0, 40))).toThrow(/danneggiato/);
    expect(() => parseMap('{"format":"arkanite-game"}')).toThrow(/non è una mappa/);
    expect(() => parseMap(text.replace('"version":1', '"version":7'))).toThrow(/versione 7/);
    const broken = JSON.parse(text) as { map: { edges: { to: string }[] } };
    const firstEdge = broken.map.edges[0];
    if (firstEdge) {
      firstEdge.to = 'nowhere';
    }
    expect(() => parseMap(JSON.stringify(broken))).toThrow(/mancano parti della mappa/);
  });
});

describe('editor undo and redo (spec 006, criterion 9)', () => {
  it('undoes and redoes changes; a new change drops redo', () => {
    const empty = newMap();
    const one = addNode(empty, { x: 0.1, y: 0.1 }, 'empty').map;
    const two = addNode(one, { x: 0.2, y: 0.2 }, 'empty').map;
    let history = commit(commit(startHistory(empty), one), two);
    history = undoEdit(history);
    expect(history.present).toBe(one);
    history = redoEdit(history);
    expect(history.present).toBe(two);
    history = commit(undoEdit(history), empty);
    expect(history.future).toEqual([]);
    expect(undoEdit(undoEdit(undoEdit(history))).present).toBe(empty);
  });
});

describe('playing a library map (spec 006, criterion 10)', () => {
  it('starts with empty cells and the board takes the background proportions', () => {
    const map = setBackground(smallMap(), { image: 'data:,', width: 3000, height: 1000 });
    const context = { map, catalog: testCatalog, items: testItems };
    // Spec 025: one proposal each, chosen in the scene.
    const proposals = withProposal(
      withProposal(emptyProposals(), 'p1', 0, { characterId: 'hero-1', powers: [] }),
      'p2',
      0,
      { characterId: 'hero-2', powers: [] },
    );
    const choice = chooseCard(showOther(chooseCard(startChoice('p1'), 0)), 0);
    const game = createGame(buildSetup(defaultNewGameForm(map, proposals), choice, context, {}));
    expect(currentState(game).cells).toEqual({});
    expect(currentState(game).players.p1.position).toBe('n1');
    expect(boardSize(map)).toEqual({ width: 1600, height: 1600 / 3 });
    expect(boardSize(testMap)).toEqual({ width: 1600, height: 900 });
  });
});
