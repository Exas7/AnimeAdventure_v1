# Immagini dei personaggi

Ogni personaggio può avere due immagini con lo stesso nome (D-024, spec
013, spec 051 e D-081):

- **la figura intera**, in questa cartella. L'app la mostra intera nei
  riquadri alti: la scena della sfida, le carte nella scelta degli
  starter, i combattenti in campo nello scontro simulato;
- **il volto**, nella sottocartella `volti/`. L'app lo mostra nei
  riquadri piccoli e quadrati: il cerchio della casella sulla mappa, la
  squadra, il negozio, lo showdown, l'elenco dei combattenti.

Senza volto, nei riquadri piccoli l'app usa la figura intera e ne mostra
il centro. Senza nessuna immagine il personaggio compare come cerchio o
rettangolo bianco col nome in nero.

I 166 personaggi della lista inclusa hanno già figura e volto, in WebP:
le figure hanno un contorno del colore dell'aura del personaggio. Fonti
e autori di ogni immagine stanno in `CREDITI.md`.

## Come chiamare i file

Il nome del file è il nome del personaggio, come nella lista dei personaggi:

- `Son_Goku_(inizio).webp` → Son Goku (inizio)
- `volti/Freeza_(forma_finale).webp` → il volto di Freeza (forma finale)

Maiuscole, accenti, spazi e trattini bassi non contano (`Son_Goku_(meta).jpg`
va bene per Son Goku (metà)).

- Formati: PNG, JPG o WebP. Il volto è meglio quadrato, con la faccia al
  centro; la figura intera verticale, con lo sfondo trasparente.
- Un'immagine nuova compare al prossimo avvio col doppio clic su
  `Avvia Anime Adventure.bat`.
- Se rinomini un personaggio nella lista, rinomina anche le sue immagini.
