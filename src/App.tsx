import { useEffect } from 'react';
import { DirectorGate } from './director/DirectorGate';
import { StreamApp } from './stream/StreamApp';

/** The same page serves both windows: `?view=stream` opens the stream (D-005). */
export default function App() {
  const isStream = new URLSearchParams(window.location.search).get('view') === 'stream';

  useEffect(() => {
    document.title = isStream ? 'Anime Adventure · Stream' : 'Anime Adventure · Regia';
  }, [isStream]);

  return isStream ? <StreamApp /> : <DirectorGate />;
}
