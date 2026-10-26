# Anime Adventure

Un gioco da tavolo per le dirette, da giocare insieme a **Dragon Ball Z:
Budokai Tenkaichi 3**. Due giocatori si muovono su una mappa, incontrano
personaggi, completano missioni (combattimenti su BT3 o simulati, quiz,
sfide) e formano la loro squadra di 5; quando le squadre sono complete, o
i due si incontrano, c'è lo scontro finale.

Il gioco ha due finestre:

- la **regia**, dove chi conduce gestisce tutto: turni, missioni, negozi,
  correzioni;
- lo **stream**, la finestra da mostrare agli spettatori: la catturi con
  OBS oppure la condividi su Discord.

**Gioca online:** https://exas7.github.io/AnimeAdventure_v1/ (meglio con
Chrome), senza scaricare né installare niente: si apre la regia; per lo
stream premi «Apri stream». Le partite restano salvate nel tuo browser.

**Senza conduttore, dal PC:** in «Nuova partita» scegli in alto
«PvP / PvIA» al posto di «Regia + Stream». Giocate 1 contro 1 sullo
stesso PC, oppure contro l'IA (Facile, Normale, Difficile): l'app fa da
arbitro e simula i combattimenti, senza stream.

**Da telefono o tablet**, in orizzontale, lo stesso indirizzo apre il
gioco senza regia: 1 contro 1 passandosi il telefono, oppure contro l'IA
(Facile, Normale, Difficile), con i combattimenti simulati. Gli editor
delle mappe e delle puntate si usano col dito. Su iPhone, per giocare
a schermo intero senza la barra del browser: Condividi → «Aggiungi alla
schermata Home», e apri il gioco dall'icona (le partite salvate lì sono
separate da quelle del browser).

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
> Rabazza), con un contorno aggiunto; i tre ospiti (Livio, Maggi e
> Meliador) sono ritagliati da un'illustrazione «NIGHTLIVE» pubblicata su
> Instagram. I crediti di ognuna sono in `assets/characters/CREDITI.md`.

## Cosa serve

- **Per giocare online**: solo un browser, meglio Chrome, sul computer,
  sul telefono o sul tablet. Niente da scaricare o installare.
- **Budokai Tenkaichi 3** non è obbligatorio: i combattimenti si possono
  giocare su BT3 oppure far simulare al gioco («Simula» in regia; nelle
  partite PvP / PvIA e da telefono sono sempre simulati).

Se vuoi, puoi anche scaricare il gioco e farlo girare sul tuo PC: così
funziona anche senza internet. In questo caso servono:

- **Windows** con **Chrome** (il gioco salva i dati in Chrome); per Mac e
  Linux vedi più sotto;
- **Node.js**, il programma che fa girare il gioco sul tuo PC: se non ce
  l'hai, il launcher ti offre di installarlo;
- internet solo la prima volta e dopo un aggiornamento, per scaricare i
  pacchetti del gioco: poi si gioca anche senza rete.

## Come avviarlo sul tuo PC

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
- **Due regole da sapere**: chi perde una sfida (combattimento o quiz) non
  può sfidare di nuovo quel personaggio, a meno che il suo starter abbia
  il potere «Ritenta una sfida persa»; una volta per partita, con la
  squadra completa, si può arruolare un sesto personaggio e poi cacciarne
  uno (mai lo starter).
- **Oggetti e viaggi**: Nuvola Speedy (750 monete, fino a 7 strade) e
  Trasmissione Istantanea (1.500, una per negozio) non portano mai sulla
  casella dell'avversario, e nel turno dopo un viaggio non ci si muove: si
  fanno solo interazioni. I prezzi di tutti gli oggetti sono nella pagina
  delle regole e dei valori.
- **Missioni della storia**: i cattivi combattono con i loro compagni
  (Freeza con Re Cold, C-17 con C-18…), dietro le strade grigie c'è chi
  nella storia viene dopo, e i personaggi speciali (Bulma, Chichi, Kami…)
  chiedono di accompagnarli da qualcuno, in cambio di monete.
- **Fusioni**: Goku e Vegeta (fine di Dragon Ball) in Vegetto o Gogeta,
  Goku e Vegeta SSJ4 in Gogeta SSJ4, Goten e Trunks bambino in Gotenks:
  con la coppia in squadra il gioco ti chiede se fonderli.
- **Risucchi**: nei combattimenti simulati C-19, C-20 e Cell (prima e
  seconda forma) si riprendono energia con Drain Life e con la presa, e
  compare «CIUCCIAAAAA»; androidi e robot non si risucchiano. Cell recupera
  un po' di vita anche trasformandosi.
- **Missioni «Attendi» e «Ripassa»**: con «Attendi» e «Salta turni» il gioco
  salta da solo i turni di chi accetta (più turni, più monete); con
  «Ripassa» si gioca nel frattempo, ma passati 5 o 6 turni bisogna tornare
  sulla casella per il premio. Il pannello del giocatore dice quanti turni
  mancano.
- **Ordine nello showdown**: nella schermata dello showdown tocca due
  personaggi della stessa squadra per scambiarli di posto.
- **Scorciatoie dal PC** (partita PvP / PvIA e regia): la barra
  spaziatrice due volte di seguito è «Fine turno»; nella finestra «Tocca a
  G2», una pressione preme «Inizia il turno».
- **Apri stream** (in regia): apre la finestra per gli spettatori.

## Regole, valori e statistiche

Due pagine, generate dal gioco stesso: i numeri sono quelli della versione
che hai.

- [Regole e valori](docs/regole-e-valori.md): il turno, i prezzi dei
  personaggi, i premi delle missioni, gli oggetti, i poteri degli starter,
  l'IA, e quello che «Randomizza» mette davvero sulle mappe base
  (misurato su molte puntate tirate a caso).
- [Schede dei personaggi](docs/schede-personaggi.md): le schede di ogni
  personaggio, come funziona lo scontro simulato e le probabilità di
  vittoria secondo il tier.

## I tuoi dati

Mappe, puntate e partite restano **nel tuo browser**: non vanno su
internet. Quelle del sito e quelle del gioco scaricato (che stanno in
Chrome, sull'indirizzo `localhost:5173`) sono separate: le une non vedono
le altre. Per non perderle:

- non cancellare i dati di navigazione del browser per quel sito;
- salva le partite con «Salva su file» ed esporta mappe e puntate.

## Aggiornare a una versione nuova

Il sito si aggiorna da solo: basta ricaricare la pagina.

Per il gioco scaricato: scaricalo di nuovo (o `git pull`) nella stessa
cartella e riavvia il launcher, che ricostruisce da solo ciò che serve. I
tuoi dati restano in Chrome.

## Licenza

[PolyForm Noncommercial 1.0.0](LICENSE): puoi usare, modificare e
condividere il gioco, ma non venderlo né usarlo per guadagnare. I font
hanno le loro licenze libere, nella cartella `src/fonts`.
