import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router'
import './index.css'
import App from './App.tsx'
import { registerServiceWorker } from '@/lib/registerSW'

// Register PWA service worker (production only)
registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <HashRouter>
    <App />
  </HashRouter>,
)
