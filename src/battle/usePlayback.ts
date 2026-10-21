import { useEffect, useState } from 'react';
import type { FightRecord } from './fight';
import { eventDuration } from './playback';

export type Speed = 1 | 2 | 4;

/** Pause before the first event, at speed 1×. */
const START_PAUSE = 1000;

export interface Playback {
  /** How many events are on screen. */
  shown: number;
  playing: boolean;
  speed: Speed;
  setPlaying(playing: boolean): void;
  setSpeed(speed: Speed): void;
  /** Jumps to a number of events shown, and pauses. */
  jump(shown: number): void;
  /** From the start, playing: for a fight just recorded. */
  restart(): void;
}

/**
 * Telling a recorded fight over time (spec 035, 2.10; spec 037, 2.4): each
 * event stays on screen for its duration at the chosen speed. Shared by the
 * test page and the director.
 */
export function usePlayback(record: FightRecord | null): Playback {
  const [shown, setShown] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);

  useEffect(() => {
    if (!record || !playing) {
      return;
    }
    if (shown >= record.steps.length) {
      setPlaying(false);
      return;
    }
    const last = record.steps[shown - 1];
    const wait = last ? eventDuration(last.event) : START_PAUSE;
    const timer = setTimeout(() => setShown((count) => count + 1), wait / speed);
    return () => clearTimeout(timer);
  }, [record, playing, shown, speed]);

  return {
    shown,
    playing,
    speed,
    setPlaying,
    setSpeed,
    jump: (count) => {
      setPlaying(false);
      setShown(count);
    },
    restart: () => {
      setShown(0);
      setPlaying(true);
    },
  };
}
