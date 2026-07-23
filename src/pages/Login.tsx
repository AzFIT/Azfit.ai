import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Dumbbell, ArrowLeft, Shield } from 'lucide-react';
import { signIn, isAdminCredentials, isAdminQuickLoginAvailable } from '@/services/auth';
import { useAuth } from '@/hooks/useAuth';

export default function Login() {
  const navigate = useNavigate();
  const { user, loginAsAdmin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  // Once the auth context finishes the async profile fetch after sign-in, redirect.
  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Check for admin credentials
      if (isAdminCredentials(email, password)) {
        await loginAsAdmin();
        navigate('/coach');
        return;
      }

      await signIn(email, password);
      // Auth context updates user asynchronously via onAuthStateChange; useEffect handles redirect.
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminQuickLogin = async () => {
    setLoading(true);
    try {
      await loginAsAdmin();
      navigate('/coach');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Admin login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center px-4" style={{ backgroundColor: '#0F172A' }}>
      {/* Wireframe gym backdrop with strong overlay for readability */}
      <div className="pointer-events-none absolute inset-0">
        <img
          src={`${import.meta.env.BASE_URL}images/bg-wireframe-gym.webp`}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(rgba(11,17,32,0.86), rgba(11,17,32,0.92))' }}
        />
      </div>
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-40 -right-40 h-80 w-80 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #0D9488 0%, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #06B6D4 0%, transparent 70%)' }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md"
      >
        {/* Back button */}
        <button
          onClick={() => navigate('/')}
          className="mb-6 flex items-center gap-2 text-sm transition-opacity hover:opacity-80"
          style={{ color: '#94A3B8' }}
        >
          <ArrowLeft size={16} />
          Back to home
        </button>

        {/* Card */}
        <div
          className="rounded-2xl border p-8"
          style={{
            backgroundColor: '#1E293B',
            borderColor: '#475569',
          }}
        >
          {/* Logo */}
          <div className="mb-8 text-center">
            <div className="mb-4 flex justify-center">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-xl"
                style={{ backgroundColor: 'rgba(13, 148, 136, 0.15)' }}
              >
                <Dumbbell size={28} style={{ color: '#0D9488' }} />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white">Welcome Back</h1>
            <p className="mt-1 text-sm" style={{ color: '#94A3B8' }}>
              Sign in to your AzFIT account
            </p>
          </div>

          {/* Admin Quick Login Button - Only show if configured */}
          {isAdminQuickLoginAvailable() && (
            <button
              onClick={handleAdminQuickLogin}
              disabled={loading}
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-semibold transition-all duration-200 hover:opacity-90 disabled:opacity-50"
              style={{
                borderColor: '#8B5CF6',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                color: '#A78BFA',
              }}
            >
              <Shield size={18} />
              {loading ? 'Signing in...' : 'Admin Quick Login'}
            </button>
          )}

          {/* Divider - Only show if admin quick login is available */}
          {isAdminQuickLoginAvailable() && (
            <div className="mb-4 flex items-center gap-3">
              <div className="h-px flex-1" style={{ backgroundColor: '#475569' }} />
              <span className="text-xs" style={{ color: '#64748B' }}>
                or sign in with email
              </span>
              <div className="h-px flex-1" style={{ backgroundColor: '#475569' }} />
            </div>
          )}

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 rounded-lg px-4 py-3 text-sm"
              style={{ backgroundColor: '#450A0A', color: '#F87171' }}
            >
              {error}
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium" style={{ color: '#CBD5E1' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border px-4 py-3 text-sm text-white outline-none transition-all focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488]"
                style={{
                  backgroundColor: '#0F172A',
                  borderColor: '#475569',
                }}
                placeholder="you@example.com"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium" style={{ color: '#CBD5E1' }}>
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  className="text-xs transition-colors hover:underline"
                  style={{ color: '#0D9488' }}
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-lg border px-4 py-3 pr-12 text-sm text-white outline-none transition-all focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488]"
                  style={{
                    backgroundColor: '#0F172A',
                    borderColor: '#475569',
                  }}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] transition-colors hover:text-white"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="remember-me"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border accent-[#0D9488]"
                style={{ borderColor: '#475569', backgroundColor: '#0F172A' }}
              />
              <label
                htmlFor="remember-me"
                className="text-sm cursor-pointer"
                style={{ color: '#94A3B8' }}
              >
                Remember me for 30 days
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg py-3 text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 disabled:opacity-50"
              style={{
                backgroundColor: '#0D9488',
                boxShadow: '0 0 20px rgba(13,148,136,0.3)',
              }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1" style={{ backgroundColor: '#475569' }} />
            <span className="text-xs" style={{ color: '#64748B' }}>
              or
            </span>
            <div className="h-px flex-1" style={{ backgroundColor: '#475569' }} />
          </div>

          {/* Sign up link */}
          <p className="text-center text-sm" style={{ color: '#94A3B8' }}>
            Don't have an account?{' '}
            <button
              onClick={() => navigate('/signup')}
              className="font-semibold transition-colors hover:underline"
              style={{ color: '#0D9488' }}
            >
              Sign up
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
