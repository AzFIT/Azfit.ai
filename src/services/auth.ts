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

export interface ClientProfileData {
  fullName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other';
  heightCm?: number;
  weightKg?: number;
  bodyFatPercentage?: number;
  fitnessGoal?: string;
  experienceLevel?: 'beginner' | 'intermediate' | 'advanced';
  trainingFrequency?: string;
  activityLevel?: string;
  injuries?: string;
  availableEquipment?: string[];
  gymType?: string;
  sessionLength?: number;
  hasCoach?: boolean;
  coachCode?: string;
  macroSplit?: string;
  mealCount?: string;
  connectedDevices?: string[];
}

// Admin credentials from environment (fallback for development)
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || 'admin@azfit.ai';
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || '';

// Check if admin quick login is available (always true for demo)
export function isAdminQuickLoginAvailable(): boolean {
  return true;
}

// Check if credentials match admin (accepts any email with admin password, or demo mode)
export function isAdminCredentials(email: string, password: string): boolean {
  // Always allow admin@azfit.ai with any password for demo
  if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) return true;
  // Also check if password matches configured admin password
  if (!ADMIN_PASSWORD) return false;
  return email.toLowerCase() === ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASSWORD;
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
  // Always return mock admin user - no real auth needed for demo/admin access
  return {
    id: 'admin-mock-id-001',
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

// Create or update full client profile after onboarding
export async function createClientProfile(
  data: ClientProfileData
): Promise<{ clientId: string; error: Error | null }> {
  const session = await getSession();
  if (!session) {
    return { clientId: '', error: new Error('Not authenticated') };
  }

  const userId = session.user.id;

  // 1. Update profiles row with latest info
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      full_name: data.fullName,
      email: data.email,
    } as Database['public']['Tables']['profiles']['Update'])
    .eq('id', userId);

  if (profileError) {
    console.warn('Profile update warning:', profileError.message);
    // Non-fatal: profile may already exist via auth trigger
  }

  // 2. Create clients row
  // For self-coached users, we use their own user ID as trainer_id
  // This allows them to see themselves in their own client list
  const trainerId = data.hasCoach && data.coachCode
    ? data.coachCode
    : userId;

  const { data: clientRow, error: clientError } = await supabase
    .from('clients')
    .insert({
      trainer_id: trainerId,
      full_name: data.fullName,
      email: data.email,
      phone: data.phone || null,
      date_of_birth: data.dateOfBirth || null,
      gender: data.gender || null,
      height_cm: data.heightCm || null,
      weight_kg: data.weightKg || null,
      body_fat_percentage: data.bodyFatPercentage || null,
      fitness_goal: data.fitnessGoal || null,
      experience_level: data.experienceLevel || null,
      status: 'active',
      notes: data.injuries || null,
    } as Database['public']['Tables']['clients']['Insert'])
    .select('id')
    .single();

  if (clientError || !clientRow) {
    return { clientId: '', error: clientError || new Error('Failed to create client profile') };
  }

  const clientId = clientRow.id;

  // 3. Create initial body composition record if we have measurements
  if (data.weightKg || data.bodyFatPercentage) {
    const { error: bodyError } = await supabase
      .from('body_composition')
      .insert({
        client_id: clientId,
        weight_kg: data.weightKg || null,
        body_fat_percentage: data.bodyFatPercentage || null,
      } as Database['public']['Tables']['body_composition']['Insert']);

    if (bodyError) {
      console.warn('Body composition insert warning:', bodyError.message);
      // Non-fatal: client was created successfully
    }
  }

  return { clientId, error: null };
}
