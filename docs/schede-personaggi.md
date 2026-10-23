# Schede dei personaggi

Le schede che il simulatore di scontro usa per ogni personaggio, e le regole con cui le usa. Mosse e
trasformazioni vengono da *Dragon Ball Z: Budokai Tenkaichi 3*, con i nomi inglesi del gioco; barre,
potenza e velocità le abbiamo scelte noi, in linea con il gioco. Progetto di fan, non ufficiale.

> Questa pagina si genera dalla lista dei personaggi (`personaggi-bt3.csv` e `.xlsx`, in questa
> cartella): non modificarla a mano, cambia la lista.

## Come funziona lo scontro

Lo scontro è una serie di **scambi** fra i due personaggi in campo, in squadre da 1 a 5. Il
simulatore lo calcola tutto in una volta, poi lo racconta scambio per scambio in regia e sulla
stream. I numeri qui sotto sono i valori di partenza del gioco.

- **Il tier decide la forza.** I tier sono 20 gradini, da E a SS+. Ogni gradino in più rende un personaggio più forte del 6,5%, sia nell'attaccare più spesso sia nel danno.
- **La scheda decide lo stile, non il risultato.** Barre di vita (da 3 a 5, ognuna da 10.000 HP), potenza (quanto toglie un colpo) e velocità (quanto spesso attacca e schiva), da 1 a 5, con potenza + velocità = 6. Allo stesso tier, schede diverse vincono più o meno lo stesso numero di volte: il simulatore pareggia i danni di ogni scheda contro quella normale (4 barre, potenza 3, velocità 3). Più barre vogliono dire più colpi per mandare a terra un personaggio, non più forza.
- **Gli attacchi.** A ogni scambio attacca uno dei due: chi è più veloce attacca più spesso. Di solito è un colpo normale (circa 1.500 HP a tier pari e potenza 3); una volta ogni 12 attacchi una delle due mosse base (circa 9.000 HP); una volta ogni 50 la mossa finale (circa 18.000 HP).
- **Onde e impeti.** Ogni mossa è un'onda (energia: raggi, raffiche di ki, esplosioni, bombe, massi lanciati) o un impeto (fisico: cariche, prese). Gli impeti non funzionano sui **giganti**, tranne quelli segnati «colpisce i giganti».
- **Il risucchio.** Una mossa segnata «risucchio» (Drain Life) restituisce a chi la mette a segno il 67% del danno che fa, mai oltre le sue barre. Chi ha una mossa col risucchio afferra anche l'avversario: una volta ogni 15 colpi la presa gli toglie 2.500 HP e glieli prende. I giganti non si afferrano, e chi è di razza «Androide» o «Robot» non si risucchia. Come le altre schede, il risucchio cambia lo stile, non il risultato: il simulatore pareggia i danni di chi risucchia.
- **Come va una mossa.** Schivata il 15% delle volte (di più se chi difende è più veloce), fallita il 10%, contrastata il 30%; altrimenti va a segno.
- **Gli scontri fra mosse.** Se la mossa è contrastata, chi difende risponde con una delle sue (con la mossa finale una volta su 5). Onda contro onda: vince uno dei due, a caso ma pesato su tier e potenza, e fa il 150% del danno della sua mossa. Impeto contro onda: vince sempre l'onda. Impeto contro impeto: vince uno dei due e fa il danno pieno.
- **La forma della squadra.** A inizio scontro ogni squadra tira un dado che la rende più forte o più debole per tutto lo scontro, di solito entro il 22% in più o in meno: la giornata buona o quella storta.
- **Il cambio.** Ogni squadra ha una barra di ricarica che si riempie in 15 scambi. A barra carica il simulatore può cambiare chi è in campo, tanto più volentieri quanta più vita recupererebbe: chi esce torna a fine barra meno 1 (da 14.300 a 19.999 HP).
- **Chi entra**, dopo un cambio o un KO: un compagno al massimo 3 gradini sotto l'avversario in campo, a caso; se non ce n'è, un compagno qualsiasi.
- **Le trasformazioni.** Chi ha una forma successiva («si trasforma in») può trasformarsi in campo, una forma alla volta: una volta ogni 60 scambi a vita piena, fino a 3 volte più spesso vicino al KO. Da lì combatte con tier e scheda della nuova forma, e tiene la vita che aveva; una forma con «cura trasformandosi» recupera in più quegli HP.

## Probabilità di vittoria

Misurate dal simulatore con 2.000 scontri per riga, schede normali e valori di partenza. I dadi
sono sempre gli stessi: rigenerando la pagina i numeri cambiano solo se cambiano le regole.

### Uno contro uno, per distacco di tier

| Distacco | Esempio | Vince il più forte |
|---|---|---|
| 0 gradini | A+ contro A+ | 51% |
| 1 gradino | A+ contro A | 56% |
| 2 gradini | A+ contro A- | 60% |
| 3 gradini | A+ contro B+ | 69% |
| 4 gradini | A+ contro B | 71% |
| 5 gradini | A+ contro B- | 77% |
| 6 gradini | A+ contro C+ | 80% |
| 8 gradini | A+ contro C- | 87% |
| 10 gradini | SS+ contro B | 93% |
| 12 gradini | SS+ contro C+ | 96% |
| 15 gradini | SS+ contro D+ | 99% |
| 19 gradini | SS+ contro E | 99,6% |

### In squadra, 5 gradini di distacco (A+ contro B-)

| Formato | Vince il più forte |
|---|---|
| 1v1 | 77% |
| 3v3 | 82% |
| 5v5 | 83% |

## I personaggi

161 personaggi con un tier, divisi per saga. Prezzo: in un negozio (vuoto per chi non si vende).
Gigante: gli impeti normali non lo colpiscono. Risucchio: la mossa restituisce energia a chi la fa. Cura trasformandosi: gli HP che recupera chi si trasforma in questa forma.

### Dragon Ball (16)

| Personaggio | Tier | Prezzo | Barre | Potenza | Velocità | Gigante | Mossa 1 | Mossa 2 | Mossa finale | Si trasforma in | Cura trasformandosi |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Son Goku (bambino) | C |  | 3 | 2 | 4 |  | Kamehameha (onda) | Counterattack! (impeto) | Penetrate! (impeto, colpisce i giganti) | Son Goku (bambino) Oozaru |  |
| Son Goku (bambino) Oozaru | A- | 1.400 | 5 | 5 | 1 | sì | Chou Makouhou (onda) | Gigant Rock Throw (onda) | Chou Makouhou Barrage (onda) |  |  |
| Muten Roshi | D+ |  | 4 | 3 | 3 |  | The Original Kamehameha (onda) | High Speed Rush (impeto) | Mankoku Kyoutenshou (onda) | Muten Roshi (massima potenza) |  |
| Muten Roshi (massima potenza) | A | 1.600 | 4 | 3 | 3 |  | The Original Kamehameha (onda) | Turtle School Ultimate Fist (impeto) | MAX Power Kamehameha (onda) |  |  |
| Son Gohan (nonno) | D+ |  | 4 | 3 | 3 |  | Kamehameha (onda) | Turtle School Four Virtues (impeto) | Turtle School Tranquility (impeto) |  |  |
| Tao Pai Pai | C |  | 4 | 3 | 3 |  | The Original Dodon-Pa (onda) | Crane Style Assassin Strike (impeto) | Ultimate Final Plan (impeto) |  |  |
| Tao Pai Pai (cyborg) | C+ |  | 4 | 3 | 3 |  | Dodon Ray (onda) | Hidden Blade (impeto) | Super Dodon Wave (onda) |  |  |
| Piccolo Daimao | C+ |  | 4 | 3 | 3 |  | Soumasen (onda) | Your name is Drum (impeto) | Explosive Demon Wave (onda) |  |  |
| Tambourine | C |  | 4 | 3 | 3 |  | Chou Makouhou (onda) | Soumasen (onda) | Super Marengeki (impeto) |  |  |
| C-8 | C- |  | 4 | 3 | 3 |  | Eighter Attack (impeto) | Eighter's Anger (onda) | You Hurt Goku! (impeto) |  |  |
| Generale Blue | E |  | 4 | 3 | 3 |  | I'll Shoot You! (onda) | Skewer! (impeto) | Rocket Engine Spark (impeto) |  |  |
| Namu | D+ |  | 4 | 3 | 3 |  | Shura Gekiretsuken (impeto) | Cross Arm Attack (impeto) | Cross Arm Dive (impeto) |  |  |
| Akkuman | D |  | 4 | 3 | 3 |  | Fork Attack (onda) | Demon Fork Rush (impeto) | Devilmite Beam (onda) |  |  |
| Chichi (bambina) | D- |  | 3 | 2 | 4 |  | Stay Away From Me! (impeto) | That Won't Work (onda) | Save Goku! (impeto) |  |  |
| Robot di Pilaf | D |  | 4 | 3 | 3 |  | Gigant Rock Throw (onda) | Rolling Smash (impeto) | Great Pilaf Operation (impeto) | Robot di Pilaf (combinato) |  |
| Robot di Pilaf (combinato) | C- |  | 5 | 5 | 1 | sì | Double Buster (onda) | Gatling Gun (impeto) | Launch Missiles! (onda) |  |  |

### Saiyan (17)

| Personaggio | Tier | Prezzo | Barre | Potenza | Velocità | Gigante | Mossa 1 | Mossa 2 | Mossa finale | Si trasforma in | Cura trasformandosi |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Son Goku (inizio) | C+ |  | 4 | 3 | 3 |  | Kamehameha (onda) | Kaio-ken Attack (impeto) | Spirit Bomb (onda) |  |  |
| Son Gohan (bambino) | C |  | 3 | 2 | 4 |  | Masenko (onda) | Gekiretsu Madan (onda) | Bakuretsu Ranma (impeto) |  |  |
| Vegeta (scouter) | B | 1.100 | 4 | 3 | 3 |  | Galick Gun (onda) | Final Galick Cannon (impeto) | Dirty Fireworks (impeto) | Vegeta (scouter) Oozaru |  |
| Vegeta (scouter) Oozaru | A | 1.600 | 5 | 5 | 1 | sì | Chou Makouhou (onda) | Chou Makouhou Barrage (onda) | Super Galick Gun (onda) |  |  |
| Piccolo (inizio) | C+ |  | 4 | 3 | 3 |  | Explosive Demon Wave (onda) | Bakuretsu Mahoko (impeto) | Special Beam Cannon (onda) |  |  |
| Krilin | C |  | 4 | 3 | 3 |  | Kamehameha (onda) | Expanding Energy Wave (onda) | Destructo Disc (onda) |  |  |
| Yamcha | C |  | 4 | 3 | 3 |  | Kamehameha (onda) | Wolf Fang Fist (impeto) | Soukidan (onda) |  |  |
| Tenshinhan | C+ |  | 4 | 3 | 3 |  | Dodon Ray (onda) | Ki Blast Cannon (onda) | Neo Tri-Beam (onda) |  |  |
| Jiaozi | D+ |  | 3 | 2 | 4 |  | Dodon Ray (onda) | Psychic Rock Throw (impeto) | Farewell, Mr. Tien (onda) |  |  |
| Yajirobe | D+ |  | 4 | 3 | 3 |  | Ka-Blam Slicer (onda) | Flash and Kill (impeto) | Miracle Ka-Blam Slash (impeto, colpisce i giganti) |  |  |
| Re Vegeta | B- | 1.000 | 4 | 3 | 3 |  | Execution Beam (onda) | Super Energy Wave Volley (onda) | Orga Blaster (impeto) | Re Vegeta Oozaru |  |
| Re Vegeta Oozaru | A- | 1.400 | 5 | 5 | 1 | sì | Super Galick Gun (onda) | Super Explosive Wave (onda) | Chou Makouhou Barrage (onda) |  |  |
| Raditz | C+ |  | 4 | 3 | 3 |  | Here's a present! (onda) | I'm A Top-class Warrior! (impeto) | Begone! (onda) | Raditz Oozaru |  |
| Raditz Oozaru | A- | 1.400 | 5 | 5 | 1 | sì | Chou Makouhou (onda) | Gigant Rock Throw (onda) | Chou Makousen (onda) |  |  |
| Nappa | A- | 1.400 | 4 | 3 | 3 |  | Volcano Explosion (onda) | Blazing Storm (impeto) | Kapa (onda) | Nappa Oozaru |  |
| Nappa Oozaru | A- | 1.400 | 5 | 5 | 1 | sì | Gigant Rock Throw (onda) | Super Explosive Wave (onda) | Chou Makouhou (onda) |  |  |
| Saibaiman | D |  | 3 | 3 | 3 |  | Full Power Energy Wave (onda) | High Speed Rush (impeto) | Saibaman Bomb (impeto) |  |  |

### Freezer (19)

| Personaggio | Tier | Prezzo | Barre | Potenza | Velocità | Gigante | Mossa 1 | Mossa 2 | Mossa finale | Si trasforma in | Cura trasformandosi |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Son Goku (metà) | B+ | 1.200 | 4 | 3 | 3 |  | x20 Kaio-ken Kamehameha (onda) | Meteor Combination (impeto) | Spirit Bomb (onda) | Son Goku (metà) SSJ |  |
| Son Goku (metà) SSJ | A | 1.600 | 4 | 3 | 3 |  | Super Kamehameha (onda) | Meteor Smash (impeto) | Angry Kamehameha (onda) |  |  |
| Nail | B | 1.100 | 4 | 3 | 3 |  | Full Power Energy Wave (onda) | Super Explosive Wave (onda) | Mystic Flasher (impeto) |  |  |
| Zarbon | C+ |  | 4 | 3 | 3 |  | Shooting Star Arrow (onda) | Bloody Dance (impeto) | Elegant Blaster (onda) | Zarbon (trasformato) |  |
| Zarbon (trasformato) | B- | 1.000 | 4 | 3 | 3 |  | Elegant Blaster (onda) | Wild Pressure (impeto) | Monster Crush (impeto) |  |  |
| Dodoria | C+ |  | 4 | 3 | 3 |  | Chou Makouhou (onda) | Dodoria Head Breaker (impeto) | Maximum Buster (onda) |  |  |
| Kyui | C |  | 4 | 3 | 3 |  | Full Power Energy Wave (onda) | Full Power Energy Barrage Wave (impeto) | Ah! Lord Frieza! (impeto) |  |  |
| Appule | D |  | 4 | 3 | 3 |  | Energy Wave (onda) | High Speed Rush (impeto) | Full Power Energy Ball (onda) |  |  |
| Soldato di Freeza | D |  | 4 | 3 | 3 |  | Energy Wave (onda) | Energy Wave (onda) | Life-Risking Blow! (impeto) |  |  |
| Ginyu | B+ | 1.200 | 4 | 3 | 3 |  | Full Power Energy Wave (onda) | Galaxy Dynamite (onda) | Body Change (impeto, colpisce i giganti) |  |  |
| Recoome | B | 1.100 | 4 | 4 | 2 |  | Recoome Eraser Gun (onda) | Recoome Renegade Bomber (onda) | Recoome Fighting Bomber (onda) |  |  |
| Butter | A+ | 1.800 | 4 | 1 | 5 |  | Space Mach Attack (impeto) | Full Power Energy Ball (onda) | Purple Comet Attack (impeto) |  |  |
| Jeeth | A- | 1.400 | 4 | 3 | 3 |  | Full Power Energy Wave (onda) | Crusher Ball (onda) | Purple Comet Attack (impeto) |  |  |
| Guldo | C |  | 3 | 2 | 4 |  | Psychic Rock Throw (impeto) | Full Power Energy Blast Volley (onda) | Guldo Special (impeto) |  |  |
| Freeza (prima forma) | B | 1.100 | 4 | 3 | 3 |  | Death Beam (onda) | Punishing Rush (impeto) | Death Ball (onda) | Freeza (seconda forma) |  |
| Freeza (seconda forma) | B+ | 1.200 | 4 | 3 | 3 |  | Punishing Blaster (onda) | Death Storm (onda) | HAIL Frieza (impeto) | Freeza (terza forma) |  |
| Freeza (terza forma) | B+ | 1.200 | 4 | 3 | 3 |  | Death Beam (onda) | High Speed Rush (impeto) | Crazy Finger Beam (onda) | Freeza (forma finale) |  |
| Freeza (forma finale) | S+ | 2.700 | 4 | 3 | 3 |  | Barrage Death Beam (onda) | I Might Die This Time. (onda) | Destroy The Planet! (onda) | Freeza (massima potenza) |  |
| Freeza (massima potenza) | S+ | 2.700 | 4 | 3 | 3 |  | Death Saucer (onda) | Nova Strike (impeto) | You Will Die By My Hand! (onda) |  |  |

### Cell (25)

| Personaggio | Tier | Prezzo | Barre | Potenza | Velocità | Gigante | Mossa 1 | Mossa 2 | Mossa finale | Si trasforma in | Cura trasformandosi |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Son Gohan (ragazzo) | B+ | 1.200 | 4 | 3 | 3 |  | Super Masenko (onda) | Gekiretsu Madan (onda) | Super Kamehameha (onda) | Son Gohan (ragazzo) SSJ |  |
| Son Gohan (ragazzo) SSJ | A+ | 1.800 | 4 | 3 | 3 |  | Super Masenko (onda) | Chou Maretsugeki (impeto) | Super Kamehameha (onda) | Son Gohan (ragazzo) SSJ2 |  |
| Son Gohan (ragazzo) SSJ2 | S | 2.500 | 4 | 3 | 3 |  | Super Kamehameha (onda) | Gekiretsu Madan (onda) | Father-Son Kamehameha (onda) |  |  |
| Vegeta | B+ | 1.200 | 4 | 3 | 3 |  | Galick Gun (onda) | Super Energy Wave Volley (onda) | Super Explosive Wave (onda) | Vegeta SSJ |  |
| Vegeta SSJ | A | 1.600 | 4 | 3 | 3 |  | Maximum Flasher (onda) | Amazing Impact (impeto) | Big Bang Attack (onda) | Super Vegeta |  |
| Super Vegeta | A+ | 1.800 | 4 | 3 | 3 |  | Big Bang Attack (onda) | Spirit Breaking Cannon (impeto) | Final Flash (onda) |  |  |
| Trunks (spada) | B+ | 1.200 | 4 | 3 | 3 |  | Finish Buster (onda) | Burning Storm (onda) | Lightning Sword Slash (onda) | Trunks (spada) SSJ |  |
| Trunks (spada) SSJ | A | 1.600 | 4 | 3 | 3 |  | Burning Attack (onda) | Burning Storm (onda) | Shining Sword Attack (impeto) |  |  |
| Trunks | B+ | 1.200 | 4 | 3 | 3 |  | Burning Attack (onda) | High Speed Rush (impeto) | Finish Buster (onda) | Trunks SSJ |  |
| Trunks SSJ | A | 1.600 | 4 | 3 | 3 |  | Burning Attack (onda) | Burning Breaker (impeto) | Heat Dome Attack (impeto, colpisce i giganti) | Super Trunks |  |
| Super Trunks | A+ | 1.800 | 4 | 4 | 2 |  | Finish Buster (onda) | Burning Attack (onda) | Super Explosive Wave (onda) |  |  |
| Piccolo (fine) | A | 1.600 | 4 | 3 | 3 |  | Special Beam Cannon (onda) | Light Grenade (onda) | Hellzone Grenade (onda) |  |  |
| Mr. Satan | E |  | 4 | 3 | 3 |  | Dynamic Mess Em Up Punch (impeto) | Present Bomb (onda) | Mister Buu Arrives! (impeto) |  |  |
| Mecha Freeza | A | 1.600 | 4 | 3 | 3 |  | Death Beam (onda) | Fissure Slash (onda) | Supernova (onda) |  |  |
| Re Cold | A | 1.600 | 4 | 3 | 3 |  | Full Power Death Beam (onda) | Super Explosive Wave (onda) | Cold Family Power (impeto) |  |  |
| C-16 | A | 1.600 | 4 | 3 | 3 |  | Hell's Impact (impeto) | Hell's Flash (impeto) | Self Destruct Device (impeto) |  |  |
| C-17 | A | 1.600 | 4 | 3 | 3 |  | Full Power Energy Ball (onda) | Photon Flash (onda) | Sadistic Dance (impeto) |  |  |
| C-18 | A+ | 1.800 | 4 | 3 | 3 |  | Infinity Bullet (onda) | Destructo Disc (onda) | Sadistic 18 (impeto) |  |  |
| C-19 | SS- | 3.200 | 4 | 3 | 3 |  | Full Power Energy Wave (onda) | High Power Rush (impeto) | Drain Life 19 (impeto, risucchio) |  |  |
| Dr. Gero (C-20) | SS- | 3.200 | 4 | 3 | 3 |  | Full Power Energy Wave (onda) | Bionic Punisher (onda) | Drain Life 20 (impeto, risucchio) |  |  |
| Cell (prima forma) | S | 2.500 | 4 | 3 | 3 |  | Kamehameha (onda) | Special Beam Cannon (onda) | Drain Life Cell (impeto, risucchio) | Cell (seconda forma) |  |
| Cell (seconda forma) | S | 2.500 | 4 | 3 | 3 |  | Big Bang Crash (onda) | Drain Life Cell (impeto, risucchio) | Unforgivable! (impeto) | Cell (forma perfetta) | 2.500 HP |
| Cell (forma perfetta) | A+ | 1.800 | 4 | 3 | 3 |  | Super Kamehameha (onda) | Barrage Death Beam (onda) | Perfect Barrier (onda) | Cell (perfetto, massima potenza) | 2.500 HP |
| Cell (perfetto, massima potenza) | SS | 3.600 | 4 | 3 | 3 |  | Full Power Death Beam (onda) | Perfect Combination (impeto) | Solar Kamehameha (onda) |  |  |
| Cell Jr. | B | 1.100 | 3 | 2 | 4 |  | Special Beam Cannon (onda) | Innocence Rush (impeto) | Super Kamehameha (onda) |  |  |

### Majin Bu (36)

| Personaggio | Tier | Prezzo | Barre | Potenza | Velocità | Gigante | Mossa 1 | Mossa 2 | Mossa finale | Si trasforma in | Cura trasformandosi |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Son Goku (fine) | A | 1.600 | 4 | 3 | 3 |  | Kamehameha (onda) | Meteor Smash (impeto) | Super Spirit Bomb (onda) | Son Goku (fine) SSJ |  |
| Son Goku (fine) SSJ | A+ | 1.800 | 4 | 3 | 3 |  | Super Kamehameha (onda) | Super Energy Wave Volley (impeto) | Instant Kamehameha (onda) | Son Goku (fine) SSJ2 |  |
| Son Goku (fine) SSJ2 | S | 2.500 | 4 | 3 | 3 |  | Kamehameha (onda) | Meteor Crash (impeto) | Super Kamehameha (onda) | Son Goku (fine) SSJ3 |  |
| Son Goku (fine) SSJ3 | S+ | 2.700 | 4 | 3 | 3 |  | Super Kamehameha (onda) | Super Explosive Wave (onda) | Dragon Fist (impeto, colpisce i giganti) |  |  |
| Son Gohan | A | 1.600 | 4 | 3 | 3 |  | Explosive Madan (onda) | Full Power Energy Blast Volley (onda) | Super Kamehameha (onda) | Son Gohan SSJ |  |
| Son Gohan SSJ | A+ | 1.800 | 4 | 3 | 3 |  | Explosive Madan (onda) | Full Power Energy Blast Volley (onda) | Bros. Kamehameha (onda) | Son Gohan SSJ2 |  |
| Son Gohan SSJ2 | S | 2.500 | 4 | 3 | 3 |  | Super Explosive Madan (onda) | Full Power Energy Barrage Wave (onda) | Super Kamehameha (onda) |  |  |
| Great Saiyaman | B | 1.100 | 4 | 3 | 3 |  | Super Explosive Wave (onda) | Justice Slash (impeto) | Justice Judgment (impeto) |  |  |
| Son Gohan (Ultimate) | S+ | 2.700 | 4 | 3 | 3 |  | Super Kamehameha (onda) | Super Explosive Wave (onda) | Burst Rush (impeto) |  |  |
| Son Goten | B | 1.100 | 3 | 2 | 4 |  | Full Power Energy Blast Volley (onda) | Assault! (impeto) | Super Kamehameha (onda) | Son Goten SSJ |  |
| Son Goten SSJ | A | 1.600 | 3 | 2 | 4 |  | Kamehameha (onda) | Assault! (impeto) | Bros. Kamehameha (onda) |  |  |
| Vegeta (seconda forma) | A | 1.600 | 4 | 3 | 3 |  | Galick Gun (onda) | Super Energy Wave Volley (onda) | Big Bang Attack (onda) | Vegeta (seconda forma) SSJ |  |
| Vegeta (seconda forma) SSJ | A+ | 1.800 | 4 | 3 | 3 |  | Final Flash (onda) | Super Energy Wave Volley (onda) | Super Explosive Wave (onda) | Vegeta (seconda forma) SSJ2 |  |
| Vegeta (seconda forma) SSJ2 | S | 2.500 | 4 | 3 | 3 |  | Big Bang Attack (onda) | Super Energy Wave Volley (onda) | Final Flash (onda) |  |  |
| Majin Vegeta | S | 2.500 | 4 | 3 | 3 |  | Final Impact (onda) | Big Bang Attack (onda) | Final Explosion (onda) |  |  |
| Trunks (bambino) | B | 1.100 | 3 | 2 | 4 |  | Full Power Energy Wave (onda) | High Speed Rush (impeto) | Finish Buster (onda) | Trunks (bambino) SSJ |  |
| Trunks (bambino) SSJ | A | 1.600 | 3 | 2 | 4 |  | Full Power Energy Barrage Wave (onda) | High Speed Rush (impeto) | Big Tree Cannon (onda) |  |  |
| Gotenks | A+ | 1.800 | 4 | 3 | 3 |  | Full Power Energy Wave (onda) | High Speed Rush (impeto) | Big Tree Cannon (onda) | Gotenks SSJ |  |
| Gotenks SSJ | S- | 2.200 | 4 | 3 | 3 |  | Big Tree Cannon (onda) | Galactic Donuts (onda) | Super Ghost Kamikaze Attack (onda) | Gotenks SSJ3 |  |
| Gotenks SSJ3 | S+ | 2.700 | 4 | 3 | 3 |  | Big Tree Cannon (onda) | DIE DIE Missile Barrage (onda) | Charging Ultra Buu Buu Volleyball (impeto) |  |  |
| Vegetto | SS- | 3.200 | 5 | 3 | 3 |  | Big Bang Attack (onda) | Scatter Finger Beam (onda) | Super Kamehameha (onda) | Super Vegetto |  |
| Super Vegetto | SS+ | 3.900 | 5 | 3 | 3 |  | Super Kamehameha (onda) | Beam Sword Slash (impeto) | Final Kamehameha (onda) |  |  |
| Videl | C- |  | 4 | 3 | 3 |  | High Speed Rush (impeto) | Desperado Rush (impeto) | Videl Rush (impeto) | Great Saiyaman 2-go |  |
| Great Saiyaman 2-go | C |  | 4 | 3 | 3 |  | Justice Countdown (impeto) | Justice Rush 2 (impeto) | Justice Judgment (impeto) |  |  |
| Kaioshin | B+ | 1.200 | 4 | 3 | 3 |  | Energy's Last (onda) | Crazy Rush (impeto) | Gekiretsu Shin'ou'hou (onda) | Kibitoshin |  |
| Kibitoshin | A | 1.600 | 4 | 3 | 3 |  | Full Power Energy Wave (onda) | Crazy Combination (impeto) | Shin Gekiretsu Shin'ou'hou (onda) |  |  |
| Uub | A | 1.600 | 4 | 3 | 3 |  | Super Kamehameha (onda) | Blazing Barrage Palm (impeto) | Super Explosive Wave (onda) | Super Uub |  |
| Majin Buu (buono) | A+ | 1.800 | 4 | 3 | 3 |  | Flame Shower Breath (onda) | Super Kamehameha (onda) | Angry Explosion (onda) |  |  |
| Majin Buu (puro male) | A+ | 1.800 | 4 | 3 | 3 |  | Super Kamehameha (onda) | Flame Shower Breath (onda) | Super Explosive Wave (onda) |  |  |
| Super Buu | S | 2.500 | 4 | 3 | 3 |  | Genocide Blast (onda) | Chocolate Beam (onda) | Revenge Death Bomber (onda) | Super Buu (Gotenks assorbito) |  |
| Super Buu (Gotenks assorbito) | S+ | 2.700 | 4 | 3 | 3 |  | Galactic Donut Volley (onda) | Special Beam Cannon (onda) | Super Kamehameha (onda) | Super Buu (Son Gohan assorbito) |  |
| Super Buu (Son Gohan assorbito) | SS | 3.600 | 4 | 3 | 3 |  | Super Kamehameha (onda) | Chocolate Beam (onda) | Super Ghost Buu Attack (onda) |  |  |
| Majin Buu (puro) | SS | 3.600 | 4 | 3 | 3 |  | Super Kamehameha (onda) | Mystic Combination (impeto) | Planet Burst (onda) |  |  |
| Dabura | A+ | 1.800 | 4 | 3 | 3 |  | Evil Impulse (onda) | Evil Flame (onda) | Darkness Sword Attack (impeto) |  |  |
| Babidi | D- |  | 3 | 2 | 4 |  | Pui Pui Nice Shot (impeto) | Yakon Is Next! (impeto) | Babidi's Ultimate Power (onda) |  |  |
| Spopovitch | C |  | 4 | 3 | 3 |  | Berserker Crash (impeto) | Mad Banquet (impeto) | Majin Buu Resurrection (impeto) |  |  |

### GT (16)

| Personaggio | Tier | Prezzo | Barre | Potenza | Velocità | Gigante | Mossa 1 | Mossa 2 | Mossa finale | Si trasforma in | Cura trasformandosi |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Son Goku (GT) | B+ | 1.200 | 4 | 3 | 3 |  | Kamehameha (onda) | Dragon Fist (impeto, colpisce i giganti) | Spirit Bomb (onda) | Son Goku (GT) SSJ |  |
| Son Goku (GT) SSJ | A+ | 1.800 | 4 | 3 | 3 |  | Super Kamehameha (onda) | Full Power Energy Blast Volley (impeto) | Super Explosive Wave (onda) | Son Goku (GT) SSJ3 |  |
| Son Goku (GT) SSJ3 | S | 2.500 | 4 | 3 | 3 |  | Super Kamehameha (onda) | Full Power Energy Blast Volley (onda) | Dragon Fist (impeto, colpisce i giganti) | Son Goku SSJ4 |  |
| Son Goku SSJ4 | SS | 3.600 | 4 | 3 | 3 |  | 10x Kamehameha (onda) | Meteor Crash (impeto) | Dragon Fist (impeto, colpisce i giganti) |  |  |
| Vegeta SSJ4 | SS | 3.600 | 4 | 3 | 3 |  | Final Flash (onda) | Spirit Breaking Cannon (impeto) | Final Shine Attack (onda) |  |  |
| Gogeta SSJ4 | SS+ | 3.900 | 5 | 3 | 3 |  | Big Bang Kamehameha (onda) | Ultimate Impact (impeto) | 100x Big Bang Kamehameha (onda) |  |  |
| Super Uub | S- | 2.200 | 4 | 3 | 3 |  | Super Energy Wave Volley (onda) | Chocolate Beam (onda) | Lightning Arrow (onda) |  |  |
| Pan | B | 1.100 | 3 | 2 | 4 |  | Kamehameha (onda) | Gill Missile (impeto) | Maiden's Rage! (impeto) |  |  |
| Baby Vegeta | A+ | 1.800 | 4 | 3 | 3 |  | Galick Gun (onda) | Finger Blitz Barrage (onda) | Final Flash (onda) | Super Baby 1 |  |
| Super Baby 1 | S | 2.500 | 4 | 3 | 3 |  | Galick Gun (onda) | Finger Blitz Barrage (onda) | Final Flash (onda) | Super Baby 2 |  |
| Super Baby 2 | S+ | 2.700 | 4 | 3 | 3 |  | Final Flash (onda) | Full Power Energy Blast Volley (onda) | Revenge Death Ball (onda) | Baby Oozaru |  |
| Baby Oozaru | SS- | 3.200 | 5 | 5 | 1 | sì | Super Galick Gun (onda) | Gigantic Flame (onda) | Revenge Death Ball Final (onda) |  |  |
| Super C-17 | S+ | 2.700 | 4 | 3 | 3 |  | Full Power Energy Wave (onda) | Hell's Storm (onda) | Shocking Death Ball (onda) |  |  |
| Su Shenron | S | 2.500 | 4 | 3 | 3 |  | Burst Attack (onda) | Burning Tornado (impeto) | Blaster Meteor (onda) |  |  |
| Ii Shenron | S+ | 2.700 | 4 | 3 | 3 |  | Trap Shooter (onda) | Blazing Storm (onda) | Gigantic Blaze (onda) | Super Ii Shenron |  |
| Super Ii Shenron | SS+ | 3.900 | 4 | 3 | 3 |  | Gigantic Blaze (onda) | Dragon Thunder (impeto) | Minus Energy Power Ball (onda) |  |  |

### Film e speciali (31)

| Personaggio | Tier | Prezzo | Barre | Potenza | Velocità | Gigante | Mossa 1 | Mossa 2 | Mossa finale | Si trasforma in | Cura trasformandosi |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Son Gohan (futuro) | B+ | 1.200 | 4 | 3 | 3 |  | Masenko (onda) | Super Explosive Wave (onda) | Super Kamehameha (onda) | Son Gohan (futuro) SSJ |  |
| Son Gohan (futuro) SSJ | A | 1.600 | 4 | 3 | 3 |  | Gekiretsu Madan (onda) | Special Beam Cannon (onda) | Gekiretsu Ranbu (impeto) |  |  |
| Super Gogeta | SS+ | 3.900 | 5 | 3 | 3 |  | Big Bang Kamehameha (onda) | Super Explosive Wave (onda) | Stardust Breaker (impeto) |  |  |
| Bardock | B- | 1.000 | 4 | 3 | 3 |  | Full Power Energy Wave (onda) | Final Revenger (impeto) | Final Spirit Cannon (onda) | Bardock Oozaru |  |
| Bardock Oozaru | A- | 1.400 | 5 | 5 | 1 | sì | Chou Makouhou (onda) | Super Explosive Wave (onda) | Giga Meteor Storm (onda) |  |  |
| Selypa | C |  | 4 | 3 | 3 |  | Full Power Energy Wave (onda) | Energy Ballet (onda) | Hysteric Saiyan Lady (impeto) | Selypa Oozaru |  |
| Selypa Oozaru | A- | 1.400 | 5 | 5 | 1 | sì | Chou Makouhou Barrage (impeto) | Gigant Rock Throw (onda) | Gigantic Saiyan Lady (impeto) |  |  |
| Paikuhan | S+ | 2.700 | 4 | 3 | 3 |  | Hyper Tornado (impeto) | Burning Shoot (impeto) | Thunder Flash (onda) |  |  |
| Garlic Jr. | C |  | 4 | 3 | 3 |  | Darkness Eye Beam (onda) | High Speed Rush (impeto) | Full Power Energy Ball (onda) | Super Garlic Jr. |  |
| Super Garlic Jr. | B | 1.100 | 4 | 4 | 2 |  | Death Impact (onda) | Darkness Illusion (impeto) | Dead Zone (onda) |  |  |
| Dr. Uiro | B | 1.100 | 4 | 3 | 3 |  | Photon Strike (onda) | Gigantic Bomber (impeto) | Planet Geyser (onda) |  |  |
| Turles | B | 1.100 | 4 | 3 | 3 |  | Kill Driver (onda) | Full Power Energy Barrage Wave (onda) | Meteor Burst (impeto) | Turles Oozaru |  |
| Turles Oozaru | A- | 1.400 | 5 | 5 | 1 | sì | Chou Makouhou (onda) | Chou Makouhou Barrage (onda) | Chou Makousen (onda) |  |  |
| Slug | A- | 1.400 | 4 | 3 | 3 |  | Finger Beam (onda) | Darkness Eye Beam (onda) | Power of Darkness (impeto) | Slug (gigante) |  |
| Slug (gigante) | S- | 2.200 | 5 | 5 | 1 | sì | Darkness Eye Beam (onda) | Super Explosive Wave (onda) | Darkness Blaster (onda) |  |  |
| Sauzer | B- | 1.000 | 4 | 3 | 3 |  | Full Power Energy Wave (onda) | Scatter Finger Beam (onda) | Salza Blade Rush (impeto) |  |  |
| Cooler | A | 1.600 | 4 | 3 | 3 |  | Full Power Energy Wave (onda) | Darkness Eye Beam (onda) | Death Ball (onda) | Cooler (forma finale) |  |
| Cooler (forma finale) | S- | 2.200 | 4 | 3 | 3 |  | Death Beam (onda) | Death Chaser (impeto) | Supernova (onda) |  |  |
| Metal Cooler | S- | 2.200 | 4 | 3 | 3 |  | Lock-On Buster (onda) | Finger Blitz Barrage (onda) | Supernova (onda) |  |  |
| C-13 | A | 1.600 | 4 | 3 | 3 |  | Full Power Energy Wave (onda) | Silent Assassin 13 (impeto) | S.S. Deadly Bomber (onda) | Super C-13 |  |
| Super C-13 | S- | 2.200 | 4 | 3 | 3 |  | S.S. Deadly Bomber (onda) | Super Explosive Wave (onda) | S.S. Deadly Hammer (impeto) |  |  |
| Broli | A+ | 1.800 | 5 | 4 | 2 |  | Full Power Energy Wave (onda) | Bloody Smash (impeto) | Eraser Cannon (onda) | Broli SSJ |  |
| Broli SSJ | S | 2.500 | 5 | 4 | 2 |  | Eraser Cannon (onda) | Trap Shooter (onda) | Super Explosive Wave (onda) | Broli Super Saiyan Leggendario |  |
| Broli Super Saiyan Leggendario | SS | 3.600 | 5 | 4 | 2 |  | Eraser Cannon (onda) | Gigantic Hammer (impeto) | Omega Blaster (onda) |  |  |
| Zangya | B | 1.100 | 4 | 3 | 3 |  | Shoot Blaster (onda) | Trap Shooter (impeto) | Sky Zapper (impeto) |  |  |
| Bojack | A | 1.600 | 4 | 3 | 3 |  | Full Power Energy Ball (onda) | Trap Shooter (onda) | Grand Smasher (onda) | Bojack (massima potenza) |  |
| Bojack (massima potenza) | S- | 2.200 | 4 | 3 | 3 |  | Grand Smasher (onda) | Galactic Tyrant (impeto) | Galactic Buster (onda) |  |  |
| Janemba | S | 2.500 | 4 | 3 | 3 |  | Chou Makouhou (onda) | Rapid Cannon (onda) | Illusion Smash (impeto) | Super Janemba |  |
| Super Janemba | SS | 3.600 | 4 | 3 | 3 |  | Chou Makouhou (onda) | Lightning Shower Rain (impeto) | Dimension Sword Attack (impeto) |  |  |
| Hildegarn | SS+ | 3.900 | 5 | 5 | 1 | sì | Chou Makousen (onda) | Super Explosive Wave (onda) | Gigantic Flame (onda) |  |  |
| Tapion | S- | 2.200 | 4 | 3 | 3 |  | Brave Cannon (onda) | Brave Slash (onda) | Brave Sword Attack (impeto, colpisce i giganti) |  |  |

### Extra (1)

| Personaggio | Tier | Prezzo | Barre | Potenza | Velocità | Gigante | Mossa 1 | Mossa 2 | Mossa finale | Si trasforma in | Cura trasformandosi |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Arale | SS | 3.600 | 4 | 3 | 3 |  | Woohoo! (onda) | Ping! (impeto, colpisce i giganti) | Playing Pro-Wrestling (impeto, colpisce i giganti) |  |  |

## Senza tier

Non combattono nel simulatore: personaggi della storia, per missioni e negozi.

- Kami
- Karin
- Bulma
- Baba la Veggente
- Chichi (adulta)
- Livio
- Maggi
- Meliador
