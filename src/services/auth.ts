import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/supabase';

export type UserRole = 'admin' | 'trainer' | 'client';

export interface AuthUser {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  isAdmin: boolean;
}

// Hardcoded admin credentials for development
const ADMIN_EMAIL = 'admin@azfit.ai';
const ADMIN_PASSWORD = 'AzFIT2024!';

// Check if credentials match admin
export function isAdminCredentials(email: string, password: string): boolean {
  return email.toLowerCase() === ADMIN_EMAIL && password === ADMIN_PASSWORD;
}

// Sign up with email and password
export async function signUp(
  email: string,
  password: string,
  fullName: string,
  role: UserRole = 'client'
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role: role,
      },
      // Auto-confirm email for development
      emailRedirectTo: undefined,
    },
  });

  if (error) throw error;
  return data;
}

// Sign in with email and password
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

// Admin login - bypasses normal auth, creates a mock session
export async function adminLogin(): Promise<AuthUser> {
  // Try to sign in as admin first (if account exists in Supabase)
  try {
    const { data } = await supabase.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });

    if (data.user) {
      return {
        id: data.user.id,
        email: data.user.email || ADMIN_EMAIL,
        full_name: 'AzFIT Admin',
        avatar_url: null,
        role: 'admin',
        isAdmin: true,
      };
    }
  } catch {
    // Admin account doesn't exist yet in Supabase, use mock
  }

  // Return mock admin user for development
  return {
    id: '00000000-0000-0000-0000-000000000000',
    email: ADMIN_EMAIL,
    full_name: 'AzFIT Admin',
    avatar_url: null,
    role: 'admin',
    isAdmin: true,
  };
}

// Sign out
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// Get current session
export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

// Get current user with profile
export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = await getSession();
  if (!session) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (error || !data) return null;

  const profile = data as Database['public']['Tables']['profiles']['Row'];

  return {
    id: profile.id,
    email: profile.email,
    full_name: profile.full_name,
    avatar_url: profile.avatar_url,
    role: (profile.role as UserRole) || 'client',
    isAdmin: profile.role === 'admin',
  };
}

// Listen to auth state changes
export function onAuthStateChange(callback: (user: AuthUser | null) => void) {
  return supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session) {
      const user = await getCurrentUser();
      callback(user);
    } else {
      callback(null);
    }
  });
}

// Update user profile
export async function updateProfile(updates: {
  full_name?: string;
  avatar_url?: string;
}) {
  const session = await getSession();
  if (!session) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('profiles')
    .update(updates as Database['public']['Tables']['profiles']['Update'])
    .eq('id', session.user.id);

  if (error) throw error;
}
