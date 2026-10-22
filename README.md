# Anime Adventure

Un gioco da tavolo per le dirette, da giocare insieme a **Dragon Ball Z:
Budokai Tenkaichi 3**. Due giocatori si muovono su una mappa, incontrano
personaggi, completano missioni (combattimenti su BT3, quiz, sfide) e
formano la loro squadra di 5; quando le squadre sono complete, o i due si
incontrano, c'è lo scontro finale.

Il gioco ha due finestre:

- la **regia**, dove chi conduce gestisce tutto: turni, missioni, negozi,
  correzioni;
- lo **stream**, la finestra da mostrare agli spettatori: la catturi con
  OBS oppure la condividi su Discord.

**Gioca online:** https://exas7.github.io/AnimeAdventure_v1/ (meglio con
Chrome): si apre la regia; per lo stream premi «Apri stream». Le partite
restano salvate nel tuo browser.

**Da telefono o tablet**, in orizzontale, lo stesso indirizzo apre il
gioco senza regia: 1 contro 1 passandosi il telefono, oppure contro l'IA
(Facile, Normale, Difficile), con i combattimenti simulati. Gli editor
delle mappe e delle puntate si usano col dito. Da Impostazioni avanzate →
«Versione telefono» la si può accendere anche sul PC.

> Progetto di fan, non ufficiale e senza scopo di lucro. Dragon Ball e i
> suoi personaggi appartengono ai rispettivi proprietari. Le immagini
> degli oggetti del negozio vengono dal web o sono generate e appartengono
> ai loro autori: Senzu, render di Forever-DB (DeviantArt); Camera
> Gravitazionale, navicella da Comic Vine; Vestiti pesanti, generati con
> Ideogram; Stanza dello Spirito e del Tempo, Nuvola Speedy e abitante di
> Yardrat (Trasmissione Istantanea), immagini dal web. Gli sfondi della
> pagina iniziale, Shenron e la Kame House, sono generati con Gemini. Le
> immagini dei personaggi sono illustrazioni ufficiali di Dragon Ball:
> Sparking! ZERO, Dragon Ball Legends e Budokai Tenkaichi 3 (Bandai
> Namco) e ritagli di fan su DeviantArt di illustrazioni ufficiali
> (Maxiuchiha22, SuperDabura, Ltxalex, PrinceofDBZGames, MonkeyOfLife,
> Rabazza), con un contorno aggiunto; i crediti di ognuna sono in
> `assets/characters/CREDITI.md`.

## Cosa serve

- **Windows** con **Chrome** (il gioco salva i dati in Chrome).
- **Node.js**, il programma che lo fa funzionare: se non ce l'hai, il
  launcher ti offre di installarlo.
- Per giocare davvero: Budokai Tenkaichi 3, dove si fanno i combattimenti.

## Come avviarlo

### Strada 1, la più semplice: chiedi a un agente AI

Apri questa cartella con un agente AI che lavora sui file del computer
(per esempio **Claude Code**) e chiedigli quello che ti serve, in
italiano. Per esempio:

- «Avvia il gioco.»
- «Crea una nuova mappa sullo sfondo degli Inferi, con 80 caselle.»
- «Aggiungi Vegeta (scouter) alla lista dei personaggi, tier B.»
- «Aggiungi una missione: Freezer chiede di battere Zarbon.»
- «Preparami una puntata pronta da giocare sul Pianeta dei Kaioshin.»

L'agente trova le istruzioni che gli servono nel file `AGENTS.md`.

Un limite da sapere: l'agente prepara i **file** (mappe, puntate, liste di
personaggi, missioni e domande). Il gioco vero, con regia e stream, lo usi
tu nell'app, dove quei file si caricano con i tasti «Importa».

### Strada 2: doppio clic sul launcher

Fai doppio clic su **`Avvia Anime Adventure.bat`**. Ti guida passo per
passo:

1. controlla Node.js e, se manca, ti offre di installarlo;
2. controlla Chrome;
3. la prima volta installa i pacchetti del gioco (qualche minuto, serve
   internet);
4. prepara il gioco, solo quando è cambiato qualcosa: dalla seconda volta
   parte subito;
5. apre la **regia** in Chrome.

Lascia aperta la finestra nera del launcher: chiudendola si spegne il
gioco.

### Su Mac o Linux

Installa Node.js 22 o più recente da <https://nodejs.org>, poi in questa
cartella:

```
npm ci
npm run build
npm run preview -- --port 5173 --strictPort
```

e apri <http://localhost:5173> in Chrome. Oppure chiedi all'agente AI.

## Come si gioca, in breve

- **Nuova partita**: scegli una delle tre mappe di base (Pianeta Nameck,
  Pianeta dei Kaioshin, Inferi) e premi «Randomizza tutto»: mette starter,
  personaggi, negozi e missioni. Poi «Scelta degli starter» e si parte.
- **Puntate**: per preparare in anticipo una partita, con personaggi e
  missioni scelti da te.
- **Editor delle mappe**: per disegnare mappe nuove sugli sfondi.
- **Apri stream** (in regia): apre la finestra per gli spettatori.

## I tuoi dati

Mappe, puntate e partite restano **nel tuo Chrome**, sull'indirizzo
`localhost:5173`: non vanno su internet. Per non perderle:

- non cancellare i dati di navigazione di Chrome per quel sito;
- salva le partite con «Salva su file» ed esporta mappe e puntate.

## Aggiornare a una versione nuova

Scarica di nuovo il gioco (o `git pull`) nella stessa cartella e riavvia
il launcher: ricostruisce da solo ciò che serve. I tuoi dati restano in
Chrome.

## Licenza

[PolyForm Noncommercial 1.0.0](LICENSE): puoi usare, modificare e
condividere il gioco, ma non venderlo né usarlo per guadagnare. I font
hanno le loro licenze libere, nella cartella `src/fonts`.
