// ═══════════════════════════════════════════════════════════════
// useTrainerNav (Phase 89) — per-user trainer nav visibility prefs.
// Persistence: profiles.nav_preferences JSONB (Phase 89 migration,
// same pattern as Phase 68 calendar_emoji; RLS "Users can update own
// profile" covers the write).
//
// Honest-failure rule (phase spec): if the write fails, the nav keeps
// working with the PREVIOUS state — saveHidden reverts the optimistic
// update and returns false so the UI can say so.
//
// A module-level cache keyed by user id means re-mounts (route
// changes re-render Layout) render instantly from the cached profile
// without a fetch flicker (Item 3 "loading" requirement).
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { normalizeNavPreferences, toNavPreferences } from "@/lib/trainerNav";

const cache = new Map<string, string[]>();

export function clearTrainerNavCacheForTests() {
  cache.clear();
}

export function useTrainerNav(userId: string | undefined) {
  const [hiddenIds, setHiddenIds] = useState<string[]>(() =>
    userId ? (cache.get(userId) ?? []) : [],
  );
  const [loaded, setLoaded] = useState(() => (userId ? cache.has(userId) : true));

  useEffect(() => {
    // Cache hit: hiddenIds/loaded were seeded from the cache in useState's
    // lazy initializer — nothing to do (no synchronous setState here).
    if (!userId || cache.has(userId)) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("nav_preferences")
        .eq("id", userId)
        .maybeSingle();
      if (cancelled) return;
      const ids = normalizeNavPreferences(
        (data as { nav_preferences?: unknown } | null)?.nav_preferences,
      );
      cache.set(userId, ids);
      setHiddenIds(ids);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const saveHidden = useCallback(
    async (next: string[]): Promise<boolean> => {
      if (!userId) return false;
      const prev = cache.get(userId) ?? [];
      const clean = normalizeNavPreferences(next);
      cache.set(userId, clean);
      setHiddenIds(clean);
      const { error } = await supabase
        .from("profiles")
        .update({ nav_preferences: toNavPreferences(clean) })
        .eq("id", userId);
      if (error) {
        // Write failed — revert so the nav keeps the previous state.
        cache.set(userId, prev);
        setHiddenIds(prev);
        return false;
      }
      return true;
    },
    [userId],
  );

  return { hiddenIds, loaded, saveHidden };
}
