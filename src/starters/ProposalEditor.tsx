import type { Character } from '../engine';
import { CharacterPicker } from '../ui/CharacterPicker';
import { starterGroups } from '../ui/characterGroups';
import { PowerSelect } from './PowerSelect';
import type { StarterProposal } from './proposals';
import type { ReadyPower } from './readyPowers';
import styles from './ProposalEditor.module.css';

/** The powers a menu offers: the list's, and older versions kept only here. */
export interface PowerChoices {
  library: ReadyPower[];
  onlyHere: ReadyPower[];
}

interface ProposalEditorProps {
  /** "Giocatore 1 n. 2": who it is proposed to, and which of the three. */
  label: string;
  proposal: StarterProposal;
  catalog: Character[];
  powers: PowerChoices;
  onChange(proposal: StarterProposal): void;
  /** "Nuovo potere…" in the menus; the new power is added to this proposal. */
  onNewPower?: (use: (power: ReadyPower) => void) => void;
  /** Known in "Nuova partita": the power texts show the real coins. */
  startingCoins?: number | null;
}

/** One proposed starter (spec 025): the character, and its powers from the list. */
export function ProposalEditor(props: ProposalEditorProps) {
  const { label, proposal, catalog, powers, onChange, onNewPower, startingCoins } = props;
  const setPowers = (next: ReadyPower[]) => onChange({ ...proposal, powers: next });
  const newPower = (use: (power: ReadyPower) => void) =>
    onNewPower ? () => onNewPower(use) : undefined;

  return (
    <div className={styles.proposal}>
      <span className={styles.label}>{label}</span>
      <CharacterPicker
        catalog={catalog}
        groups={starterGroups(catalog)}
        value={proposal.characterId ?? ''}
        onChange={(characterId) => onChange({ ...proposal, characterId: characterId || undefined })}
        placeholder="Scegli il personaggio…"
        ariaLabel={`Personaggio, ${label}`}
      />
      {proposal.powers.map((power, index) => (
        <div key={`${power.id}-${index}`} className={styles.power}>
          <PowerSelect
            {...powers}
            startingCoins={startingCoins}
            value={power}
            placeholder="Nessun potere"
            ariaLabel={`Potere ${index + 1}, ${label}`}
            onChange={(next) =>
              setPowers(
                next
                  ? proposal.powers.map((current, i) => (i === index ? next : current))
                  : proposal.powers.filter((_, i) => i !== index),
              )
            }
            onNew={newPower((created) =>
              setPowers(proposal.powers.map((current, i) => (i === index ? created : current))),
            )}
          />
          <button
            className={styles.remove}
            onClick={() => setPowers(proposal.powers.filter((_, i) => i !== index))}
            aria-label={`Togli il potere ${index + 1}, ${label}`}
          >
            ×
          </button>
        </div>
      ))}
      <PowerSelect
        {...powers}
        startingCoins={startingCoins}
        value={undefined}
        placeholder={proposal.powers.length === 0 ? 'Scegli il potere…' : '+ potere…'}
        ariaLabel={`Aggiungi un potere, ${label}`}
        onChange={(next) => next && setPowers([...proposal.powers, next])}
        onNew={newPower((created) => setPowers([...proposal.powers, created]))}
      />
    </div>
  );
}
