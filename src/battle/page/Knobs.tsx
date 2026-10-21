import { DEFAULT_SETTINGS, type FightSettings } from '../fight';
import styles from './BattlePage.module.css';

interface KnobsProps {
  settings: FightSettings;
  onChange: (settings: FightSettings) => void;
}

interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** What the value means, next to the label. */
  text: string;
  onChange: (value: number) => void;
}

function Knob({ label, value, min, max, step, text, onChange }: KnobProps) {
  return (
    <label className={styles.knob}>
      <span className={styles.knobLabel}>
        {label}: <strong>{text}</strong>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

const percent = (value: number) => `${Math.round(value * 100)}%`;
const oneIn = (chance: number) => Math.round(1 / chance);

/** The knobs to tune the simulator (2.10); the starting values are those of the spec. */
export function Knobs({ settings, onChange }: KnobsProps) {
  const set = (change: Partial<FightSettings>) => onChange({ ...settings, ...change });
  const changed = (Object.keys(DEFAULT_SETTINGS) as (keyof FightSettings)[]).some(
    (key) => settings[key] !== DEFAULT_SETTINGS[key],
  );

  return (
    <section className={styles.knobs}>
      <h2 className={styles.sectionTitle}>Manopole</h2>
      <div className={styles.knobGrid}>
        <Knob
          label="Forma della squadra"
          value={settings.formSpread}
          min={0}
          max={0.5}
          step={0.01}
          text={settings.formSpread === 0 ? 'nessuna' : `±${percent(settings.formSpread)} circa`}
          onChange={(formSpread) => set({ formSpread })}
        />
        <Knob
          label="Mosse base"
          value={oneIn(settings.moveChance)}
          min={4}
          max={40}
          step={1}
          text={`1 attacco su ${oneIn(settings.moveChance)}`}
          onChange={(value) => set({ moveChance: 1 / value })}
        />
        <Knob
          label="Mossa finale"
          value={oneIn(settings.finaleChance)}
          min={10}
          max={200}
          step={5}
          text={`1 attacco su ${oneIn(settings.finaleChance)}`}
          onChange={(value) => set({ finaleChance: 1 / value })}
        />
        <Knob
          label="Contromosse"
          value={settings.counterChance}
          min={0}
          max={0.5}
          step={0.01}
          text={`${percent(settings.counterChance)} delle mosse`}
          onChange={(counterChance) => set({ counterChance })}
        />
        <Knob
          label="Ricarica del cambio"
          value={settings.switchRecharge}
          min={1}
          max={40}
          step={1}
          text={`${settings.switchRecharge} scambi`}
          onChange={(switchRecharge) => set({ switchRecharge })}
        />
        <Knob
          label="Trasformazioni"
          value={oneIn(settings.transformChance)}
          min={5}
          max={200}
          step={5}
          text={`1 scambio su ${oneIn(settings.transformChance)} a vita piena`}
          onChange={(value) => set({ transformChance: 1 / value })}
        />
      </div>
      <button type="button" disabled={!changed} onClick={() => onChange(DEFAULT_SETTINGS)}>
        Valori di partenza
      </button>
    </section>
  );
}
