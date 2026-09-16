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
import { keepaliveProfilePatch } from "@/lib/keepaliveSave";
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
/** Fix Pack 2 — saves made before the profiles row has been read (92c-fix
 * lesson: never drop a legitimate save silently). Flushed by the fetch
 * effect once the server doc lands. */
const pendingSaves = new Map<string, DashboardPreferences>();
const PREFS_DEFAULT = normalizeDashboardPreferences(
  null,
  DASHBOARD_CARD_IDS,
  PROFILE_SECTION_IDS,
  BENTO_GROUP
);

/**
 * Apply a queued (pre-read) save over the freshly-read server doc: keys the
 * queued doc still holds at DEFAULT value were untouched by the user this
 * session, so the server's customized value wins there; keys that differ
 * from default carry the user's actual change and win. Prevents the queued
 * fallback-based doc from wiping server-side privacy/order customizations.
 */
function mergeOverServer(
  queued: DashboardPreferences,
  server: DashboardPreferences
): DashboardPreferences {
  const out = { ...server };
  (Object.keys(queued) as (keyof DashboardPreferences)[]).forEach((k) => {
    if (JSON.stringify(queued[k]) !== JSON.stringify(PREFS_DEFAULT[k])) {
      (out as Record<string, unknown>)[k] = queued[k];
    }
  });
  return out;
}

function publish(userId: string): void {
  listeners.forEach((l) => l(userId));
}

export function clearDashboardPrefsCacheForTests(): void {
  cache.clear();
  pendingSaves.clear();
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
      const serverNorm = normalizeDashboardPreferences(
        data?.dashboard_preferences ?? null,
        DASHBOARD_CARD_IDS,
        PROFILE_SECTION_IDS,
        BENTO_GROUP
      );
      // Flush any save queued before the read resolved (merged over the
      // server doc so untouched customized fields survive).
      const queued = pendingSaves.get(userId);
      const initial = queued ? mergeOverServer(queued, serverNorm) : serverNorm;
      pendingSaves.delete(userId);
      cache.set(userId, initial);
      publish(userId);
      setFetched(initial);
      setLoaded(true);
      if (queued) {
        keepaliveProfilePatch(userId, {
          dashboard_preferences: initial as unknown as Json,
        }).then((res) => {
          if (!res.ok) console.error("queued dashboard prefs flush failed:", res.error);
        });
      }
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
      if (!cache.has(userId)) {
        // Row not read yet — QUEUE the save (Fix Pack 2). The 92c guard
        // dropped these silently; now the fetch effect flushes it merged
        // over the server doc (see mergeOverServer).
        pendingSaves.set(userId, normalized);
        return true;
      }
      cache.set(userId, normalized);
      publish(userId);
      // Fix Pack 2: keepalive PATCH — survives the Phase 33A SW-reload race
      // that killed supabase-js writes in this window (same RLS, raw REST).
      const res = await keepaliveProfilePatch(userId, {
        dashboard_preferences: normalized as unknown as Json,
      });
      if (!res.ok) {
        // Revert — the UI keeps working with the previous state (honest rule).
        console.error('dashboard prefs save failed — reverting:', res.error);
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
