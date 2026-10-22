import { describe, expect, it } from 'vitest';
import {
  createGame,
  currentState,
  powerCatalog,
  testCatalog,
  testContent,
  testItems,
  testMap,
  type GameContext,
} from '../engine';
// The list as it was at spec 022 (see importCatalog.test.ts).
import oldFormatTable from '../catalog/fixtures/personaggi-formato-vecchio.csv?raw';
import { importCatalog } from '../catalog/importCatalog';
import { newPowerForm } from '../starters/powerForm';
import { emptyProposals, withProposal, type StarterProposals } from '../starters/proposals';
import { DEFAULT_READY_POWERS, makeReadyPower, type ReadyPower } from '../starters/readyPowers';
import { chooseCard, showOther, startChoice } from '../starters/starterChoice';
import { starterGroups } from '../ui/characterGroups';
import { buildSetup, defaultNewGameForm, playerNames, type NewGameForm } from './newGame';

const context: GameContext = { map: testMap, catalog: testCatalog, items: testItems };

const [everyTwo, perInteraction, richStart] = DEFAULT_READY_POWERS as [
  ReadyPower,
  ReadyPower,
  ReadyPower,
];

/** The proposals of an episode: three starters each, six different characters. */
function episodeProposals(): StarterProposals {
  return {
    p1: [
      { characterId: 'hero-1', powers: [everyTwo] },
      { characterId: 'char-c', powers: [perInteraction] },
      { characterId: 'char-e', powers: [richStart] },
    ],
    p2: [
      { characterId: 'hero-2', powers: [everyTwo] },
      { characterId: 'char-d', powers: [perInteraction] },
      { characterId: 'char-f', powers: [richStart] },
    ],
  };
}

describe('new game screen (spec 003, 2.2; spec 025, 2.3)', () => {
  it('without an episode: three empty proposals each, the two start cells', () => {
    const form = defaultNewGameForm(testMap);
    expect(form.players).toEqual({
      p1: { name: 'G1', startNodeId: 's1' },
      p2: { name: 'G2', startNodeId: 's2' },
    });
    expect(form.proposals).toEqual(emptyProposals());
    // Spec 030 (2.5): 1.000, as in the channel's graphic; it was 0.
    expect(form.startingCoins).toBe(1000);
    expect(form.firstPlayer).toBe('p1');
  });

  it("starts from the episode's proposals; changing them leaves the episode as it is (criterion 7)", () => {
    const episode = episodeProposals();
    const form = defaultNewGameForm(testMap, episode);
    expect(form.proposals).toEqual(episode);

    const changed = withProposal(form.proposals, 'p1', 0, { characterId: 'char-g', powers: [] });
    if (form.proposals.p2[0]) {
      form.proposals.p2[0].powers.push(richStart);
    }
    expect(changed.p1[0]?.characterId).toBe('char-g');
    expect(episode).toEqual(episodeProposals());
  });

  it('turns the form and the chosen starters into the setup for the engine (criterion 8)', () => {
    const own = makeReadyPower('own', 'Doppio movimento per 3 volte', {
      ...newPowerForm('extraActionsOnDemand'),
      name: 'Doppio movimento',
      uses: 3,
    });
    const form: NewGameForm = {
      ...defaultNewGameForm(testMap, withProposal(episodeProposals(), 'p1', 1, {
        characterId: 'char-c',
        powers: [own, everyTwo],
      })),
      players: { p1: { name: '  Marco ', startNodeId: 's2' }, p2: { name: '', startNodeId: 's1' } },
      startingCoins: 500,
      firstPlayer: 'p2',
    };
    const choice = chooseCard(showOther(chooseCard(startChoice('p2'), 2)), 1);

    expect(playerNames(form)).toEqual({ p1: 'Marco', p2: 'G2' });
    expect(buildSetup(form, choice, context, testContent)).toEqual({
      ...context,
      content: testContent,
      players: {
        p1: {
          name: 'Marco',
          starter: {
            characterId: 'char-c',
            powers: [
              powerCatalog.extraActionsOnDemand(2, 3, 'Doppio movimento'),
              powerCatalog.coinsEveryNTurns(200, 2),
            ],
          },
          startNodeId: 's2',
        },
        p2: {
          name: 'G2',
          // «Parti con …»: +1,500 since spec 063.
          starter: { characterId: 'char-f', powers: [powerCatalog.extraStartingCoins(1500)] },
          startNodeId: 's1',
        },
      },
      firstPlayer: 'p2',
      startingCoins: 500,
    });

    const state = currentState(createGame(buildSetup(form, choice, context, testContent)));
    expect(state.currentPlayer).toBe('p2');
    expect(state.players.p1.starterId).toBe('char-c');
    expect(state.players.p1.coins).toBe(500);
    expect(state.players.p2.coins).toBe(2000);
  });

  it('a player who has not chosen yet cannot start the game', () => {
    const form = defaultNewGameForm(testMap, episodeProposals());
    expect(() => buildSetup(form, chooseCard(startChoice('p1'), 0), context, {})).toThrow(
      /G2 non ha ancora scelto lo starter/,
    );
  });

  it('with the imported list: empty cells, possible starters first in the menus (spec 005, criterion 8)', () => {
    const result = importCatalog(oldFormatTable);
    if (!result.ok) {
      throw new Error(result.errors.join(' '));
    }
    const [suggested] = starterGroups(result.catalog);
    expect(suggested?.label).toBe('Possibili starter');
    expect(suggested?.characters).toHaveLength(24);

    const imported: GameContext = { map: testMap, catalog: result.catalog, items: testItems };
    const proposals = withProposal(
      withProposal(emptyProposals(), 'p1', 0, { characterId: suggested?.characters[0]?.id, powers: [] }),
      'p2',
      0,
      { characterId: suggested?.characters[1]?.id, powers: [] },
    );
    const choice = chooseCard(showOther(chooseCard(startChoice('p1'), 0)), 0);
    const state = currentState(
      createGame(buildSetup(defaultNewGameForm(testMap, proposals), choice, imported, {})),
    );
    expect(state.cells).toEqual({});
    expect(state.players.p1.starterId).toBe(suggested?.characters[0]?.id);
  });
});
