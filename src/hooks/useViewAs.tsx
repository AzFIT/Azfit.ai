/* eslint-disable react-refresh/only-export-components */
/* ═══════════════════════════════════════════════════════════════
   useViewAs (Phase 90e) — the trainer "View As Client" override.

   Data-level override ONLY: the trainer's auth session is never
   touched, no tokens are swapped, and every hook keeps reading
   through RLS — the override simply changes WHICH client's identity
   the client-data hooks resolve. State lives in sessionStorage
   (scoped key per client, `savedAt` timestamp breaks ties) so a
   refresh keeps the trainer inside the client's view.

   useEffectiveClientIdentity() is THE shared identity resolver the
   client-data hooks use (it replaces the ~10 inline
   `clients.eq("email", user.email)` copies — ALL of which became
   case-insensitive `.ilike` in Phase 99a, the invited-client fix):
     · override active  → the TARGET's clients.id + email, and their
       profiles.id resolved async (null until resolved; also null
       permanently when the target has no account — account-less
       roster clients — see `resolved`)
     · client, no override → own clients row (newest first) + own
       profiles.id (= auth uid)
     · trainer, no override → all null
   ═══════════════════════════════════════════════════════════════ */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import {
  VIEW_AS_KEY_PREFIX,
  parseViewAs,
  viewAsStorageKey,
  clearViewAsStorage,
  type ViewAsIdentity,
} from "@/lib/viewAs";

/* ── Context ─────────────────────────────────────────────────── */

interface ViewAsContextType {
  viewAs: ViewAsIdentity | null;
  beginViewAs: (identity: ViewAsIdentity) => void;
  endViewAs: () => void;
}

const ViewAsContext = createContext<ViewAsContextType | undefined>(undefined);

/* ── sessionStorage scan (provider init) ─────────────────────── */

/** Most recently written valid override; malformed keys and older
 *  duplicates are removed. Never throws (private mode). */
function readInitialViewAs(): ViewAsIdentity | null {
  try {
    let best: { savedAt: number; identity: ViewAsIdentity; key: string } | null = null;
    const removeKeys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (!key?.startsWith(VIEW_AS_KEY_PREFIX)) continue;
      const raw = sessionStorage.getItem(key);
      let savedAt = 0;
      let identity: ViewAsIdentity | null = null;
      try {
        const payload: unknown = JSON.parse(raw ?? "");
        if (typeof payload === "object" && payload !== null) {
          const rec = payload as Record<string, unknown>;
          identity = parseViewAs(JSON.stringify(rec));
          savedAt = typeof rec.savedAt === "number" ? rec.savedAt : 0;
        }
      } catch {
        identity = null;
      }
      if (!identity) {
        removeKeys.push(key);
        continue;
      }
      if (!best || savedAt >= best.savedAt) {
        if (best) removeKeys.push(best.key);
        best = { savedAt, identity, key };
      } else {
        removeKeys.push(key);
      }
    }
    for (const k of removeKeys) sessionStorage.removeItem(k);
    return best?.identity ?? null;
  } catch {
    return null;
  }
}

export function ViewAsProvider({ children }: { children: ReactNode }) {
  const [viewAs, setViewAs] = useState<ViewAsIdentity | null>(readInitialViewAs);
  const { user, loading: authLoading } = useAuth();

  const beginViewAs = useCallback((identity: ViewAsIdentity) => {
    try {
      // invariant: at most one scoped key
      clearViewAsStorage();
      sessionStorage.setItem(
        viewAsStorageKey(identity.clientId),
        JSON.stringify({ ...identity, savedAt: Date.now() }),
      );
    } catch {
      /* private mode — override still works for this session */
    }
    setViewAs(identity);
  }, []);

  const endViewAs = useCallback(() => {
    clearViewAsStorage();
    setViewAs(null);
  }, []);

  // Logout safety: an override can never outlive the trainer's
  // session. Sign-out also clears the keys eagerly in
  // services/auth.signOut; this catches any other path that ends the
  // session (gated on auth loading so a refresh mid-load doesn't
  // clear a legitimate override).
  useEffect(() => {
    if (!authLoading && !user && viewAs) {
      clearViewAsStorage();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setViewAs(null);
    }
  }, [authLoading, user, viewAs]);

  return (
    <ViewAsContext.Provider value={{ viewAs, beginViewAs, endViewAs }}>
      {children}
    </ViewAsContext.Provider>
  );
}

export function useViewAs() {
  const context = useContext(ViewAsContext);
  if (context === undefined) {
    throw new Error("useViewAs must be used within a ViewAsProvider");
  }
  return context;
}

/* ── Shared client-identity resolver ─────────────────────────── */

export interface EffectiveClientIdentity {
  /** clients.id — the override target's, or the caller's own */
  clientId: string | null;
  /** profiles email of that same person */
  clientEmail: string | null;
  /** profiles.id (sessions.client_id half of the dual key) — null
   *  until resolved, and permanently null for account-less targets */
  profileId: string | null;
  isOverride: boolean;
  /** true once every async lookup the CURRENT mode needs has settled
   *  (hooks wait on this instead of fetching against a half-resolved
   *  identity; trainer-without-override is trivially resolved) */
  resolved: boolean;
}

// Positive-result caches only (email → id). A missing row is NOT
// cached — a clients/profiles row created later must be picked up.
// Same per-user pattern as useTrainerProfile's module-level cache.
const clientsIdCache = new Map<string, string>();
const profileIdCache = new Map<string, string>();

export function useEffectiveClientIdentity(): EffectiveClientIdentity {
  const { user, isClient } = useAuth();
  const { viewAs } = useViewAs();

  // Resolution states are keyed by the email they resolved so a
  // stale result from a previous user/override is never served.
  const [own, setOwn] = useState<{ email: string; clientId: string | null } | null>(null);
  const [overrideProfile, setOverrideProfile] = useState<{
    email: string;
    profileId: string | null;
  } | null>(null);

  const ownEmail = !viewAs && isClient ? (user?.email ?? null) : null;
  const overrideEmail = viewAs?.email ?? null;

  // Own clients row (client role, no override) — newest first, same
  // resolution every inline copy used to do.
  useEffect(() => {
    if (!ownEmail) return;
    let cancelled = false;
    (async () => {
      const cached = clientsIdCache.get(ownEmail);
      let id: string | null = null;
      if (cached) {
        id = cached;
      } else {
        const { data } = await supabase
          .from("clients")
          .select("id")
          .ilike("email", ownEmail)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cancelled) return;
        id = (data as { id: string } | null)?.id ?? null;
        if (id) clientsIdCache.set(ownEmail, id);
      }
      if (cancelled) return;
      setOwn({ email: ownEmail, clientId: id });
    })();
    return () => {
      cancelled = true;
    };
  }, [ownEmail]);

  // Override target's profiles.id (sessions dual-key). Account-less
  // targets have no profiles row → resolved with null.
  useEffect(() => {
    if (!viewAs || !overrideEmail) return;
    let cancelled = false;
    (async () => {
      const cached = profileIdCache.get(overrideEmail);
      let id: string | null = null;
      if (cached) {
        id = cached;
      } else {
        const { data } = await supabase
          .from("profiles")
          .select("id")
          .ilike("email", overrideEmail)
          .maybeSingle();
        if (cancelled) return;
        id = (data as { id: string } | null)?.id ?? null;
        if (id) profileIdCache.set(overrideEmail, id);
      }
      if (cancelled) return;
      setOverrideProfile({ email: overrideEmail, profileId: id });
    })();
    return () => {
      cancelled = true;
    };
  }, [viewAs, overrideEmail]);

  if (viewAs) {
    const settled = overrideProfile?.email === overrideEmail;
    return {
      clientId: viewAs.clientId,
      clientEmail: viewAs.email,
      profileId: settled ? overrideProfile.profileId : null,
      isOverride: true,
      resolved: settled,
    };
  }
  if (ownEmail) {
    const settled = own?.email === ownEmail;
    return {
      clientId: settled ? own.clientId : null,
      clientEmail: ownEmail,
      profileId: settled ? (user?.id ?? null) : null,
      isOverride: false,
      resolved: settled,
    };
  }
  return {
    clientId: null,
    clientEmail: null,
    profileId: null,
    isOverride: false,
    resolved: true,
  };
}
