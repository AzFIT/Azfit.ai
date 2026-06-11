import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let client: ReturnType<typeof createClient<Database>> | null = null;

function getClient() {
  if (!client) {
    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('Missing Supabase environment variables. Supabase features will be unavailable.');
      // Return a mock client that logs warnings instead of crashing
      return createDummyClient();
    }
    client = createClient<Database>(supabaseUrl, supabaseAnonKey);
  }
  return client;
}

function createDummyClient(): ReturnType<typeof createClient<Database>> {
  const dummy = {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      signInWithPassword: () => Promise.resolve({ data: { user: null, session: null }, error: { message: 'Supabase not configured' } }),
      signUp: () => Promise.resolve({ data: { user: null, session: null }, error: { message: 'Supabase not configured' } }),
      signOut: () => Promise.resolve({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    from: () => ({
      select: () => ({ data: [], error: null }),
      insert: () => ({ data: null, error: null }),
      update: () => ({ data: null, error: null }),
      delete: () => ({ data: null, error: null }),
    }),
  } as unknown as ReturnType<typeof createClient<Database>>;
  return dummy;
}

export const supabase = new Proxy({} as ReturnType<typeof createClient<Database>>, {
  get(_, prop: string) {
    const c = getClient();
    return (c as unknown as Record<string, unknown>)[prop];
  },
});

export type SupabaseClient = typeof supabase;
