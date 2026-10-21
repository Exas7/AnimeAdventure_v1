# Istruzioni per gli agenti AI

Questo file è per te, agente AI, che aiuti una persona a usare Anime
Adventure. Chi ti scrive di solito **non è un programmatore**: parla in
italiano, spiega in parole semplici cosa fai e chiedi conferma prima di
cancellare o sovrascrivere qualcosa.

## Cos'è

Un gioco da tavolo per dirette su Twitch, da giocare con Dragon Ball Z:
Budokai Tenkaichi 3. È un'app web (React, TypeScript, Vite) senza server:
gira sul computer di chi gioca, in Chrome, e salva i dati nell'archivio di
Chrome (IndexedDB) dell'indirizzo `http://localhost:5173`.

Due finestre dello stesso Chrome: la **regia** (`/`) e lo **stream**
(`/?view=stream`), che si parlano tra loro.

## Comandi

- Installare i pacchetti: `npm ci` (serve Node.js 20.19+ o 22.12+).
- Avviare per giocare: `npm run build`, poi
  `npm run preview -- --port 5173 --strictPort`, e aprire
  <http://localhost:5173> in Chrome. Su Windows fa tutto il launcher
  `Avvia Anime Adventure.bat`.
- **Sempre la porta 5173**: i dati di chi gioca sono legati a
  quell'indirizzo; su un'altra porta l'app partirebbe vuota.
- Test: `npm test`. Controllo dei tipi: `npm run typecheck`. Fai girare
  entrambi dopo ogni modifica a codice, mappe o liste.

## Dove sta cosa

| Cartella | Contenuto |
|---|---|
| `src/engine/` | regole del gioco (turni, missioni, poteri, salvataggi) |
| `src/director/` | la regia |
| `src/stream/` | la finestra dello stream |
| `src/editor/` | l'editor delle mappe; `mapEdit.ts` ha `checkMap`, il controllo delle regole delle mappe |
| `src/episode/` | le puntate e «Randomizza» |
| `src/included/` | i dati che vengono con l'app |
| `assets/maps/*.jpg` | gli **sfondi**: immagini, scelte dal menu «Sfondi…» dell'editor |
| `assets/maps/incluse/*.json` | le **mappe base**: sfondo più caselle e percorsi |
| `docs/*.csv` | le liste: personaggi, missioni, domande |
| `docs/*.xlsx` | le stesse liste in Excel, per modificarle a mano |

Uno **sfondo** è solo l'immagine; una **mappa** è lo sfondo più caselle e
percorsi. Una **puntata** è una mappa con i personaggi, le missioni e i
negozi già messi.

## Cosa puoi fare tu e cosa fa la persona

Tu prepari **file**: mappe, puntate, liste. La persona li carica nell'app:

- una mappa: nell'editor delle mappe, «Importa file»; oppure, per farla
  diventare una mappa base, il file in `assets/maps/incluse/`;
- una puntata: in «Puntate», «Importa puntata»;
- le liste: «Importa lista personaggi» nel menu iniziale; in «Puntate», le
  schede «Missioni» e «Domande», con «Importa da Excel» (accetta i CSV).

Le liste in `docs/` l'app le carica da sola **solo se Chrome non ne ha
già**: dopo averle modificate, la persona le deve reimportare.

Non toccare i dati di chi gioca salvati in Chrome, e non aggiungere
pacchetti npm senza chiederlo.

## Il file di una mappa

```json
{
  "format": "arkanite-map",
  "version": 1,
  "map": {
    "name": "Pianeta Nameck",
    "nodes": [{ "id": "n1", "x": 0.14, "y": 0.75, "type": "start" }],
    "edges": [
      { "id": "e1", "from": "n1", "to": "n2", "curve": [], "locked": false }
    ],
    "background": { "image": "data:image/jpeg;base64,…", "width": 1200, "height": 896 }
  }
}
```

- `x` e `y` vanno da 0 a 1, rispetto allo sfondo (0,0 in alto a sinistra).
- Tipi di casella (`type`): `empty` (pallino di passaggio), `character`
  (casella personaggio), `shop` (negozio), `start` (partenza), `special`
  (pallino di un altro colore, con `color` e `note` liberi).
- `curve`: punti `{ "x", "y" }` che piegano il percorso; vuoto = dritto.
- Strada grigia: `"locked": true`, con `unlockNodeId` (la casella che la
  apre) e `lockNote` (testo libero).
- Lo sfondo va **dentro** il file, come immagine in base64.
- La mappa non dice quali personaggi ci sono: quello lo decide la puntata.
- Leggere e scrivere: `parseMap` e `serializeMap` in `src/editor/mapFile.ts`.

### Le regole delle mappe

`checkMap` le controlla tutte; una mappa base non deve dare nessun avviso.

1. Due partenze; per le mappe base, sul bordo, in due angoli opposti.
2. Almeno due negozi, circa a metà strada da ciascuna partenza.
3. Accanto a una partenza solo pallini (`empty`).
4. Tutte le caselle collegate e raggiungibili da una partenza.
5. **Nessun vicolo cieco**: ogni casella, tranne le partenze, ha almeno
   due percorsi aperti. Unica eccezione: una casella personaggio dietro
   una strada grigia, che ha solo quella.
6. **Ogni strada grigia** parte da una casella personaggio, che ha anche
   almeno due percorsi aperti e la apre (`unlockNodeId`), e porta a una
   casella personaggio in fondo a un vicolo cieco.
7. Mappe base: niente caselle speciali; circa 100 caselle, 40 caselle
   personaggio, 6-8 strade grigie, divise in modo simile tra i due lati.
8. Caselle e percorsi sulla terra: il mare o la lava si attraversano solo
   per unire le isole, meglio dove lo sfondo disegna un ponte.

Aggiungendo una mappa base, aggiorna l'elenco delle mappe nel test
«the three default maps» in `src/included/included.test.ts`, poi `npm test`.

## Il file di una puntata

```json
{ "format": "arkanite-episode", "version": 5, "episode": {
  "name": "…", "map": { …la mappa intera… },
  "content": { "n12": { "characterId": "…", "lines": ["…"], "mission": { … } } },
  "starters": { … }
} }
```

- `content` dice cosa c'è in ogni casella: `characterId` (in un negozio,
  il negoziante), `lines` (le battute), `mission`, e per i negozi
  `forSale` (personaggi in vendita).
- Una missione (`Mission` in `src/engine/types.ts`) ha `type` (`fight`,
  `quiz`, `goTo`, `defeat`, `bring`, `wait`, `skipTurns`, `other`), i
  campi del suo tipo e `reward` (premio: `cellCharacter`, `characters`,
  `coins`, `items`).
- Il codice di un personaggio nasce dal nome (`characterIdOf` in
  `src/catalog/importCatalog.ts`).
- `starters` (gli starter proposti) è facoltativo: senza, li sceglie chi
  gioca in «Nuova partita».
- Leggere e scrivere: `parseEpisode` e `serializeEpisode` in
  `src/episode/episodeFile.ts`. Controlla sempre il file con
  `parseEpisode` prima di consegnarlo.

## Le liste (CSV)

- Separatore `;`, codifica UTF-8. La **prima riga è l'intestazione**:
  rispetta le colonne che trovi, senza cambiarne i nomi.
- Personaggi (`docs/personaggi-bt3.csv`): una riga per forma. Il significato
  delle colonne è in `src/catalog/importCatalog.ts`. Il tier va da E a SS+
  (con + e −); i personaggi senza tier non si reclutano.
- Missioni (`docs/missioni-bt3.csv`): chi la dà (un personaggio o un
  gruppo: `cattivi`, `arruolabili`, `storia`), tipo, valori del tipo,
  premio, peso e battute (separate da ` | `; `{obiettivo}`, `{premio}`,
  `{n}` diventano i valori veri). Vedi `src/missions/catalogCsv.ts`.
- Domande (`docs/domande.csv`): `domanda;A;B;C;D;giusta`.
- Se modifichi un CSV, modifica allo stesso modo il file Excel con lo
  stesso nome, se la persona lo usa.
