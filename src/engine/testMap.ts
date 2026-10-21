import type {
  CellContent,
  Character,
  GameMap,
  GameSetup,
  ItemDefinition,
  PlayerId,
  PowerDefinition,
} from './types';

/**
 * Hand-written test map: 13 cells with generic names and no images. Used by
 * the tests and, from spec 003, to see the board. Two start cells at the
 * sides, a shop near each start, four cells with a character (in the test
 * content, D-016) and a special cell in the middle. Path e8 (c1 – n3) starts
 * locked for both players; s1 and s2 are not connected to each other.
 * Prices are test values only.
 */
export const testCatalog: Character[] = [
  { id: 'hero-1', name: 'Eroe Uno', price: 0 },
  { id: 'hero-2', name: 'Eroe Due', price: 0 },
  { id: 'char-a', name: 'Personaggio A', price: 200 },
  { id: 'char-b', name: 'Personaggio B', price: 250 },
  { id: 'char-c', name: 'Personaggio C', price: 400 },
  { id: 'char-d', name: 'Personaggio D', price: 450 },
  { id: 'char-e', name: 'Personaggio E', price: 300 },
  { id: 'char-f', name: 'Personaggio F', price: 500 },
  { id: 'char-g', name: 'Personaggio G', price: 350 },
  { id: 'char-h', name: 'Personaggio H', price: 800 },
  { id: 'keeper-1', name: 'Negoziante Uno', price: 0 },
  { id: 'keeper-2', name: 'Negoziante Due', price: 0 },
];

/** The items of spec 002, section 5, with test prices. */
export const testItems: ItemDefinition[] = [
  {
    id: 'senzu',
    name: 'Senzu',
    price: 300,
    copiesPerShop: 1,
    oncePerPlayer: false,
    onPurchase: 'rechargeStarter',
  },
  {
    id: 'heavy-clothes',
    name: 'Vestiti pesanti da allenamento',
    price: 200,
    copiesPerShop: null,
    oncePerPlayer: true,
  },
  {
    id: 'gravity-room',
    name: 'Camera Gravitazionale del Dr. Brief',
    price: 400,
    copiesPerShop: null,
    oncePerPlayer: true,
  },
  {
    id: 'time-chamber',
    name: 'Stanza dello Spirito e del Tempo',
    price: 700,
    copiesPerShop: null,
    oncePerPlayer: true,
  },
  { id: 'flying-nimbus', name: 'Nuvola Speedy', price: 250, copiesPerShop: null, oncePerPlayer: false },
  {
    id: 'instant-transmission',
    name: 'Trasmissione Istantanea',
    price: 600,
    copiesPerShop: null,
    oncePerPlayer: false,
  },
];

export const testMap: GameMap = {
  name: 'Mappa di prova',
  nodes: [
    { id: 's1', x: 0.08, y: 0.5, type: 'start' },
    { id: 'n1', x: 0.2, y: 0.3, type: 'empty' },
    { id: 'n2', x: 0.2, y: 0.7, type: 'empty' },
    { id: 'sh1', x: 0.3, y: 0.5, type: 'shop' },
    { id: 'c1', x: 0.38, y: 0.2, type: 'empty' },
    { id: 'c2', x: 0.38, y: 0.8, type: 'empty' },
    { id: 'n3', x: 0.5, y: 0.5, type: 'special' },
    { id: 'c3', x: 0.62, y: 0.2, type: 'empty' },
    { id: 'c4', x: 0.62, y: 0.8, type: 'empty' },
    { id: 'sh2', x: 0.7, y: 0.5, type: 'shop' },
    { id: 'n4', x: 0.8, y: 0.3, type: 'empty' },
    { id: 'n5', x: 0.8, y: 0.7, type: 'empty' },
    { id: 's2', x: 0.92, y: 0.5, type: 'start' },
  ],
  edges: [
    { id: 'e1', from: 's1', to: 'n1', curve: [], locked: false },
    { id: 'e2', from: 's1', to: 'n2', curve: [], locked: false },
    { id: 'e3', from: 'n1', to: 'sh1', curve: [], locked: false },
    { id: 'e4', from: 'n2', to: 'sh1', curve: [], locked: false },
    { id: 'e5', from: 'n1', to: 'c1', curve: [{ x: 0.27, y: 0.18 }], locked: false },
    { id: 'e6', from: 'n2', to: 'c2', curve: [], locked: false },
    { id: 'e7', from: 'sh1', to: 'n3', curve: [], locked: false },
    {
      id: 'e8',
      from: 'c1',
      to: 'n3',
      curve: [],
      locked: true,
      lockNote: 'Si apre dopo aver battuto Personaggio A',
    },
    { id: 'e9', from: 'c2', to: 'n3', curve: [], locked: false },
    { id: 'e10', from: 'n3', to: 'c3', curve: [], locked: false },
    { id: 'e11', from: 'n3', to: 'c4', curve: [], locked: false },
    { id: 'e12', from: 'n3', to: 'sh2', curve: [], locked: false },
    { id: 'e13', from: 'c3', to: 'n4', curve: [], locked: false },
    { id: 'e14', from: 'c4', to: 'n5', curve: [{ x: 0.73, y: 0.82 }], locked: false },
    { id: 'e15', from: 'sh2', to: 'n4', curve: [], locked: false },
    { id: 'e16', from: 'sh2', to: 'n5', curve: [], locked: false },
    { id: 'e17', from: 'n4', to: 's2', curve: [], locked: false },
    { id: 'e18', from: 'n5', to: 's2', curve: [], locked: false },
  ],
};

/** Test content of the cells (D-016): four challengers and two shops. */
export const testContent: Record<string, CellContent> = {
  c1: {
    characterId: 'char-a',
    lines: ['Battimi se ci riesci!', 'Vinci senza trasformazioni'],
    format: '1v1',
  },
  c2: {
    characterId: 'char-b',
    lines: ['Due contro due, niente scuse.', 'Vinci con un solo personaggio rimasto'],
    format: '2v2',
  },
  c3: {
    characterId: 'char-c',
    lines: ['Sei arrivato fin qui?', 'Vinci in meno di due minuti'],
    format: '1v1',
  },
  c4: {
    characterId: 'char-d',
    lines: ['Tre contro tre, se hai coraggio.', 'Vinci senza usare le mosse finali'],
    format: '3v3',
  },
  sh1: { characterId: 'keeper-1', forSale: ['char-e', 'char-f'] },
  sh2: { characterId: 'keeper-2', forSale: ['char-g', 'char-h'] },
};

export interface TestSetupOptions {
  p1Powers?: PowerDefinition[];
  p2Powers?: PowerDefinition[];
  startingCoins?: number;
  firstPlayer?: PlayerId;
}

/** Game setup on the test map: G1 (Eroe Uno) starts on s1, G2 (Eroe Due) on s2. */
export function testSetup(options: TestSetupOptions = {}): GameSetup {
  return {
    map: testMap,
    catalog: testCatalog,
    items: testItems,
    content: testContent,
    players: {
      p1: {
        name: 'G1',
        starter: { characterId: 'hero-1', powers: options.p1Powers ?? [] },
        startNodeId: 's1',
      },
      p2: {
        name: 'G2',
        starter: { characterId: 'hero-2', powers: options.p2Powers ?? [] },
        startNodeId: 's2',
      },
    },
    firstPlayer: options.firstPlayer ?? 'p1',
    startingCoins: options.startingCoins ?? 0,
  };
}
