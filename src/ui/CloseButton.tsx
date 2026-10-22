import styles from './CloseButton.module.css';

interface CloseButtonProps {
  onClose(): void;
  /** What the button says after the cross, «Chiudi» if not given. */
  label?: string;
  className?: string;
}

/** «✕ Chiudi» at the top of a window or of a screen over the map, always in sight (spec 065). */
export function CloseButton({ onClose, label = 'Chiudi', className }: CloseButtonProps) {
  return (
    <button type="button" className={className ? `${styles.close} ${className}` : styles.close} onClick={onClose}>
      <span aria-hidden="true">✕</span> {label}
    </button>
  );
}
