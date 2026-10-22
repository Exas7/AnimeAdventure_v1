import { useEffect } from 'react';
import { DirectorGate } from './director/DirectorGate';
import { isPhoneVersion } from './phone/phoneMode';
import { PhoneShell } from './phone/PhoneShell';
import { StreamApp } from './stream/StreamApp';

/**
 * The same page serves both windows: `?view=stream` opens the stream (D-005).
 * On a phone or tablet the page is the game without director (spec 052, D-083).
 */
export default function App() {
  const isStream = new URLSearchParams(window.location.search).get('view') === 'stream';
  const isPhone = !isStream && isPhoneVersion();

  useEffect(() => {
    document.title = isStream
      ? 'Anime Adventure · Stream'
      : isPhone
        ? 'Anime Adventure'
        : 'Anime Adventure · Regia';
  }, [isStream, isPhone]);

  if (isStream) {
    return <StreamApp />;
  }
  return isPhone ? <PhoneShell /> : <DirectorGate />;
}
