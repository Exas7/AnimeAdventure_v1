import { cellNumber, type CellContent, type GameContext, type GameState } from '../engine';
import { Frame, FrameTitle } from '../theme/Frame';
import { CellContentForm } from '../ui/CellContentForm';
import { ShopScreen, type ShopActions } from '../ui/ShopScreen';
import styles from './CellEditor.module.css';

interface CellEditorProps {
  context: GameContext;
  state: GameState;
  nodeId: string;
  onSave(content: CellContent): void;
  onClose(): void;
  /** Price corrections in the private shop view. */
  shopActions: ShopActions;
}

/**
 * Edit mode panel for one cell (spec 004, 2.2). Director only: the stream
 * only sees the result once saved. For shops it also shows the private view
 * of the shop, where prices can be corrected but nothing can be bought.
 */
export function CellEditor({ context, state, nodeId, onSave, onClose, shopActions }: CellEditorProps) {
  const type = context.map.nodes.find((candidate) => candidate.id === nodeId)?.type;
  const isShop = type === 'shop';
  const initial = state.cells[nodeId] ?? {};

  return (
    <Frame
      className={styles.editor}
      contentClassName={styles.content}
      role="dialog"
      aria-label={`Modifica casella ${cellNumber(nodeId)}`}
    >
      <header className={styles.header}>
        <FrameTitle>
          Casella {cellNumber(nodeId)}
          {isShop && <span className={styles.badge}>negozio</span>}
        </FrameTitle>
        <span className={styles.private}>Visibile solo in regia</span>
      </header>

      <CellContentForm
        catalog={context.catalog}
        isShop={isShop}
        canHoldCharacter={type === 'character' || isShop || Boolean(initial.characterId)}
        initial={initial}
        items={context.items}
        onSave={onSave}
        onCancel={onClose}
      />

      {isShop && (
        <section className={styles.privateShop}>
          <h3>Vista privata del negozio</h3>
          <p className={styles.hint}>
            Disponibilità e prezzi attuali. Da qui non si compra: gli acquisti si fanno dal negozio
            aperto a modifica spenta.
          </p>
          <ShopScreen
            context={context}
            state={state}
            shopNodeId={nodeId}
            actions={shopActions}
            compact
          />
        </section>
      )}
    </Frame>
  );
}
