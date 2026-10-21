import { describe, expect, it } from 'vitest';
import { act, createGame, currentState, lastWarnings, undo } from './game';
import { parseGame, serializeGame } from './save';
import {
  activeMissionText,
  missionsOf,
  cellMission,
  defaultMission,
  fightMission,
  MISSION_TYPES,
  looksLikeMission,
  missionLabel,
  missionsDone,
  rewardText,
} from './missions';
import { testCatalog, testContent, testItems, testSetup } from './testMap';
import type { Game, GameAction, Mission } from './types';

function play(game: Game, ...actions: GameAction[]): Game {
  return actions.reduce(act, game);
}

/** The test game with a mission in a cell; char-a sits in c1, char-b in c2, char-c in c3. */
function withMission(nodeId: string, mission: Mission): Game {
  const game = createGame(testSetup());
  const content = { ...currentState(game).cells[nodeId], mission };
  return act(game, { type: 'setCellContent', nodeId, content });
}

const doneIds = (game: Game) => missionsDone(currentState(game)).map((active) => active.nodeId);

describe('missions in the cells (spec 026, 2.1 and criterion 1)', () => {
  it('content prepared before missions reads its format as a fight', () => {
    expect(cellMission(testContent.c2)).toEqual(fightMission('2v2'));
    expect(cellMission({ characterId: 'char-a' })).toBeUndefined();
    expect(missionLabel(fightMission('2v2'), testCatalog)).toBe('Combattimento 2v2');
  });

  it('names every kind of mission for the scene', () => {
    const labels = (
      [
        { type: 'fight', format: '2v2', opponents: ['char-e', 'char-f'], condition: 'transform', reward: {} },
        { type: 'quiz', reward: {} },
        { type: 'goTo', targetId: 'char-a', returnToGiver: true, reward: {} },
        { type: 'defeat', targetId: 'char-b', reward: {} },
        { type: 'bring', targetId: 'char-e', reward: {} },
        { type: 'wait', turns: 3, reward: {} },
        { type: 'skipTurns', turns: 1, reward: {} },
        { type: 'other', text: 'Fai ridere il pubblico', reward: {} },
      ] as Mission[]
    ).map((mission) => missionLabel(mission, testCatalog));
    expect(labels).toEqual([
      'Combattimento 2v2 contro Personaggio E e Personaggio F · deve trasformarsi',
      'Quiz',
      'Missione · Vai da Personaggio A e torna',
      'Missione · Batti Personaggio B',
      'Missione · Porta Personaggio E',
      'Missione · Attendi 3 turni',
      'Missione · Salta 1 turno',
      'Missione · Fai ridere il pubblico',
    ]);
  });

  it('a new mission of each kind starts ready to fill, keeping the reward', () => {
    expect(defaultMission('fight')).toEqual(fightMission('1v1'));
    expect(defaultMission('quiz', { coins: 300 })).toEqual({
      type: 'quiz',
      quiz: { question: '', answers: ['', '', '', ''], correct: 0 },
      reward: { coins: 300 },
    });
    expect(defaultMission('wait').turns).toBe(2);
    expect(defaultMission('skipTurns').turns).toBe(1);
    expect(MISSION_TYPES.map((entry) => looksLikeMission(defaultMission(entry.type)))).not.toContain(false);
  });

  it('describes the reward', () => {
    expect(
      rewardText(
        { cellCharacter: true, characters: ['char-h'], coins: 500, items: ['senzu'] },
        'char-c',
        testCatalog,
        testItems,
      ),
    ).toBe('Personaggio C, Personaggio H, 500 monete, Senzu');
    expect(rewardText({}, 'char-c', testCatalog, testItems)).toBe('');
  });

  it('recognises a mission read from a file, and rejects a damaged one', () => {
    expect(looksLikeMission(fightMission('1v1'))).toBe(true);
    expect(looksLikeMission({ type: 'fly', reward: {} })).toBe(false);
    expect(looksLikeMission({ type: 'wait', turns: '3', reward: {} })).toBe(false);
    expect(looksLikeMission({ type: 'quiz', quiz: { question: 'Chi?', answers: 'A', correct: 0 }, reward: {} })).toBe(false);
    expect(looksLikeMission({ type: 'quiz' })).toBe(false);
  });
});

describe('missions in the saved game (spec 026, criteria 1 and 13)', () => {
  it('cells with missions and missions in progress are saved and reloaded identical', () => {
    let game = withMission('c3', { type: 'wait', turns: 2, reward: { coins: 100, items: ['senzu'] } });
    game = act(game, { type: 'acceptMission', nodeId: 'c3', player: 'p1' });
    expect(parseGame(serializeGame(game))).toEqual(game);
  });

  it('a game saved before missions has none in progress and reads its formats as fights', () => {
    const old = createGame(testSetup());
    const state = currentState(parseGame(serializeGame(old)));
    expect(state.activeMissions).toBeUndefined();
    expect(missionsDone(state)).toEqual([]);
    expect(cellMission(state.cells.c4)).toEqual(fightMission('3v3'));
  });
});

describe('missions in progress and their conditions (spec 026, 2.4)', () => {
  it('Vai da: completed when the pawn reaches the cell of the target (criterion 2)', () => {
    let game = withMission('c3', { type: 'goTo', targetId: 'char-a', reward: { coins: 300 } });
    game = act(game, { type: 'acceptMission', nodeId: 'c3', player: 'p1' });
    expect(doneIds(game)).toEqual([]);
    game = act(game, { type: 'placePawn', player: 'p1', nodeId: 'c1' });
    expect(doneIds(game)).toEqual(['c3']);
  });

  it('Vai da … e torna: only when the pawn comes back after the target (criterion 2)', () => {
    let game = withMission('c3', {
      type: 'goTo',
      targetId: 'char-a',
      returnToGiver: true,
      reward: { coins: 300 },
    });
    game = play(
      game,
      { type: 'acceptMission', nodeId: 'c3', player: 'p1' },
      { type: 'placePawn', player: 'p1', nodeId: 'c3' },
    );
    expect(doneIds(game)).toEqual([]);
    game = act(game, { type: 'placePawn', player: 'p1', nodeId: 'c1' });
    expect(doneIds(game)).toEqual([]);
    const [active] = currentState(game).activeMissions ?? [];
    expect(active && activeMissionText(active, currentState(game), testCatalog)).toBe(
      'Personaggio C: sei stato da Personaggio A, ora torna da Personaggio C',
    );
    game = act(game, { type: 'placePawn', player: 'p1', nodeId: 'c3' });
    expect(doneIds(game)).toEqual(['c3']);
  });

  it('Batti: completed when the player conquers the cell, not the opponent (criterion 3)', () => {
    let game = withMission('c4', { type: 'defeat', targetId: 'char-b', reward: { cellCharacter: true } });
    game = play(
      game,
      { type: 'acceptMission', nodeId: 'c4', player: 'p1' },
      { type: 'setConquest', nodeId: 'c2', player: 'p2' },
    );
    expect(doneIds(game)).toEqual([]);
    game = act(game, { type: 'setConquest', nodeId: 'c2', player: 'p1' });
    expect(doneIds(game)).toEqual(['c4']);
  });

  it('Porta: completed when the character joins the team, bought too, or at once if already there (criterion 4)', () => {
    let game = withMission('c3', { type: 'bring', targetId: 'char-e', reward: { coins: 100 } });
    game = act(game, { type: 'acceptMission', nodeId: 'c3', player: 'p1' });
    expect(doneIds(game)).toEqual([]);
    game = act(game, { type: 'buyCharacter', shopNodeId: 'sh1', characterId: 'char-e' });
    expect(doneIds(game)).toEqual(['c3']);

    let already = withMission('c3', { type: 'bring', targetId: 'char-f', reward: { coins: 100 } });
    already = play(
      already,
      { type: 'addCharacter', player: 'p1', characterId: 'char-f' },
      { type: 'acceptMission', nodeId: 'c3', player: 'p1' },
    );
    expect(doneIds(already)).toEqual(['c3']);
  });

  it("Attendi: after N of the player's own turns, counted from the acceptance (criterion 5)", () => {
    let game = withMission('c3', { type: 'wait', turns: 2, reward: { characters: ['char-h'] } });
    game = play(
      game,
      { type: 'acceptMission', nodeId: 'c3', player: 'p1' },
      { type: 'endTurn' },
      { type: 'endTurn' },
    );
    expect(doneIds(game)).toEqual([]);
    const [active] = currentState(game).activeMissions ?? [];
    expect(active && activeMissionText(active, currentState(game), testCatalog)).toBe(
      'Personaggio C: attendi 2 turni (ne manca 1)',
    );
    game = act(game, { type: 'endTurn' });
    expect(doneIds(game)).toEqual(['c3']);
  });

  it('Salta turni: the turns are marked at once, completed when skipped (criterion 5)', () => {
    let game = withMission('c3', { type: 'skipTurns', turns: 1, reward: { coins: 400 } });
    game = act(game, { type: 'acceptMission', nodeId: 'c3', player: 'p1' });
    expect(currentState(game).players.p1.turnsToSkip).toBe(1);
    game = play(game, { type: 'endTurn' }, { type: 'endTurn' });
    const state = currentState(game);
    expect(state.currentPlayer).toBe('p2');
    expect(state.players.p1.turnsToSkip).toBe(0);
    expect(doneIds(game)).toEqual(['c3']);
  });

  it('fights, quizzes and "other" missions are never detected: the host judges them', () => {
    let game = withMission('c3', { type: 'other', text: 'Canta', reward: { coins: 50 } });
    game = act(game, { type: 'acceptMission', nodeId: 'c3', player: 'p1' });
    expect(doneIds(game)).toEqual([]);
  });

  it("each panel lists the player's own missions in progress", () => {
    let game = withMission('c3', { type: 'defeat', targetId: 'char-b', reward: {} });
    game = play(
      game,
      { type: 'acceptMission', nodeId: 'c3', player: 'p2' },
      { type: 'acceptMission', nodeId: 'c3', player: 'p1' },
    );
    const state = currentState(game);
    expect(missionsOf(state, 'p1', testCatalog)).toEqual([
      { id: 2, nodeId: 'c3', text: 'Personaggio C: batti Personaggio B' },
    ]);
    expect(missionsOf(state, 'p2', testCatalog).map((mission) => mission.id)).toEqual([1]);
  });

  it('accepting the same mission twice gives a warning', () => {
    let game = withMission('c3', { type: 'wait', turns: 2, reward: {} });
    game = play(
      game,
      { type: 'acceptMission', nodeId: 'c3', player: 'p1' },
      { type: 'acceptMission', nodeId: 'c3', player: 'p1' },
    );
    expect(lastWarnings(game).map((warning) => warning.kind)).toEqual(['missionAlreadyActive']);
  });
});

describe('the reward (spec 026, criteria 6 and 8)', () => {
  const mission: Mission = {
    type: 'wait',
    turns: 0,
    reward: { cellCharacter: true, characters: ['char-h'], coins: 500, items: ['senzu'] },
  };

  it('team, coins, inventory and conquest in one action, taken back by one undo', () => {
    let game = withMission('c3', mission);
    game = act(game, { type: 'acceptMission', nodeId: 'c3', player: 'p1' });
    const before = currentState(game);
    game = act(game, { type: 'completeMission', nodeId: 'c3', player: 'p1' });
    const state = currentState(game);
    expect(state.players.p1.team).toEqual(['hero-1', 'char-c', 'char-h']);
    expect(state.players.p1.coins).toBe(500);
    expect(state.players.p1.inventory).toEqual(['senzu']);
    expect(state.conquests.c3).toBe('p1');
    expect(state.activeMissions).toEqual([]);
    expect(state.notifications.map((notification) => notification.text)).toEqual([
      'G1 · Missione completata: Missione · Attendi 0 turni → Personaggio C, Personaggio H, 500 monete, Senzu',
    ]);
    expect(currentState(undo(game))).toEqual(before);
  });

  it('a mission completed by one player leaves the missions of the other, with a warning', () => {
    let game = withMission('c3', mission);
    game = play(
      game,
      { type: 'acceptMission', nodeId: 'c3', player: 'p1' },
      { type: 'acceptMission', nodeId: 'c3', player: 'p2' },
      { type: 'completeMission', nodeId: 'c3', player: 'p2' },
    );
    expect(currentState(game).activeMissions).toEqual([]);
    expect(lastWarnings(game).map((warning) => warning.message)).toContain(
      'Missione di Personaggio C completata da G2: tolta dalle missioni in corso di G1',
    );
  });

  it('a fight from the old format gives the cell character, like "Assegna"', () => {
    let game = createGame(testSetup());
    game = act(game, { type: 'completeMission', nodeId: 'c2', player: 'p2' });
    expect(currentState(game).players.p2.team).toEqual(['hero-2', 'char-b']);
    expect(currentState(game).conquests.c2).toBe('p2');
  });

  it('"Abbandona" takes the mission away, with the turns it still had to skip', () => {
    let game = withMission('c3', { type: 'skipTurns', turns: 2, reward: { coins: 400 } });
    game = act(game, { type: 'acceptMission', nodeId: 'c3', player: 'p1' });
    const [active] = currentState(game).activeMissions ?? [];
    game = act(game, { type: 'abandonMission', missionId: active?.id ?? -1 });
    expect(currentState(game).activeMissions).toEqual([]);
    expect(currentState(game).players.p1.turnsToSkip).toBe(0);
    expect(currentState(game).players.p1.coins).toBe(0);
  });
});
