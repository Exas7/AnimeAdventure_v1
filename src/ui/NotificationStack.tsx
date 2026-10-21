import type { Notification as GameNotification } from '../engine';
import styles from './NotificationStack.module.css';

interface NotificationStackProps {
  notifications: GameNotification[];
  /** Director only; on the stream notifications close by themselves. */
  onClose?: (notificationId: number) => void;
}

export function NotificationStack({ notifications, onClose }: NotificationStackProps) {
  if (notifications.length === 0) {
    return null;
  }
  return (
    <ul className={styles.stack} aria-live="polite">
      {notifications.map((notification) => (
        <li key={notification.id} className={styles.notification}>
          <span>{notification.text}</span>
          {onClose && (
            <button
              className={styles.close}
              aria-label="Chiudi notifica"
              onClick={() => onClose(notification.id)}
            >
              ×
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
