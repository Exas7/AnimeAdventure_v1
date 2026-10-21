import type { ReadyPower } from './readyPowers';
import { cardTextFor } from './starterChoice';

/** Value of the menu entry that opens the form for a new power. */
const NEW_POWER = '__nuovo-potere__';

interface PowerSelectProps {
  /** The list of powers (D-037). */
  library: ReadyPower[];
  /** Copies kept here whose version the list no longer has (spec 025, 2.1). */
  onlyHere: ReadyPower[];
  value: ReadyPower | undefined;
  onChange(power: ReadyPower | undefined): void;
  placeholder: string;
  ariaLabel: string;
  /** Present in "Nuova partita": a last entry, "Nuovo potere…", opens the form. */
  onNew?: () => void;
  /** Known in "Nuova partita": the texts show the real coins (spec 029, 2.5). */
  startingCoins?: number | null;
}

/** The menu of the powers of a proposed starter (spec 025, 2.2 and 2.3). */
export function PowerSelect(props: PowerSelectProps) {
  const { library, onlyHere, value, onChange, placeholder, ariaLabel, onNew } = props;
  const text = (power: ReadyPower) => cardTextFor(power, props.startingCoins ?? null);
  const all = [...library, ...onlyHere];
  return (
    <select
      value={value?.id ?? ''}
      aria-label={ariaLabel}
      onChange={(event) => {
        if (event.target.value === NEW_POWER) {
          onNew?.();
          return;
        }
        onChange(all.find((power) => power.id === event.target.value));
      }}
    >
      <option value="">{placeholder}</option>
      <optgroup label="Poteri">
        {library.map((power) => (
          <option key={power.id} value={power.id}>
            {text(power)}
          </option>
        ))}
      </optgroup>
      {onlyHere.length > 0 && (
        <optgroup label="Solo qui (versione vecchia)">
          {onlyHere.map((power) => (
            <option key={power.id} value={power.id}>
              {text(power)}
            </option>
          ))}
        </optgroup>
      )}
      {onNew && <option value={NEW_POWER}>Nuovo potere…</option>}
    </select>
  );
}
