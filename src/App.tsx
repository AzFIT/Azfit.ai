import { Routes, Route } from 'react-router'
import { Suspense, lazy } from 'react'
import { ThemeProvider } from '@/hooks/useTheme'
import { AuthProvider } from '@/hooks/useAuth'
import ProtectedRoute from '@/components/ProtectedRoute'

// Lazy-loaded pages for code splitting
const Home = lazy(() => import('@/pages/Home'))
const Login = lazy(() => import('@/pages/Login'))
const Signup = lazy(() => import('@/pages/Signup'))
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Analytics = lazy(() => import('@/pages/Analytics'))
const Coach = lazy(() => import('@/pages/Coach'))
const ProgramBuilder = lazy(() => import('@/pages/ProgramBuilder'))
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
    <AuthProvider>
      <ThemeProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/analytics" element={
              <ProtectedRoute>
                <Analytics />
              </ProtectedRoute>
            } />
            <Route path="/coach" element={
              <ProtectedRoute requireTrainer>
                <Coach />
              </ProtectedRoute>
            } />
            <Route path="/program-builder" element={
              <ProtectedRoute requireTrainer>
                <ProgramBuilder />
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            } />
          </Routes>
        </Suspense>
      </ThemeProvider>
    </AuthProvider>
  )
}
