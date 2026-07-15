import { useState, useEffect, useCallback, useRef } from 'react';
import { isOnline, withRetry } from '@/lib/supabase';
import type { SupabaseClient } from '@/lib/supabase';

/**
 * ═══════════════════════════════════════════════════════════════
 * useResilientForm — Auto-save to localStorage, sync to Supabase
 * Phase 2: The "Gym Wi-Fi" Fix
 * ═══════════════════════════════════════════════════════════════
 *
 * Binds a form field to localStorage for instant persistence.
 * On submit, attempts Supabase write with retry.
 * Only clears localStorage after confirmed 200/201 success.
 */

export interface ResilientFormOptions<T> {
  /** localStorage key — must be unique per field/session */
  storageKey: string;
  /** Default value when nothing is cached */
  defaultValue: T;
  /** Supabase table to write to (optional — if omitted, no remote sync) */
  supabaseTable?: string;
  /** Supabase client instance (passed from caller) */
  supabase?: SupabaseClient;
  /** Transform value before writing to Supabase */
  serialize?: (value: T) => Record<string, unknown>;
  /** Callback after successful Supabase write */
  onSync?: () => void;
  /** Callback on sync error */
  onError?: (error: Error) => void;
  /** Debounce delay for localStorage writes (ms) */
  saveDelay?: number;
}

export interface ResilientFormState<T> {
  value: T;
  setValue: (val: T | ((prev: T) => T)) => void;
  isDirty: boolean;
  isSubmitting: boolean;
  isOffline: boolean;
  lastSaved: Date | null;
  submit: () => Promise<boolean>;
  reset: () => void;
  conflict: boolean;
}

/* ─── Generic helpers ─── */

function getStorageItem<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function setStorageItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('[useResilientForm] Storage write failed:', e);
  }
}

function removeStorageItem(key: string): void {
  localStorage.removeItem(key);
}

/* ─── Untyped Supabase helper ─── */

function getTableRef(supabase: SupabaseClient, table: string) {
  return (supabase as unknown as { from: (t: string) => {
    insert: (p: unknown) => Promise<{ error: { message: string } | null }>;
    update: (p: unknown) => Promise<{ error: { message: string } | null }>;
    select: (cols: string) => { order: (col: string, opts: unknown) => { limit: (n: number) => Promise<{ data: unknown[] | null; error: { message: string } | null }> } };
  } }).from(table);
}

/* ─── Hook ─── */

export function useResilientForm<T>(options: ResilientFormOptions<T>): ResilientFormState<T> {
  const { storageKey, defaultValue, supabaseTable, supabase, serialize, onSync, onError, saveDelay = 300 } = options;

  const [value, setValueState] = useState<T>(() => getStorageItem(storageKey, defaultValue));
  const [isDirty, setIsDirty] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOffline, setIsOffline] = useState(!isOnline());
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [conflict, setConflict] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncedRef = useRef<string | null>(null);

  /* ── Watch online status ── */
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  /* ── setValue: update state + debounced localStorage ── */
  const setValue = useCallback(
    (val: T | ((prev: T) => T)) => {
      setValueState((prev) => {
        const next = typeof val === 'function' ? (val as (prev: T) => T)(prev) : val;

        // Debounce localStorage write
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          setStorageItem(storageKey, {
            data: next,
            timestamp: Date.now(),
            synced: false,
          });
          setIsDirty(true);
        }, saveDelay);

        return next;
      });
    },
    [storageKey, saveDelay]
  );

  /* ── submit: attempt Supabase write ── */
  const submit = useCallback(async (): Promise<boolean> => {
    if (!supabaseTable || !supabase) {
      console.warn('[useResilientForm] No supabaseTable or supabase client provided');
      return false;
    }

    setIsSubmitting(true);

    try {
      const payload = serialize ? serialize(value) : (value as unknown as Record<string, unknown>);
      const tableRef = getTableRef(supabase, supabaseTable);

      const result = await withRetry(
        async () => {
          const { error } = await tableRef.insert(payload);
          if (error) throw new Error(error.message);
          return true;
        },
        3,
        1000
      );

      // Success: clear localStorage, mark clean
      removeStorageItem(storageKey);
      lastSyncedRef.current = JSON.stringify(result);
      setIsDirty(false);
      setLastSaved(new Date());
      setConflict(false);
      onSync?.();
      return true;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('[useResilientForm] Sync failed:', error.message);
      onError?.(error);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [supabaseTable, supabase, serialize, value, storageKey, onSync, onError]);

  /* ── reset: clear state and storage ── */
  const reset = useCallback(() => {
    removeStorageItem(storageKey);
    setValueState(defaultValue);
    setIsDirty(false);
    setLastSaved(null);
    setConflict(false);
  }, [storageKey, defaultValue]);

  /* ── Check for server-side conflict on mount ── */
  useEffect(() => {
    if (!supabaseTable || !supabase) return;

    const checkConflict = async () => {
      try {
        const cached = getStorageItem<{ data: T; timestamp: number; synced: boolean } | null>(storageKey, null);
        if (!cached || cached.synced) return;

        const tableRef = getTableRef(supabase, supabaseTable);
        const { data: serverData } = await tableRef
          .select('created_at')
          .order('created_at', { ascending: false })
          .limit(1);
        if (serverData && serverData.length > 0) {
          const serverTimestamp = new Date((serverData[0] as { created_at?: string }).created_at || 0).getTime();
          if (serverTimestamp > cached.timestamp) {
            setConflict(true);
          }
        }
      } catch {
        // Offline or error — ignore conflict check
      }
    };

    const timer = setTimeout(checkConflict, 500);
    return () => clearTimeout(timer);
  }, [supabaseTable, supabase, storageKey]);

  /* ── Cleanup debounce on unmount ── */
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return {
    value,
    setValue,
    isDirty,
    isSubmitting,
    isOffline,
    lastSaved,
    submit,
    reset,
    conflict,
  };
}
