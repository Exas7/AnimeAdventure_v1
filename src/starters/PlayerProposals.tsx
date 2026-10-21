import type { Character } from '../engine';
import { ProposalEditor, type PowerChoices } from './ProposalEditor';
import type { StarterProposal } from './proposals';
import type { ReadyPower } from './readyPowers';
import styles from './PlayerProposals.module.css';

interface PlayerProposalsProps {
  /** The player's name, or "Giocatore 1" where names are not known yet. */
  playerName: string;
  proposals: StarterProposal[];
  catalog: Character[];
  powers: PowerChoices;
  onChange(index: number, proposal: StarterProposal): void;
  onNewPower?: (use: (power: ReadyPower) => void) => void;
  /** Shows the player's name as a heading above the three proposals. */
  withHeading?: boolean;
  /** Known in "Nuova partita": the power texts show the real coins. */
  startingCoins?: number | null;
}

/** The three starters proposed to one player (spec 025, 2.2 and 2.3). */
export function PlayerProposals(props: PlayerProposalsProps) {
  const { playerName, proposals, onChange } = props;
  return (
    <div className={styles.column}>
      {props.withHeading && <h3 className={styles.heading}>{playerName}</h3>}
      {proposals.map((proposal, index) => (
        <ProposalEditor
          key={index}
          label={`${playerName} n. ${index + 1}`}
          proposal={proposal}
          catalog={props.catalog}
          powers={props.powers}
          onChange={(next) => onChange(index, next)}
          onNewPower={props.onNewPower}
          startingCoins={props.startingCoins}
        />
      ))}
    </div>
  );
}
