import styles from './CloseButton.module.css';

interface CloseButtonProps {
  onClose(): void;
  /** What the button is called for screen readers and on hover, «Chiudi» if not given. */
  label?: string;
  className?: string;
}

/**
 * The cross at the top of a window or of a screen over the map, always in
 * sight (spec 065): a red button with only «✕» in it (spec 065, 6).
 */
export function CloseButton({ onClose, label = 'Chiudi', className }: CloseButtonProps) {
  return (
    <button
      type="button"
      className={className ? `${styles.close} ${className}` : styles.close}
      onClick={onClose}
      aria-label={label}
      title={label}
    >
      <span aria-hidden="true">✕</span>
    </button>
  );
}
