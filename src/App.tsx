import { Routes, Route, useLocation, Navigate } from "react-router";
import { Suspense, lazy, useEffect, type ReactNode } from "react";
import * as Sentry from "@sentry/react";
import { useAnalytics } from "@/hooks/useAnalytics";
import { ThemeProvider } from "@/hooks/useTheme";
import { AuthProvider } from "@/hooks/useAuth";
import { ChatProvider } from "@/components/chat/ChatContext";
import { AIContextProvider } from "@/components/ai-copilot/AIContextProvider";
import { registerServiceWorker } from "@/lib/registerSW";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Toaster } from "@/components/ui/sonner";
import OfflineBanner from "@/components/OfflineBanner";
import NotFound from "@/components/NotFound";

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: 1.0,
    tracePropagationTargets: ["localhost", /^https:\/\/azfit\.github\.io/],
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}

// Lazy-loaded pages for code splitting
const Home = lazy(() => import("@/pages/Home"));
const Login = lazy(() => import("@/pages/Login"));
const Signup = lazy(() => import("@/pages/Signup"));
const Invite = lazy(() => import("@/pages/Invite"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Analytics = lazy(() => import("@/pages/Analytics"));
const Coach = lazy(() => import("@/pages/Coach"));
const SheetsPage = lazy(() => import("@/pages/SheetsPage"));
const Settings = lazy(() => import("@/pages/Settings"));
const OnboardingPage = lazy(() => import("@/pages/OnboardingPage"));
const BioPrintPage = lazy(() => import("@/pages/BioPrintPage"));
const NutritionPage = lazy(() => import("@/pages/Nutrition"));
const AIProgramBuilderPage = lazy(() => import("@/pages/AIProgramBuilder"));
const ManualProgramBuilderPage = lazy(() => import("@/pages/ManualProgramBuilder"));
const SchedulePage = lazy(() => import("@/pages/Schedule"));
const ProgressPhotosPage = lazy(() => import("@/pages/ProgressPhotos"));
const ExportSharePage = lazy(() => import("@/pages/ExportShare"));
const TimerModesPage = lazy(() => import("@/pages/TimerModes"));
const NotificationsPage = lazy(() => import("@/pages/Notifications"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const DemoDashboard = lazy(() => import("@/pages/DemoDashboard"));
const ClientProfile = lazy(() => import("@/pages/ClientProfile"));
const ClientsPage = lazy(() => import("@/pages/Clients"));
const WarmupGeneratorPage = lazy(() => import("@/pages/WarmupGenerator"));
const DeloadDetectionPage = lazy(() => import("@/pages/DeloadDetection"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const CoachAIPage = lazy(() => import("@/pages/CoachAIPage"));
const Messages = lazy(() => import("@/pages/Messages"));
const ExercisesPage = lazy(() => import("@/pages/ExercisesPage"));
const CheckInsPage = lazy(() => import("@/pages/CheckInsPage"));
const WeeklyDigestPage = lazy(() => import("@/pages/WeeklyDigest"));
const FormChecksPage = lazy(() => import("@/pages/FormChecks"));
const LibraryPage = lazy(() => import("@/pages/Library"));
const PrintProgramPage = lazy(() => import("@/pages/PrintProgram"));

// Loading fallback
function PageLoader() {
  return (
    <div
      className="flex min-h-[100dvh] items-center justify-center"
      style={{ backgroundColor: "var(--page-bg)" }}
    >
      <div
        className="h-8 w-8 animate-spin rounded-full border-4 border-solid"
        style={{
          borderColor: "var(--azfit-primary)",
          borderTopColor: "transparent",
        }}
      />
    </div>
  );
}

function ErrorFallback() {
  return (
    <div
      className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 p-6 text-center"
      style={{ backgroundColor: "var(--page-bg)", color: "var(--text-primary)" }}
    >
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        The error has been reported. Please refresh the page to continue.
      </p>
      <button
        type="button"
        className="rounded-md px-4 py-2 text-sm font-medium text-white"
        style={{ background: "linear-gradient(90deg, #00AEEF, #8B5CF6)" }}
        onClick={() => window.location.reload()}
      >
        Refresh
      </button>
    </div>
  );
}

// Phase 33A Fix 2: an error boundary keyed on the route — remounting per
// pathname resets it, so a page crash can't poison the whole SPA. Page errors
// still hit the same Sentry reporting + fallback UI.
function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  return (
    <Sentry.ErrorBoundary key={location.pathname} fallback={<ErrorFallback />}>
      {children}
    </Sentry.ErrorBoundary>
  );
}

export default function App() {
  useAnalytics();
  useEffect(() => {
    registerServiceWorker();
    // One-time dev test error to verify Sentry wiring (replace with real DSN to see it in dashboard)
    if (import.meta.env.DEV && sentryDsn && !sessionStorage.getItem("sentry-test-sent")) {
      Sentry.captureException(new Error("Sentry test error from AzFIT dev"));
      sessionStorage.setItem("sentry-test-sent", "1");
    }
  }, []);

  return (
    <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
      <AuthProvider>
        <ThemeProvider>
          <ChatProvider>
            <AIContextProvider>
              <Toaster />
              <OfflineBanner />
              <Suspense fallback={<PageLoader />}>
                <RouteErrorBoundary>
                <Routes>
                  <Route path="/demo" element={<DemoDashboard />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/" element={<Home />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/invite/:trainerId" element={<Invite />} />
                  <Route
                    path="/dashboard"
                    element={
                      <ProtectedRoute>
                        <Dashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/analytics"
                    element={
                      <ProtectedRoute>
                        <Analytics />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/coach"
                    element={
                      <ProtectedRoute requireTrainer>
                        <Coach />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/coach-ai"
                    element={
                      <ProtectedRoute requireTrainer>
                        <CoachAIPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/sheets"
                    element={
                      <ProtectedRoute>
                        <SheetsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/settings"
                    element={
                      <ProtectedRoute>
                        <Settings />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/onboarding"
                    element={
                      <ProtectedRoute>
                        <OnboardingPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/bioprint"
                    element={
                      <ProtectedRoute>
                        <BioPrintPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/nutrition"
                    element={
                      <ProtectedRoute>
                        <NutritionPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/ai-program-builder"
                    element={
                      <ProtectedRoute requireTrainer>
                        <AIProgramBuilderPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/manual-program-builder"
                    element={
                      <ProtectedRoute requireTrainer>
                        <ManualProgramBuilderPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/schedule"
                    element={
                      <ProtectedRoute>
                        <SchedulePage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/progress-photos"
                    element={
                      <ProtectedRoute>
                        <ProgressPhotosPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/check-ins"
                    element={
                      <ProtectedRoute>
                        <CheckInsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/weekly-digest"
                    element={
                      <ProtectedRoute requireTrainer>
                        <WeeklyDigestPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/export"
                    element={
                      <ProtectedRoute>
                        <ExportSharePage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/timer"
                    element={
                      <ProtectedRoute>
                        <TimerModesPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/notifications"
                    element={
                      <ProtectedRoute>
                        <NotificationsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/client/:clientId"
                    element={
                      <ProtectedRoute>
                        <ClientProfile />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/clients"
                    element={
                      <ProtectedRoute requireTrainer>
                        <ClientsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/leaderboard"
                    element={
                      // Phase 33B: no real leaderboard data source exists — the mock was
                      // removed; the route redirects and the sidebar entry is hidden.
                      <Navigate to="/dashboard" replace />
                    }
                  />
                  <Route
                    path="/warmup"
                    element={
                      <ProtectedRoute>
                        <WarmupGeneratorPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/deload"
                    element={
                      <ProtectedRoute>
                        <DeloadDetectionPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/messages"
                    element={
                      <ProtectedRoute>
                        <Messages />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/exercises"
                    element={
                      <ProtectedRoute>
                        <ExercisesPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/form-checks"
                    element={
                      <ProtectedRoute>
                        <FormChecksPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/library"
                    element={
                      <ProtectedRoute requireTrainer>
                        <LibraryPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/print/program/:programId"
                    element={
                      <ProtectedRoute>
                        <PrintProgramPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="*" element={<NotFound />} />
                </Routes>
                </RouteErrorBoundary>
              </Suspense>
            </AIContextProvider>
          </ChatProvider>
        </ThemeProvider>
      </AuthProvider>
    </Sentry.ErrorBoundary>
  );
}
