import { cellNumber, type GameMap, type NodeType } from '../engine';
import { TextField } from '../ui/TextField';
import { clearCurve, renameMap, updateEdge, updateNodes, type Selection } from './mapEdit';
import styles from './MapEditor.module.css';

export const NODE_TYPE_LABELS: { type: NodeType; label: string }[] = [
  { type: 'empty', label: 'Passaggio' },
  { type: 'character', label: 'Personaggio' },
  { type: 'shop', label: 'Negozio' },
  { type: 'start', label: 'Partenza' },
  { type: 'special', label: 'Speciale' },
];

interface EditorPanelProps {
  map: GameMap;
  selection: Selection;
  onCommit(map: GameMap): void;
  /** Path whose opening cell is being chosen on the map (D-027). */
  pickingFor: string | null;
  onPickingChange(edgeId: string | null): void;
}

/** Properties of the map and of the selected cells or path (spec 006, 2.4). */
export function EditorPanel({
  map,
  selection,
  onCommit,
  pickingFor,
  onPickingChange,
}: EditorPanelProps) {
  const nodes = map.nodes.filter((node) => selection.nodes.includes(node.id));
  const edges = map.edges.filter((edge) => selection.edges.includes(edge.id));
  const node = nodes.length === 1 && edges.length === 0 ? nodes[0] : undefined;
  const edge = edges.length === 1 && nodes.length === 0 ? edges[0] : undefined;

  return (
    <aside className={styles.panel}>
      <section>
        <h3>Mappa</h3>
        <label className={styles.field}>
          Nome
          <TextField
            label="Nome della mappa"
            value={map.name}
            onCommit={(name) => onCommit(renameMap(map, name.trim() || 'Mappa senza nome'))}
          />
        </label>
        <p className={styles.small}>
          {map.nodes.length} caselle · {map.edges.length} percorsi
          {map.background
            ? ` · sfondo ${map.background.width}×${map.background.height}`
            : ' · senza sfondo'}
        </p>
      </section>

      {node && (
        <section>
          <h3>Casella {cellNumber(node.id)}</h3>
          <label className={styles.field}>
            Tipo
            <TypeSelect
              value={node.type}
              onChange={(type) => onCommit(updateNodes(map, [node.id], { type }))}
            />
          </label>
          {node.type === 'special' && (
            <>
              <label className={styles.field}>
                Colore
                <input
                  type="color"
                  value={node.color ?? '#a855f7'}
                  onChange={(event) => onCommit(updateNodes(map, [node.id], { color: event.target.value }))}
                />
              </label>
              <label className={styles.field}>
                Significato
                <TextField
                  label="Significato della casella speciale"
                  value={node.note ?? ''}
                  placeholder="Es. bonus, trappola…"
                  onCommit={(note) => onCommit(updateNodes(map, [node.id], { note }))}
                />
              </label>
            </>
          )}
        </section>
      )}

      {nodes.length > 1 && (
        <section>
          <h3>{nodes.length} caselle selezionate</h3>
          <label className={styles.field}>
            Tipo per tutte
            <TypeSelect
              value={nodes.every((other) => other.type === nodes[0]?.type) ? (nodes[0]?.type ?? '') : ''}
              onChange={(type) =>
                onCommit(updateNodes(map, nodes.map((other) => other.id), { type }))
              }
            />
          </label>
        </section>
      )}

      {edge && (
        <section>
          <h3>
            Percorso {cellNumber(edge.from)} – {cellNumber(edge.to)}
          </h3>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={edge.locked}
              onChange={(event) => onCommit(updateEdge(map, edge.id, { locked: event.target.checked }))}
            />
            Bloccato a inizio partita
          </label>
          {edge.locked && (
            <UnlockCellField
              map={map}
              edgeId={edge.id}
              unlockNodeId={edge.unlockNodeId}
              picking={pickingFor === edge.id}
              onCommit={onCommit}
              onPickingChange={onPickingChange}
            />
          )}
          <label className={styles.field}>
            Condizione di sblocco
            <TextField
              label="Condizione di sblocco"
              value={edge.lockNote ?? ''}
              placeholder="Es. si apre dopo aver battuto…"
              onCommit={(lockNote) => onCommit(updateEdge(map, edge.id, { lockNote }))}
            />
          </label>
          <p className={styles.small}>
            Punti di curva: {edge.curve.length}. Trascina la "+" per piegare il percorso, doppio
            clic su un punto per toglierlo.
          </p>
          <button onClick={() => onCommit(clearCurve(map, edge.id))} disabled={edge.curve.length === 0}>
            Togli curve
          </button>
        </section>
      )}

      {nodes.length === 0 && edges.length === 0 && (
        <section className={styles.small}>
          <h3>Come si usa</h3>
          <p>Seleziona: clic, Maiusc+clic o rettangolo; trascina per spostare.</p>
          <p>Casella: clic su uno spazio vuoto. Percorso: trascina da una casella a un'altra.</p>
          <p>Canc elimina, Ctrl+D duplica, Ctrl+Z e Ctrl+Y annullano e ripetono.</p>
          <p>Rotellina: zoom. Tasto centrale o barra spaziatrice: sposta la vista.</p>
        </section>
      )}
    </aside>
  );
}

interface TypeSelectProps {
  value: NodeType | '';
  onChange(type: NodeType): void;
}

interface UnlockCellFieldProps {
  map: GameMap;
  edgeId: string;
  unlockNodeId: string | undefined;
  picking: boolean;
  onCommit(map: GameMap): void;
  onPickingChange(edgeId: string | null): void;
}

/** The cell whose conquest opens the path for the conqueror (D-027). */
function UnlockCellField(props: UnlockCellFieldProps) {
  const { map, edgeId, unlockNodeId, picking, onCommit, onPickingChange } = props;
  const cell = map.nodes.find((node) => node.id === unlockNodeId);
  const typeLabel = NODE_TYPE_LABELS.find((entry) => entry.type === cell?.type)?.label;
  return (
    <div className={styles.field}>
      Si apre conquistando
      {picking ? (
        <>
          <span className={styles.picking}>Clicca sulla mappa la casella che apre il percorso.</span>
          <span className={styles.group}>
            <button onClick={() => onPickingChange(null)}>Annulla</button>
          </span>
        </>
      ) : (
        <>
          <span className={styles.value}>
            {cell
              ? `${typeLabel ?? 'Casella'} ${cellNumber(cell.id)} (evidenziata sulla mappa)`
              : 'Nessuna casella: si apre solo a mano'}
          </span>
          <span className={styles.group}>
            <button onClick={() => onPickingChange(edgeId)}>Scegli sulla mappa</button>
            {cell && (
              <button
                onClick={() => onCommit(updateEdge(map, edgeId, { unlockNodeId: undefined }))}
              >
                Togli
              </button>
            )}
          </span>
        </>
      )}
    </div>
  );
}

export function TypeSelect({ value, onChange }: TypeSelectProps) {
  return (
    <select
      value={value}
      onChange={(event) => {
        const chosen = NODE_TYPE_LABELS.find((entry) => entry.type === event.target.value);
        if (chosen) {
          onChange(chosen.type);
        }
      }}
    >
      {value === '' && <option value="">(diversi)</option>}
      {NODE_TYPE_LABELS.map((entry) => (
        <option key={entry.type} value={entry.type}>
          {entry.label}
        </option>
      ))}
    </select>
  );
}
