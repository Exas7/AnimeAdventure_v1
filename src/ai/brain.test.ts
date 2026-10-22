import { describe, expect, it } from 'vitest';
import {
  act,
  cellMission,
  createGame,
  currentState,
  parseGame,
  serializeGame,
  testCatalog,
  testSetup,
  type AiLevel,
  type CellContent,
  type Game,
  type GameAction,
} from '../engine';
import { blockReason, fightResults, quizRewards } from '../phone/arbiter';
import { aiFight, aiStarterIndex, chaseWorthIt, newMemory, nextAiStep, type AiMemory } from './brain';

/** A repeatable random sequence. */
function seeded(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 1103515245 + 12345) % 2147483648;
    return value / 2147483648;
  };
}

const TIERS: Record<string, string> = {
  'hero-1': 'S',
  'hero-2': 'S',
  'char-a': 'C',
  'char-b': 'B',
  'char-c': 'A',
  'char-d': 'B',
  'char-e': 'B',
  'char-f': 'A',
  'char-g': 'C',
  'char-h': 'S',
};

/** The test game, the AI as player 1 so that it plays first; characters with a tier. */
function aiGame(options: { coins?: number; content?: Record<string, CellContent>; tiers?: Record<string, string> } = {}): Game {
  const tiers = { ...TIERS, ...options.tiers };
  const setup = testSetup({ startingCoins: options.coins ?? 0 });
  const game = createGame({
    ...setup,
    catalog: testCatalog.map((character) => ({ ...character, tier: tiers[character.id] })),
    content: { ...setup.content, ...options.content },
  });
  return { ...game, opponent: { player: 'p1', level: 'normal' } };
}

const place = (game: Game, nodeId: string) => act(game, { type: 'placePawn', player: 'p1', nodeId });

/** Plays one step as the phone would; returns the game after it. */
function apply(game: Game, step: ReturnType<typeof nextAiStep>, memory: AiMemory, random: () => number): Game {
  const state = currentState(game);
  const perform = (actions: GameAction[]) => actions.reduce(act, game);
  switch (step.kind) {
    case 'act':
      expect(blockReason(game, step.action)).toBeNull();
      if (step.resolves) memory.resolved.add(step.resolves);
      return act(game, step.action);
    case 'interact':
      expect(blockReason(game, { type: 'interact', nodeId: step.nodeId })).toBeNull();
      return act(game, { type: 'interact', nodeId: step.nodeId });
    case 'quiz':
      memory.resolved.add(step.resolves);
      return perform(quizRewards(cellMission(state.cells[step.nodeId]), step.answer, step.nodeId, state.currentPlayer));
    case 'fight': {
      memory.resolved.add(step.resolves);
      const { record, team } = aiFight(game, state, step.nodeId, step.fighters, random);
      return perform(
        fightResults(record, cellMission(state.cells[step.nodeId]), step.nodeId, state.currentPlayer, team),
      );
    }
    case 'close':
      memory.resolved.add(step.resolves);
      return game;
    case 'end':
      return act(game, { type: 'endTurn' });
  }
}

describe('the AI opponent is saved with the game (spec 053, criterion 1)', () => {
  it('a game saved and read again keeps the AI and its level', () => {
    const game = { ...createGame(testSetup()), opponent: { player: 'p2' as const, level: 'hard' as const } };
    expect(parseGame(serializeGame(game)).opponent).toEqual({ player: 'p2', level: 'hard' });
  });
});

describe('the starter of the AI (spec 053, criterion 2)', () => {
  const proposals = [{ characterId: 'char-a', powers: [] }, { characterId: 'char-h', powers: [] }, { powers: [] }];
  const catalog = testCatalog.map((character) => ({ ...character, tier: TIERS[character.id] }));

  it('Normale and Difficile take the strongest character', () => {
    expect(aiStarterIndex(proposals, catalog, 'normal', () => 0)).toBe(1);
    expect(aiStarterIndex(proposals, catalog, 'hard', () => 0)).toBe(1);
  });

  it('Facile takes one at random among the proposals with a character', () => {
    expect(aiStarterIndex(proposals, catalog, 'easy', () => 0)).toBe(0);
    expect(aiStarterIndex(proposals, catalog, 'easy', () => 0.9)).toBe(1);
  });
});

describe('a turn of the AI (spec 053, criterion 3)', () => {
  it.each<AiLevel>(['easy', 'normal', 'hard'])('%s: every step is allowed and the turn ends within 20 steps', (level) => {
    for (const seed of [1, 2, 3]) {
      const random = seeded(seed);
      let game = aiGame({ coins: 1000 });
      game = { ...game, opponent: { player: 'p1', level } };
      for (let turn = 0; turn < 3; turn += 1) {
        const memory = newMemory();
        const player = currentState(game).currentPlayer;
        let ended = false;
        for (let step = 0; step < 20 && !ended; step += 1) {
          const next = nextAiStep(game, level, random, memory);
          game = apply(game, next, memory, random);
          ended = next.kind === 'end';
        }
        expect(ended).toBe(true);
        // The other player's turn: nothing, straight to the AI's next one.
        if (currentState(game).currentPlayer !== player) {
          game = act(game, { type: 'endTurn' });
        }
      }
    }
  });
});

describe('where the AI goes and what it does there (spec 053, criterion 4)', () => {
  it('moves towards the most convenient cell and meets the character once there', () => {
    const game = aiGame();
    const first = nextAiStep(game, 'normal', seeded(1), newMemory());
    // c1 (Personaggio A, weaker than its team) is two steps away, through n1.
    expect(first).toMatchObject({ kind: 'act', action: { type: 'move', to: 'n1' } });

    const there = place(game, 'c1');
    const meet = nextAiStep(there, 'normal', seeded(1), newMemory());
    expect(meet).toMatchObject({ kind: 'interact', nodeId: 'c1' });

    const memory = newMemory();
    const fight = nextAiStep(act(there, { type: 'interact', nodeId: 'c1' }), 'normal', seeded(1), memory);
    expect(fight).toMatchObject({ kind: 'fight', nodeId: 'c1', fighters: ['hero-1'] });
  });

  it('in a shop buys the strongest character it can pay', () => {
    const game = place(aiGame({ coins: 600 }), 'sh1');
    const step = nextAiStep(game, 'normal', seeded(1), newMemory());
    // Personaggio F (A, 500) rather than Personaggio E (B, 300).
    expect(step).toMatchObject({ kind: 'act', action: { type: 'buyCharacter', characterId: 'char-f' } });
  });

  it('with nothing left to do, ends the turn', () => {
    const game = act(act(aiGame(), { type: 'move', to: 'n1' }), { type: 'move', to: 'c1' });
    expect(nextAiStep(game, 'normal', seeded(1), newMemory())).toMatchObject({ kind: 'end' });
  });
});

describe('the quiz of the AI (spec 053, criterion 5)', () => {
  const quiz: CellContent = {
    characterId: 'char-a',
    mission: {
      type: 'quiz',
      quiz: { question: 'Chi?', answers: ['A', 'B', 'C', 'D'], correct: 2 },
      reward: { coins: 300 },
    },
  };

  it('is right when the draw is under the level, wrong above it', () => {
    const game = act(place(aiGame({ content: { c1: quiz } }), 'c1'), { type: 'interact', nodeId: 'c1' });
    expect(nextAiStep(game, 'normal', () => 0.5, newMemory())).toMatchObject({ kind: 'quiz', answer: 2 });
    const wrong = nextAiStep(game, 'normal', () => 0.75, newMemory());
    expect(wrong.kind).toBe('quiz');
    expect(wrong.kind === 'quiz' && wrong.answer).not.toBe(2);
    // Difficile is right up to 9 times in 10.
    expect(nextAiStep(game, 'hard', () => 0.85, newMemory())).toMatchObject({ kind: 'quiz', answer: 2 });
  });
});

describe('the fights of the AI (spec 053, criterion 6)', () => {
  it('Normale does not fight characters stronger than its own', () => {
    const game = place(aiGame({ tiers: { 'hero-1': 'C', 'char-a': 'SS' } }), 'c1');
    expect(nextAiStep(game, 'normal', seeded(1), newMemory()).kind).not.toBe('interact');
  });

  it('sends its strongest characters on the field', () => {
    const team = act(act(aiGame(), { type: 'addCharacter', player: 'p1', characterId: 'char-e' }), {
      type: 'addCharacter',
      player: 'p1',
      characterId: 'char-g',
    });
    const at = act(place(team, 'c2'), { type: 'interact', nodeId: 'c2' });
    // 2v2: Eroe Uno (S) and Personaggio E (B), not Personaggio G (C).
    expect(nextAiStep(at, 'normal', seeded(1), newMemory())).toMatchObject({
      kind: 'fight',
      fighters: ['hero-1', 'char-e'],
    });
  });
});

describe('missions the AI never takes (spec 053, criterion 7)', () => {
  it('«salta turni» and «Altro»', () => {
    for (const type of ['skipTurns', 'other'] as const) {
      const content: CellContent = { characterId: 'char-a', mission: { type, turns: 2, reward: { coins: 1000 } } };
      const game = place(aiGame({ content: { c1: content } }), 'c1');
      expect(nextAiStep(game, 'normal', seeded(1), newMemory()).kind).not.toBe('interact');
    }
  });
});

describe('the AI and the rules of spec 061 (criterion 5)', () => {
  const add = (game: Game, ids: string[]) =>
    ids.reduce((next, characterId) => act(next, { type: 'addCharacter', player: 'p1', characterId }), game);

  it('does not challenge again a character who beat it', () => {
    const lost = act(place(aiGame(), 'c1'), { type: 'loseChallenge', nodeId: 'c1', player: 'p1' });
    expect(nextAiStep(lost, 'normal', seeded(1), newMemory())).not.toMatchObject({ kind: 'interact', nodeId: 'c1' });
  });

  it('with a full team still goes for its sixth, and not after the swap', () => {
    const full = place(add(aiGame(), ['char-e', 'char-f', 'char-g', 'char-h']), 'c1');
    expect(nextAiStep(full, 'normal', seeded(1), newMemory())).toMatchObject({ kind: 'interact', nodeId: 'c1' });

    const swapped = act(add(full, ['char-b']), { type: 'removeCharacter', player: 'p1', characterId: 'char-b' });
    expect(nextAiStep(swapped, 'normal', seeded(1), newMemory())).not.toMatchObject({ kind: 'interact' });
  });

  it('after the sixth sends away its weakest character, never the starter', () => {
    const six = add(aiGame(), ['char-a', 'char-b', 'char-c', 'char-d', 'char-e']);
    expect(nextAiStep(six, 'normal', seeded(1), newMemory())).toMatchObject({
      kind: 'act',
      action: { type: 'removeCharacter', player: 'p1', characterId: 'char-a' },
    });
  });

  it('chases only with 3 characters more, or a team finished with the swap', () => {
    const state = (game: Game) => currentState(game);
    expect(chaseWorthIt(state(add(aiGame(), ['char-a'])), 'p1', 'p2')).toBe(false);
    expect(chaseWorthIt(state(add(aiGame(), ['char-a', 'char-b', 'char-c'])), 'p1', 'p2')).toBe(true);

    const full = add(aiGame(), ['char-e', 'char-f', 'char-g', 'char-h']);
    const opponent = (game: Game) =>
      ['char-a', 'char-b', 'char-c'].reduce(
        (next, characterId) => act(next, { type: 'addCharacter', player: 'p2', characterId }),
        game,
      );
    expect(chaseWorthIt(state(opponent(full)), 'p1', 'p2')).toBe(false);
    const swapped = act(add(full, ['char-d']), { type: 'removeCharacter', player: 'p1', characterId: 'char-d' });
    expect(chaseWorthIt(state(opponent(swapped)), 'p1', 'p2')).toBe(true);
  });
});
