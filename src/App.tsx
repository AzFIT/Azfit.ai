import { Routes, Route } from 'react-router'
import { Suspense, lazy } from 'react'
import { ThemeProvider } from '@/hooks/useTheme'

// Lazy-loaded pages for code splitting
const Home = lazy(() => import('@/pages/Home'))
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Analytics = lazy(() => import('@/pages/Analytics'))
const Coach = lazy(() => import('@/pages/Coach'))
const Settings = lazy(() => import('@/pages/Settings'))

// Loading fallback
function PageLoader() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center" style={{ backgroundColor: 'var(--page-bg)' }}>
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-solid" style={{ borderColor: 'var(--azfit-primary)', borderTopColor: 'transparent' }} />
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/coach" element={<Coach />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Suspense>
    </ThemeProvider>
  )
}
