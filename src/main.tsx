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

// Remove the CSS-only splash screen once React mounts.
// A microtask ensures the paint cycle completes before we fade out.
requestAnimationFrame(() => {
  const splash = document.getElementById('splash');
  if (splash) {
    splash.classList.add('hide');
    setTimeout(() => splash.remove(), 500);
  }
});
