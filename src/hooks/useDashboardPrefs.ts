// Phase 91 — per-user dashboard_preferences (profiles.dashboard_preferences
// JSONB). Persistence mirrors Phase 89's useTrainerNav exactly: module-level
// cache keyed by userId (no fetch flicker), single-UPDATE save, optimistic
// write with revert on failure. NULL column = defaults everywhere (zero
// visual change for existing users).
//
// Multi-instance: the app bar (Navbar) and the dashboard both consume this
// hook — cache writes PUBLISH to every mounted instance (force re-render
// from cache) so a save in the settings sheet flips the app-bar eye
// without a reload.

import { useCallback, useEffect, useReducer, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Json } from "@/types/supabase";
import {
  normalizeDashboardPreferences,
  type DashboardPreferences,
} from "@/lib/dashboardPrefs";
import {
  BENTO_GROUP,
  DASHBOARD_CARD_IDS,
  PROFILE_SECTION_IDS,
} from "@/lib/dashboardRegistry";

const cache = new Map<string, DashboardPreferences>();
const listeners = new Set<(userId: string) => void>();

function publish(userId: string): void {
  listeners.forEach((l) => l(userId));
}

export function clearDashboardPrefsCacheForTests(): void {
  cache.clear();
}

export interface DashboardPrefsState {
  /** Normalized prefs (defaults when the column is NULL). */
  prefs: DashboardPreferences;
  /** True once the profiles row has been read at least once. */
  loaded: boolean;
  /**
   * Persists the full preferences doc in ONE UPDATE. Optimistic in-memory;
   * on write failure the previous state is restored and `false` returns so
   * the caller can toast — the profile never half-saves.
   */
  save: (next: DashboardPreferences) => Promise<boolean>;
}

export function useDashboardPrefs(userId: string | undefined): DashboardPrefsState {
  const [, force] = useReducer((x: number) => x + 1, 0);

  // Re-render from cache whenever ANY instance writes this user's prefs.
  useEffect(() => {
    const cb = (uid: string) => {
      if (uid === userId) force();
    };
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  }, [userId]);

  const [fetched, setFetched] = useState<DashboardPreferences | null>(() =>
    userId ? (cache.get(userId) ?? null) : null
  );
  const [loaded, setLoaded] = useState<boolean>(() =>
    userId ? cache.has(userId) : false
  );

  // React-endorsed "adjust state during render" for userId changes (auth
  // switches remount providers in practice — this covers the edge without
  // setState-in-effect).
  const [prevId, setPrevId] = useState(userId);
  if (userId !== prevId) {
    setPrevId(userId);
    setFetched(userId ? (cache.get(userId) ?? null) : null);
    setLoaded(userId ? cache.has(userId) : false);
  }

  useEffect(() => {
    if (!userId || cache.has(userId)) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("dashboard_preferences")
        .eq("id", userId)
        .maybeSingle();
      if (cancelled) return;
      // Phase 92: an optimistic save may have landed while the fetch was
      // in flight (trainer toggles a panel right after login). That save
      // is newer than this server snapshot — never clobber it.
      if (cache.has(userId)) {
        setLoaded(true);
        return;
      }
      const normalized = normalizeDashboardPreferences(
        data?.dashboard_preferences ?? null,
        DASHBOARD_CARD_IDS,
        PROFILE_SECTION_IDS,
        BENTO_GROUP
      );
      cache.set(userId, normalized);
      publish(userId);
      setFetched(normalized);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const save = useCallback(
    async (next: DashboardPreferences): Promise<boolean> => {
      if (!userId) return false;
      const prev = cache.get(userId) ?? null;
      const normalized = normalizeDashboardPreferences(
        next,
        DASHBOARD_CARD_IDS,
        PROFILE_SECTION_IDS,
        BENTO_GROUP
      );
      cache.set(userId, normalized);
      publish(userId);
      const { error } = await supabase
        .from("profiles")
        .update({ dashboard_preferences: normalized as unknown as Json })
        .eq("id", userId);
      if (error) {
        // Revert — the UI keeps working with the previous state (honest rule).
        console.warn("dashboard prefs save failed — reverting:", error.message);
        if (prev) cache.set(userId, prev);
        else cache.delete(userId);
        publish(userId);
        return false;
      }
      return true;
    },
    [userId]
  );

  // Cache wins over local state so cross-instance publishes show immediately.
  const cached = userId ? cache.get(userId) : undefined;
  const fallback = normalizeDashboardPreferences(
    null,
    DASHBOARD_CARD_IDS,
    PROFILE_SECTION_IDS,
    BENTO_GROUP
  );
  return { prefs: cached ?? fetched ?? fallback, loaded, save };
}
