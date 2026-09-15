import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router'
import './index.css'
import App from './App.tsx'

// Phase 94: the service worker is registered AFTER LOGIN (App.tsx subscribes
// to auth state), not here — public pages stay SW-free and the one-shot
// Notification permission ask is never burned on an anonymous first load.
// (PWA offline caching matters for signed-in training use; the app is
// auth-gated.)

// Phase 56 Item 7: stale-chunk recovery. After a deploy, an open tab (or an
// old service worker) can hold a chunk map whose files no longer exist —
// dynamic imports then fail and land on the error boundary. Force ONE hard
// reload (sessionStorage guard, 10s window — same pattern as the 33A
// controllerchange reload in registerSW.ts) so those users self-heal.
window.addEventListener('vite:preloadError', () => {
  const last = Number(sessionStorage.getItem('chunk-reload-at') || 0)
  if (Date.now() - last < 10000) return // already reloaded once — let the boundary show
  sessionStorage.setItem('chunk-reload-at', String(Date.now()))
  window.location.reload()
})

createRoot(document.getElementById('root')!).render(
  <HashRouter>
    <App />
  </HashRouter>,
)
