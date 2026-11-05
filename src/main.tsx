import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { requestPersistentStorage } from './db';
import { applyRecurring } from './lib/data';
import '@fontsource-variable/manrope';
import './styles.css';

registerSW({ immediate: true });
requestPersistentStorage();
applyRecurring().catch(console.error);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
