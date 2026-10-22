import type { BoardSize } from '../ui/boardModel';
import { zoomCentered, type ViewBox } from './viewBox';

interface PhoneEditToolsProps {
  view: ViewBox;
  size: BoardSize;
  onViewChange(view: ViewBox): void;
  multiSelect: boolean;
  onMultiSelect(on: boolean): void;
  /** Missing where there is nothing to delete or duplicate (the episode's characters). */
  onDelete?: () => void;
  onDuplicate?: () => void;
  canDelete?: boolean;
  canDuplicate?: boolean;
}

/**
 * The buttons that take the place of wheel and keys on the phone (spec 054,
 * 2.2): zoom, multi-select, and delete and duplicate the selection.
 */
export function PhoneEditTools(props: PhoneEditToolsProps) {
  const { view, size, onViewChange } = props;
  return (
    <>
      <button aria-label="Ingrandisci" onClick={() => onViewChange(zoomCentered(view, true, size))}>
        +
      </button>
      <button aria-label="Rimpicciolisci" onClick={() => onViewChange(zoomCentered(view, false, size))}>
        −
      </button>
      <button aria-pressed={props.multiSelect} onClick={() => props.onMultiSelect(!props.multiSelect)}>
        {props.multiSelect ? 'Selezione multipla ✓' : 'Selezione multipla'}
      </button>
      {props.onDelete && (
        <button disabled={!props.canDelete} onClick={props.onDelete}>
          Elimina
        </button>
      )}
      {props.onDuplicate && (
        <button disabled={!props.canDuplicate} onClick={props.onDuplicate}>
          Duplica
        </button>
      )}
    </>
  );
}
