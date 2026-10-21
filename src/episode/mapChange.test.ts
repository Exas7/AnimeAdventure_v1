import { describe, expect, it } from 'vitest';
import type { GameMap, NodeType } from '../engine';
import { contentAfterMapChange } from './mapChange';

function mapOf(types: Record<string, NodeType>): GameMap {
  return {
    name: 'Prova',
    nodes: Object.entries(types).map(([id, type], index) => ({ id, x: index / 10, y: 0.5, type })),
    edges: [],
  };
}

describe('episode content after a map change (spec 015, criterion 1)', () => {
  it('a Character cell that becomes a passage loses its mission too (spec 034)', () => {
    const withMission = {
      n1: { characterId: 'goku', mission: { type: 'wait' as const, turns: 2, reward: { coins: 100 } } },
    };
    const result = contentAfterMapChange(mapOf({ n1: 'character' }), mapOf({ n1: 'empty' }), withMission);
    expect(result.content.n1).toBeUndefined();
    expect(result.dropped[0]?.lost).toEqual(withMission.n1);
  });

  const before = mapOf({ n1: 'character', n2: 'character', n3: 'shop', n4: 'empty', n5: 'shop' });
  const content = {
    n1: { characterId: 'goku', lines: ['Vinci'] },
    n2: { characterId: 'vegeta' },
    n3: { characterId: 'kaio', forSale: ['nail'] },
    n4: { characterId: 'krilin' }, // saved before D-023
    n5: { characterId: 'roshi', forSale: ['yamcha'] },
  };

  it('a deleted cell loses all its content', () => {
    const after = mapOf({ n2: 'character', n3: 'shop', n4: 'empty', n5: 'shop' });
    const result = contentAfterMapChange(before, after, content);
    expect(result.content.n1).toBeUndefined();
    expect(result.dropped).toEqual([{ nodeId: 'n1', reason: 'deleted', lost: content.n1 }]);
  });

  it('a cell that can no longer hold a character loses it, and its lines with it (spec 034)', () => {
    const after = mapOf({ n1: 'special', n2: 'empty', n3: 'shop', n4: 'empty', n5: 'shop' });
    const result = contentAfterMapChange(before, after, content);
    // Until spec 034 the lines stayed; they belonged to the character and its mission.
    expect(result.content.n1).toBeUndefined();
    expect(result.dropped[0]).toEqual({ nodeId: 'n1', reason: 'type', lost: { characterId: 'goku', lines: ['Vinci'] } });
    expect(result.content.n2).toBeUndefined();
    expect(result.dropped.map((entry) => entry.nodeId)).toEqual(['n1', 'n2']);
  });

  it('shops keep keeper and list; a shop that becomes a character cell keeps only the character', () => {
    const after = mapOf({ n1: 'shop', n2: 'character', n3: 'shop', n4: 'empty', n5: 'character' });
    const result = contentAfterMapChange(before, after, content);
    // A Character cell that becomes a shop keeps the character as shopkeeper,
    // but not the lines of its mission (spec 034).
    expect(result.content.n1).toEqual({ characterId: 'goku' });
    expect(result.content.n3).toEqual(content.n3);
    expect(result.content.n5).toEqual({ characterId: 'roshi' });
    expect(result.dropped).toEqual([
      { nodeId: 'n1', reason: 'type', lost: { lines: ['Vinci'] } },
      { nodeId: 'n5', reason: 'type', lost: { forSale: ['yamcha'] } },
    ]);
  });

  it('cells that did not change type keep everything, also data saved before D-023', () => {
    const after = { ...before, nodes: before.nodes.map((node) => ({ ...node, x: node.x + 0.01 })) };
    expect(contentAfterMapChange(before, after, content)).toEqual({ content, dropped: [] });
  });
});
