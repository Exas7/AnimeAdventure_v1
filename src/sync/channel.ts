import { parseSyncMessage, SYNC_CHANNEL_NAME, type SyncMessage } from './messages';

export interface SyncChannel {
  send(message: SyncMessage): void;
  close(): void;
}

/** Opens the browser channel shared by the director and stream windows (D-010). */
export function openSyncChannel(onMessage: (message: SyncMessage) => void): SyncChannel {
  const channel = new BroadcastChannel(SYNC_CHANNEL_NAME);
  channel.onmessage = (event: MessageEvent<unknown>) => {
    const message = parseSyncMessage(event.data);
    if (message) {
      onMessage(message);
    }
  };
  return {
    send: (message) => channel.postMessage(message),
    close: () => channel.close(),
  };
}
