import { Routes, Route } from 'react-router'
import { Suspense, lazy } from 'react'
import { ThemeProvider } from '@/hooks/useTheme'
import { AuthProvider } from '@/hooks/useAuth'
import { ChatProvider } from '@/components/chat/ChatContext'
import ProtectedRoute from '@/components/ProtectedRoute'

// Lazy-loaded pages for code splitting
const Home = lazy(() => import('@/pages/Home'))
const Login = lazy(() => import('@/pages/Login'))
const Signup = lazy(() => import('@/pages/Signup'))
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Analytics = lazy(() => import('@/pages/Analytics'))
const Coach = lazy(() => import('@/pages/Coach'))
const ProgramBuilder = lazy(() => import('@/pages/ProgramBuilder'))
const SheetsPage = lazy(() => import('@/pages/SheetsPage'))
const Settings = lazy(() => import('@/pages/Settings'))
const OnboardingPage = lazy(() => import('@/pages/OnboardingPage'))
const BioPrintPage = lazy(() => import('@/pages/BioPrintPage'))
const NutritionPage = lazy(() => import('@/pages/Nutrition'))
const AIProgramBuilderPage = lazy(() => import('@/pages/AIProgramBuilder'))
const SchedulePage = lazy(() => import('@/pages/Schedule'))
const ProgressPhotosPage = lazy(() => import('@/pages/ProgressPhotos'))
const ExportSharePage = lazy(() => import('@/pages/ExportShare'))
const TimerModesPage = lazy(() => import('@/pages/TimerModes'))
const NotificationsPage = lazy(() => import('@/pages/Notifications'))
const LeaderboardPage = lazy(() => import('@/pages/Leaderboard'))
const WarmupGeneratorPage = lazy(() => import('@/pages/WarmupGenerator'))
const DeloadDetectionPage = lazy(() => import('@/pages/DeloadDetection'))

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
        <ChatProvider>
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
            <Route path="/sheets" element={
              <ProtectedRoute>
                <SheetsPage />
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            } />
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/bioprint" element={
              <ProtectedRoute>
                <BioPrintPage />
              </ProtectedRoute>
            } />
            <Route path="/nutrition" element={
              <ProtectedRoute>
                <NutritionPage />
              </ProtectedRoute>
            } />
            <Route path="/ai-program-builder" element={
              <ProtectedRoute>
                <AIProgramBuilderPage />
              </ProtectedRoute>
            } />
            <Route path="/schedule" element={
              <ProtectedRoute>
                <SchedulePage />
              </ProtectedRoute>
            } />
            <Route path="/progress-photos" element={
              <ProtectedRoute>
                <ProgressPhotosPage />
              </ProtectedRoute>
            } />
            <Route path="/export" element={
              <ProtectedRoute>
                <ExportSharePage />
              </ProtectedRoute>
            } />
            <Route path="/timer" element={
              <ProtectedRoute>
                <TimerModesPage />
              </ProtectedRoute>
            } />
            <Route path="/notifications" element={
              <ProtectedRoute>
                <NotificationsPage />
              </ProtectedRoute>
            } />
            <Route path="/leaderboard" element={
              <ProtectedRoute>
                <LeaderboardPage />
              </ProtectedRoute>
            } />
            <Route path="/warmup" element={
              <ProtectedRoute>
                <WarmupGeneratorPage />
              </ProtectedRoute>
            } />
            <Route path="/deload" element={
              <ProtectedRoute>
                <DeloadDetectionPage />
              </ProtectedRoute>
            } />
          </Routes>
        </Suspense>
        </ChatProvider>
      </ThemeProvider>
    </AuthProvider>
  )
}
