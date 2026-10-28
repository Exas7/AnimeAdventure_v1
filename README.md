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
> suoi personaggi appartengono ai rispettivi proprietari. Da dove vengono
> le immagini: vedi [Crediti delle immagini](#crediti-delle-immagini).

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

## Le regole

In **regia** le regole sono una guida: chi conduce può cambiare prezzi,
monete e missioni, e una mossa fuori regola dà un avviso, ma con un
secondo clic si fa lo stesso. Nella partita **PvP / PvIA** e sul
**telefono** l'app fa da arbitro: ciò che è fuori regola non si fa. I
numeri qui sotto sono quelli che il gioco propone.

### Come si vince

Ognuno forma una squadra di **5 personaggi**. La partita finisce con lo
**showdown**, lo scontro fra le due squadre: chi lo vince vince la
partita.

- Lo showdown si apre da solo a fine turno, quando le due pedine sono
  sulla stessa casella.
- In regia chi conduce lo può aprire anche a mano, con le squadre
  complete. Nella partita PvP / PvIA e sul telefono si apre da solo anche
  quando tutti e due hanno la squadra completa e hanno già preso il sesto
  personaggio (vedi «La squadra»).
- Nella schermata dello showdown tocca due personaggi della stessa
  squadra per scambiarli di posto.

### L'inizio

- A ognuno si propongono **3 starter** e ne sceglie uno. Lo starter è il
  primo della squadra, non se ne va mai, e ha un **potere**, uno di
  questi:
  - Ogni 2 turni guadagni 200$
  - Ogni volta che interagisci con un PG prendi 250$
  - Parti con 2.500$ invece che 1.000$
  - Due volte per partita puoi ritentare una sfida persa
  - Due volte per partita: doppia azione (2 azioni e 1 interazione in più)
  - Due volte per partita fai saltare un turno all'avversario
- Si parte con **1.000$**.

### Il turno

Ogni turno hai **2 azioni** e **1 interazione**.

- **Muoversi** di una casella, lungo una strada aperta, costa 1 azione:
  senza poteri ti sposti al massimo di 2 caselle a turno. Se torni sulla
  casella da cui sei appena partito, la mossa si annulla e non spendi
  niente.
- **Sfidare il personaggio** della tua casella costa 1 azione e
  l'interazione: una sfida a turno. Quindi in un turno fai 2 caselle,
  oppure 1 casella e una sfida. Riaprire la stessa scena senza lasciare la
  casella non costa niente.
- Entrare in un negozio, comprare, usare il Senzu o un oggetto di
  allenamento e fondere due personaggi non costano azioni; usare un
  oggetto di viaggio costa 1 azione.
- Chi deve saltare un turno lo salta, e un turno saltato non conta per i
  poteri «ogni N turni».

### La mappa

- **Caselle personaggio**: ognuna ha un personaggio e la sua missione.
- **Negozi**: personaggi in vendita e oggetti (vedi «Il negozio»).
- **Pallini**: caselle di passaggio, senza niente.
- **Strade grigie**: chiuse all'inizio. Si aprono completando la missione
  della casella davanti, e solo per chi l'ha completata. Dietro di solito
  c'è un personaggio più forte, spesso chi nella storia viene dopo.
- Sul tabellone appare grigio ciò che il giocatore di turno non può
  usare: strade chiuse per lui, personaggi già presi o già venduti.
- I **personaggi della storia** (come Bulma, Chichi o Kami) non entrano in
  squadra: danno solo una missione, con un premio in monete.

### Le missioni

Il premio è il personaggio della casella, delle monete, o tutti e due, e
va a **chi completa la missione per primo**.

- **Combattimento**: battere il personaggio della casella, da solo o con
  i suoi compagni (2 contro 2, 3 contro 3), su BT3 o con lo scontro
  simulato; in qualche missione basta costringerlo a trasformarsi.
- **Quiz**: una domanda a scelta multipla, con una sola risposta giusta.
- **Batti**: battere il personaggio di un'altra casella.
- **Vai da**: portare la pedina sulla casella di un altro personaggio.
- **Porta**: avere in squadra un certo personaggio.
- **Accompagnami da**: il personaggio viaggia con te fino alla casella di
  un altro; un compagno alla volta.
- **Attendi** e **Salta turni**: stare fermi per alcuni turni, che il
  gioco salta da solo; più turni, più monete.
- **Ripassa**: intanto si gioca, ma passati 5 o 6 turni bisogna tornare
  sulla casella per il premio. Il pannello del giocatore dice quanti
  turni mancano.
- **Altro**: una missione scritta a mano: in regia la giudica chi
  conduce.

Le missioni che durano (tutte tranne Combattimento, Quiz e Altro) si
accettano nella scena, danno il premio da sole quando la condizione si
avvera, e si possono abbandonare.

**Chi perde una sfida** (combattimento o quiz) non può sfidare di nuovo
quel personaggio, a meno che il suo starter abbia il potere «ritentare
una sfida persa».

### Il negozio

Si compra con la pedina sulla casella del negozio: arrivarci è un
movimento normale, entrare e comprare non costano azioni.

- **Personaggi**: il prezzo dipende dal tier, da 1.000$ (tier B-) a
  3.900$ (tier SS+). Ognuno si vende una volta sola, a chi arriva prima,
  e non si rivende.
- **Oggetti**:

| Oggetto | Prezzo | A cosa serve |
|---|---|---|
| Senzu | 1.000$ | Ricarica il potere dello starter: un uso in più, o di nuovo le monete in più di «Parti con…». Si usa appena comprato. Uno per negozio. |
| Vestiti pesanti da allenamento | 500$ | Allenamento: 1 personaggio sale di 1 forma. |
| Camera Gravitazionale del Dr. Brief | 1.000$ | Allenamento: 1 personaggio sale di 2 forme, oppure 2 personaggi salgono di 1. |
| Stanza dello Spirito e del Tempo | 2.000$ | Allenamento: 2 personaggi salgono di 2 forme. |
| Nuvola Speedy | 750$ | Viaggio: la pedina va fino a 7 strade più in là, per le strade aperte. |
| Trasmissione Istantanea | 1.500$ | Viaggio: la pedina va su qualsiasi casella raggiungibile per le strade aperte. Una per negozio. |

- **Salire di una forma** vuol dire passare alla trasformazione
  successiva, come in BT3: per esempio Vegeta → Vegeta SSJ → Super
  Vegeta. Chi non ha forme successive non sale. Ogni oggetto di
  allenamento si compra una volta sola per giocatore.
- **I viaggi** costano 1 azione, non portano mai sulla casella
  dell'avversario, e nel turno dopo un viaggio la pedina non si muove: si
  fanno solo interazioni, anche con un potere che dà azioni in più.

### La squadra

- La squadra ha 5 posti. Una volta per partita, con la squadra completa,
  si può prendere un **sesto personaggio**: poi uno della squadra se ne
  va, mai lo starter.
- **Fusioni**: con la coppia in squadra il gioco ti chiede se fonderli.
  Son Goku (fine) e Vegeta (seconda forma) diventano Vegetto, o Super
  Vegetto o Super Gogeta se tutti e due sono SSJ; Son Goku SSJ4 e Vegeta
  SSJ4 diventano Gogeta SSJ4; Son Goten e Trunks (bambino) diventano
  Gotenks, o Gotenks SSJ. La fusione prende il posto del primo dei due.

### Tutti i numeri

Due pagine, generate dal gioco stesso: i numeri sono quelli della versione
che hai.

- [Regole e valori](docs/regole-e-valori.md): le regole per intero, i
  prezzi dei personaggi tier per tier, i premi delle missioni, come gioca
  l'IA ai tre livelli, e quello che «Randomizza» mette davvero sulle
  mappe base (misurato su molte puntate tirate a caso).
- [Schede dei personaggi](docs/schede-personaggi.md): le schede di ogni
  personaggio, come funziona lo scontro simulato e le probabilità di
  vittoria secondo il tier.

## Usare l'app

- **Nuova partita**: scegli una delle tre mappe di base (Pianeta Nameck,
  Pianeta dei Kaioshin, Inferi) e premi «Randomizza tutto»: mette starter,
  personaggi, negozi e missioni. Poi «Scelta degli starter» e si parte.
- **Puntate**: per preparare in anticipo una partita, con personaggi e
  missioni scelti da te.
- **Editor delle mappe**: per disegnare mappe nuove sugli sfondi.
- **Apri stream** (in regia): apre la finestra per gli spettatori.
- **Scorciatoie dal PC** (partita PvP / PvIA e regia): la barra
  spaziatrice due volte di seguito è «Fine turno»; nella finestra «Tocca a
  G2», una pressione preme «Inizia il turno».

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

## Crediti delle immagini

Le immagini degli oggetti del negozio vengono dal web o sono generate e
appartengono ai loro autori: Senzu, render di Forever-DB (DeviantArt);
Camera Gravitazionale, navicella da Comic Vine; Vestiti pesanti, generati
con Ideogram; Stanza dello Spirito e del Tempo, Nuvola Speedy e abitante
di Yardrat (Trasmissione Istantanea), immagini dal web. Gli sfondi della
pagina iniziale, Shenron e la Kame House, sono generati con Gemini. Le
immagini dei personaggi sono illustrazioni ufficiali di Dragon Ball:
Sparking! ZERO, Dragon Ball Legends e Budokai Tenkaichi 3 (Bandai Namco)
e ritagli di fan su DeviantArt di illustrazioni ufficiali (Maxiuchiha22,
SuperDabura, Ltxalex, PrinceofDBZGames, MonkeyOfLife, Rabazza), con un
contorno aggiunto; i tre ospiti (Livio, Maggi e Meliador) sono ritagliati
da un'illustrazione «NIGHTLIVE» pubblicata su Instagram. I crediti di
ognuna sono in `assets/characters/CREDITI.md`.
