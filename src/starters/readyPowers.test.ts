import { describe, expect, it } from 'vitest';
import { createGame, currentState, powerCatalog, testCatalog, testItems, testMap } from '../engine';
import { newPowerForm } from './powerForm';
import {
  availablePowers,
  DEFAULT_READY_POWERS,
  looksLikeReadyPower,
  makeReadyPower,
  readyPowerDefinition,
  REPLACED_READY_POWERS,
  sameReadyPower,
} from './readyPowers';

describe('the list of ready powers (spec 025)', () => {
  it('starts with the three powers of coins of the channel graphic and three without coins, two uses each, with the right effects (criterion 1; spec 061, criterion 6; spec 063, criterion 2)', () => {
    expect(DEFAULT_READY_POWERS.map((power) => power.cardText)).toEqual([
      'Ogni 2 turni guadagni 200$',
      'Ogni volta che interagisci con un PG prendi 250$',
      // Spec 029 (2.5): the numbers follow the starting coins of the game.
      'Parti con {totale} invece che {iniziali}',
      'Due volte per partita puoi ritentare una sfida persa',
      'Due volte per partita: doppio movimento (2 azioni in più)',
      "Due volte per partita fai saltare un turno all'avversario",
    ]);
    expect(DEFAULT_READY_POWERS.map(readyPowerDefinition)).toEqual([
      powerCatalog.coinsEveryNTurns(200, 2),
      powerCatalog.coinsPerInteraction(250),
      powerCatalog.extraStartingCoins(1500),
      powerCatalog.retryLostChallenge(2),
      powerCatalog.extraActionsOnDemand(2, 2, 'Doppio movimento'),
      powerCatalog.skipOpponentTurn(2, 'Salta turno'),
    ]);
    expect(new Set(DEFAULT_READY_POWERS.map((power) => power.id)).size).toBe(6);
    expect(DEFAULT_READY_POWERS.every(looksLikeReadyPower)).toBe(true);
  });

  it('a power of the list works in the game with the same values and own name (criterion 2)', () => {
    const power = makeReadyPower('p', ' Rendita ', {
      ...newPowerForm('coinsEveryNTurns'),
      amount: 250,
      n: 2,
      name: 'Rendita',
    });
    expect(power.cardText).toBe('Rendita');
    expect(readyPowerDefinition(power)).toEqual(powerCatalog.coinsEveryNTurns(250, 2, 'Rendita'));

    const extra = DEFAULT_READY_POWERS[2];
    if (!extra) {
      throw new Error('missing default power');
    }
    const game = createGame({
      map: testMap,
      catalog: testCatalog,
      items: testItems,
      content: {},
      players: {
        p1: {
          name: 'G1',
          starter: { characterId: 'hero-1', powers: [readyPowerDefinition(extra)] },
          startNodeId: 's1',
        },
        p2: { name: 'G2', starter: { characterId: 'hero-2', powers: [] }, startNodeId: 's2' },
      },
      firstPlayer: 'p1',
      startingCoins: 1000,
    });
    expect(currentState(game).players.p1.coins).toBe(2500);
    expect(currentState(game).players.p2.coins).toBe(1000);
  });

  it('rejects a damaged power read back from the browser', () => {
    const [first] = DEFAULT_READY_POWERS;
    expect(looksLikeReadyPower({ ...first, id: '' })).toBe(false);
    expect(looksLikeReadyPower({ ...first, cardText: 3 })).toBe(false);
    expect(looksLikeReadyPower({ ...first, effect: { kind: 'unknown' } })).toBe(false);
  });

  it('offers the list first, then the copies whose version the list no longer has', () => {
    const [a, b] = DEFAULT_READY_POWERS;
    if (!a || !b) {
      throw new Error('missing default powers');
    }
    const old = { ...b, id: 'old-version', cardText: 'Vecchia scritta' };
    expect(availablePowers([a, b], [a, old, old])).toEqual({ library: [a, b], onlyHere: [old] });
  });
});

describe('the ready powers of before spec 063 in a browser (spec 063, 2.3)', () => {
  it('each old one is recognised only when unchanged, and its new version has another code', () => {
    for (const [old, next] of REPLACED_READY_POWERS) {
      expect(sameReadyPower(old, old)).toBe(true);
      expect(sameReadyPower({ ...old, cardText: `${old.cardText}!` }, old)).toBe(false);
      expect(sameReadyPower({ ...old, effect: { ...old.effect, uses: old.effect.uses + 1 } }, old)).toBe(false);
      expect(next.id).not.toBe(old.id);
      expect(DEFAULT_READY_POWERS).toContain(next);
    }
  });
});
