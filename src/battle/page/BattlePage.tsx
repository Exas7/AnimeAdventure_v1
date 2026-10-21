import { useEffect, useMemo, useRef, useState } from 'react';
import { includedCatalog } from '../../included/includedLists';
import { openSyncChannel, type SyncChannel } from '../../sync/channel';
import { battleMessage } from '../../sync/messages';
import {
  DEFAULT_SETTINGS,
  fighterOf,
  fightStats,
  recordFight,
  SIDES,
  type Fighter,
  type FightRecord,
  type FightSettings,
  type FightStats,
  type Side,
} from '../fight';
import { eventDuration, type BattleView } from '../playback';
import { FightPanel, type Speed } from './FightPanel';
import { Knobs } from './Knobs';
import { StatsPanel } from './StatsPanel';
import { TeamColumn } from './TeamColumn';
import styles from './BattlePage.module.css';

/** Pause before the first event, at speed 1×. */
const START_PAUSE = 1000;
const STATS_FIGHTS = 1000;

/**
 * The test page of the fight simulator (spec 035, 2.10): two teams, the
 * knobs, one fight told step by step, and the totals of a thousand fights.
 */
export function BattlePage() {
  // Everyone with a tier can fight (2.6).
  const fighters = useMemo(
    () =>
      new Map(
        includedCatalog().flatMap((character) => {
          const fighter = fighterOf(character);
          return fighter ? [[fighter.id, { character, fighter }] as const] : [];
        }),
      ),
    [],
  );
  const [teams, setTeams] = useState<Record<Side, string[]>>({ a: [], b: [] });
  const [settings, setSettings] = useState<FightSettings>(DEFAULT_SETTINGS);
  // The fight being told, with the knobs it was played with.
  const [fight, setFight] = useState<{ record: FightRecord; settings: FightSettings } | null>(null);
  const [shown, setShown] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const [stats, setStats] = useState<{ stats: FightStats; milliseconds: number } | null>(null);
  const [counting, setCounting] = useState(false);

  const teamFighters = (side: Side): Fighter[] =>
    teams[side].flatMap((id) => {
      const entry = fighters.get(id);
      return entry ? [entry.fighter] : [];
    });
  const ready = SIDES.every((side) => teams[side].length > 0);

  const record = fight?.record;

  // The stream tells the same fight, in step (2.11, D-055).
  const battle = useMemo<BattleView | null>(
    () =>
      fight && { record: fight.record, shown, speed, switchRecharge: fight.settings.switchRecharge },
    [fight, shown, speed],
  );
  const channel = useRef<SyncChannel | null>(null);
  const lastBattle = useRef<BattleView | null>(null);

  useEffect(() => {
    const opened = openSyncChannel((message) => {
      // A stream opened mid-fight asks for it.
      if (message.type === 'requestView' && lastBattle.current) {
        opened.send(battleMessage(lastBattle.current));
      }
    });
    channel.current = opened;
    // Closing the page frees the stream.
    const release = () => opened.send(battleMessage(null));
    window.addEventListener('pagehide', release);
    return () => {
      window.removeEventListener('pagehide', release);
      release();
      opened.close();
      channel.current = null;
    };
  }, []);

  useEffect(() => {
    lastBattle.current = battle;
    if (battle) {
      channel.current?.send(battleMessage(battle));
    }
  }, [battle]);

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

  const simulate = () => {
    const teamsNow = { a: teamFighters('a'), b: teamFighters('b') };
    setFight({ record: recordFight(teamsNow, settings, Math.random), settings });
    setShown(0);
    setPlaying(true);
  };

  const countMany = () => {
    setCounting(true);
    // Let the page show "Calcolo…" before the fights keep the browser busy.
    setTimeout(() => {
      const begin = performance.now();
      const result = fightStats(
        { a: teamFighters('a'), b: teamFighters('b') },
        settings,
        STATS_FIGHTS,
        Math.random,
      );
      setStats({ stats: result, milliseconds: performance.now() - begin });
      setCounting(false);
    }, 30);
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Prova battaglia</h1>
        <p className={styles.note}>
          Concept della spec 035: non fa parte del gioco. Gli scontri non cambiano nessuna partita.
        </p>
      </header>

      <div className={styles.teams}>
        {SIDES.map((side) => (
          <TeamColumn
            key={side}
            side={side}
            ids={teams[side]}
            fighters={fighters}
            onChange={(ids) => setTeams({ ...teams, [side]: ids })}
          />
        ))}
      </div>

      <Knobs settings={settings} onChange={setSettings} />

      <div className={styles.actions}>
        <button type="button" className={styles.primary} disabled={!ready} onClick={simulate}>
          Simula
        </button>
        <button type="button" disabled={!ready || counting} onClick={countMany}>
          {counting ? 'Calcolo…' : `Lancia ${STATS_FIGHTS} scontri`}
        </button>
        <button
          type="button"
          onClick={() => window.open('/?view=stream', 'arkanite-stream', 'popup,width=1280,height=720')}
        >
          Apri la finestra della stream
        </button>
        {!ready && <span className={styles.note}>Metti almeno un personaggio per squadra.</span>}
      </div>

      {stats && <StatsPanel stats={stats.stats} milliseconds={stats.milliseconds} />}

      {fight && (
        <FightPanel
          record={fight.record}
          settings={fight.settings}
          shown={shown}
          playing={playing}
          speed={speed}
          onShown={(count) => {
            setPlaying(false);
            setShown(count);
          }}
          onPlaying={setPlaying}
          onSpeed={setSpeed}
        />
      )}
    </div>
  );
}
