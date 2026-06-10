import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { getCurrentUser, onAuthStateChange, signOut, adminLogin, type AuthUser } from '@/services/auth';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isAdmin: boolean;
  isTrainer: boolean;
  isClient: boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  loginAsAdmin: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      console.error('Error fetching user:', error);
      setUser(null);
    }
  };

  const loginAsAdmin = async () => {
    const adminUser = await adminLogin();
    setUser(adminUser);
  };

  useEffect(() => {
    // Initial load
    refreshUser().finally(() => setLoading(false));

    // Listen for auth changes
    const { data: subscription } = onAuthStateChange((user) => {
      setUser(user);
      setLoading(false);
    });

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    await signOut();
    setUser(null);
  };

  const value: AuthContextType = {
    user,
    loading,
    isAdmin: user?.role === 'admin',
    isTrainer: user?.role === 'trainer' || user?.role === 'admin',
    isClient: user?.role === 'client' || user?.role === 'admin',
    logout,
    refreshUser,
    loginAsAdmin,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
