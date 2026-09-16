/* ═══════════════════════════════════════════════════════════════
   useConsistencyMap (Phase 86) — data for the consistency heatmap.
   Exactly ONE range query per activity source over the 12-week
   window (sessions / daily_plan_items / habit_logs /
   check_in_submissions) — no per-day or N+1 queries.

   Documented sharing choice: useInsights (Phase 83) fetches overlapping
   sources but at different windows (2 weeks / 90-day streak) and for
   different math (week aggregates, not per-day counts). Extending it
   would couple two features and over-fetch; instead this hook reuses
   the SHARED pieces (weekStartMonday, formatDateKeyLocal, the
   client-resolution + orFilter pattern) and issues its own four
   12-week range queries.

   RLS-safe: client view resolves own clients row via profiles-email
   join (27B); trainer view passes the client's id + email explicitly
   and reads only that client's rows (trainer policies).
   ═══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useEffectiveClientIdentity } from "@/hooks/useViewAs";
import { formatDateKeyLocal } from "@/lib/utils";
import {
  buildConsistencyGrid,
  consistencyRange,
  type ConsistencyGrid,
} from "@/lib/consistencyMap";
import { clientScopeOr } from "@/lib/clientScope";

interface UseConsistencyMapOptions {
  /** trainer view: the clients-row id of the client being viewed */
  clientId?: string;
  /** trainer view: that client's email (resolves profiles.id for the
   *  sessions.client_id half of the OR filter) */
  clientEmail?: string;
}

const iso = (dateKey: string) => new Date(`${dateKey}T00:00:00`).toISOString();

export interface ActivityWindowRaw {
  sessionDates: string[];
  planItems: { date: string; done: boolean }[];
  habitDates: string[];
  checkinDates: string[];
  startKey: string;
  todayKey: string;
}

export function useConsistencyMap(opts: UseConsistencyMapOptions = {}) {
  // Phase 90e: with no explicit trainer props, resolution goes through
  // the shared resolver (own identity, or the view-as target).
  const eff = useEffectiveClientIdentity();
  const [grid, setGrid] = useState<ConsistencyGrid | null>(null);
  const [raw, setRaw] = useState<ActivityWindowRaw | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    // Explicit trainer props (client drill-down views) win; otherwise
    // the shared resolver supplies the identity. Never fetch until it
    // has settled — a null clients.id after resolution is a REAL empty
    // state (account-less), not a "still loading" one.
    const explicit = !!opts.clientId;
    const ready = explicit ? !!opts.clientEmail : eff.resolved;
    if (!ready) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(false);
      try {
        // Resolve clients-row id (+ profiles id for sessions OR filter)
        const cid: string | null = opts.clientId ?? eff.clientId;
        let profileId: string | null = null;

        if (explicit) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("id")
            .eq("email", opts.clientEmail!)
            .maybeSingle();
          if (cancelled) return;
          profileId = (prof as { id: string } | null)?.id ?? null;
        } else {
          profileId = eff.profileId;
        }

        const { startKey, todayKey } = consistencyRange();
        const tomorrow = new Date(new Date(`${todayKey}T00:00:00`).getTime() + 86400000);

        // sessions: profile-id OR clients-row id (same orFilter pattern
        // as useInsights/useMetricTiles), completed only, 12-week window.
        // Fix Pack 2: defensive scope — null cid used to interpolate
        // `client_record_id.eq.null` (400/22P02).
        const scope = clientScopeOr(profileId, cid);
        const sessionsQuery =
          scope !== null
            ? supabase
                .from("sessions")
                .select("starts_at")
                .or(scope)
                .eq("status", "completed")
                .gte("starts_at", iso(startKey))
                .lt("starts_at", tomorrow.toISOString())
            : Promise.resolve({ data: [] });

        const [sessRes, planRes, habitRes, checkinRes] = await Promise.all([
          sessionsQuery,
          cid
            ? supabase
                // Phase 87: done flag shared with the achievements engine
                // (plan-finisher needs done AND undone items; the heatmap
                // still derives its planDates by filtering done)
                .from("daily_plan_items")
                .select("plan_date, done")
                .eq("client_id", cid)
                .gte("plan_date", startKey)
                .lte("plan_date", todayKey)
            : Promise.resolve({ data: [] }),
          cid
            ? supabase
                .from("habit_logs")
                .select("log_date")
                .eq("client_id", cid)
                .eq("done", true)
                .gte("log_date", startKey)
                .lte("log_date", todayKey)
            : Promise.resolve({ data: [] }),
          cid
            ? supabase
                .from("check_in_submissions")
                .select("submitted_at")
                .eq("client_id", cid)
                .gte("submitted_at", iso(startKey))
                .lt("submitted_at", tomorrow.toISOString())
            : Promise.resolve({ data: [] }),
        ]);
        if (cancelled) return;

        const sessionDates = ((sessRes.data as { starts_at: string }[] | null) ?? []).map((s) =>
          formatDateKeyLocal(new Date(s.starts_at)),
        );
        const planItems = ((planRes.data as { plan_date: string; done: boolean }[] | null) ?? []).map((p) => ({
          date: p.plan_date,
          done: p.done,
        }));
        const planDates = planItems.filter((p) => p.done).map((p) => p.date);
        const habitDates = ((habitRes.data as { log_date: string }[] | null) ?? []).map((h) => h.log_date);
        const checkinDates = ((checkinRes.data as { submitted_at: string }[] | null) ?? []).map((c) =>
          formatDateKeyLocal(new Date(c.submitted_at)),
        );

        setGrid(
          buildConsistencyGrid({ sessionDates, planDates, habitDates, checkinDates }),
        );
        // Phase 87: raw arrays shared with useAchievements (no parallel
        // query layer for the same sources)
        setRaw({ sessionDates, planItems, habitDates, checkinDates, startKey, todayKey });
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };

  }, [eff.resolved, eff.clientId, eff.profileId, opts.clientId, opts.clientEmail]);

  return { grid, raw, loading, error };
}
