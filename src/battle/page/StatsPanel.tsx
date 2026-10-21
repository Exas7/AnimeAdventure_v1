import { SIDES, type FightStats } from '../fight';
import { SIDE_NAMES } from '../playback';
import styles from './BattlePage.module.css';

interface StatsPanelProps {
  stats: FightStats;
  milliseconds: number;
}

const percent = (part: number, whole: number) =>
  whole === 0 ? '—' : `${((100 * part) / whole).toFixed(1).replace('.', ',')}%`;
const average = (total: number, fights: number) => (total / fights).toFixed(1).replace('.', ',');

/** The totals of "Lancia 1000 scontri" (2.10). */
export function StatsPanel({ stats, milliseconds }: StatsPanelProps) {
  const clashes = stats.clashes.waves + stats.clashes.rushes + stats.clashes.rushVsWave;
  const moves =
    stats.moves.hit + stats.moves.dodged + stats.moves.failed + stats.moves.giant + clashes;

  return (
    <section className={styles.stats}>
      <h2 className={styles.sectionTitle}>
        {stats.fights} scontri <span className={styles.note}>({(milliseconds / 1000).toFixed(1)} s)</span>
      </h2>
      <dl className={styles.statList}>
        <dt>Vittorie</dt>
        <dd>
          {SIDES.map((side) => `${SIDE_NAMES[side]} ${percent(stats.wins[side], stats.fights)}`).join(' · ')}
        </dd>
        <dt>Durata media</dt>
        <dd>{average(stats.exchanges, stats.fights)} scambi</dd>
        <dt>Cambi</dt>
        <dd>
          {average(stats.switches, stats.fights)} a scontro · subito appena la barra si carica:{' '}
          {percent(stats.immediateSwitches, stats.switches)}
        </dd>
        <dt>Mosse speciali</dt>
        <dd>
          {average(moves, stats.fights)} a scontro: a segno {percent(stats.moves.hit, moves)} · schivate{' '}
          {percent(stats.moves.dodged, moves)} · fallite {percent(stats.moves.failed, moves)} · non
          funzionano sui giganti {percent(stats.moves.giant, moves)} · contrastate {percent(clashes, moves)}
        </dd>
        <dt>Scontri fra mosse</dt>
        <dd>
          {average(clashes, stats.fights)} a scontro: onde contro onde{' '}
          {average(stats.clashes.waves, stats.fights)} · impeti contro impeti{' '}
          {average(stats.clashes.rushes, stats.fights)} · impeto contro onda{' '}
          {average(stats.clashes.rushVsWave, stats.fights)}
        </dd>
      </dl>
    </section>
  );
}
