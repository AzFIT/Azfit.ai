import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let client: ReturnType<typeof createClient<Database>> | null = null;

function getClient() {
  if (!client) {
    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('[AzFIT] Missing Supabase environment variables. Supabase features will be unavailable.');
      return createDummyClient();
    }
    client = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      global: {
        headers: {
          'x-app-name': import.meta.env.VITE_APP_NAME || 'AzFIT',
        },
      },
    });
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
    storage: {
      from: () => ({
        upload: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
      }),
    },
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

// ─── Offline-aware helpers for Phase 2 resilience ───

export interface DbResult<T> {
  data: T | null;
  error: Error | null;
  fromCache?: boolean;
}

/**
 * Check if the browser is currently online.
 */
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine;
}

/**
 * Retry a Supabase query with exponential backoff.
 * Used by Phase 2's resilient state management.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (retries <= 0) throw err;
    await new Promise((res) => setTimeout(res, delay));
    return withRetry(fn, retries - 1, delay * 2);
  }
}

/**
 * Direct Supabase Storage bucket helper.
 * Pre-configured for Phase 4 progress photo uploads.
 */
export const supabaseStorage = {
  bucket: (bucketName: string) => {
    const s = getClient();
    return s.storage.from(bucketName);
  },
};

/**
 * Sync a batch of queued items to Supabase.
 * Returns { succeeded: ids[], failed: items[] }.
 * Phase 2: Called by useOfflineQueue when connection returns.
 */
export async function syncQueue(
  items: { table: string; operation: 'insert' | 'update'; payload: Record<string, unknown> }[],
  supabaseClient: SupabaseClient
): Promise<{ succeeded: string[]; failed: typeof items }> {
  const succeeded: string[] = [];
  const failed: typeof items = [];

  for (const item of items) {
    try {
      await withRetry(async () => {
        const tableRef = (supabaseClient as unknown as { from: (t: string) => { insert: (p: unknown) => Promise<{ error: { message: string } | null }>; update: (p: unknown) => Promise<{ error: { message: string } | null }> } }).from(item.table);
        const { error } =
          item.operation === 'insert'
            ? await tableRef.insert(item.payload)
            : await tableRef.update(item.payload);
        if (error) throw new Error(error.message);
      }, 2, 500);
      succeeded.push(item.table + '_' + JSON.stringify(item.payload).slice(0, 20));
    } catch {
      failed.push(item);
    }
  }

  return { succeeded, failed };
}
