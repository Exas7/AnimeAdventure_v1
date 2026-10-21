import { useEffect, useState } from 'react';
import type { BattleView } from '../battle/playback';
import { BattleScreen } from '../battle/stream/BattleScreen';
import { missionsOf, PLAYER_IDS } from '../engine';
import { openSyncChannel } from '../sync/channel';
import type { LiveView } from '../sync/liveView';
import { requestViewMessage } from '../sync/messages';
import type { StarterChoiceView } from '../starters/starterChoice';
import { PlayerPanel } from '../ui/PlayerPanel';
import { Stage } from '../ui/Stage';
import { StarterChoiceScreen } from '../ui/StarterChoiceScreen';
import styles from './StreamApp.module.css';

/** The window captured by OBS: board and panels only, no menus (D-005). */
export function StreamApp() {
  const [view, setView] = useState<LiveView | null>(null);
  // The starter choice scene (spec 025, 2.4): while the director has it open, it takes the whole window.
  const [choice, setChoice] = useState<StarterChoiceView | null>(null);
  // The simulated fight (spec 035, D-055): while the test page has one open, it takes the whole window.
  const [battle, setBattle] = useState<BattleView | null>(null);
  const [heardFromDirector, setHeardFromDirector] = useState(false);

  useEffect(() => {
    const channel = openSyncChannel((message) => {
      if (message.type === 'view') {
        setView(message.view);
        setChoice(null);
        setHeardFromDirector(true);
      } else if (message.type === 'starterChoice') {
        setChoice(message.choice);
        setHeardFromDirector(true);
      } else if (message.type === 'battle') {
        setBattle(message.battle);
        setHeardFromDirector(true);
      }
    });
    // Ask right away, so a stream opened (or reopened) mid-game is up to date.
    channel.send(requestViewMessage());
    return () => channel.close();
  }, []);

  if (battle) {
    return (
      <div className={styles.battle}>
        <BattleScreen view={battle} />
      </div>
    );
  }

  if (choice) {
    return (
      <div className={styles.choice}>
        <StarterChoiceScreen view={choice} />
      </div>
    );
  }

  if (!view) {
    return (
      <div className={styles.waiting}>
        {heardFromDirector ? 'Nessuna partita in corso' : 'In attesa della regia…'}
      </div>
    );
  }

  return (
    <div className={styles.stream}>
      <div className={styles.stage}>
        <Stage
          map={view.map}
          catalog={view.catalog}
          items={view.items}
          state={view.state}
          overlay={view.overlay}
        />
      </div>
      {view.layout.playerPanels === 'below' && (
        <div className={styles.panels}>
          {PLAYER_IDS.map((playerId) => (
            <PlayerPanel
              key={playerId}
              playerId={playerId}
              player={view.state.players[playerId]}
              catalog={view.catalog}
              items={view.items}
              isCurrent={view.state.currentPlayer === playerId}
              missions={missionsOf(view.state, playerId, view.catalog)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
