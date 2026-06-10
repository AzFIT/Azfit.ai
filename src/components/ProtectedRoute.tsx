import { Navigate } from 'react-router';
import { useAuth } from '@/hooks/useAuth';
import type { ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
  requireTrainer?: boolean;
  requireClient?: boolean;
}

export default function ProtectedRoute({
  children,
  requireTrainer = false,
  requireClient = false,
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center" style={{ backgroundColor: '#0F172A' }}>
        <div
          className="h-8 w-8 animate-spin rounded-full border-4 border-solid"
          style={{ borderColor: '#0D9488', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireTrainer && user.role !== 'trainer') {
    return <Navigate to="/dashboard" replace />;
  }

  if (requireClient && user.role !== 'client') {
    return <Navigate to="/coach" replace />;
  }

  return <>{children}</>;
}
