import { useState } from 'react';
import { cellNumber, PLAYER_IDS, type CellContent, type GameContext, type PlayerId } from '../engine';
import type { RandomReport } from '../episode/randomReport';
import { InfoButton } from '../ui/InfoButton';
import { NumberField } from '../ui/NumberField';
import { Tile } from '../ui/Tile';
import { PlayerProposals } from '../starters/PlayerProposals';
import { PowerDialog } from '../starters/PowerDialog';
import { powersInProposals, proposalIssues, withProposal } from '../starters/proposals';
import type { ReadyPowerDraft } from '../starters/ReadyPowerForm';
import { availablePowers, type ReadyPower } from '../starters/readyPowers';
import { starterConflicts } from '../starters/starterConflicts';
import {
  browserPreferences,
  MAP_GROUPS,
  readClosedGroups,
  writeClosedGroups,
  type MapChoice,
  type MapKind,
} from './mapGroups';
import { playerNames, type NewGameForm, type PlayerForm } from './newGame';
import { RandomReportTiles } from './RandomReportTiles';
import styles from './Screens.module.css';

interface NewGameScreenProps {
  mapChoices: MapChoice[];
  selectedMapId: string;
  onSelectMap(id: string): void;
  context: GameContext;
  /** What the cells hold: the episode's, or what "Randomizza tutto" drew; empty on a bare map. */
  content: Record<string, CellContent>;
  form: NewGameForm;
  onChange(form: NewGameForm): void;
  /** The list of ready powers (D-037). */
  readyPowers: ReadyPower[];
  /**
   * "Nuovo potere…": the power is saved in the list, then given to the
   * proposal. Null when it could not be saved: the director already says why.
   */
  onCreatePower(draft: ReadyPowerDraft): Promise<ReadyPower | null>;
  /** "Scelta degli starter": opens the scene on director and stream (spec 025, 2.4). */
  onOpenChoice(): void;
  /** "← Menu iniziale" (spec 028, 3.1). */
  onBackToMenu(): void;
  /** Present only when a game is in progress: going back keeps it unchanged. */
  onResumeGame?: () => void;
  /** "Randomizza tutto" (spec 030, 2.3): present with a map, not with an episode. */
  onRandomize?: () => void;
  /**
   * What "Randomizza tutto" did, null before it; `round` counts the draws,
   * so that each one shows its tendine closed (spec 033, 2.3).
   */
  random: { report: RandomReport; round: number } | null;
  /** The name of the episode saved with "Salva anche come puntata"; null before it. */
  savedAsEpisode: string | null;
  onSaveAsEpisode(): void;
}

/**
 * "Nuova partita" (spec 003, 2.2; spec 025, 2.3): players, start cells,
 * the proposed starters with their powers, coins and who starts.
 */
export function NewGameScreen(props: NewGameScreenProps) {
  const { context, form, onChange } = props;
  // "Nuovo potere…" waits for the form: then the new power goes where it was asked.
  const [newPowerFor, setNewPowerFor] = useState<((power: ReadyPower) => void) | null>(null);
  const names = playerNames(form);
  const powers = availablePowers(props.readyPowers, powersInProposals(form.proposals));
  const guides = [
    ...proposalIssues(form.proposals, context.catalog, names).map((issue) => issue.message),
    ...starterConflicts(form.proposals, props.content, context.map, context.catalog),
  ];

  const updatePlayer = (playerId: PlayerId, changes: Partial<PlayerForm>) =>
    onChange({
      ...form,
      players: { ...form.players, [playerId]: { ...form.players[playerId], ...changes } },
    });

  return (
    <div className={styles.screen}>
      <h1 className={styles.title}>Nuova partita</h1>
      <MapTiles
        choices={props.mapChoices}
        selectedId={props.selectedMapId}
        onSelect={props.onSelectMap}
      />
      {props.onRandomize && (
        <div className={styles.choices}>
          <button className={styles.primary} onClick={props.onRandomize}>
            {props.random ? 'Randomizza di nuovo' : 'Randomizza tutto'}
            <small>starter, poteri, negozi, personaggi e missioni</small>
          </button>
          {props.random &&
            (props.savedAsEpisode ? (
              <span className={styles.note}>Salvata in Puntate come «{props.savedAsEpisode}».</span>
            ) : (
              <button onClick={props.onSaveAsEpisode}>Salva anche come puntata</button>
            ))}
        </div>
      )}
      {props.random && <RandomReportTiles key={props.random.round} report={props.random.report} />}

      <div className={styles.players}>
        {PLAYER_IDS.map((playerId) => (
          <section key={playerId} className={`${styles.player} ${styles[playerId] ?? ''}`}>
            <label>
              Nome
              <input
                value={form.players[playerId].name}
                onChange={(event) => updatePlayer(playerId, { name: event.target.value })}
              />
            </label>
            <label>
              Partenza
              <select
                value={form.players[playerId].startNodeId}
                onChange={(event) => updatePlayer(playerId, { startNodeId: event.target.value })}
              >
                {context.map.nodes
                  .filter((node) => node.type === 'start')
                  .map((node) => (
                    <option key={node.id} value={node.id}>
                      Casella {cellNumber(node.id)}
                    </option>
                  ))}
              </select>
            </label>
            <h3 className={styles.subtitle}>
              Starter proposti{' '}
              <InfoButton label="Starter proposti">
                Qui si cambiano solo per questa partita: la puntata salvata resta com'è. Lo starter
                scelto esce dalla mappa e al suo posto ne arriva un altro.
              </InfoButton>
            </h3>
            <PlayerProposals
              playerName={names[playerId]}
              proposals={form.proposals[playerId]}
              catalog={context.catalog}
              powers={powers}
              onChange={(index, proposal) =>
                onChange({ ...form, proposals: withProposal(form.proposals, playerId, index, proposal) })
              }
              onNewPower={(use) => setNewPowerFor(() => use)}
              startingCoins={form.startingCoins}
            />
          </section>
        ))}
      </div>

      {guides.length > 0 && (
        <div className={styles.guides}>
          {guides.map((guide) => (
            <p key={guide}>⚠ {guide}</p>
          ))}
        </div>
      )}

      <div className={styles.row}>
        <label>
          Monete iniziali
          <NumberField
            label="Monete iniziali"
            value={form.startingCoins}
            onCommit={(startingCoins) => onChange({ ...form, startingCoins })}
          />
        </label>
        <label>
          Comincia
          <select
            value={form.firstPlayer}
            onChange={(event) =>
              onChange({ ...form, firstPlayer: event.target.value === 'p2' ? 'p2' : 'p1' })
            }
          >
            {PLAYER_IDS.map((playerId) => (
              <option key={playerId} value={playerId}>
                {names[playerId]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.choices}>
        <button className={styles.primary} onClick={props.onOpenChoice}>
          Scelta degli starter
        </button>
        <button onClick={props.onBackToMenu}>← Menu iniziale</button>
        {props.onResumeGame && (
          <button onClick={props.onResumeGame}>Torna alla partita in corso</button>
        )}
      </div>
      <p className={styles.note}>
        La scelta si fa nella scena, su regia e stream: chi comincia sceglie per primo.
      </p>

      {newPowerFor && (
        <PowerDialog
          onClose={() => setNewPowerFor(null)}
          onSave={(draft) => {
            const use = newPowerFor;
            setNewPowerFor(null);
            void props.onCreatePower(draft).then((power) => {
              if (power) {
                use(power);
              }
            });
          }}
        />
      )}
    </div>
  );
}

interface NewGameUnavailableProps {
  missing: 'catalog' | 'map';
  onOpenMaps(): void;
  onBack(): void;
}

/** "Nuova partita" without a character list or a map: says what is missing (spec 010). */
export function NewGameUnavailable({ missing, onOpenMaps, onBack }: NewGameUnavailableProps) {
  return (
    <div className={styles.screen}>
      <h1 className={styles.title}>Nuova partita</h1>
      <p className={styles.note}>
        {missing === 'catalog'
          ? 'Serve la lista dei personaggi: importala dal menu iniziale con "Importa lista personaggi".'
          : "Non c'è nessuna mappa: disegnane una con l'editor delle mappe."}
      </p>
      <div className={styles.choices}>
        {missing === 'map' && (
          <button className={styles.primary} onClick={onOpenMaps}>
            Editor delle mappe
          </button>
        )}
        <button onClick={onBack}>← Menu iniziale</button>
      </div>
    </div>
  );
}

interface MapTilesProps {
  choices: MapChoice[];
  selectedId: string;
  onSelect(id: string): void;
}

/**
 * Puntate, Le mie mappe, Mappe base: tiles that open and close, only those
 * with something inside, and Chrome remembers which are closed (spec 033,
 * 2.1; D-050).
 */
function MapTiles({ choices, selectedId, onSelect }: MapTilesProps) {
  const [closed, setClosed] = useState(() => readClosedGroups(browserPreferences()));

  const toggle = (kind: MapKind, open: boolean) => {
    if (open !== closed.has(kind)) {
      return;
    }
    const next = new Set(closed);
    if (open) {
      next.delete(kind);
    } else {
      next.add(kind);
    }
    setClosed(next);
    writeClosedGroups(browserPreferences(), next);
  };

  return (
    <div className={styles.tiles}>
      {MAP_GROUPS.map((group) => {
        const inGroup = choices.filter((choice) => choice.kind === group.kind);
        if (inGroup.length === 0) {
          return null;
        }
        const chosen = inGroup.find((choice) => choice.id === selectedId);
        const open = !closed.has(group.kind);
        return (
          <Tile
            key={group.kind}
            title={group.label}
            count={inGroup.length}
            detail={
              <>
                {group.description}
                {!open && chosen && <strong className={styles.chosenName}> · scelta: {chosen.name}</strong>}
              </>
            }
            open={open}
            onToggle={(isOpen) => toggle(group.kind, isOpen)}
          >
            <div className={styles.mapButtons}>
              {inGroup.map((choice) => (
                <button
                  key={choice.id}
                  className={choice.id === selectedId ? styles.chosen : undefined}
                  aria-pressed={choice.id === selectedId}
                  onClick={() => onSelect(choice.id)}
                >
                  {choice.name}
                </button>
              ))}
            </div>
          </Tile>
        );
      })}
    </div>
  );
}
