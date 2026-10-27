import {
  CHASE_LEAD,
  HARD_MIN_CHANCE,
  LATE_TURN,
  LEVEL_NAMES,
  LEVELS,
  SIMULATIONS,
  TRIP_BUY_MIN,
  TRIP_MIN,
  type LevelRules,
} from '../ai/brain';
import { seededRandom } from '../battle/random';
import { tierName } from '../battle/sheetsPage';
import { GUESTS, isGuest } from '../catalog/guests';
import { CELL_JR, SAIBAIMAN } from '../catalog/henchmen';
import {
  BASE_ACTIONS,
  BASE_INTERACTIONS,
  FUSION_PAIRS,
  LASTING_MISSIONS,
  MISSION_TYPES,
  TEAM_SIZE,
  trainingRuleText,
  type AiLevel,
  type ChallengeFormat,
  type Character,
  type GameMap,
  type ItemDefinition,
  type MissionType,
} from '../engine';
import { tierRank } from '../episode/fill';
import {
  aloneChance,
  CELLS_PER_STORY_CHARACTER,
  EASY_MISSIONS,
  OPENER_MISSIONS,
  questionLevel,
  STRONGEST_FOR_EASY,
} from '../episode/missionFill';
import { DEFAULT_PER_SHOP, randomEpisode } from '../episode/stepRandomize';
import { EMPTY_TEXT_LIBRARY } from '../episode/textLibrary';
import type { CatalogMission, QuestionEntry, QuestionLevel } from '../missions/catalog';
import { PROPOSALS_PER_PLAYER } from '../starters/proposals';
import { DEFAULT_READY_POWERS } from '../starters/readyPowers';
import { cardTextFor, formatCoins } from '../starters/starterChoice';

// The page of the rules and values for the community (spec 077, D-102): the
// rules of the game with the values in force, and what "Randomizza" really
// puts on the base maps. Like the sheets page (D-065) it is generated from
// the code and the lists, never written by hand; a test keeps
// docs/regole-e-valori.md in step.

/** Episodes drawn on each base map, with repeatable dice. */
export const MEASURED_EPISODES = 100;
const MEASURE_SEED = 77;

/** What a character cell holds after the draw: a mission, a character without one, or nobody. */
export type CellKind = MissionType | 'none' | 'empty';

const FORMATS: ChallengeFormat[] = ['1v1', '2v2', '3v3'];

/** What "Randomizza" put on one base map, summed over the measured episodes. */
export interface MapStats {
  name: string;
  characterCells: number;
  shops: number;
  episodes: number;
  byKind: Record<CellKind, number>;
  formats: Record<ChallengeFormat, number>;
  /** Character cells whose mission gives their character. */
  recruits: number;
  /** Coins promised by the missions of the character cells. */
  coins: number;
  story: number;
  chains: number;
  placed: number;
  /** Episodes with a guest among the story characters. */
  withGuest: number;
  /** Guests keeping a shop. */
  guestKeepers: number;
}

/** The lists that come with the app (D-045). */
export interface IncludedLists {
  catalog: Character[];
  missions: CatalogMission[];
  questions: QuestionEntry[];
  items: ItemDefinition[];
}

function emptyKinds(): Record<CellKind, number> {
  const kinds = { none: 0, empty: 0 } as Record<CellKind, number>;
  for (const { type } of MISSION_TYPES) {
    kinds[type] = 0;
  }
  return kinds;
}

/** «Randomizza tutto» on each map, always with the same dice: one seed per map, so a new map changes no other. */
export function measureRandomize(
  maps: readonly GameMap[],
  lists: IncludedLists,
  episodes: number = MEASURED_EPISODES,
): MapStats[] {
  return maps.map((map, index) => {
    const random = seededRandom(MEASURE_SEED + index);
    const cells = map.nodes.filter((node) => node.type === 'character');
    const shops = map.nodes.filter((node) => node.type === 'shop');
    const stats: MapStats = {
      name: map.name,
      characterCells: cells.length,
      shops: shops.length,
      episodes,
      byKind: emptyKinds(),
      formats: { '1v1': 0, '2v2': 0, '3v3': 0 },
      recruits: 0,
      coins: 0,
      story: 0,
      chains: 0,
      placed: 0,
      withGuest: 0,
      guestKeepers: 0,
    };
    for (let run = 0; run < episodes; run++) {
      const { content, extras } = randomEpisode(map, {
        catalog: lists.catalog,
        specialKeepers: [],
        powers: DEFAULT_READY_POWERS,
        texts: EMPTY_TEXT_LIBRARY,
        missions: { catalog: lists.missions, questions: lists.questions, items: lists.items },
        perShop: DEFAULT_PER_SHOP,
        random,
      });
      for (const node of cells) {
        const cell = content[node.id];
        const mission = cell?.mission;
        stats.byKind[!cell?.characterId ? 'empty' : mission ? mission.type : 'none'] += 1;
        if (mission?.type === 'fight') {
          stats.formats[mission.format ?? '1v1'] += 1;
        }
        if (mission?.reward.cellCharacter) {
          stats.recruits += 1;
        }
        stats.coins += mission?.reward.coins ?? 0;
      }
      stats.story += extras.filter((extra) => extra.kind === 'story').length;
      stats.chains += extras.filter((extra) => extra.kind === 'chain').length;
      stats.placed += extras.filter((extra) => extra.kind === 'placed').length;
      if (cells.some((node) => isGuest(content[node.id]?.characterId ?? ''))) {
        stats.withGuest += 1;
      }
      stats.guestKeepers += shops.filter((node) => isGuest(content[node.id]?.characterId ?? '')).length;
    }
    return stats;
  });
}

function percent(part: number, whole: number): string {
  return whole === 0 ? '—' : `${Math.round((100 * part) / whole)}%`;
}

function decimal(value: number): string {
  return value.toFixed(1).replace('.', ',');
}

function outOfTen(share: number): string {
  return `${Math.round(share * 10)} su 10`;
}

function joinWords(words: string[], last = 'e'): string {
  return words.length <= 1 ? (words[0] ?? '') : `${words.slice(0, -1).join(', ')} ${last} ${words.at(-1)}`;
}

const LABELS = new Map<CellKind, string>([
  ...MISSION_TYPES.map(({ type, label }): [CellKind, string] => [type, label]),
  ['none', 'Nessuna missione'],
  ['empty', 'Casella rimasta vuota'],
]);

function label(kind: CellKind): string {
  return LABELS.get(kind) ?? kind;
}

function quoted(kinds: readonly MissionType[]): string {
  return joinWords(kinds.map((kind) => `«${label(kind)}»`));
}

function intro(): string[] {
  return [
    '# Regole e valori del gioco',
    '',
    'Le regole di Anime Adventure con i valori in vigore, e quello che «Randomizza» mette davvero sulle',
    'mappe che vengono con il gioco. Progetto di fan, non ufficiale.',
    '',
    '> Questa pagina si genera dal codice del gioco e dalle liste di questa cartella (`personaggi-bt3`,',
    '> `missioni-bt3`, `domande`): non modificarla a mano. Lo scontro, con le schede dei personaggi e le',
    '> probabilità di vittoria, è in [schede-personaggi.md](schede-personaggi.md).',
    '',
    'In **regia** i valori qui sotto sono quelli proposti: chi conduce può cambiare prezzi, monete e',
    "missioni, e una mossa fuori regola dà un avviso, ma con un secondo clic si fa lo stesso. Nella partita",
    "**PvP / PvIA** e sul **telefono** l'app fa da arbitro: ciò che è fuori regola non si fa.",
  ];
}

function turnSection(startingCoins: number): string[] {
  return [
    '',
    '## Il turno',
    '',
    `- Ogni turno ha **${BASE_ACTIONS} azioni** e **${BASE_INTERACTIONS} interazione**.`,
    '- Spostarsi su una casella vicina, lungo una strada aperta, costa 1 azione. Tornare sulla casella da cui',
    '  la pedina è appena partita annulla la mossa, senza spendere niente.',
    "- Interagire con il personaggio della propria casella (la sua sfida) costa 1 azione e l'interazione.",
    '  Riaprire la stessa scena senza lasciare la casella non costa niente.',
    "- Comprare, usare il Senzu o un oggetto di allenamento e fondere due personaggi non costano azioni; un",
    "  oggetto di viaggio costa 1 azione. Un viaggio non porta mai sulla casella dell'avversario, e nel turno dopo",
    '  un viaggio la pedina non si muove: si fanno solo interazioni, anche con un potere che dà azioni in più.',
    '- A fine turno valgono i poteri «a fine turno» e «ogni N turni»; chi deve saltare un turno lo salta, e un',
    '  turno saltato non conta per i poteri.',
    `- La squadra ha **${TEAM_SIZE} posti**. Una volta per partita si può prendere un sesto personaggio: allora`,
    '  uno della squadra, mai lo starter, se ne va. Con la squadra completa dopo il cambio, una missione dà',
    '  monete e oggetti ma non personaggi (in regia è un avviso, e decide chi conduce).',
    `- A ogni giocatore si propongono **${PROPOSALS_PER_PLAYER} starter**, ciascuno con il suo potere, e ne sceglie uno.`,
    `- Si parte con **${formatCoins(startingCoins)}**, il valore proposto in «Nuova partita».`,
    '',
    '### Lo showdown',
    '',
    '- È lo scontro finale fra le due squadre: chi lo vince vince la partita. Si apre da solo a fine turno con le',
    '  due pedine sulla stessa casella.',
    '- In regia chi conduce può chiuderlo e continuare; con le squadre complete lo apre a mano.',
    '- Nella partita PvP / PvIA e sul telefono si apre da solo anche quando tutti e due hanno preso il sesto',
    "  personaggio e hanno la squadra completa, e l'app simula lo scontro.",
  ];
}

function priceSection(catalog: readonly Character[]): string[] {
  const byTier = new Map<string, number[]>();
  for (const character of catalog) {
    if (character.tier && character.price) {
      byTier.set(character.tier, [...(byTier.get(character.tier) ?? []), character.price]);
    }
  }
  const tiers = [...byTier.keys()].sort((a, b) => (tierRank(a) ?? 0) - (tierRank(b) ?? 0));
  const priceText = (prices: number[]) => {
    const low = Math.min(...prices);
    const high = Math.max(...prices);
    return low === high ? formatCoins(low) : `da ${formatCoins(low)} a ${formatCoins(high)}`;
  };
  return [
    '',
    '## Le monete',
    '',
    '### I prezzi dei personaggi',
    '',
    'Il prezzo dipende dal tier. Ogni personaggio si vende una volta sola e non si rivende; quelli senza prezzo',
    '(i tier più bassi e i personaggi della storia) non sono in vendita.',
    '',
    '| Tier | Prezzo | Personaggi in vendita |',
    '|---|---|---|',
    ...tiers.map((tier) => {
      const prices = byTier.get(tier) ?? [];
      return `| ${tier} | ${priceText(prices)} | ${prices.length} |`;
    }),
  ];
}

function rewardSection(missions: readonly CatalogMission[]): string[] {
  const rows = MISSION_TYPES.flatMap(({ type, label: name }) => {
    const ofType = missions.filter((entry) => entry.mission.type === type);
    if (ofType.length === 0) {
      return [];
    }
    const recruit = ofType.filter((entry) => entry.mission.reward.cellCharacter).length;
    const coins = [...new Set(ofType.flatMap((entry) => entry.mission.reward.coins ?? []))].sort((a, b) => a - b);
    return [`| ${name} | ${ofType.length} | ${recruit} | ${coins.length > 0 ? coins.map(formatCoins).join(', ') : '—'} |`];
  });
  return [
    '',
    '### I premi delle missioni',
    '',
    'Le missioni della lista `missioni-bt3`, per tipo: quante sono, quante danno il personaggio della casella e',
    'le monete che promettono. Il premio va a chi completa la missione per primo.',
    '',
    '| Tipo | Missioni | Danno il personaggio | Monete in premio |',
    '|---|---|---|---|',
    ...rows,
  ];
}

function itemEffect(item: ItemDefinition): string {
  if (item.onPurchase === 'rechargeStarter') {
    return "Si usa appena comprato: ricarica il potere dello starter (un uso in più, o di nuovo le monete in più di «Parti con…»).";
  }
  if (item.training) {
    return `Allenamento: ${trainingRuleText(item.training)}.`;
  }
  if (item.travel) {
    return item.travel.steps === null
      ? 'Viaggio: la pedina va su qualsiasi casella raggiungibile per le strade aperte (1 azione).'
      : `Viaggio: la pedina va fino a ${item.travel.steps} strade più in là, per le strade aperte (1 azione).`;
  }
  return 'Va nell’inventario; l’effetto lo applica chi conduce.';
}

function itemSection(items: readonly ItemDefinition[]): string[] {
  return [
    '',
    '## Gli oggetti del negozio',
    '',
    '| Oggetto | Prezzo | Copie per negozio | Uno per giocatore | Effetto |',
    '|---|---|---|---|---|',
    ...items.map(
      (item) =>
        `| ${item.name} | ${formatCoins(item.price)} | ${item.copiesPerShop ?? 'senza limite'} | ` +
        `${item.oncePerPlayer ? 'sì' : 'no'} | ${itemEffect(item)} |`,
    ),
  ];
}

function powerSection(startingCoins: number): string[] {
  return [
    '',
    '## I poteri degli starter',
    '',
    'I poteri pronti che «Randomizza» e «Nuova partita» propongono con gli starter:',
    '',
    ...DEFAULT_READY_POWERS.map((power) => `- ${cardTextFor(power, startingCoins)}`),
  ];
}

const MISSION_TEXTS: Record<MissionType, string> = {
  fight:
    'battere il personaggio della casella, da solo o con i suoi compagni nei 2v2 e nei 3v3, su BT3 o con lo ' +
    'scontro simulato; in qualche missione basta che si trasformi.',
  quiz:
    'una domanda a scelta multipla, con una sola risposta. Se le risposte sono tutte uguali è una lotteria: la ' +
    'giusta si estrae a ogni nuova sfida.',
  goTo: 'portare la pedina sulla casella di un altro personaggio.',
  defeat: 'conquistare la casella di un altro personaggio, battendolo.',
  bring: 'avere in squadra un certo personaggio.',
  wait: "stare fermi mentre passano alcuni turni, che l'app salta da sola.",
  skipTurns: 'saltare alcuni turni.',
  comeBack: 'aspettare alcuni dei propri turni giocando, poi tornare sulla casella per il premio.',
  escort: 'il personaggio viaggia con il giocatore fino alla casella di un altro; un compagno alla volta.',
  other: 'una missione scritta a mano: in regia la giudica chi conduce, sul telefono vale la parola del giocatore.',
};

function missionSection(): string[] {
  return [
    '',
    '## Le missioni',
    '',
    ...MISSION_TYPES.map(({ type, label: name }) => `- **${name}**: ${MISSION_TEXTS[type]}`),
    '',
    `Le missioni che durano (${quoted(LASTING_MISSIONS)}) si accettano nella scena e danno il premio da sole`,
    "quando la condizione si avvera; si possono abbandonare. Una sfida persa non si ritenta, a meno che il",
    'potere dello starter lo permetta.',
  ];
}

/** "facili fino a C+, medie da B- a B, difficili da B+ in su", from the levels of the questions. */
function questionLevelsText(catalog: readonly Character[]): string {
  const ranks = catalog.flatMap((character) => tierRank(character.tier) ?? []);
  const names: Record<QuestionLevel, string> = { easy: 'facili', medium: 'medie', hard: 'difficili' };
  const ranges: { level: QuestionLevel; from: number; to: number }[] = [];
  for (let rank = Math.min(...ranks); rank <= Math.max(...ranks); rank++) {
    const level = questionLevel(tierName(rank));
    const last = ranges.at(-1);
    if (last?.level === level) {
      last.to = rank;
    } else {
      ranges.push({ level, from: rank, to: rank });
    }
  }
  return joinWords(
    ranges.map(({ level, from, to }, index) => {
      if (index === 0) {
        return `${names[level]} fino a ${tierName(to)}`;
      }
      if (index === ranges.length - 1) {
        return `${names[level]} da ${tierName(from)} in su`;
      }
      return from === to ? `${names[level]} per ${tierName(from)}` : `${names[level]} da ${tierName(from)} a ${tierName(to)}`;
    }),
  );
}

function randomizeRules(catalog: readonly Character[]): string[] {
  const name = (id: string) => catalog.find((character) => character.id === id)?.name ?? id;
  const alone = [
    ['fino a B+', aloneChance('B+')],
    ['se è A', aloneChance('A')],
    ['se è S', aloneChance('S')],
    ['se è SS', aloneChance('SS')],
  ] as const;
  return [
    '',
    '## «Randomizza»',
    '',
    '«Randomizza tutto» prepara una puntata su una mappa: starter, negozi, personaggi e missioni. Le sue regole:',
    '',
    `- **Starter:** ${PROPOSALS_PER_PLAYER} proposte per giocatore, mai personaggi già sulla mappa.`,
    `- **Negozi:** un negoziante e ${DEFAULT_PER_SHOP} personaggi in vendita per negozio.`,
    `- **Personaggi della storia:** circa uno ogni ${CELLS_PER_STORY_CHARACTER} caselle personaggio. Non si`,
    `  reclutano: danno solo una missione. Degli ospiti (${joinWords(GUESTS.map(name))}) al massimo uno per`,
    '  puntata fra i personaggi della storia; come negozianti senza limite.',
    `- **Strade grigie:** chi apre una strada grigia dà solo missioni ${quoted(OPENER_MISSIONS)}. Le catene`,
    '  della storia mettono dietro la strada un personaggio più forte; le catene più pesanti escono più spesso.',
    '- **Formato degli scontri:** 1v1 nel terzo di caselle più vicino alla propria partenza, 2v2 più lontano, 3v3',
    '  solo nella casella più lontana di ogni lato. Dove potrebbe esserci uno scontro a squadre, il personaggio',
    `  combatte da solo ${joinWords(alone.map(([tier, share]) => `il ${percent(share, 1)} delle volte ${tier}`))}.`,
    `- **Missioni facili:** ${quoted(EASY_MISSIONS)} reclutano solo personaggi fino a ${tierName(STRONGEST_FOR_EASY)}.`,
    `- **Domande dei quiz:** ${questionLevelsText(catalog)}; medie per i personaggi della storia. Chi ha domande`,
    '  sue fa solo quelle, con le risposte in un ordine nuovo a ogni puntata.',
    '- **Una persona in un posto solo:** lo stesso personaggio, con le sue forme, non compare due volte nella',
    '  puntata.',
    `- **Gregari:** ${name(SAIBAIMAN)} e ${name(CELL_JR)} non vanno sulla mappa né nei negozi: completano gli`,
    `  avversari che mancano negli scontri a squadre (${name(CELL_JR)} accanto a un Cell, altrimenti`,
    `  ${name(SAIBAIMAN)}).`,
  ];
}

function statsSection(stats: readonly MapStats[]): string[] {
  const header = `| | ${stats.map((map) => map.name).join(' | ')} |`;
  const rule = `|---|${stats.map(() => '---|').join('')}`;
  const row = (title: string, value: (map: MapStats) => string) =>
    `| ${title} | ${stats.map(value).join(' | ')} |`;
  const kinds = ([...MISSION_TYPES.map(({ type }) => type), 'none', 'empty'] as CellKind[]).filter((kind) =>
    stats.some((map) => map.byKind[kind] > 0),
  );
  const cellsDrawn = (map: MapStats) => map.characterCells * map.episodes;
  const fights = (map: MapStats) => FORMATS.reduce((total, format) => total + map.formats[format], 0);
  const perEpisode = (value: (map: MapStats) => number) => (map: MapStats) => decimal(value(map) / map.episodes);
  const episodes = stats[0]?.episodes ?? MEASURED_EPISODES;
  return [
    '',
    '### Cosa esce davvero',
    '',
    `Misurato su ${episodes} puntate tirate a caso per ogni mappa base, con le liste di questa cartella. I dadi`,
    'sono sempre gli stessi: rigenerando la pagina i numeri cambiano solo se cambiano le regole, le liste o le',
    'mappe.',
    '',
    '**Le caselle personaggio, per missione** (quota delle caselle personaggio)',
    '',
    header,
    rule,
    row('Caselle personaggio', (map) => String(map.characterCells)),
    ...kinds.map((kind) => row(label(kind), (map) => percent(map.byKind[kind], cellsDrawn(map)))),
    '',
    '**I combattimenti, per formato** (quota dei combattimenti)',
    '',
    header,
    rule,
    ...FORMATS.map((format) => row(format, (map) => percent(map.formats[format], fights(map)))),
    '',
    '**In una puntata, in media**',
    '',
    header,
    rule,
    row('Negozi', (map) => String(map.shops)),
    row('Personaggi della storia', perEpisode((map) => map.story)),
    row('Catene sulle strade grigie', perEpisode((map) => map.chains)),
    row('Personaggi messi sulla mappa per la missione di un altro', perEpisode((map) => map.placed)),
    row('Caselle che danno il loro personaggio', (map) => percent(map.recruits, cellsDrawn(map))),
    row('Monete in palio nelle missioni', (map) => formatCoins(Math.round(map.coins / map.episodes / 100) * 100)),
    row('Puntate con un ospite fra i personaggi della storia', (map) => percent(map.withGuest, map.episodes)),
    row('Ospiti che tengono un negozio', perEpisode((map) => map.guestKeepers)),
  ];
}

function fightRule(rules: LevelRules): string {
  switch (rules.fights) {
    case 'any':
      return 'li accetta tutti';
    case 'tier':
      return 'solo se i suoi personaggi non sono più deboli di quelli della missione';
    case 'simulate':
      return `simula ${SIMULATIONS} scontri e combatte se ne vince almeno il ${percent(HARD_MIN_CHANCE, 1)}`;
  }
}

function aiSection(): string[] {
  const levels = Object.keys(LEVEL_NAMES) as AiLevel[];
  const row = (title: string, value: (rules: LevelRules) => string) =>
    `| ${title} | ${levels.map((level) => value(LEVELS[level])).join(' | ')} |`;
  return [
    '',
    "## L'IA",
    '',
    "Nella partita PvP / PvIA e sul telefono l'IA è G2 e gioca con lo stesso arbitro del giocatore.",
    '',
    `| | ${levels.map((level) => LEVEL_NAMES[level]).join(' | ')} |`,
    `|---|${levels.map(() => '---|').join('')}`,
    row('Quiz giusti', (rules) => outOfTen(rules.quiz)),
    row('Dove va', (rules) =>
      rules.wander > 0
        ? `a caso ${Math.round(rules.wander * 10)} volte su 10, se no verso la casella utile più vicina`
        : 'verso la casella più conveniente: il premio diviso per la distanza' +
          (rules.keepsGoal ? ', e tiene la destinazione finché ci arriva' : '') +
          (rules.races ? "; lascia perdere le caselle dove l'avversario arriva prima" : ''),
    ),
    row('Combattimenti', fightRule),
    row('Missioni che durano', (rules) => `${quoted(rules.lasting)}, solo se può finirle`),
    row('Negozi', (rules) =>
      rules.buysBest
        ? 'il personaggio più forte che può permettersi, gli oggetti di allenamento che può usare, il Senzu quando conviene' +
          (rules.travels ? ', un viaggio quando le serve' : '')
        : 'un personaggio a caso fra quelli che può permettersi',
    ),
    row('Oggetti e poteri da usare a mano', (rules) => (rules.usesItems ? 'sì' : 'no')),
    row('Nuvola Speedy e Trasmissione Istantanea', (rules) =>
      rules.travels
        ? `le compra per una casella utile ad almeno ${TRIP_BUY_MIN} strade e le usa per caselle ad almeno ${TRIP_MIN} strade`
        : 'no',
    ),
    row('Showdown', (rules) =>
      rules.showdown
        ? `se lo vincerebbe insegue l'avversario, con la squadra completa o ${CHASE_LEAD} personaggi più di lui, e quando ` +
          'lo raggiunge si ferma; prova a tagliargli la strada, andando dove crede che lui vada; mentre lo ' +
          'insegue si ferma per strada solo per un SS o per le monete per comprarne uno, e con la squadra ' +
          'completa mai; se lo perderebbe gli sta lontano' +
          (rules.ordersTeam ? "; all'apertura si mette nell'ordine migliore secondo il simulatore" : '')
        : 'non ci pensa',
    ),
    row('Starter', (rules) => (rules.buysBest ? 'il più forte' : 'a caso')),
    '',
    "- Sceglie dove andare chiedendo all'arbitro: non va dove non potrebbe incontrare il personaggio o accettarne",
    "  la missione. Se ha già usato l'interazione del turno, aspetta sulla casella che vuole.",
    `- Non accetta mai ${quoted(['wait', 'skipTurns', 'comeBack', 'other'])}.`,
    "- Usa «Salta turno» quando l'avversario sta per completare la squadra, a livello Difficile anche quando è",
    `  vicino e lo showdown lo perderebbe, e comunque dal turno ${LATE_TURN} in poi.`,
    '- Fonde sempre quando può; dopo il sesto personaggio manda via il suo più debole.',
  ];
}

function fusionSection(catalog: readonly Character[]): string[] {
  const name = (id: string) => catalog.find((character) => character.id === id)?.name ?? id;
  const names = (ids: string[], last = 'o') => joinWords(ids.map(name), last);
  return [
    '',
    '## Le fusioni',
    '',
    ...FUSION_PAIRS.map((pair) => {
      const first = pair.first.base[0] ?? pair.first.ssj[0] ?? '';
      const second = pair.second.base[0] ?? pair.second.ssj[0] ?? '';
      const ssj = pair.base.length > 0 ? `; tutti e due SSJ: ${names(pair.ssj)}` : '';
      return `- ${name(first)} e ${name(second)}: ${names(pair.base.length > 0 ? pair.base : pair.ssj)}${ssj}.`;
    }),
    '',
    'La fusione prende il posto del primo dei due in squadra, e dello starter se uno dei due lo era. La sua',
    'casella sul tabellone si spegne per tutti e due, e nei negozi esce dalla vendita; una fusione già in',
    'squadra non si ripete.',
  ];
}

/** The whole page, as docs/regole-e-valori.md holds it. */
export function rulesPage(lists: IncludedLists, startingCoins: number, stats: readonly MapStats[]): string {
  return [
    ...intro(),
    ...turnSection(startingCoins),
    ...priceSection(lists.catalog),
    ...rewardSection(lists.missions),
    ...itemSection(lists.items),
    ...powerSection(startingCoins),
    ...missionSection(),
    ...randomizeRules(lists.catalog),
    ...statsSection(stats),
    ...aiSection(),
    ...fusionSection(lists.catalog),
    '',
    '## Lo scontro',
    '',
    'Come funziona lo scontro simulato, le schede dei personaggi e le probabilità di vittoria: vedi',
    '[schede-personaggi.md](schede-personaggi.md).',
    '',
  ].join('\n');
}
