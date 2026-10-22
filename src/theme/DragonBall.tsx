import { useId } from 'react';
import { starPath, starRadius, starSpots } from './ballStars';

/** React's ids hold characters that url(#…) does not take: letters and digits only. */
function useSvgId(prefix: string): string {
  return `${prefix}${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
}

/** A dragon ball, glossy, with its red stars (spec 050, 2.4). */
export function DragonBall({ stars, className }: { stars: number; className?: string }) {
  const id = useSvgId('ball');
  const radius = starRadius(stars);
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}body`} cx="50%" cy="64%" r="62%" fx="52%" fy="68%">
          <stop offset="0" stopColor="#ffe066" />
          <stop offset="0.45" stopColor="#ffb627" />
          <stop offset="0.8" stopColor="#f77f1f" />
          <stop offset="1" stopColor="#d4501a" />
        </radialGradient>
        <linearGradient id={`${id}star`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff4a3d" />
          <stop offset="1" stopColor="#b3121a" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="48.5" fill="#fff3c4" stroke="#000000" strokeWidth="1.5" />
      <circle cx="50" cy="50" r="44" fill={`url(#${id}body)`} stroke="#c2410c" strokeWidth="1" />
      <path d="M21 62 C 15 46, 20 29, 35 18" fill="none" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" opacity="0.7" />
      <ellipse cx="39" cy="21" rx="11" ry="5.5" transform="rotate(-24 39 21)" fill="#ffffff" opacity="0.92" />
      <circle cx="59" cy="13.5" r="3.1" fill="#ffffff" opacity="0.92" />
      {starSpots(stars).map((spot) => (
        <path
          key={spot.join()}
          d={starPath(spot, radius)}
          fill={`url(#${id}star)`}
          stroke="#6e0a0a"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

const GRID_STEPS = [-3, -2, -1, 0, 1, 2, 3];
const GRID =
  GRID_STEPS.map((step) => `M${(50 + step * 10.3).toFixed(1)} 20V90`).join('') +
  GRID_STEPS.map((step) => `M15 ${(55 + step * 10.3).toFixed(1)}H85`).join('');

/** The dragon radar, for «Riprendi la partita»: the grid and the dots that blink (spec 050, 2.4). */
export function DragonRadar({ className, blipClassName }: { className?: string; blipClassName?: string }) {
  const id = useSvgId('radar');
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}case`} cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.6" stopColor="#dfe5ea" />
          <stop offset="1" stopColor="#9aa6b0" />
        </radialGradient>
        <radialGradient id={`${id}screen`} cx="45%" cy="40%" r="70%">
          <stop offset="0" stopColor="#b8f5a0" />
          <stop offset="0.55" stopColor="#5fc46a" />
          <stop offset="1" stopColor="#25713a" />
        </radialGradient>
        <clipPath id={`${id}clip`}>
          <circle cx="50" cy="55" r="31" />
        </clipPath>
      </defs>
      <rect x="42" y="1.5" width="16" height="11" rx="3" fill={`url(#${id}case)`} stroke="#000000" strokeWidth="1.5" />
      <circle cx="50" cy="55" r="43" fill={`url(#${id}case)`} stroke="#000000" strokeWidth="1.8" />
      <circle cx="50" cy="55" r="33.5" fill="#1d2a22" />
      <circle cx="50" cy="55" r="31" fill={`url(#${id}screen)`} />
      <path d={GRID} stroke="#1f5e2c" strokeWidth="1.1" opacity="0.6" clipPath={`url(#${id}clip)`} />
      <path d="M50 50.5 L54.5 59 H45.5 Z" fill="#d7262b" stroke="#6e0a0a" strokeWidth="1" />
      <circle className={blipClassName} cx="66" cy="42" r="4.6" fill="#ffd21f" stroke="#a86b00" strokeWidth="1" />
      <circle className={blipClassName} cx="36" cy="70" r="3.4" fill="#ffd21f" stroke="#a86b00" strokeWidth="1" />
      <ellipse cx="40" cy="40" rx="13" ry="6" transform="rotate(-30 40 40)" fill="#ffffff" opacity="0.35" />
    </svg>
  );
}
