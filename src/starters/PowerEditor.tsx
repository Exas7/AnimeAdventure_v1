import { NumberField } from '../ui/NumberField';
import {
  newPowerForm,
  POWER_KINDS,
  powerFields,
  REMINDER_MOMENTS,
  type PowerForm,
  type PowerKind,
  type ReminderMoment,
} from './powerForm';
import styles from './PowerEditor.module.css';

interface PowerEditorProps {
  power: PowerForm;
  onChange(power: PowerForm): void;
  /** Present when the power can be taken away from where it is edited. */
  onRemove?: () => void;
}

/** The kind of a power of the catalog (spec 001, section 6) and the values it needs. */
export function PowerEditor({ power, onChange, onRemove }: PowerEditorProps) {
  const fields = powerFields(power);
  return (
    <div className={`${styles.power} ${onRemove ? styles.removable : ''}`}>
      <select
        value={power.kind}
        aria-label="Tipo di potere"
        onChange={(event) =>
          onChange({ ...newPowerForm(event.target.value as PowerKind), name: power.name })
        }
      >
        {POWER_KINDS.map((entry) => (
          <option key={entry.kind} value={entry.kind}>
            {entry.label}
          </option>
        ))}
      </select>
      <input
        value={power.name}
        placeholder="Nome proprio (facoltativo)"
        aria-label="Nome proprio del potere"
        onChange={(event) => onChange({ ...power, name: event.target.value })}
      />
      {fields.includes('amount') && (
        <label>
          {power.kind === 'fixedExtraActions' || power.kind === 'extraActionsOnDemand'
            ? 'Azioni'
            : 'Monete'}
          <NumberField
            label="Quantità"
            value={power.amount}
            onCommit={(amount) => onChange({ ...power, amount })}
          />
        </label>
      )}
      {fields.includes('n') && (
        <label>
          Ogni N turni
          <NumberField label="N" value={power.n} onCommit={(n) => onChange({ ...power, n })} />
        </label>
      )}
      {fields.includes('uses') && (
        <label>
          Usi
          <NumberField
            label="Usi"
            value={power.uses}
            onCommit={(uses) => onChange({ ...power, uses })}
          />
        </label>
      )}
      {fields.includes('text') && (
        <input
          value={power.text}
          placeholder="Testo del promemoria"
          aria-label="Testo del promemoria"
          onChange={(event) => onChange({ ...power, text: event.target.value })}
        />
      )}
      {fields.includes('moment') && (
        <select
          value={power.moment}
          aria-label="Quando compare il promemoria"
          onChange={(event) => onChange({ ...power, moment: event.target.value as ReminderMoment })}
        >
          {REMINDER_MOMENTS.map((entry) => (
            <option key={entry.moment} value={entry.moment}>
              {entry.label}
            </option>
          ))}
        </select>
      )}
      {onRemove && (
        <button className={styles.remove} onClick={onRemove} aria-label="Togli potere">
          ×
        </button>
      )}
    </div>
  );
}
