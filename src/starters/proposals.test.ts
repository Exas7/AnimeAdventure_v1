import { describe, expect, it } from 'vitest';
import { newMap } from '../editor/mapEdit';
import { parseEpisode, serializeEpisode, type Episode } from '../episode/episodeFile';
import {
  areEmpty,
  copyPowersFromFirst,
  emptyProposals,
  powersInProposals,
  powersMissingFrom,
  proposalIssues,
  proposedCharacters,
  withProposal,
  type StarterProposals,
} from './proposals';
import { availablePowers, DEFAULT_READY_POWERS, makeReadyPower, type ReadyPower } from './readyPowers';

const [everyTwo, perInteraction, richStart] = DEFAULT_READY_POWERS as [
  ReadyPower,
  ReadyPower,
  ReadyPower,
];

const catalog = [
  { id: 'krilin', name: 'Krilin' },
  { id: 'piccolo', name: 'Piccolo (inizio)' },
  { id: 'raditz', name: 'Raditz' },
  { id: 'yamcha', name: 'Yamcha' },
  { id: 'tenshinhan', name: 'Tenshinhan' },
  { id: 'bardock', name: 'Bardock' },
];

/** Six different starters, with the three powers of the graphic for each player. */
function fullProposals(): StarterProposals {
  return {
    p1: [
      { characterId: 'krilin', powers: [everyTwo] },
      { characterId: 'piccolo', powers: [perInteraction] },
      { characterId: 'raditz', powers: [richStart] },
    ],
    p2: [
      { characterId: 'yamcha', powers: [everyTwo] },
      { characterId: 'tenshinhan', powers: [perInteraction] },
      { characterId: 'bardock', powers: [richStart] },
    ],
  };
}

describe('proposals in the episode (spec 025, criterion 3)', () => {
  const episode: Episode = {
    name: 'Puntata',
    map: newMap('Vuota'),
    content: {},
    starters: fullProposals(),
  };

  it('are saved, exported and imported identical', () => {
    expect(parseEpisode(serializeEpisode(episode))).toEqual(episode);
  });

  it('an episode of version 3 is read without proposals', () => {
    const { starters: _none, ...older } = episode;
    const file = JSON.parse(serializeEpisode(older)) as { version: number };
    file.version = 3;
    expect(parseEpisode(JSON.stringify(file))).toEqual(older);
  });

  it('damaged proposals make the file unreadable, with the usual message', () => {
    const broken = { ...episode, starters: { p1: [], p2: [] } } as unknown as Episode;
    expect(() => parseEpisode(serializeEpisode(broken))).toThrow(/mancano parti della puntata/);
  });

  it('imported on another computer, the powers missing from the list join it', () => {
    const own = makeReadyPower('own', 'Fai perdere un turno', everyTwo.effect);
    const proposals = withProposal(fullProposals(), 'p2', 0, { characterId: 'yamcha', powers: [own] });
    expect(powersMissingFrom([everyTwo, perInteraction], proposals)).toEqual([richStart, own]);
    expect(powersMissingFrom(DEFAULT_READY_POWERS, undefined)).toEqual([]);
  });
});

describe('copies of the powers (spec 025, criterion 4)', () => {
  it('editing a power of the list leaves the episode copy as it was', () => {
    const edited = makeReadyPower('new-version', 'Ogni 2 turni guadagni 300$', {
      ...everyTwo.effect,
      amount: 300,
    });
    const library = [edited, perInteraction, richStart];
    const proposals = fullProposals();
    expect(proposals.p1[0]?.powers).toEqual([everyTwo]);
    // The menu still offers the old version, as only in this episode.
    expect(availablePowers(library, powersInProposals(proposals)).onlyHere).toEqual([everyTwo]);
  });
});

describe('"Stessi poteri del Giocatore 1" (spec 025, criterion 5)', () => {
  it('copies the powers proposal by proposal and leaves the characters', () => {
    const start = fullProposals();
    const mixed = withProposal(start, 'p2', 1, { characterId: 'tenshinhan', powers: [] });
    const copied = copyPowersFromFirst({
      ...mixed,
      p1: mixed.p1.map((proposal, index) => ({ ...proposal, powers: index === 1 ? [richStart, everyTwo] : proposal.powers })),
    });
    expect(copied.p2.map((proposal) => proposal.characterId)).toEqual(['yamcha', 'tenshinhan', 'bardock']);
    expect(copied.p2.map((proposal) => proposal.powers)).toEqual([[everyTwo], [richStart, everyTwo], [richStart]]);
  });
});

describe('guides on the proposals (spec 025, criterion 6)', () => {
  it('nothing to say when the six starters are different and complete', () => {
    expect(proposalIssues(fullProposals(), catalog)).toEqual([]);
  });

  it('a character proposed more than once', () => {
    const twice = withProposal(fullProposals(), 'p2', 2, { characterId: 'krilin', powers: [richStart] });
    expect(proposalIssues(twice, catalog)).toEqual([
      {
        kind: 'repeatedCharacter',
        message: 'Krilin è proposto più di una volta: i 6 starter proposti dovrebbero essere tutti diversi.',
      },
    ]);
  });

  it('proposals without a character or without a power, named with the players', () => {
    const missing = withProposal(
      withProposal(fullProposals(), 'p1', 1, { powers: [perInteraction] }),
      'p2',
      2,
      { characterId: 'bardock', powers: [] },
    );
    expect(proposalIssues(missing, catalog, { p1: 'Maggi', p2: 'Melia' })).toEqual([
      { kind: 'missingCharacter', message: 'Proposte senza personaggio: Maggi n. 2.' },
      { kind: 'missingPower', message: 'Proposte senza potere: Melia n. 3.' },
    ]);
  });

  it('the same power twice for one player, in one proposal or in two (spec 029, criterion 8)', () => {
    let repeated = withProposal(fullProposals(), 'p2', 0, { characterId: 'yamcha', powers: [everyTwo, everyTwo] });
    repeated = withProposal(repeated, 'p2', 1, { characterId: 'tenshinhan', powers: [everyTwo] });
    repeated = withProposal(repeated, 'p1', 1, { characterId: 'piccolo', powers: [richStart] });
    expect(proposalIssues(repeated, catalog, { p1: 'Maggi', p2: 'Melia' })).toEqual([
      {
        kind: 'repeatedPower',
        message:
          'Poteri ripetuti nello stesso giocatore: «Parti con {totale} invece che {iniziali}» per Maggi (n. 2, n. 3); «Ogni 2 turni guadagni 200$» per Melia (n. 1, n. 1, n. 2).',
      },
    ]);
  });

  it('the same power for both players is normal: no guide', () => {
    expect(proposalIssues(copyPowersFromFirst(fullProposals()), catalog)).toEqual([]);
  });

  it('empty proposals: everything is missing, and they count as not set', () => {
    const empty = emptyProposals();
    expect(areEmpty(empty)).toBe(true);
    expect(areEmpty(fullProposals())).toBe(false);
    expect(proposalIssues(empty, catalog).map((issue) => issue.kind)).toEqual([
      'missingCharacter',
      'missingPower',
    ]);
  });
});

describe('the proposed characters (D-044)', () => {
  it('lists the characters of both players, without the empty proposals', () => {
    const proposals = withProposal(fullProposals(), 'p2', 1, { powers: [] });
    expect(proposedCharacters(proposals)).toEqual(['krilin', 'piccolo', 'raditz', 'yamcha', 'bardock']);
    expect(proposedCharacters(undefined)).toEqual([]);
  });
});
