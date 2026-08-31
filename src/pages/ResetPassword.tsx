import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { Dumbbell, ArrowLeft, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // Check if we have a recovery session from the email link
  useEffect(() => {
    const checkSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        // No valid session - user came here directly without a reset link
        setError('Invalid or expired reset link. Please request a new one.');
      }
    };
    checkSession();
  }, []);

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
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-4" style={{ backgroundColor: '#0F172A' }}>
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-40 -right-40 h-80 w-80 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, var(--azfit-primary) 0%, transparent 70%)' }}
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
          onClick={() => navigate('/login')}
          className="mb-6 flex items-center gap-2 text-sm transition-opacity hover:opacity-80"
          style={{ color: '#94A3B8' }}
        >
          <ArrowLeft size={16} />
          Back to login
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
                style={{ backgroundColor: 'color-mix(in srgb, var(--azfit-primary) 15%, transparent)' }}
              >
                <Dumbbell size={28} style={{ color: 'var(--azfit-primary)' }} />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white">Reset Password</h1>
            <p className="mt-1 text-sm" style={{ color: '#94A3B8' }}>
              Enter your new password below
            </p>
          </div>

          {/* Success State */}
          {success ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <div className="mb-4 flex justify-center">
                <CheckCircle size={48} style={{ color: '#10B981' }} />
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">Password updated!</h2>
              <p className="text-sm mb-6" style={{ color: '#94A3B8' }}>
                Your password has been reset successfully.
              </p>
              <button
                onClick={() => navigate('/login')}
                className="w-full rounded-lg py-3 text-sm font-semibold text-white transition-all duration-200 hover:opacity-90"
                style={{ backgroundColor: 'var(--azfit-primary)' }}
              >
                Sign In
              </button>
            </motion.div>
          ) : (
            <>
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
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full rounded-lg border px-4 py-3 pr-12 text-sm text-white outline-none transition-all focus:border-[var(--azfit-primary)] focus:ring-1 focus:ring-[var(--azfit-primary)]"
                      style={{
                        backgroundColor: '#0F172A',
                        borderColor: '#475569',
                      }}
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
                    className="w-full rounded-lg border px-4 py-3 text-sm text-white outline-none transition-all focus:border-[var(--azfit-primary)] focus:ring-1 focus:ring-[var(--azfit-primary)]"
                    style={{
                      backgroundColor: '#0F172A',
                      borderColor: '#475569',
                    }}
                    placeholder="Confirm your password"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg py-3 text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 disabled:opacity-50"
                  style={{
                    backgroundColor: 'var(--azfit-primary)',
                    boxShadow: '0 0 20px color-mix(in srgb, var(--azfit-primary) 3%, transparent)',
                  }}
                >
                  {loading ? 'Updating...' : 'Reset Password'}
                </button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
