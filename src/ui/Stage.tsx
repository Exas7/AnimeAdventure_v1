import type { ReactNode } from 'react';
import {
  cellMission,
  missionLabel,
  rewardText,
  type Character,
  type GameMap,
  type GameState,
  type ItemDefinition,
  type PlayerId,
} from '../engine';
import type { Overlay } from '../sync/liveView';
import { Board, type ScreenPoint } from './Board';
import { ChallengeScreen } from './ChallengeScreen';
import { CloseButton } from './CloseButton';
import { NotificationStack } from './NotificationStack';
import { ShopScreen, type ShopActions } from './ShopScreen';
import { ShowdownScreen } from './ShowdownScreen';
import overlayStyles from './Overlay.module.css';
import styles from './Stage.module.css';

interface StageProps {
  map: GameMap;
  catalog: Character[];
  items: ItemDefinition[];
  state: GameState;
  overlay: Overlay | null;
  // Everything below is for the director window only.
  /** The overlay is the director's preview, not seen on the stream (D-032). */
  previewOnly?: boolean;
  onNodeClick?: (nodeId: string) => void;
  onNodeDoubleClick?: (nodeId: string) => void;
  /** A click on the balloon of the challenge scene: the next line. */
  onNextLine?: () => void;
  /** A click on a quiz answer: the player's answer (spec 026, 2.5). */
  onAnswer?: (index: number) => void;
  /** The phone (spec 052, 2.6): the right answer is not marked before the player answers. */
  hideRightAnswer?: boolean;
  onNodeMenu?: (nodeId: string, at: ScreenPoint) => void;
  onEdgeMenu?: (edgeId: string, at: ScreenPoint) => void;
  onEdgeClick?: (edgeId: string, at: ScreenPoint) => void;
  onPawnDrop?: (player: PlayerId, nodeId: string) => void;
  /** Cells where a travel item can take the pawn (spec 047). */
  highlighted?: ReadonlySet<string>;
  /** The phone (spec 052, 2.5): highlighted cells are large targets for a finger. */
  tapRadius?: number;
  onCloseNotification?: (notificationId: number) => void;
  /** The phone (spec 055, 2.2): notifications go in its own strip, not in boxes over the map. */
  hideNotifications?: boolean;
  challengeControls?: (nodeId: string, character: Character | undefined) => ReactNode;
  showdownControls?: ReactNode;
  shopActions?: (shopNodeId: string) => ShopActions;
  shopControls?: ReactNode;
  /** «✕ Chiudi» in the top right corner of the scene, the shop and the showdown (spec 065). */
  onCloseScene?: () => void;
  onCloseShop?: () => void;
  onCloseShowdown?: () => void;
  /** The phone (spec 057, 2.1): the shop in one column, scrolled only up and down. */
  stackedShop?: boolean;
}

/** The board with what goes on top of it: challenge, showdown and notifications. */
export function Stage(props: StageProps) {
  const { map, catalog, items, state, overlay } = props;
  const challenge = overlay?.kind === 'challenge' ? overlay : null;
  const challengeContent = challenge ? state.cells[challenge.nodeId] : undefined;
  const challengeCharacter = catalog.find(
    (character) => character.id === challengeContent?.characterId,
  );
  // The mission of the scene (spec 026), a format saved before included.
  const mission = cellMission(challengeContent);
  const reward = mission
    ? rewardText(mission.reward, challengeContent?.characterId, catalog, items)
    : '';

  return (
    <div className={styles.stage}>
      <Board
        map={map}
        catalog={catalog}
        state={state}
        onNodeClick={props.onNodeClick}
        onNodeDoubleClick={props.onNodeDoubleClick}
        onNodeMenu={props.onNodeMenu}
        onEdgeMenu={props.onEdgeMenu}
        onEdgeClick={props.onEdgeClick}
        onPawnDrop={props.onPawnDrop}
        highlighted={props.highlighted}
        tapRadius={props.tapRadius}
      />
      {challenge && (
        <ChallengeScreen
          nodeId={challenge.nodeId}
          content={challengeContent}
          character={challengeCharacter}
          line={challenge.line}
          onBalloonClick={props.onNextLine}
          label={props.previewOnly ? 'Solo in regia' : undefined}
          missionTitle={mission ? missionLabel(mission, catalog) : undefined}
          reward={reward || undefined}
          quiz={mission?.type === 'quiz' ? mission.quiz : undefined}
          answer={challenge.answer}
          onAnswer={props.onAnswer}
          hideRightAnswer={props.hideRightAnswer}
          onClose={props.onCloseScene}
        >
          {props.challengeControls?.(challenge.nodeId, challengeCharacter)}
        </ChallengeScreen>
      )}
      {overlay?.kind === 'shop' && (
        <div className={overlayStyles.backdrop}>
          {props.onCloseShop && <CloseButton className={overlayStyles.corner} onClose={props.onCloseShop} />}
          <ShopScreen
            context={{ map, catalog, items }}
            state={state}
            shopNodeId={overlay.nodeId}
            actions={props.shopActions?.(overlay.nodeId)}
            stacked={props.stackedShop}
          >
            {props.shopControls}
          </ShopScreen>
        </div>
      )}
      {overlay?.kind === 'showdown' && (
        <ShowdownScreen state={state} catalog={catalog} onClose={props.onCloseShowdown}>
          {props.showdownControls}
        </ShowdownScreen>
      )}
      {!props.hideNotifications && (
        <NotificationStack notifications={state.notifications} onClose={props.onCloseNotification} />
      )}
    </div>
  );
}
