/** The two players. A game always has exactly two. */
export type PlayerId = 'p1' | 'p2';

export const PLAYER_IDS: readonly PlayerId[] = ['p1', 'p2'];

/** Team size; characters beyond it are extras, flagged until the host fixes the team. */
export const TEAM_SIZE = 5;

/** Actions per turn, of which at most one interaction (format rule 3). */
export const BASE_ACTIONS = 2;
export const BASE_INTERACTIONS = 1;

// ---------------------------------------------------------------------------
// Catalog and map
// ---------------------------------------------------------------------------

/** Any character can sit in any cell, give tasks or fight (D-016). */
export interface Character {
  id: string;
  name: string;
  /** Default price in a shop; missing for characters that are not sold. */
  price?: number;
  /** Suggested as starter in "Nuova partita"; anyone can still be one (D-016). */
  possibleStarter?: boolean;
  /** Can keep a shop: "Randomizza" picks shopkeepers only among these (D-034). */
  shopkeeper?: boolean;
  /** A villain: without missions of their own, they get those of the villains (spec 027). */
  villain?: boolean;
  /** Missing: not recruitable, a story character for tasks or shops (D-034). */
  tier?: string;
  /** The same for the forms of one person, e.g. "Son Goku" (D-048); missing: a person alone. */
  person?: string;
  saga?: string;
  race?: string;
  info?: string;
  /** Image file name, for when the channel provides the images. */
  image?: string;
  /** The picture itself, as a data URL: special shopkeepers only (D-035). */
  imageData?: string;
  /** The fight simulator's sheet (spec 037, D-059); missing: the normal sheet. */
  fight?: FightSheet;
}

/** A special move of the fight simulator (spec 035, D-057). */
export interface FightMove {
  name: string;
  /** A wave can be countered by anything; a rush does not work on giants. */
  kind: 'wave' | 'rush';
  /** A rush that works on giants all the same, as in BT3 (D-057). */
  hitsGiants?: boolean;
  /** Who lands it drains part of the damage into their own health (spec 073, D-098). */
  drains?: boolean;
}

/** The columns of the sheet in the character list (spec 037, 2.2): each one missing takes the normal value. */
export interface FightSheet {
  /** Health bars of 10,000 HP, from 3 to 5. */
  bars?: number;
  /** From 1 to 5. */
  power?: number;
  /** From 1 to 5. */
  speed?: number;
  giant?: boolean;
  move1?: FightMove;
  move2?: FightMove;
  finale?: FightMove;
  /** The code of the next form, a character of the list with a tier (spec 037, 2.3). */
  transformsInto?: string;
  /** HP won back by who transforms into this form (spec 073, D-098). */
  transformHeal?: number;
}

/**
 * 'empty' is a passage cell. Characters go in 'character' cells (D-023);
 * shops have their shopkeeper.
 */
export type NodeType = 'empty' | 'character' | 'shop' | 'start' | 'special';

export type ChallengeFormat = '1v1' | '2v2' | '3v3';

/** The kinds of mission of a character cell (spec 026, 2.1). */
export type MissionType =
  | 'fight'
  | 'quiz'
  | 'goTo'
  | 'defeat'
  | 'bring'
  | 'wait'
  | 'skipTurns'
  // «Ripassa» (spec 084, D-106): wait moving freely, then come back to the cell.
  | 'comeBack'
  | 'other'
  // «Accompagnami da» (spec 069, 2.5; D-097): the giver travels with the player to the target.
  | 'escort';

/** A multiple-choice question (spec 026, 2.5). */
export interface QuizQuestion {
  question: string;
  /** Three or four answers, in the order shown with A, B, C, D. */
  answers: string[];
  /** Index of the right answer. */
  correct: number;
}

/** What completing a mission gives (spec 026, 2.1). */
export interface MissionReward {
  /** The character of the cell joins the team. */
  cellCharacter?: boolean;
  /** Other characters that join the team, e.g. Trunks (bambino) from Bulma. */
  characters?: string[];
  coins?: number;
  items?: string[];
}

/**
 * The challenge of a character cell (spec 026, D-039): what it asks and what
 * it gives. Only the fields of its type matter; the lines tell the audience.
 */
export interface Mission {
  type: MissionType;
  /** Fight: who goes on the field against the player; empty means the cell's character. */
  opponents?: string[];
  format?: ChallengeFormat;
  /** Fight: 'transform' when it is enough that the opponent transforms. */
  condition?: 'win' | 'transform';
  /** goTo, defeat, bring, escort: the character to reach, to beat or to have in the team. */
  targetId?: string;
  /** goTo: and then back to the cell of the character who gave the mission. */
  returnToGiver?: boolean;
  /** wait, skipTurns. */
  turns?: number;
  quiz?: QuizQuestion;
  /** other: what the mission asks, in words. */
  text?: string;
  reward: MissionReward;
}

export interface Point {
  x: number;
  y: number;
}

export interface MapNode {
  id: string;
  /** Position relative to the background image, from 0 to 1 on both axes. */
  x: number;
  y: number;
  type: NodeType;
  /** Special cells only: free colour and meaning (spec generale, 5.1). */
  color?: string;
  note?: string;
}

/**
 * What a cell holds, kept apart from the map (D-016). It comes with the game
 * setup and is part of the game state, so the host can change it any time.
 */
export interface CellContent {
  /** The character in the cell; in a shop, the shopkeeper. */
  characterId?: string;
  /**
   * What the character says in the challenge scene, one balloon each, in
   * order. The task is written inside the lines (D-031).
   */
  lines?: string[];
  /** The mission of the cell (spec 026, D-039). */
  mission?: Mission;
  /**
   * The format of the challenge before missions: read as a fight in that
   * format (D-039). New content keeps the format inside the mission.
   */
  format?: ChallengeFormat;
  /** Shop cells only: characters for sale. */
  forSale?: string[];
}

export interface MapEdge {
  id: string;
  from: string;
  to: string;
  /** Control points that bend the path; empty for a straight line. */
  curve: Point[];
  /** Lock state at the start of the game, the same for both players. */
  locked: boolean;
  lockNote?: string;
  /**
   * Locked paths only: the cell that opens the path for whoever conquers it
   * (D-027). Missing: the host opens the path by hand.
   */
  unlockNodeId?: string;
}

/** Background image, inside the map file (D-018). */
export interface MapBackground {
  /** The image as a data URL. */
  image: string;
  /** Pixel size of the image: the map takes its proportions. */
  width: number;
  height: number;
}

export interface GameMap {
  name: string;
  nodes: MapNode[];
  edges: MapEdge[];
  background?: MapBackground;
}

// ---------------------------------------------------------------------------
// Powers: every power is a trigger -> effect pair
// ---------------------------------------------------------------------------

export type Trigger =
  | { type: 'gameStart' }
  | { type: 'turnStart' }
  | { type: 'turnEnd' }
  // At the end of every Nth turn of the owner; skipped turns do not count.
  | { type: 'everyNTurns'; n: number }
  | { type: 'interaction' }
  // Fired by hand by the host, a limited number of times per game.
  | { type: 'manual'; uses: number };

export type Effect =
  | { type: 'addCoins'; amount: number }
  // With `interactions`, interactions more too: «Doppia azione» (spec 067).
  | { type: 'extraActions'; amount: number; interactions?: number }
  | { type: 'skipOpponentTurn' }
  | { type: 'reminder'; text: string }
  // On the cell of a character who beat the owner: they may challenge it again (spec 061, D-090).
  | { type: 'retryChallenge' };

export interface PowerDefinition {
  name: string;
  trigger: Trigger;
  effect: Effect;
}

// ---------------------------------------------------------------------------
// Shop items: the same in every shop
// ---------------------------------------------------------------------------

export interface ItemDefinition {
  id: string;
  name: string;
  price: number;
  /** Copies each shop sells, whoever buys them; null for unlimited. */
  copiesPerShop: number | null;
  /** Each player should buy it only once across all shops: a guide, not a block. */
  oncePerPlayer: boolean;
  /**
   * Automatic effect on purchase. Items without one go to the inventory
   * and the host applies their effect by hand.
   */
  onPurchase?: 'rechargeStarter';
  /** Training items (spec 041, D-067): "Usa" makes characters of the team take later forms. */
  training?: TrainingRule;
  /**
   * Travel items (spec 047, D-074): "Usa" moves the pawn at most `steps`
   * paths away along the paths open for the player; null for any distance.
   */
  travel?: { steps: number | null };
}

/**
 * How far a training item goes: at most `characters` characters, each up
 * `formsEach` forms, `formsTotal` forms in all. A guide, not a block (D-008).
 */
export interface TrainingRule {
  characters: number;
  formsEach: number;
  formsTotal: number;
}

/** A character of the team and how many forms it goes up. */
export interface TrainingChoice {
  characterId: string;
  forms: number;
}

/** Any catalog character, with the powers the host chose for this game. */
export interface Starter {
  characterId: string;
  powers: PowerDefinition[];
}

// ---------------------------------------------------------------------------
// Game setup
// ---------------------------------------------------------------------------

export interface PlayerSetup {
  name: string;
  starter: Starter;
  startNodeId: string;
}

export interface GameContext {
  map: GameMap;
  catalog: Character[];
  items: ItemDefinition[];
}

export interface GameSetup extends GameContext {
  /** Starting content of the cells: node id -> content. */
  content: Record<string, CellContent>;
  players: Record<PlayerId, PlayerSetup>;
  firstPlayer: PlayerId;
  startingCoins: number;
}

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------

export interface PowerState {
  /** Stable id within the game, e.g. "p1-0". */
  id: string;
  definition: PowerDefinition;
  /** Uses left for manual powers; null for automatic ones. */
  usesLeft: number | null;
}

export interface PlayerState {
  name: string;
  starterId: string;
  /** Node where the pawn stands. */
  position: string;
  coins: number;
  /** Character ids: the first TEAM_SIZE form the team, the rest are extras. */
  team: string[];
  powers: PowerState[];
  /** Item ids bought and not used yet; the host removes an item once used. */
  inventory: string[];
  turnsToSkip: number;
  /** Own turns completed. Skipped turns do not count. */
  turnsPlayed: number;
  /**
   * A sixth character already joined the full team, once per game (spec 061,
   * D-091). Missing in games saved before.
   */
  sixthTaken?: boolean;
}

export interface ItemPurchase {
  itemId: string;
  shopNodeId: string;
  player: PlayerId;
}

/** Reminder for the host: it never blocks anything. */
export interface TurnActions {
  used: number;
  available: number;
  interactionsUsed: number;
  interactionsAvailable: number;
}

/** A mission a player accepted and has not completed or abandoned yet (spec 026, 2.4). */
export interface ActiveMission {
  id: number;
  /** The cell of the character who gave it: its mission says what to do. */
  nodeId: string;
  player: PlayerId;
  /** The player's own turns played when accepting, for "attendi N turni". */
  turnsPlayedAtStart: number;
  /** goTo with return: the pawn has already reached the target. */
  reachedTarget?: boolean;
  /** skipTurns and wait (spec 078): turns still to be skipped; absent in a wait accepted before. */
  turnsToSkipLeft?: number;
}

/** A player lost the challenge of the character at a cell (spec 061, D-090). */
export interface Defeat {
  player: PlayerId;
  nodeId: string;
}

/** Message shown on screen, stream included, until the host closes it. */
export interface Notification {
  id: number;
  text: string;
}

export interface GameState {
  turn: number;
  currentPlayer: PlayerId;
  actions: TurnActions;
  players: Record<PlayerId, PlayerState>;
  /** Conquered cells: node id -> player who conquered it. */
  conquests: Record<string, PlayerId>;
  /** Lock state of every path, separate for each player. */
  edgeLocks: Record<string, Record<PlayerId, boolean>>;
  /** Content of the cells (D-016): node id -> content. Missing means empty. */
  cells: Record<string, CellContent>;
  /** Current prices, editable by the host: character id / item id -> price. */
  characterPrices: Record<string, number>;
  itemPrices: Record<string, number>;
  /** Characters bought in a shop: character id -> first buyer. */
  soldCharacters: Record<string, PlayerId>;
  /** Every item bought, for the "sold out" and "already bought" guides. */
  itemPurchases: ItemPurchase[];
  /** Turn-rule warnings already given this turn: each kind only once (D-013). */
  acknowledgedThisTurn: WarningKind[];
  /**
   * The cell where the current player has already interacted this turn,
   * without leaving it since: interacting there again is a reopening and
   * counts nothing (spec 020, 2.4). Missing in games saved before.
   */
  interactedNodeId?: string | null;
  /** Missions in progress (spec 026, 2.4). Missing in games saved before. */
  activeMissions?: ActiveMission[];
  /**
   * Challenges lost (spec 061, D-090): a fight lost or a quiz answered wrong
   * at a cell. Missing in games saved before.
   */
  defeats?: Defeat[];
  /** Cells turned off by a fusion, for both players (spec 068, 2.3). Missing in games saved before. */
  offCells?: string[];
  nextMissionId?: number;
  notifications: Notification[];
  nextNotificationId: number;
}

// ---------------------------------------------------------------------------
// Actions, warnings and history
// ---------------------------------------------------------------------------

export type GameAction =
  | { type: 'move'; to: string }
  | { type: 'interact'; nodeId: string }
  | { type: 'usePower'; player: PlayerId; powerId: string }
  | { type: 'endTurn' }
  | { type: 'addCharacter'; player: PlayerId; characterId: string }
  | { type: 'removeCharacter'; player: PlayerId; characterId: string }
  | { type: 'setConquest'; nodeId: string; player: PlayerId | null }
  // "Assegna" (spec 020): the cell's character joins the team and the cell is conquered.
  | { type: 'assign'; nodeId: string; player: PlayerId }
  | { type: 'setEdgeLock'; edgeId: string; players: PlayerId | 'both'; locked: boolean }
  // Shop: the buyer is always the current player
  | { type: 'buyCharacter'; shopNodeId: string; characterId: string }
  | { type: 'buyItem'; shopNodeId: string; itemId: string }
  // Manual corrections
  | { type: 'setCoins'; player: PlayerId; coins: number }
  | { type: 'setTurn'; turn: number }
  | { type: 'setCurrentPlayer'; player: PlayerId }
  | { type: 'setActions'; actions: Partial<TurnActions> }
  | { type: 'setTurnsToSkip'; player: PlayerId; turns: number }
  | { type: 'setPowerUses'; player: PlayerId; powerId: string; uses: number }
  | { type: 'placePawn'; player: PlayerId; nodeId: string }
  | { type: 'addToInventory'; player: PlayerId; itemId: string }
  | { type: 'removeFromInventory'; player: PlayerId; itemId: string }
  | { type: 'setCharacterPrice'; characterId: string; price: number }
  | { type: 'setItemPrice'; itemId: string; price: number }
  // Replaces the whole content of a cell (D-016).
  | { type: 'setCellContent'; nodeId: string; content: CellContent }
  // Missions (spec 026): accepted by a player, completed with the reward, or abandoned.
  | { type: 'acceptMission'; nodeId: string; player: PlayerId }
  // withoutCharacters: on the phone a full team after the sixth gets the rest of the reward (spec 063, D-092).
  | { type: 'completeMission'; nodeId: string; player: PlayerId; withoutCharacters?: boolean }
  | { type: 'abandonMission'; missionId: number }
  // A fight lost or a quiz answered wrong (spec 061, D-090): the player may not challenge that cell again.
  | { type: 'loseChallenge'; nodeId: string; player: PlayerId }
  // "Aggiorna la squadra" (spec 037, 2.4): characters that transformed in a
  // simulated fight take their new form in the team.
  | { type: 'transformCharacters'; player: PlayerId; changes: { from: string; to: string }[] }
  // "Usa" on a training item (spec 041): the chosen characters take later forms, the item is used up.
  | { type: 'useTraining'; player: PlayerId; itemId: string; choices: TrainingChoice[] }
  // "Usa" on a Senzu (no `to`) or on a travel item, whose pawn goes `to` a cell (spec 047).
  // A Senzu may name the power it recharges (spec 061, 2.1); otherwise the first rechargeable one.
  | { type: 'useItem'; player: PlayerId; itemId: string; to?: string; powerId?: string }
  // Two characters of the team swap places: the order of the showdown (spec 081).
  | { type: 'swapTeam'; player: PlayerId; a: number; b: number }
  // Two of the team fuse into one (spec 068).
  | { type: 'fuse'; player: PlayerId; members: [string, string]; resultId: string };

export type RecordedAction = { type: 'startGame' } | GameAction;

export type WarningKind =
  | 'powerOutOfUses'
  | 'teamFull'
  | 'starterRemoved'
  | 'characterAlreadyPlaced'
  | 'characterAlreadySold'
  | 'itemSoldOut'
  | 'itemAlreadyBought'
  | 'nothingToRecharge'
  // "Assegna" of a character already in a team (spec 020).
  | 'characterInTeam'
  // Turn rules (D-013, D-014, D-015): given once per turn, asked before acting.
  // 'characterAlreadySold', 'itemSoldOut', 'itemAlreadyBought', 'nothingToRecharge'
  // and 'teamFull' are turn rules too when they come from a purchase.
  | 'nodeAlreadyConquered'
  // A cell turned off by a fusion (spec 068, 2.3).
  | 'cellOff'
  // «Accompagnami da» (spec 069, 2.5): the giver is travelling, one companion at a time.
  | 'companionAway'
  | 'oneCompanion'
  | 'notAdjacent'
  | 'noActionsLeft'
  | 'noInteractionsLeft'
  // "Fine turno" with actions still available (D-033).
  | 'actionsLeft'
  // The other player's pawn dropped on a cell: asked by the director at
  // every drop, never recorded in the game (D-033).
  | 'otherPlayerPawn'
  // Missions (spec 026): accepted twice, or completed by the other player first.
  | 'missionAlreadyActive'
  | 'missionTaken'
  // A training item used past its rule (spec 041).
  | 'trainingRule'
  // A travel item taking the pawn beyond its reach (spec 047).
  | 'travelRange'
  // A character who already beat the player (spec 061, D-090): a turn rule.
  | 'challengeLost'
  // «Ritenta una sfida persa» away from the cell of a character who beat the player.
  | 'nothingToRetry';

/** Non-blocking warning for the host, shown only in the director window (D-008). */
export interface Warning {
  kind: WarningKind;
  message: string;
}

export interface HistoryEntry {
  action: RecordedAction;
  /** Turn and player at the moment the action was taken. */
  turn: number;
  player: PlayerId;
  /** State right after the action. */
  state: GameState;
  warnings: Warning[];
  /** Automatic consequences, for the log: powers fired, turns skipped. */
  events: string[];
}

/** How well the AI of the phone plays (spec 053). */
export type AiLevel = 'easy' | 'normal' | 'hard';

/** The AI opponent of a phone game (spec 053, D-086): which player it is, at which level. */
export interface Opponent {
  player: PlayerId;
  level: AiLevel;
}

/** A game in progress. This is exactly what gets saved to file. */
export interface Game extends GameContext {
  /** Never empty: the first entry is the start of the game. */
  history: HistoryEntry[];
  /** A phone game against the AI (D-086); missing in a game between two people. */
  opponent?: Opponent;
  /** PvP / PvIA, with the app as the arbiter (spec 076, D-101); missing in a game of the director. */
  arbitrated?: boolean;
}
