import { describe, expect, it } from 'vitest';
import { act, createGame, currentState, powerCatalog, testSetup, type Game, type GameAction } from '../engine';
import { playerInfo, powerText } from './playerInfo';

const play = (game: Game, ...actions: GameAction[]) => actions.reduce(act, game);

describe('the «i» of a player on the phone (spec 064, criterion 1)', () => {
  it('the powers with what they do and the uses left', () => {
    const game = createGame(
      testSetup({ p1Powers: [powerCatalog.coinsEveryNTurns(200, 2), powerCatalog.extraActionsOnDemand(2, 2, 'Doppio movimento')] }),
    );
    const info = playerInfo(currentState(game), game.catalog, game.items, 'p1');
    expect(info.powers).toEqual([
      { name: 'Monete ogni N turni', text: '+200 monete ogni 2 turni', usesLeft: null },
      { name: 'Doppio movimento', text: '+2 azioni nel turno in cui lo usi', usesLeft: 2 },
    ]);
  });

  it('every kind of power in words', () => {
    expect(powerText(powerCatalog.extraStartingCoins(1500))).toBe('+1500 monete a inizio partita');
    expect(powerText(powerCatalog.coinsPerInteraction(250))).toBe('+250 monete ogni volta che interagisci con un personaggio');
    expect(powerText(powerCatalog.coinsAtTurnEnd(100))).toBe('+100 monete a fine turno');
    expect(powerText(powerCatalog.skipOpponentTurn(2))).toBe("l'avversario salta il suo prossimo turno");
    expect(powerText(powerCatalog.retryLostChallenge(2))).toMatch(/sfidi di nuovo/);
    expect(powerText(powerCatalog.doubleActionOnDemand(2))).toBe('+2 azioni e +1 interazione nel turno in cui lo usi');
  });

  it('the items, the missions in progress in full, the lost challenges and the sixth', () => {
    const game = play(
      createGame(testSetup()),
      { type: 'addToInventory', player: 'p1', itemId: 'senzu' },
      { type: 'addToInventory', player: 'p1', itemId: 'gravity-room' },
      {
        type: 'setCellContent',
        nodeId: 'c2',
        content: { characterId: 'char-b', mission: { type: 'wait', turns: 3, reward: { coins: 1200 } } },
      },
      { type: 'acceptMission', nodeId: 'c2', player: 'p1' },
      { type: 'loseChallenge', nodeId: 'c1', player: 'p1' },
    );
    const info = playerInfo(currentState(game), game.catalog, game.items, 'p1');
    expect(info.items).toEqual([
      { name: 'Senzu', text: 'ricarica il potere dello starter' },
      { name: 'Camera Gravitazionale del Dr. Brief', text: expect.stringMatching(/personagg/) },
    ]);
    expect(info.missions).toEqual([{ id: 1, giver: 'Personaggio B', task: expect.stringMatching(/attendi|turn/) }]);
    expect(info.lostTo).toEqual(['Personaggio A']);
    expect(info.sixth).toMatch(/ancora disponibile/);
    expect(playerInfo(currentState(game), game.catalog, game.items, 'p2').missions).toEqual([]);
  });
});
