import { useState, type CSSProperties } from 'react';
import type { Side } from '../fight';
import { BOLT_BOX, lightningBolt, seededRandom } from '../lightning';
import type { WaveLook } from '../waveLook';
import styles from './EnergyWave.module.css';

/**
 * How the wave moves during the event: it reaches the opponent, dies out
 * halfway, or pushes against the other wave of a clash and wins or loses.
 */
export type WaveMode = 'reach' | 'fizzle' | 'pushWin' | 'pushLose';

interface EnergyWaveProps {
  look: WaveLook;
  from: Side;
  mode: WaveMode;
}

/**
 * An energy wave as in the anime (spec 062): the charge on the hands of who
 * throws it, a ray with a white core and streaks running towards the
 * opponent, and a big oval head with a comet tail; an energy ball on its
 * own, born on the hands and flying to the opponent; or a thin ray from a
 * finger. In the colour of the thrower's aura, bigger for the stronger
 * ones, with electric bolts and sparks from tier A+ up.
 */
export function EnergyWave({ look, from, mode }: EnergyWaveProps) {
  // Every wave crackles its own way.
  const [seed] = useState(() => Math.floor(Math.random() * 1_000_000));
  const style = {
    '--wave-color': look.color,
    '--wave-halo': look.halo,
    '--wave-size': look.size,
  } as CSSProperties;
  const ball = look.shape === 'ball';
  return (
    <span
      aria-hidden="true"
      className={[styles.wave, styles[from], styles[look.shape], styles[mode]].join(' ')}
      style={style}
    >
      {!ball && <span className={styles.body} />}
      {!ball && <span className={styles.tail} />}
      {!ball && <span className={styles.charge} />}
      <span className={styles.head}>{ball && look.lightning && <Electricity seed={seed} around="ball" />}</span>
      {!ball && look.lightning && <Electricity seed={seed} around="ray" />}
    </span>
  );
}

const BOLTS = 8;
const SPARKS = 10;

/**
 * Electric bolts that flash on and off along the ray (or around the ball),
 * each with its own shape and rhythm, and sparks flying off.
 */
function Electricity({ seed, around }: { seed: number; around: 'ray' | 'ball' }) {
  const random = seededRandom(seed);
  const place = (index: number, count: number, spread: number) => {
    if (around === 'ray') {
      const side = random() < 0.5 ? -1 : 1;
      return {
        left: `${((index + 0.2 + random() * 0.6) / count) * 100}%`,
        top: `calc(${side * (1.5 + random() * spread)} * var(--wave-size) * 1cqh)`,
        angle: (random() - 0.5) * 60,
      };
    }
    const angle = (index / count) * 360 + random() * 30;
    const radians = (angle * Math.PI) / 180;
    return {
      left: `${50 + 44 * Math.cos(radians)}%`,
      top: `${50 + 44 * Math.sin(radians)}%`,
      angle: angle + 90 + (random() - 0.5) * 40,
    };
  };
  const bolts = Array.from({ length: BOLTS }, (_, index) => ({
    bolt: lightningBolt(seed + index * 7919),
    ...place(index, BOLTS, 3.5),
    zap: 150 + random() * 220,
    delay: -random() * 400,
  }));
  const sparks = Array.from({ length: SPARKS }, (_, index) => ({
    ...place(index, SPARKS, 2.5),
    dx: (random() - 0.5) * 9,
    dy: (random() - 0.5) * 9,
    zap: 260 + random() * 260,
    delay: -random() * 500,
  }));
  return (
    <span className={`${styles.electric} ${styles[around]}`}>
      {bolts.map(({ bolt, left, top, angle, zap, delay }, index) => (
        <svg
          key={`bolt-${index}`}
          className={styles.bolt}
          viewBox={`0 0 ${BOLT_BOX.width} ${BOLT_BOX.height}`}
          preserveAspectRatio="none"
          style={
            {
              left,
              top,
              '--angle': `${angle}deg`,
              '--zap': `${zap}ms`,
              '--delay': `${delay}ms`,
            } as CSSProperties
          }
        >
          <polyline className={styles.boltGlow} points={bolt.main} />
          <polyline className={styles.boltCore} points={bolt.main} />
          {bolt.branches.map((points, branch) => (
            <polyline key={branch} className={styles.boltBranch} points={points} />
          ))}
        </svg>
      ))}
      {sparks.map(({ left, top, dx, dy, zap, delay }, index) => (
        <span
          key={`spark-${index}`}
          className={styles.spark}
          style={
            {
              left,
              top,
              '--dx': `calc(${dx} * var(--wave-size) * 1cqh)`,
              '--dy': `calc(${dy} * var(--wave-size) * 1cqh)`,
              '--zap': `${zap}ms`,
              '--delay': `${delay}ms`,
            } as CSSProperties
          }
        />
      ))}
    </span>
  );
}
