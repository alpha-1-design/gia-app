import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/globals.css'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary'

const root = createRoot(document.getElementById('root')!);

root.render(
  <StrictMode>
    <ErrorBoundary name="GIA">
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

// Keep the splash up until App has hydrated persisted state and committed
// the screen the user should actually see (wizard, legal, or a module).
// Removing it on the first React frame is what flashed Chat underneath.
function dismissSplash() {
  const splash = document.getElementById('splash');
  if (!splash || splash.classList.contains('hide')) return;
  splash.classList.add('hide');
  setTimeout(() => splash.remove(), 400);
}

window.addEventListener('gia-shell-ready', dismissSplash, { once: true });
setTimeout(dismissSplash, 4000);
