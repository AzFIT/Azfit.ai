import { useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Dumbbell, ArrowLeft, User, UserCog } from 'lucide-react';
import { signUp } from '@/services/auth';
import type { UserRole } from '@/services/auth';

export default function Signup() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>('client');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      await signUp(email, password, fullName, role);
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center px-4" style={{ backgroundColor: '#0F172A' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md rounded-2xl border p-8 text-center"
          style={{ backgroundColor: '#1E293B', borderColor: '#475569' }}
        >
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
            style={{ backgroundColor: 'rgba(13, 148, 136, 0.15)' }}
          >
            <Dumbbell size={32} style={{ color: '#0D9488' }} />
          </div>
          <h2 className="text-2xl font-bold text-white">Account Created!</h2>
          <p className="mt-2 text-sm" style={{ color: '#94A3B8' }}>
            Please check your email to verify your account, then sign in.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="mt-6 w-full rounded-lg py-3 text-sm font-semibold text-white transition-all"
            style={{ backgroundColor: '#0D9488' }}
          >
            Go to Sign In
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-4" style={{ backgroundColor: '#0F172A' }}>
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
        <button
          onClick={() => navigate('/')}
          className="mb-6 flex items-center gap-2 text-sm transition-opacity hover:opacity-80"
          style={{ color: '#94A3B8' }}
        >
          <ArrowLeft size={16} />
          Back to home
        </button>

        <div
          className="rounded-2xl border p-8"
          style={{ backgroundColor: '#1E293B', borderColor: '#475569' }}
        >
          <div className="mb-8 text-center">
            <div className="mb-4 flex justify-center">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-xl"
                style={{ backgroundColor: 'rgba(13, 148, 136, 0.15)' }}
              >
                <Dumbbell size={28} style={{ color: '#0D9488' }} />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white">Create Account</h1>
            <p className="mt-1 text-sm" style={{ color: '#94A3B8' }}>
              Join AzFIT and start your fitness journey
            </p>
          </div>

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

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Role Selection */}
            <div>
              <label className="mb-1.5 block text-sm font-medium" style={{ color: '#CBD5E1' }}>
                I am a...
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole('client')}
                  className="flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-all"
                  style={{
                    borderColor: role === 'client' ? '#0D9488' : '#475569',
                    backgroundColor: role === 'client' ? 'rgba(13, 148, 136, 0.1)' : '#0F172A',
                    color: role === 'client' ? '#0D9488' : '#94A3B8',
                  }}
                >
                  <User size={18} />
                  Client
                </button>
                <button
                  type="button"
                  onClick={() => setRole('trainer')}
                  className="flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-all"
                  style={{
                    borderColor: role === 'trainer' ? '#0D9488' : '#475569',
                    backgroundColor: role === 'trainer' ? 'rgba(13, 148, 136, 0.1)' : '#0F172A',
                    color: role === 'trainer' ? '#0D9488' : '#94A3B8',
                  }}
                >
                  <UserCog size={18} />
                  Trainer
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium" style={{ color: '#CBD5E1' }}>
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full rounded-lg border px-4 py-3 text-sm text-white outline-none transition-all focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488]"
                style={{ backgroundColor: '#0F172A', borderColor: '#475569' }}
                placeholder="John Doe"
              />
            </div>

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
                style={{ backgroundColor: '#0F172A', borderColor: '#475569' }}
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium" style={{ color: '#CBD5E1' }}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full rounded-lg border px-4 py-3 pr-12 text-sm text-white outline-none transition-all focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488]"
                  style={{ backgroundColor: '#0F172A', borderColor: '#475569' }}
                  placeholder="Min 6 characters"
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

            <div>
              <label className="mb-1.5 block text-sm font-medium" style={{ color: '#CBD5E1' }}>
                Confirm Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full rounded-lg border px-4 py-3 text-sm text-white outline-none transition-all focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488]"
                style={{ backgroundColor: '#0F172A', borderColor: '#475569' }}
                placeholder="Confirm your password"
              />
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
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1" style={{ backgroundColor: '#475569' }} />
            <span className="text-xs" style={{ color: '#64748B' }}>or</span>
            <div className="h-px flex-1" style={{ backgroundColor: '#475569' }} />
          </div>

          <p className="text-center text-sm" style={{ color: '#94A3B8' }}>
            Already have an account?{' '}
            <button
              onClick={() => navigate('/login')}
              className="font-semibold transition-colors hover:underline"
              style={{ color: '#0D9488' }}
            >
              Sign in
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
