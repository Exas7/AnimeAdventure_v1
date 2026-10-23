import { describe, expect, it } from 'vitest';
import { act, createGame, currentState, lastWarnings, undo } from './game';
import { parseGame, serializeGame } from './save';
import {
  activeMissionParts,
  activeMissionText,
  awayCells,
  companionOf,
  missionsOf,
  cellMission,
  defaultMission,
  fightMission,
  isLottery,
  lotteryDraw,
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

  it('Attendi stops the player like Salta turni: the turns pass by themselves (spec 078, criteria 1 and 2)', () => {
    let game = withMission('c3', { type: 'wait', turns: 2, reward: { coins: 900 } });
    game = act(game, { type: 'acceptMission', nodeId: 'c3', player: 'p1' });
    expect(currentState(game).players.p1.turnsToSkip).toBe(2);
    expect(doneIds(game)).toEqual([]);
    // p1 ends the turn; p2 plays and ends: p1 is skipped once; p2 ends again: p1 is skipped twice.
    game = play(game, { type: 'endTurn' }, { type: 'endTurn' });
    expect(currentState(game).currentPlayer).toBe('p2');
    expect(doneIds(game)).toEqual([]);
    game = act(game, { type: 'endTurn' });
    const state = currentState(game);
    expect(state.currentPlayer).toBe('p2');
    expect(state.players.p1.turnsToSkip).toBe(0);
    expect(doneIds(game)).toEqual(['c3']);
    game = act(game, { type: 'endTurn' });
    expect(currentState(game).currentPlayer).toBe('p1');
  });

  it('Attendi: «Abbandona» gives back the turns not yet skipped (spec 078, criterion 3)', () => {
    let game = withMission('c3', { type: 'wait', turns: 3, reward: {} });
    game = play(game, { type: 'acceptMission', nodeId: 'c3', player: 'p1' }, { type: 'endTurn' }, { type: 'endTurn' });
    expect(currentState(game).players.p1.turnsToSkip).toBe(2);
    const [active] = currentState(game).activeMissions ?? [];
    game = act(game, { type: 'abandonMission', missionId: active?.id ?? 0 });
    expect(currentState(game).players.p1.turnsToSkip).toBe(0);
  });

  it('an Attendi accepted before spec 078 keeps the old rule: played turns, nothing skipped (criterion 5)', () => {
    let game = withMission('c3', { type: 'wait', turns: 2, reward: {} });
    game = act(game, { type: 'acceptMission', nodeId: 'c3', player: 'p1' });
    const old = structuredClone(currentState(game));
    old.players.p1.turnsToSkip = 0;
    for (const active of old.activeMissions ?? []) {
      delete active.turnsToSkipLeft;
    }
    expect(missionsDone(old)).toEqual([]);
    old.players.p1.turnsPlayed += 2;
    expect(missionsDone(old).map((active) => active.nodeId)).toEqual(['c3']);
  });

  it('Ripassa: nobody is stopped, and the reward comes back on the cell after the turns (spec 084, criteria 1-4)', () => {
    let game = withMission('c3', { type: 'comeBack', turns: 2, reward: { coins: 900 } });
    game = act(game, { type: 'acceptMission', nodeId: 'c3', player: 'p1' });
    expect(currentState(game).players.p1.turnsToSkip).toBe(0);
    // On the cell at once: the turns have not passed.
    game = act(game, { type: 'placePawn', player: 'p1', nodeId: 'c3' });
    expect(doneIds(game)).toEqual([]);
    // Two turns of p1 pass, nobody is skipped.
    game = play(game, { type: 'endTurn' }, { type: 'endTurn' }, { type: 'endTurn' });
    const state = currentState(game);
    expect(state.currentPlayer).toBe('p2');
    expect(state.players.p1.turnsPlayed).toBe(2);
    // The turns passed, but p1 went away from the cell: not yet.
    game = act(game, { type: 'placePawn', player: 'p1', nodeId: 'c1' });
    expect(doneIds(game)).toEqual([]);
    const [active] = currentState(game).activeMissions ?? [];
    expect(active && activeMissionText(active, currentState(game), testCatalog)).toBe(
      'Personaggio C: torna da Personaggio C: puoi riscuotere il premio',
    );
    game = act(game, { type: 'placePawn', player: 'p1', nodeId: 'c3' });
    expect(doneIds(game)).toEqual(['c3']);
  });

  it('Ripassa: the panel counts the turns left (spec 084, criterion 4)', () => {
    let game = withMission('c3', { type: 'comeBack', turns: 3, reward: {} });
    game = act(game, { type: 'acceptMission', nodeId: 'c3', player: 'p1' });
    const state = currentState(game);
    const [active] = state.activeMissions ?? [];
    expect(active && activeMissionParts(active, state, testCatalog).task).toBe('ripassa da Personaggio C tra 3 turni');
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

  it('who gave a mission and what it asks, apart for the phone (spec 058, criterion 1)', () => {
    let game = withMission('c3', { type: 'wait', turns: 2, reward: {} });
    game = play(game, { type: 'acceptMission', nodeId: 'c3', player: 'p1' }, { type: 'endTurn' }, { type: 'endTurn' });
    const state = currentState(game);
    const [active] = state.activeMissions ?? [];
    expect(active && activeMissionParts(active, state, testCatalog)).toEqual({
      giver: 'Personaggio C',
      task: 'attendi 2 turni (ne manca 1)',
    });
    expect(active && activeMissionText(active, state, testCatalog)).toBe(
      'Personaggio C: attendi 2 turni (ne manca 1)',
    );

    const removed = act(game, { type: 'setCellContent', nodeId: 'c3', content: { characterId: 'char-c' } });
    const after = currentState(removed);
    expect(active && activeMissionParts(active, after, testCatalog)).toEqual({
      giver: 'Personaggio C',
      task: 'missione tolta dalla casella',
    });
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

describe('«Accompagnami da» (spec 069, criterion 5; D-097)', () => {
  const escort: Mission = { type: 'escort', targetId: 'char-c', reward: { coins: 800 } };
  // char-a gives it in c1 and asks to be taken to char-c, in c3.
  const accepted = () =>
    play(withMission('c1', escort), { type: 'placePawn', player: 'p1', nodeId: 'c1' }, { type: 'acceptMission', nodeId: 'c1', player: 'p1' });

  it('the giver travels with the player, not in the team, and their cell is away', () => {
    const state = currentState(accepted());
    expect(companionOf(state, 'p1')).toBe('char-a');
    expect(awayCells(state).get('c1')).toBe('p1');
    expect(state.players.p1.team).not.toContain('char-a');
    expect(missionLabel(escort, testCatalog)).toBe('Missione · Accompagnami da Personaggio C');
    expect(activeMissionText(state.activeMissions![0]!, state, testCatalog)).toBe(
      'Personaggio A: viaggia con te fino a Personaggio C',
    );
  });

  it('on the cell of the one to reach the mission comes true: coins, and the companion goes', () => {
    const arrived = act(accepted(), { type: 'placePawn', player: 'p1', nodeId: 'c3' });
    expect(doneIds(arrived)).toEqual(['c1']);
    const done = act(arrived, { type: 'completeMission', nodeId: 'c1', player: 'p1' });
    const state = currentState(done);
    expect(state.players.p1.coins).toBe(800);
    expect(state.players.p1.team).not.toContain('char-a');
    expect(companionOf(state, 'p1')).toBeUndefined();
  });

  it('one companion at a time; nobody meets a giver who is travelling; abandoned, the giver is back', () => {
    const second = act(
      act(accepted(), { type: 'setCellContent', nodeId: 'c2', content: { characterId: 'char-b', mission: escort } }),
      { type: 'acceptMission', nodeId: 'c2', player: 'p1' },
    );
    expect(lastWarnings(second).map((warning) => warning.kind)).toContain('oneCompanion');
    const other = play(accepted(), { type: 'endTurn' }, { type: 'placePawn', player: 'p2', nodeId: 'c1' }, { type: 'interact', nodeId: 'c1' });
    expect(lastWarnings(other).map((warning) => warning.kind)).toContain('companionAway');
    const missionId = currentState(accepted()).activeMissions![0]!.id;
    const back = currentState(act(accepted(), { type: 'abandonMission', missionId }));
    expect(awayCells(back).size).toBe(0);
    expect(back.cells.c1?.characterId).toBe('char-a');
  });
});

describe('the lottery of Livio (spec 074, 2.4; D-099)', () => {
  const lisa = (correct = 0): Mission => ({
    type: 'quiz',
    quiz: { question: 'Trova la mia vera Lisa', answers: ['Lisa', 'Lisa', 'Lisa', 'Lisa'], correct },
    reward: { coins: 1500 },
  });
  const meet = (game: Game) =>
    play(game, { type: 'placePawn', player: 'p1', nodeId: 'c1' }, { type: 'interact', nodeId: 'c1' });
  const rightAnswer = (game: Game) => currentState(game).cells.c1?.mission?.quiz?.correct;

  it('a quiz with all its answers the same is a lottery; an empty or a real one is not', () => {
    expect(isLottery(lisa().quiz)).toBe(true);
    expect(isLottery({ question: '?', answers: ['Lisa', ' lisa ', 'LISA'], correct: 1 })).toBe(true);
    expect(isLottery({ question: '?', answers: ['Lisa', 'Lisa', 'Monica'], correct: 0 })).toBe(false);
    expect(isLottery(defaultMission('quiz').quiz)).toBe(false);
    expect(isLottery({ question: '?', answers: ['Lisa'], correct: 0 })).toBe(false);
    expect(isLottery(undefined)).toBe(false);
  });

  it('a new challenge draws the right answer from the state of the game', () => {
    const met = meet(withMission('c1', lisa()));
    expect(rightAnswer(met)).toBe(lotteryDraw(currentState(met), 'c1', 4));
  });

  it('reopening the scene in the same turn keeps it; undo and the same move draw the same one', () => {
    const met = meet(withMission('c1', lisa()));
    const reopened = act(met, { type: 'interact', nodeId: 'c1' });
    expect(rightAnswer(reopened)).toBe(rightAnswer(met));
    const again = act(undo(met), { type: 'interact', nodeId: 'c1' });
    expect(rightAnswer(again)).toBe(rightAnswer(met));
  });

  it('over many challenges every Lisa is the right one about once in four', () => {
    const counts = [0, 0, 0, 0];
    const state = currentState(meet(withMission('c1', lisa())));
    for (let turn = 1; turn <= 4000; turn++) {
      const players = { ...state.players, p1: { ...state.players.p1, coins: (turn * 37) % 3000 } };
      counts[lotteryDraw({ ...state, turn, players }, 'c1', 4)]! += 1;
    }
    for (const count of counts) {
      expect(count).toBeGreaterThan(900);
      expect(count).toBeLessThan(1100);
    }
  });

  it('a real quiz keeps its right answer', () => {
    const real: Mission = {
      type: 'quiz',
      quiz: { question: 'Chi?', answers: ['Goku', 'Vegeta', 'Gohan', 'Crilin'], correct: 2 },
      reward: {},
    };
    expect(rightAnswer(meet(withMission('c1', real)))).toBe(2);
  });
});
