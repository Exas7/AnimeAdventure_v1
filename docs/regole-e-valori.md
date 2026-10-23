# Regole e valori del gioco

Le regole di Anime Adventure con i valori in vigore, e quello che «Randomizza» mette davvero sulle
mappe che vengono con il gioco. Progetto di fan, non ufficiale.

> Questa pagina si genera dal codice del gioco e dalle liste di questa cartella (`personaggi-bt3`,
> `missioni-bt3`, `domande`): non modificarla a mano. Lo scontro, con le schede dei personaggi e le
> probabilità di vittoria, è in [schede-personaggi.md](schede-personaggi.md).

In **regia** i valori qui sotto sono quelli proposti: chi conduce può cambiare prezzi, monete e
missioni, e una mossa fuori regola dà un avviso, ma con un secondo clic si fa lo stesso. Nella partita
**PvP / PvIA** e sul **telefono** l'app fa da arbitro: ciò che è fuori regola non si fa.

## Il turno

- Ogni turno ha **2 azioni** e **1 interazione**.
- Spostarsi su una casella vicina, lungo una strada aperta, costa 1 azione. Tornare sulla casella da cui
  la pedina è appena partita annulla la mossa, senza spendere niente.
- Interagire con il personaggio della propria casella (la sua sfida) costa 1 azione e l'interazione.
  Riaprire la stessa scena senza lasciare la casella non costa niente.
- Comprare, usare il Senzu o un oggetto di allenamento e fondere due personaggi non costano azioni; un
  oggetto di viaggio costa 1 azione. Un viaggio non porta mai sulla casella dell'avversario, e nel turno dopo
  un viaggio la pedina non si muove: si fanno solo interazioni, anche con un potere che dà azioni in più.
- A fine turno valgono i poteri «a fine turno» e «ogni N turni»; chi deve saltare un turno lo salta, e un
  turno saltato non conta per i poteri.
- La squadra ha **5 posti**. Una volta per partita si può prendere un sesto personaggio: allora
  uno della squadra, mai lo starter, se ne va. Con la squadra completa dopo il cambio, una missione dà
  monete e oggetti ma non personaggi (in regia è un avviso, e decide chi conduce).
- A ogni giocatore si propongono **3 starter**, ciascuno con il suo potere, e ne sceglie uno.
- Si parte con **1.000$**, il valore proposto in «Nuova partita».

### Lo showdown

- È lo scontro finale fra le due squadre: chi lo vince vince la partita. Si apre da solo a fine turno con le
  due pedine sulla stessa casella.
- In regia chi conduce può chiuderlo e continuare; con le squadre complete lo apre a mano.
- Nella partita PvP / PvIA e sul telefono si apre da solo anche quando tutti e due hanno preso il sesto
  personaggio e hanno la squadra completa, e l'app simula lo scontro.

## Le monete

### I prezzi dei personaggi

Il prezzo dipende dal tier. Ogni personaggio si vende una volta sola e non si rivende; quelli senza prezzo
(i tier più bassi e i personaggi della storia) non sono in vendita.

| Tier | Prezzo | Personaggi in vendita |
|---|---|---|
| B- | 1.000$ | 4 |
| B | 1.100$ | 13 |
| B+ | 1.200$ | 11 |
| A- | 1.400$ | 10 |
| A | 1.600$ | 22 |
| A+ | 1.800$ | 16 |
| S- | 2.200$ | 8 |
| S | 2.500$ | 13 |
| S+ | 2.700$ | 10 |
| SS- | 3.200$ | 4 |
| SS | 3.600$ | 8 |
| SS+ | 3.900$ | 5 |

### I premi delle missioni

Le missioni della lista `missioni-bt3`, per tipo: quante sono, quante danno il personaggio della casella e
le monete che promettono. Il premio va a chi completa la missione per primo.

| Tipo | Missioni | Danno il personaggio | Monete in premio |
|---|---|---|---|
| Combattimento | 84 | 68 | 400$, 1.200$, 2.000$ |
| Quiz | 9 | 4 | 400$, 800$, 1.500$ |
| Batti | 38 | 38 | 400$ |
| Porta | 12 | 12 | 400$ |
| Salta turni | 6 | 5 | 900$, 1.500$ |
| Ripassa | 5 | 2 | 2.400$, 2.500$, 2.800$ |
| Accompagnami da | 8 | 0 | 800$ |

## Gli oggetti del negozio

| Oggetto | Prezzo | Copie per negozio | Uno per giocatore | Effetto |
|---|---|---|---|---|
| Senzu | 1.000$ | 1 | no | Si usa appena comprato: ricarica il potere dello starter (un uso in più, o di nuovo le monete in più di «Parti con…»). |
| Vestiti pesanti da allenamento | 500$ | senza limite | sì | Allenamento: 1 personaggio sale di 1 forma. |
| Camera Gravitazionale del Dr. Brief | 1.000$ | senza limite | sì | Allenamento: 1 personaggio sale di 2 forme, oppure 2 personaggi salgono di 1. |
| Stanza dello Spirito e del Tempo | 2.000$ | senza limite | sì | Allenamento: 2 personaggi salgono di 2 forme. |
| Nuvola Speedy | 750$ | senza limite | no | Viaggio: la pedina va fino a 7 strade più in là, per le strade aperte (1 azione). |
| Trasmissione Istantanea | 1.500$ | 1 | no | Viaggio: la pedina va su qualsiasi casella raggiungibile per le strade aperte (1 azione). |

## I poteri degli starter

I poteri pronti che «Randomizza» e «Nuova partita» propongono con gli starter:

- Ogni 2 turni guadagni 200$
- Ogni volta che interagisci con un PG prendi 250$
- Parti con 2.500$ invece che 1.000$
- Due volte per partita puoi ritentare una sfida persa
- Due volte per partita: doppia azione (2 azioni e 1 interazione in più)
- Due volte per partita fai saltare un turno all'avversario

## Le missioni

- **Combattimento**: battere il personaggio della casella, da solo o con i suoi compagni nei 2v2 e nei 3v3, su BT3 o con lo scontro simulato; in qualche missione basta che si trasformi.
- **Quiz**: una domanda a scelta multipla, con una sola risposta. Se le risposte sono tutte uguali è una lotteria: la giusta si estrae a ogni nuova sfida.
- **Vai da**: portare la pedina sulla casella di un altro personaggio.
- **Batti**: conquistare la casella di un altro personaggio, battendolo.
- **Porta**: avere in squadra un certo personaggio.
- **Attendi**: stare fermi mentre passano alcuni turni, che l'app salta da sola.
- **Salta turni**: saltare alcuni turni.
- **Ripassa**: aspettare alcuni dei propri turni giocando, poi tornare sulla casella per il premio.
- **Altro**: una missione scritta a mano: in regia la giudica chi conduce, sul telefono vale la parola del giocatore.
- **Accompagnami da**: il personaggio viaggia con il giocatore fino alla casella di un altro; un compagno alla volta.

Le missioni che durano («Vai da», «Batti», «Porta», «Attendi», «Salta turni», «Ripassa» e «Accompagnami da») si accettano nella scena e danno il premio da sole
quando la condizione si avvera; si possono abbandonare. Una sfida persa non si ritenta, a meno che il
potere dello starter lo permetta.

## «Randomizza»

«Randomizza tutto» prepara una puntata su una mappa: starter, negozi, personaggi e missioni. Le sue regole:

- **Starter:** 3 proposte per giocatore, mai personaggi già sulla mappa.
- **Negozi:** un negoziante e 3 personaggi in vendita per negozio.
- **Personaggi della storia:** circa uno ogni 8 caselle personaggio. Non si
  reclutano: danno solo una missione. Degli ospiti (Livio, Maggi e Meliador) al massimo uno per
  puntata fra i personaggi della storia; come negozianti senza limite.
- **Strade grigie:** chi apre una strada grigia dà solo missioni «Combattimento» e «Batti». Le catene
  della storia mettono dietro la strada un personaggio più forte; le catene più pesanti escono più spesso.
- **Formato degli scontri:** 1v1 nel terzo di caselle più vicino alla propria partenza, 2v2 più lontano, 3v3
  solo nella casella più lontana di ogni lato. Dove potrebbe esserci uno scontro a squadre, il personaggio
  combatte da solo il 67% delle volte fino a B+, il 50% delle volte se è A, il 33% delle volte se è S e il 25% delle volte se è SS.
- **Missioni facili:** «Quiz», «Attendi», «Salta turni» e «Ripassa» reclutano solo personaggi fino a B+.
- **Domande dei quiz:** facili fino a C+, medie da B- a B e difficili da B+ in su; medie per i personaggi della storia. Chi ha domande
  sue fa solo quelle, con le risposte in un ordine nuovo a ogni puntata.
- **Una persona in un posto solo:** lo stesso personaggio, con le sue forme, non compare due volte nella
  puntata.
- **Gregari:** Saibaiman e Cell Jr. non vanno sulla mappa né nei negozi: completano gli
  avversari che mancano negli scontri a squadre (Cell Jr. accanto a un Cell, altrimenti
  Saibaiman).

### Cosa esce davvero

Misurato su 100 puntate tirate a caso per ogni mappa base, con le liste di questa cartella. I dadi
sono sempre gli stessi: rigenerando la pagina i numeri cambiano solo se cambiano le regole, le liste o le
mappe.

**Le caselle personaggio, per missione** (quota delle caselle personaggio)

| | Inferi | Pianeta dei Kaioshin | Pianeta Nameck |
|---|---|---|---|
| Caselle personaggio | 40 | 40 | 42 |
| Combattimento | 72% | 70% | 72% |
| Quiz | 6% | 7% | 6% |
| Batti | 10% | 10% | 9% |
| Porta | 1% | 1% | 1% |
| Salta turni | 2% | 2% | 2% |
| Ripassa | 3% | 3% | 3% |
| Accompagnami da | 6% | 6% | 6% |

**I combattimenti, per formato** (quota dei combattimenti)

| | Inferi | Pianeta dei Kaioshin | Pianeta Nameck |
|---|---|---|---|
| 1v1 | 57% | 55% | 58% |
| 2v2 | 40% | 41% | 38% |
| 3v3 | 4% | 4% | 4% |

**In una puntata, in media**

| | Inferi | Pianeta dei Kaioshin | Pianeta Nameck |
|---|---|---|---|
| Negozi | 2 | 2 | 2 |
| Personaggi della storia | 4,8 | 4,9 | 4,9 |
| Catene sulle strade grigie | 6,0 | 6,0 | 7,0 |
| Personaggi messi sulla mappa per la missione di un altro | 3,5 | 4,0 | 3,7 |
| Caselle che danno il loro personaggio | 78% | 78% | 78% |
| Monete in palio nelle missioni | 24.400$ | 24.800$ | 26.000$ |
| Puntate con un ospite fra i personaggi della storia | 96% | 99% | 96% |
| Ospiti che tengono un negozio | 0,6 | 0,7 | 0,7 |

## L'IA

Nella partita PvP / PvIA e sul telefono l'IA è G2 e gioca con lo stesso arbitro del giocatore.

| | Facile | Normale | Difficile |
|---|---|---|---|
| Quiz giusti | 5 su 10 | 7 su 10 | 9 su 10 |
| Dove va | a caso 6 volte su 10, se no verso la casella utile più vicina | verso la casella più conveniente: il premio diviso per la distanza | verso la casella più conveniente: il premio diviso per la distanza |
| Combattimenti | li accetta tutti | solo se i suoi personaggi non sono più deboli di quelli della missione | simula 40 scontri e combatte se ne vince almeno il 45% |
| Missioni che durano | «Vai da» | «Vai da», «Batti», «Porta» e «Accompagnami da» | «Vai da», «Batti», «Porta» e «Accompagnami da» |
| Negozi | un personaggio a caso fra quelli che può permettersi | il personaggio più forte che può permettersi, gli oggetti di allenamento che può usare, il Senzu quando conviene | il personaggio più forte che può permettersi, gli oggetti di allenamento che può usare, il Senzu quando conviene |
| Oggetti e poteri da usare a mano | no | sì | sì |
| Showdown | non ci pensa | non ci pensa | se lo vincerebbe insegue l'avversario, con la squadra completa o 3 personaggi più di lui; se lo perderebbe gli sta lontano |
| Starter | a caso | il più forte | il più forte |

- Non accetta mai «Attendi», «Salta turni», «Ripassa» e «Altro», e non compra né usa Nuvola Speedy e Trasmissione
  Istantanea.
- Usa «Salta turno» quando l'avversario sta per completare la squadra, a livello Difficile anche quando è
  vicino e lo showdown lo perderebbe, e comunque dal turno 40 in poi.
- Fonde sempre quando può; dopo il sesto personaggio manda via il suo più debole.

## Le fusioni

- Son Goku (fine) e Vegeta (seconda forma): Vegetto; tutti e due SSJ: Super Vegetto o Super Gogeta.
- Son Goku SSJ4 e Vegeta SSJ4: Gogeta SSJ4.
- Son Goten e Trunks (bambino): Gotenks; tutti e due SSJ: Gotenks SSJ.

La fusione prende il posto del primo dei due in squadra, e dello starter se uno dei due lo era. La sua
casella sul tabellone si spegne per tutti e due, e nei negozi esce dalla vendita; una fusione già in
squadra non si ripete.

## Lo scontro

Come funziona lo scontro simulato, le schede dei personaggi e le probabilità di vittoria: vedi
[schede-personaggi.md](schede-personaggi.md).
