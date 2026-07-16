import { useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { Dumbbell, ArrowLeft, Mail, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email');
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
                style={{ backgroundColor: 'rgba(13, 148, 136, 0.15)' }}
              >
                <Dumbbell size={28} style={{ color: '#0D9488' }} />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white">Reset Password</h1>
            <p className="mt-1 text-sm" style={{ color: '#94A3B8' }}>
              Enter your email and we'll send you a reset link
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
              <h2 className="text-lg font-semibold text-white mb-2">Check your email</h2>
              <p className="text-sm mb-6" style={{ color: '#94A3B8' }}>
                We've sent a password reset link to <strong className="text-white">{email}</strong>
              </p>
              <button
                onClick={() => navigate('/login')}
                className="w-full rounded-lg py-3 text-sm font-semibold text-white transition-all duration-200 hover:opacity-90"
                style={{ backgroundColor: '#0D9488' }}
              >
                Back to login
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
                    Email
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full rounded-lg border px-4 py-3 pl-11 text-sm text-white outline-none transition-all focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488]"
                      style={{
                        backgroundColor: '#0F172A',
                        borderColor: '#475569',
                      }}
                      placeholder="you@example.com"
                    />
                    <Mail
                      size={18}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2"
                      style={{ color: '#64748B' }}
                    />
                  </div>
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
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
