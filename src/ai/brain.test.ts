import { describe, expect, it } from 'vitest';
import {
  act,
  cellMission,
  createGame,
  currentState,
  parseGame,
  serializeGame,
  powerCatalog,
  testCatalog,
  testItems,
  testSetup,
  type AiLevel,
  type PowerDefinition,
  type CellContent,
  type Character,
  type Game,
  type GameAction,
  type GameMap,
} from '../engine';
import { blockReason, fightResults, quizRewards } from '../phone/arbiter';
import {
  aiFight,
  aiShowdownOrder,
  aiStarterIndex,
  chaseWorthIt,
  newMemory,
  nextAiStep,
  nextTurnMemory,
  swapsTo,
  type AiMemory,
} from './brain';

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

/** The test game, the AI as player 1 so that it plays first; characters with a tier, and the henchman of team fights (spec 069). */
function aiGame(options: { coins?: number; content?: Record<string, CellContent>; tiers?: Record<string, string> } = {}): Game {
  const tiers = { ...TIERS, ...options.tiers };
  const setup = testSetup({ startingCoins: options.coins ?? 0 });
  const game = createGame({
    ...setup,
    catalog: [
      ...testCatalog.map((character) => ({ ...character, tier: tiers[character.id] })),
      { id: 'saibaiman', name: 'Saibaiman', tier: 'D', villain: true },
    ],
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

  it('finds the true Lisa only once in four, at any level (spec 074, 2.4)', () => {
    const lisa: CellContent = {
      characterId: 'char-a',
      mission: {
        type: 'quiz',
        quiz: { question: 'Trova la mia vera Lisa', answers: ['Lisa', 'Lisa', 'Lisa', 'Lisa'], correct: 0 },
        reward: { coins: 1500 },
      },
    };
    const game = act(place(aiGame({ content: { c1: lisa } }), 'c1'), { type: 'interact', nodeId: 'c1' });
    const right = currentState(game).cells.c1?.mission?.quiz?.correct;
    expect(nextAiStep(game, 'hard', () => 0.2, newMemory())).toMatchObject({ kind: 'quiz', answer: right });
    const wrong = nextAiStep(game, 'hard', () => 0.3, newMemory());
    expect(wrong.kind === 'quiz' && wrong.answer).not.toBe(right);
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

describe('the AI uses its powers when they pay (spec 063, criterion 4)', () => {
  const withPowers = (powers: PowerDefinition[], coins = 0): Game => {
    const game = aiGame({ coins });
    const state = currentState(game);
    const p1 = { ...state.players.p1, powers: powers.map((definition, index) => ({ id: `p1-${index}`, definition, usesLeft: definition.trigger.type === 'manual' ? definition.trigger.uses : null })) };
    const entry = { ...game.history[0]!, state: { ...state, players: { ...state.players, p1 } } };
    return { ...game, history: [entry] };
  };

  it('retries a lost challenge with «Ritenta», then meets the character again', () => {
    const lost = act(act(place(withPowers([powerCatalog.retryLostChallenge(2)]), 'c1'), { type: 'interact', nodeId: 'c1' }), {
      type: 'loseChallenge',
      nodeId: 'c1',
      player: 'p1',
    });
    const memory = newMemory();
    memory.resolved.add('cell:c1');
    const step = nextAiStep(lost, 'normal', seeded(1), memory);
    expect(step).toMatchObject({ kind: 'act', action: { type: 'usePower', powerId: 'p1-0' }, reopens: 'cell:c1' });
  });

  it('uses «Doppio movimento» only when it takes it to its goal in this turn', () => {
    const game = withPowers([powerCatalog.extraActionsOnDemand(2, 2, 'Doppio movimento')]);
    // c1 is two steps away and needs an action to meet Personaggio A: 3 actions, 2 left.
    expect(nextAiStep(game, 'normal', seeded(1), newMemory())).toMatchObject({
      kind: 'act',
      action: { type: 'usePower', powerId: 'p1-0' },
    });
    const near = place(game, 'n1');
    expect(nextAiStep(near, 'normal', seeded(1), newMemory())).toMatchObject({ kind: 'act', action: { type: 'move' } });
  });

  it('uses «Doppia azione» for a second interaction within reach, «Doppio movimento» not (spec 067, criterion 3)', () => {
    // At n1, after meeting someone there: no interaction left, Personaggio A in c1 one step away.
    const met = (power: PowerDefinition) => {
      const game = place(withPowers([power]), 'n1');
      const state = currentState(game);
      const actions = { ...state.actions, used: 1, interactionsUsed: 1 };
      return { ...game, history: [{ ...game.history[0]!, state: { ...state, actions } }] };
    };
    expect(nextAiStep(met(powerCatalog.doubleActionOnDemand(2)), 'normal', seeded(1), newMemory())).toMatchObject({
      kind: 'act',
      action: { type: 'usePower', powerId: 'p1-0' },
    });
    expect(
      nextAiStep(met(powerCatalog.extraActionsOnDemand(2, 2, 'Doppio movimento')), 'normal', seeded(1), newMemory()),
    ).not.toMatchObject({ action: { type: 'usePower' } });
  });

  it('uses «Salta turno» when the opponent is about to complete the team, not before', () => {
    const game = withPowers([powerCatalog.skipOpponentTurn(2)]);
    expect(nextAiStep(game, 'normal', seeded(1), newMemory())).not.toMatchObject({ action: { type: 'usePower' } });
    const close = ['char-e', 'char-f', 'char-g'].reduce(
      (next, characterId) => act(next, { type: 'addCharacter', player: 'p2', characterId }),
      game,
    );
    expect(nextAiStep(close, 'normal', seeded(1), newMemory())).toMatchObject({
      kind: 'act',
      action: { type: 'usePower', powerId: 'p1-0' },
    });
  });

  it('buys a Senzu when it pays the extra starting coins again', () => {
    // The Senzu costs 1,000 and so many coins it has; the characters of sh2 cost more.
    let game = place(withPowers([powerCatalog.extraStartingCoins(1500)], 1000), 'sh2');
    for (const characterId of ['char-g', 'char-h']) {
      game = act(game, { type: 'setCharacterPrice', characterId, price: 1500 });
    }
    expect(nextAiStep(game, 'normal', seeded(1), newMemory())).toMatchObject({
      kind: 'act',
      action: { type: 'buyItem', itemId: 'senzu' },
    });
  });
});

describe('the AI fuses (spec 068, criterion 4)', () => {
  it('fuses a pair of its team into the strongest fusion it may take', () => {
    const pair: Character[] = [
      { id: 'son-goku-fine-ssj', name: 'Son Goku (fine) SSJ', person: 'Son Goku (fine)', tier: 'A+' },
      { id: 'vegeta-seconda-forma-ssj', name: 'Vegeta (seconda forma) SSJ', person: 'Vegeta (seconda forma)', tier: 'A+' },
      { id: 'super-vegetto', name: 'Super Vegetto', person: 'Vegetto', tier: 'SS+', price: 3900 },
      { id: 'super-gogeta', name: 'Super Gogeta', person: 'Super Gogeta', tier: 'SS+', price: 3800 },
    ];
    const base = aiGame();
    const withPair = { ...base, catalog: [...base.catalog, ...pair] };
    const game = ['son-goku-fine-ssj', 'vegeta-seconda-forma-ssj'].reduce(
      (next, characterId) => act(next, { type: 'addCharacter', player: 'p1', characterId }),
      withPair,
    );
    expect(nextAiStep(game, 'normal', seeded(1), newMemory())).toMatchObject({
      kind: 'act',
      action: { type: 'fuse', player: 'p1', members: ['son-goku-fine-ssj', 'vegeta-seconda-forma-ssj'], resultId: 'super-vegetto' },
    });
  });
});

describe('a smarter AI that follows the rules (spec 093)', () => {
  /** The test map with only these cells filled: the shops sell nothing unless told. */
  const bare = (content: Record<string, CellContent>, level: AiLevel = 'hard', coins = 0): Game => {
    const setup = testSetup({ startingCoins: coins });
    const game = createGame({
      ...setup,
      catalog: [
        ...testCatalog.map((character) => ({ ...character, tier: TIERS[character.id] })),
        { id: 'saibaiman', name: 'Saibaiman', tier: 'D', villain: true },
      ],
      content: {
        sh1: { characterId: 'keeper-1', forSale: [] },
        sh2: { characterId: 'keeper-2', forSale: [] },
        ...content,
      },
    });
    return { ...game, opponent: { player: 'p1', level } };
  };
  const quiz = (coins: number, characterId = 'char-c'): CellContent => ({
    characterId,
    lines: ['?'],
    mission: { type: 'quiz', quiz: { question: '?', answers: ['a', 'b', 'c'], correct: 0 }, reward: { coins } },
  });
  const mission = (
    characterId: string,
    type: 'goTo' | 'defeat' | 'bring' | 'escort',
    targetId: string,
    coins: number,
  ): CellContent => ({ characterId, lines: ['!'], mission: { type, targetId, reward: { coins } } });
  const add = (game: Game, player: 'p1' | 'p2', ids: string[]) =>
    ids.reduce((next, characterId) => act(next, { type: 'addCharacter', player, characterId }), game);
  /** The human's turn (G2): these actions, then the AI plays again. */
  const humanTurn = (game: Game, actions: GameAction[]) =>
    act(actions.reduce(act, act(game, { type: 'endTurn' })), { type: 'endTurn' });
  /** The AI meets and accepts the mission of a cell, then a new turn starts. */
  const accepted = (game: Game, nodeId: string) =>
    humanTurn(
      act(act(place(game, nodeId), { type: 'interact', nodeId }), { type: 'acceptMission', nodeId, player: 'p1' }),
      [],
    );
  /** AI turns as the phone plays them, the memory going on from turn to turn: every step it took. */
  const play = (start: Game, turns: number, level: AiLevel = 'hard') => {
    const random = seeded(1);
    let game = start;
    let memory = newMemory();
    const steps: ReturnType<typeof nextAiStep>[] = [];
    for (let turn = 0; turn < turns; turn += 1) {
      memory = nextTurnMemory(memory);
      for (let count = 0; count < 20; count += 1) {
        const step = nextAiStep(game, level, random, memory);
        steps.push(step);
        game = apply(game, step, memory, random);
        if (step.kind === 'end') {
          break;
        }
      }
      if (currentState(game).currentPlayer === 'p2') {
        game = act(game, { type: 'endTurn' });
      }
    }
    return steps;
  };
  const movesOf = (steps: ReturnType<typeof nextAiStep>[]) =>
    steps.flatMap((step) => (step.kind === 'act' && step.action.type === 'move' ? [step.action.to] : []));
  /** The pawn after meeting someone: one action and the interaction of the turn used. */
  const spent = (game: Game) => {
    const state = currentState(game);
    const actions = { ...state.actions, used: 1, interactionsUsed: 1 };
    return { ...game, history: [{ ...game.history[0]!, state: { ...state, actions } }] };
  };

  it('does not head for a character travelling with the opponent (criterion 1, the case of Baba)', () => {
    // c2 gives an «Accompagnami da» for 800 coins, which G2 accepted: Personaggio B travels with G2.
    const game = humanTurn(bare({ c2: mission('char-b', 'escort', 'char-h', 800), c3: quiz(300) }), [
      { type: 'placePawn', player: 'p2', nodeId: 'c2' },
      { type: 'interact', nodeId: 'c2' },
      { type: 'acceptMission', nodeId: 'c2', player: 'p2' },
      { type: 'placePawn', player: 'p2', nodeId: 's2' },
    ]);
    const steps = play(game, 4);
    expect(movesOf(steps)).not.toContain('c2');
    expect(steps).toContainEqual(expect.objectContaining({ kind: 'interact', nodeId: 'c3' }));
  });

  it('does not head for a second «Accompagnami da» while it has a companion (criterion 2)', () => {
    const game = bare({
      c2: mission('char-b', 'escort', 'char-h', 800),
      c4: mission('char-d', 'escort', 'char-h', 800),
      c3: quiz(300),
    });
    const steps = play(accepted(game, 'c2'), 4);
    expect(steps).not.toContainEqual(expect.objectContaining({ kind: 'interact', nodeId: 'c4' }));
    expect(steps).toContainEqual(expect.objectContaining({ kind: 'interact', nodeId: 'c3' }));
  });

  it("chasing, stops on the opponent's cell with actions left; losing, keeps off it (criterion 3)", () => {
    // Four characters against one: Difficile chases G2, who stands on c4 next to it.
    const strong = add(bare({ c3: quiz(300) }), 'p1', ['char-h', 'char-c', 'char-f']);
    const chasing = place(humanTurn(strong, [{ type: 'placePawn', player: 'p2', nodeId: 'c4' }]), 'n3');
    const memory = newMemory();
    const first = nextAiStep(chasing, 'hard', seeded(1), memory);
    expect(first).toMatchObject({ kind: 'act', action: { type: 'move', to: 'c4' } });
    const caught = apply(chasing, first, memory, seeded(1));
    expect(currentState(caught).actions.used).toBe(1);
    expect(nextAiStep(caught, 'hard', seeded(1), memory)).toMatchObject({ kind: 'end' });

    // One against four: the quiz is on G2's cell, and the AI keeps off it.
    const weak = add(bare({ c4: quiz(300) }), 'p2', ['char-h', 'char-c', 'char-f']);
    const avoiding = place(humanTurn(weak, [{ type: 'placePawn', player: 'p2', nodeId: 'c4' }]), 'n3');
    expect(movesOf(play(avoiding, 2))).not.toContain('c4');
  });

  it('on a cell it wants, with no interaction left, waits there and meets the character next turn (criterion 4)', () => {
    // On c3 after meeting someone: the quiz of c4 is two steps away, worth less.
    const game = spent(place(bare({ c3: quiz(300), c4: quiz(200, 'char-d') }, 'normal'), 'c3'));
    const memory = newMemory();
    expect(nextAiStep(game, 'normal', seeded(1), memory)).toMatchObject({ kind: 'end' });
    const next = humanTurn(game, []);
    expect(nextAiStep(next, 'normal', seeded(1), nextTurnMemory(memory))).toMatchObject({
      kind: 'interact',
      nodeId: 'c3',
    });
  });

  it('keeps its estimates and its goal from one turn to the next (criterion 5)', () => {
    const memory = newMemory();
    nextAiStep(bare({ c3: quiz(300) }), 'hard', seeded(1), memory);
    const next = nextTurnMemory(memory);
    expect([...next.chances.keys()].some((key) => key.startsWith('showdown:'))).toBe(true);
    expect(next.chances).toBe(memory.chances);
    expect(next.resolved.size).toBe(0);

    // Two quizzes one step away: it heads for c3; a little more on c4 does not change its mind.
    const goal = newMemory();
    const even = place(bare({ c3: quiz(300), c4: quiz(300, 'char-d') }, 'normal'), 'n3');
    expect(nextAiStep(even, 'normal', seeded(1), goal)).toMatchObject({ action: { type: 'move', to: 'c3' } });
    const richer = place(bare({ c3: quiz(300), c4: quiz(400, 'char-d') }, 'normal'), 'n3');
    expect(nextAiStep(richer, 'normal', seeded(1), nextTurnMemory(goal))).toMatchObject({
      action: { type: 'move', to: 'c3' },
    });
    expect(nextAiStep(richer, 'normal', seeded(1), newMemory())).toMatchObject({ action: { type: 'move', to: 'c4' } });
  });

  it('goes to beat whom «Batti» asks for (criterion 6)', () => {
    // c2: a weak fight for 100 coins; c1 asks to beat Personaggio A there for 1,000; c3: a quiz.
    const weakFight: CellContent = {
      characterId: 'char-a',
      lines: ['!'],
      mission: { type: 'fight', format: '1v1', reward: { coins: 100 } },
    };
    const game = bare({ c1: mission('char-g', 'defeat', 'char-a', 1000), c2: weakFight, c3: quiz(300) }, 'normal');
    expect(nextAiStep(game, 'normal', seeded(1), newMemory())).toMatchObject({ action: { type: 'move', to: 'n1' } });
    const taken = place(accepted(game, 'c1'), 's1');
    expect(nextAiStep(taken, 'normal', seeded(1), newMemory())).toMatchObject({ action: { type: 'move', to: 'n2' } });
  });

  it('buys whom «Porta» asks for (criterion 6)', () => {
    const shop = { characterId: 'keeper-1', forSale: ['char-e', 'char-f'] };
    const game = bare({ c1: mission('char-g', 'bring', 'char-e', 1000), sh1: shop }, 'normal', 1000);
    // Without the mission the strongest it can pay: Personaggio F (A) rather than Personaggio E (B).
    expect(nextAiStep(place(game, 'sh1'), 'normal', seeded(1), newMemory())).toMatchObject({
      action: { type: 'buyCharacter', characterId: 'char-f' },
    });
    expect(nextAiStep(place(accepted(game, 'c1'), 'sh1'), 'normal', seeded(1), newMemory())).toMatchObject({
      action: { type: 'buyCharacter', characterId: 'char-e' },
    });
  });

  it('does not take a mission it cannot finish (criterion 6)', () => {
    // Personaggio H is nowhere on the map; Personaggio C is on c3.
    const nowhere = place(bare({ c1: mission('char-g', 'goTo', 'char-h', 1000) }, 'normal'), 'c1');
    expect(nextAiStep(nowhere, 'normal', seeded(1), newMemory())).not.toMatchObject({ kind: 'interact' });
    const there = place(bare({ c1: mission('char-g', 'goTo', 'char-c', 1000), c3: quiz(300) }, 'normal'), 'c1');
    expect(nextAiStep(there, 'normal', seeded(1), newMemory())).toMatchObject({ kind: 'interact', nodeId: 'c1' });
  });

  it('Difficile leaves a cell the opponent reaches first, when it has another one (criterion 7)', () => {
    // The quiz of c4 is worth more, but G2 stands next to it on n5; the one of c2 is the AI's.
    const game = humanTurn(bare({ c4: quiz(1000, 'char-d'), c2: quiz(300) }), [
      { type: 'placePawn', player: 'p2', nodeId: 'n5' },
    ]);
    const normal: Game = { ...game, opponent: { player: 'p1', level: 'normal' } };
    expect(nextAiStep(normal, 'normal', seeded(1), newMemory())).toMatchObject({ action: { type: 'move', to: 'n1' } });
    expect(nextAiStep(game, 'hard', seeded(1), newMemory())).toMatchObject({ action: { type: 'move', to: 'n2' } });
  });

  it('takes an order for the showdown with swaps of the team (criterion 8)', () => {
    expect(swapsTo(['a', 'b', 'c', 'd'], ['c', 'a', 'd', 'b'])).toEqual([
      { a: 0, b: 2 },
      { a: 1, b: 2 },
      { a: 2, b: 3 },
    ]);
    expect(swapsTo(['a', 'b'], ['a', 'b'])).toEqual([]);
    // With a team of one there is nothing to choose.
    expect(aiShowdownOrder(bare({}), 'p1', seeded(1))).toBeNull();

    const game = add(add(bare({}), 'p1', ['char-a', 'char-h', 'char-c']), 'p2', ['char-f', 'char-d']);
    const team = currentState(game).players.p1.team;
    for (const seed of [1, 2, 3]) {
      const order = aiShowdownOrder(game, 'p1', seeded(seed)) ?? team;
      expect([...order].sort()).toEqual([...team].sort());
      const swapped = swapsTo(team, order).reduce(
        (next, { a, b }) => act(next, { type: 'swapTeam', player: 'p1', a, b }),
        game,
      );
      expect(currentState(swapped).players.p1.team).toEqual(order);
    }
  });

  /** A line of cells, s1 – sh – a – b – c – d – e – q, with s2 next to s1: q is 7 paths from s1, 6 from the shop. */
  const line = (q: number | CellContent, coins: number): Game => {
    const ids = ['s1', 'sh', 'a', 'b', 'c', 'd', 'e', 'q'];
    const type = (id: string) => (id === 's1' || id === 's2' ? 'start' : id === 'sh' ? 'shop' : 'empty');
    const map: GameMap = {
      name: 'Linea',
      nodes: [...ids, 's2'].map((id, index) => ({ id, x: index / 10, y: 0.5, type: type(id) })),
      edges: [
        ...ids
          .slice(1)
          .map((id, index) => ({ id: `e${index}`, from: ids[index] as string, to: id, curve: [], locked: false })),
        { id: 'e-s2', from: 's1', to: 's2', curve: [], locked: false },
      ],
    };
    const setup = testSetup({ startingCoins: coins });
    const game = createGame({
      ...setup,
      map,
      items: testItems,
      catalog: testCatalog.map((character) => ({ ...character, tier: TIERS[character.id] })),
      content: { sh: { characterId: 'keeper-1', forSale: [] }, q: typeof q === 'number' ? quiz(q) : q },
      players: {
        p1: { ...setup.players.p1, startNodeId: 's1' },
        p2: { ...setup.players.p2, startNodeId: 's2' },
      },
    });
    return { ...game, opponent: { player: 'p1', level: 'hard' } };
  };
  const withNimbus = (game: Game) => act(game, { type: 'buyItem', shopNodeId: 'sh', itemId: 'flying-nimbus' });

  describe('Difficile and the trips (criterion 9)', () => {
    it("uses Nuvola Speedy for a useful cell far away, never for the opponent's cell", () => {
      const game = withNimbus(line(2000, 1000));
      expect(nextAiStep(game, 'hard', seeded(1), newMemory())).toMatchObject({
        kind: 'act',
        action: { type: 'useItem', itemId: 'flying-nimbus', to: 'q' },
      });
      const occupied = humanTurn(game, [{ type: 'placePawn', player: 'p2', nodeId: 'q' }]);
      expect(nextAiStep(occupied, 'hard', seeded(1), newMemory())).not.toMatchObject({
        action: { type: 'useItem' },
      });
    });

    it('buys a trip only when a far cell is worth it, and one at a time', () => {
      expect(nextAiStep(place(line(2000, 1000), 'sh'), 'hard', seeded(1), newMemory())).toMatchObject({
        kind: 'act',
        action: { type: 'buyItem', itemId: 'flying-nimbus' },
      });
      // 450 coins expected from the quiz: less than the 750 of the Nuvola.
      expect(nextAiStep(place(line(500, 1000), 'sh'), 'hard', seeded(1), newMemory())).not.toMatchObject({
        action: { type: 'buyItem' },
      });
      expect(nextAiStep(place(withNimbus(line(2000, 2000)), 'sh'), 'hard', seeded(1), newMemory())).not.toMatchObject({
        action: { type: 'buyItem' },
      });
    });
  });

  describe('the chase goes straight (spec 094)', () => {
    /** The characters of the game with these tiers. */
    const tiered = (game: Game, tiers: Record<string, string>): Game => ({
      ...game,
      catalog: game.catalog.map((character) => ({ ...character, tier: tiers[character.id] ?? character.tier })),
    });
    /** A quiz whose reward is the character of the cell. */
    const joins = (characterId: string): CellContent => ({
      characterId,
      lines: ['?'],
      mission: {
        type: 'quiz',
        quiz: { question: '?', answers: ['a', 'b', 'c'], correct: 0 },
        reward: { cellCharacter: true },
      },
    });
    /**
     * Four against one: Difficile chases G2, five paths away on s2. The AI
     * stands on n1, next to c1, which is off the way: its path to n3 is closed.
     */
    const chasing = (content: Record<string, CellContent>, tiers: Record<string, string> = {}, at = 'n1') =>
      place(add(tiered(bare(content), tiers), 'p1', ['char-h', 'char-c', 'char-f']), at);
    /** c1 gives 2000 coins; Personaggio D, an SS, is on sale in sh2 at this price. */
    const coinsForSS = (price: number) =>
      act(chasing({ c1: quiz(2000, 'char-g'), sh2: { characterId: 'keeper-2', forSale: ['char-d'] } }, { 'char-d': 'SS' }), {
        type: 'setCharacterPrice',
        characterId: 'char-d',
        price,
      });
    const first = (game: Game) => nextAiStep(game, 'hard', seeded(1), newMemory());

    it('goes for the opponent, not for a character under an SS off the way (criterion 1)', () => {
      expect(first(chasing({ c1: joins('char-d') }, { 'char-d': 'S' }))).toMatchObject({
        kind: 'act',
        action: { type: 'move', to: 'sh1' },
      });
    });

    it('on a cell along the way, does not meet the character for a reward under an SS (criterion 2)', () => {
      expect(first(chasing({ c2: quiz(2000, 'char-g') }, {}, 'c2'))).toMatchObject({
        kind: 'act',
        action: { type: 'move', to: 'n3' },
      });
    });

    it('turns aside for an SS and meets it (criterion 3)', () => {
      const steps = play(chasing({ c1: joins('char-d') }, { 'char-d': 'SS' }), 1);
      expect(movesOf(steps)[0]).toBe('c1');
      expect(steps).toContainEqual(expect.objectContaining({ kind: 'interact', nodeId: 'c1' }));
    });

    it('turns aside for coins that buy an SS on sale on the map, not for fewer (criterion 4)', () => {
      expect(first(coinsForSS(1200))).toMatchObject({
        action: { type: 'move', to: 'c1' },
      });
      expect(first(coinsForSS(2400))).toMatchObject({
        action: { type: 'move', to: 'sh1' },
      });
    });

    it('with its team finished, nothing stops it (criterion 5)', () => {
      const full = add(coinsForSS(1200), 'p1', ['char-e', 'char-b']);
      const finished = act(full, { type: 'removeCharacter', player: 'p1', characterId: 'char-b' });
      expect(first(finished)).toMatchObject({ action: { type: 'move', to: 'sh1' } });
    });

    it('with less than 3 characters more it does not chase, and turns aside as before (criterion 6)', () => {
      const game = place(add(tiered(bare({ c1: joins('char-d') }), { 'char-d': 'S' }), 'p1', ['char-h']), 'n1');
      expect(first(game)).toMatchObject({ action: { type: 'move', to: 'c1' } });
    });

    it("on the opponent's cell still meets the character there", () => {
      const game = humanTurn(chasing({ c2: quiz(2000, 'char-g') }, {}, 'c2'), [{ type: 'placePawn', player: 'p2', nodeId: 'c2' }]);
      expect(first(game)).toMatchObject({ kind: 'interact', nodeId: 'c2' });
    });

    it('buys a trip only for a cell with an SS (criterion 7)', () => {
      const chase = (game: Game) => place(add(game, 'p1', ['char-h', 'char-c', 'char-f']), 'sh');
      expect(first(chase(line(2000, 1000)))).not.toMatchObject({ action: { type: 'buyItem' } });
      expect(first(chase(tiered(line(joins('char-d'), 1000), { 'char-d': 'SS' })))).toMatchObject({
        action: { type: 'buyItem', itemId: 'flying-nimbus' },
      });
    });

    /** In their last turn G2 walked from n4 to c3, so these cells: the AI chases from `at`. */
    const walked = (content: Record<string, CellContent>, at: string) =>
      humanTurn(humanTurn(chasing(content, {}, at), [{ type: 'placePawn', player: 'p2', nodeId: 'n4' }]), [
        { type: 'move', to: 'c3' },
      ]);
    /** c2, worth 2000 coins to G2, is two paths ahead of them: c3 – n3 – c2. */
    const heading = (at: string) => walked({ c2: quiz(2000, 'char-g') }, at);

    it("cuts off the opponent's way instead of running after them (criterion 10)", () => {
      // From s1, G2 on c3 is 4 paths away; c2, where G2 ends the next turn, only 2.
      expect(first(heading('s1'))).toMatchObject({
        kind: 'act',
        action: { type: 'move', to: 'n2' },
        text: 'Taglia la strada a G2',
      });
      expect(movesOf(play(heading('s1'), 1))).toEqual(['n2', 'c2']);
    });

    it('goes straight to the opponent who skips the next turn (criterion 11)', () => {
      const skipping = act(heading('s1'), { type: 'setTurnsToSkip', player: 'p2', turns: 1 });
      expect(first(skipping)).toMatchObject({ kind: 'act', action: { type: 'move' }, text: 'Insegue G2' });
    });

    it('goes where the opponent is when they did not move, no cell is worth it to them, or theirs is where they stand (criterion 12)', () => {
      expect(first(humanTurn(heading('s1'), []))).toMatchObject({ kind: 'act', text: 'Insegue G2' });
      expect(first(walked({}, 's1'))).toMatchObject({ kind: 'act', text: 'Insegue G2' });
      const staying = walked({ c2: quiz(2000, 'char-g'), c3: quiz(2000, 'char-a') }, 's1');
      expect(first(staying)).toMatchObject({ kind: 'act', text: 'Insegue G2' });
    });

    it('once on the way before the opponent, waits for them there (criterion 13)', () => {
      // From n2 it gets to c2 with one action; G2 on c3 is two paths further.
      const steps = play(heading('n2'), 1);
      expect(movesOf(steps)).toEqual(['c2']);
      expect(steps.at(-1)).toMatchObject({ kind: 'end' });
    });
  });
});
