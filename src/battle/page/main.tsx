import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BattlePage } from './BattlePage';
import '../../index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Missing #root element in battaglia.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <BattlePage />
  </StrictMode>,
);
