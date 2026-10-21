import type { Character, GameMap } from '../engine';
import { keepersUsedIn } from '../catalog/specialKeepers';
import { areEmpty, type StarterProposals } from '../starters/proposals';
import type { Episode } from './episodeFile';
import type { Content } from './fill';

// The guided creation of an episode (spec 028, 3.3): the state of the
// libraries before starting, and the episode the steps put together.

export type LibraryId = 'characters' | 'powers' | 'keepers' | 'missions' | 'questions';

/** One line of "Prima di cominciare": ready, or what is missing and what it means. */
export interface LibraryCheck {
  id: LibraryId;
  label: string;
  ready: boolean;
  text: string;
}

export interface LibraryCounts {
  characters: Character[];
  powers: number;
  specialKeepers: number;
  missions: number;
  questions: number;
}

/** The libraries every episode uses, with a green tick or a warning (spec 028, 3.3, step 1). */
export function libraryStatus(counts: LibraryCounts): LibraryCheck[] {
  const { characters } = counts;
  const keepers = characters.filter((character) => character.shopkeeper).length;
  const villains = characters.filter((character) => character.villain).length;
  const characterText =
    characters.length === 0
      ? 'Nessuna lista: importala dal menu iniziale con «Importa lista personaggi».'
      : villains === 0
        ? `${characters.length} personaggi, ma nessun cattivo: reimporta docs/personaggi-bt3.csv, che ha la colonna «cattivo».`
        : `${characters.length} personaggi: ${keepers} negozianti, ${villains} cattivi.`;
  const shopkeeperCount = keepers + counts.specialKeepers;
  return [
    {
      id: 'characters',
      label: 'Lista dei personaggi',
      ready: characters.length > 0 && villains > 0,
      text: characterText,
    },
    {
      id: 'powers',
      label: 'Poteri',
      ready: counts.powers > 0,
      text:
        counts.powers > 0
          ? `${counts.powers} poteri da dare agli starter.`
          : 'Nessun potere: se ne aggiungono al passo «Starter».',
    },
    {
      id: 'keepers',
      label: 'Negozianti',
      ready: shopkeeperCount > 0,
      text:
        shopkeeperCount > 0
          ? `${keepers} nella lista, ${counts.specialKeepers} speciali.`
          : 'Nessun negoziante: i negozi restano senza. Se ne aggiungono al passo «Negozi».',
    },
    {
      id: 'missions',
      label: 'Missioni',
      ready: counts.missions > 0,
      text:
        counts.missions > 0
          ? `${counts.missions} missioni nel catalogo.`
          : 'Catalogo vuoto: «Randomizza» metterà solo personaggi e battute, senza missioni. Importa docs/missioni-bt3.csv.',
    },
    {
      id: 'questions',
      label: 'Domande del quiz',
      ready: counts.questions > 0,
      text:
        counts.questions > 0
          ? `${counts.questions} domande.`
          : 'Nessuna domanda: le missioni quiz non usciranno. Importa docs/domande.csv.',
    },
  ];
}

/** What the steps have put together, before saving. */
export interface EpisodeDraft {
  name: string;
  map: GameMap;
  content: Content;
  starters: StarterProposals;
}

/**
 * The episode the guided creation saves: map, name, the proposed starters
 * (left out if none was set) and the content of "Randomizza", with copies of
 * the special shopkeepers it uses (D-035).
 */
export function newEpisode(draft: EpisodeDraft, specialKeepers: Character[]): Episode {
  const keepers = keepersUsedIn(draft.content, specialKeepers);
  return {
    name: draft.name.trim() || 'Puntata senza nome',
    map: draft.map,
    content: draft.content,
    ...(keepers.length > 0 ? { keepers } : {}),
    ...(areEmpty(draft.starters) ? {} : { starters: draft.starters }),
  };
}
