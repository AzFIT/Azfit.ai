import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router";
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Apple,
  FileSpreadsheet,
  ClipboardList,
  Ticket,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import {
  weekWindow,
  sortDigestRows,
  summarizeRows,
  type DigestRowInput,
} from "@/lib/weeklyDigest";
import { aggregateWeek, targetPercents, type AdherenceLogRow } from "@/lib/weeklyAdherence";
import { remainingCredits } from "@/lib/creditsAvailability";

/* ═══════════════════════════════════════════════════════════════════
   Trainer Weekly Digest (Phase 45) — every client's week at a glance.
   READ-ONLY. Data-source mapping documented in src/lib/weeklyDigest.ts.
   ═══════════════════════════════════════════════════════════════════ */

interface Row extends DigestRowInput {
  clientId: string;
  name: string;
  programName: string | null;
  creditsRemaining: number | null; // Phase 50: null when the client has no package
}

const DAY_MS = 86400000;
const fmtDay = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
const dateStr = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export default function WeeklyDigest() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [weekOffset, setWeekOffset] = useState(0);
  const [rows, setRows] = useState<Row[] | null>(null);

  const window = useMemo(() => weekWindow(weekOffset), [weekOffset]);
  const sunday = useMemo(() => new Date(window.end.getTime() - DAY_MS), [window]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    (async () => {
      setRows(null); // loading state for the new week
      const { data: clients } = await supabase
        .from("clients")
        .select("id, full_name, email")
        .eq("trainer_id", user.id)
        .neq("status", "archived")
        .order("full_name", { ascending: true });
      if (cancelled) return;
      if (!clients || clients.length === 0) {
        setRows([]);
        return;
      }

      const clientIds = clients.map((c) => c.id);
      const emails = clients.map((c) => c.email);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email")
        .in("email", emails);
      const profileIdByEmail = new Map((profiles || []).map((p) => [p.email, p.id]));
      const profileIds = [...new Set((profiles || []).map((p) => p.id))];

      const startIso = window.start.toISOString();
      const endIso = window.end.toISOString();
      const startDate = dateStr(window.start);
      const endDate = dateStr(sunday);

      const [subsRes, priorRes, logsRes, sessRes, foodRes, targetsRes, progRes, pkgRes, pkgSessRes] =
        await Promise.all([
          // check-ins this week
          supabase
            .from("check_in_submissions")
            .select("client_id, answers, submitted_at")
            .in("client_id", clientIds)
            .gte("submitted_at", startIso)
            .lt("submitted_at", endIso),
          // latest prior check-in per client (for the weight delta)
          supabase
            .from("check_in_submissions")
            .select("client_id, answers, submitted_at")
            .in("client_id", clientIds)
            .lt("submitted_at", startIso)
            .order("submitted_at", { ascending: false })
            .limit(200),
          // workouts completed this week
          supabase
            .from("workout_logs")
            .select("client_id, completed_at")
            .in("client_id", clientIds)
            .gte("completed_at", startIso)
            .lt("completed_at", endIso),
          // scheduled sessions (side note; both id spaces, 35 pattern)
          supabase
            .from("sessions")
            .select("client_id, client_record_id, starts_at")
            .gte("starts_at", startIso)
            .lt("starts_at", endIso)
            .limit(500),
          // nutrition logs in the window (macro join for the % math)
          profileIds.length
            ? supabase
                .from("nutrition_logs")
                .select("user_id, logged_date, quantity_g, food:foods_cache(calories, protein, serving_size_g)")
                .in("user_id", profileIds)
                .gte("logged_date", startDate)
                .lte("logged_date", endDate)
                .limit(2000)
            : Promise.resolve({ data: [] as never[] }),
          profileIds.length
            ? supabase
                .from("nutrition_targets")
                .select("user_id, calories, protein_g")
                .in("user_id", profileIds)
            : Promise.resolve({ data: [] as never[] }),
          supabase
            .from("programs")
            .select("client_id, name, created_at")
            .in("client_id", clientIds)
            .eq("status", "active")
            .order("created_at", { ascending: false }),
          // Phase 50: packages + the sessions feeding the derivative count
          supabase
            .from("session_packages")
            .select("id, client_id, total_credits, created_at")
            .in("client_id", clientIds),
          supabase
            .from("sessions")
            .select("client_record_id, status, created_at")
            .in("client_record_id", clientIds)
            .in("status", ["scheduled", "completed"])
            .limit(1000),
        ]);
      if (cancelled) return;

      // index lookups
      const checkinWeight = new Map<string, number>();
      for (const s of subsRes.data || []) {
        const w = Number((s.answers as Record<string, unknown>)?.weight);
        if (Number.isFinite(w)) checkinWeight.set(s.client_id, w);
      }
      const priorWeight = new Map<string, number>();
      for (const s of priorRes.data || []) {
        if (priorWeight.has(s.client_id)) continue; // newest-first
        const w = Number((s.answers as Record<string, unknown>)?.weight);
        if (Number.isFinite(w)) priorWeight.set(s.client_id, w);
      }
      const workoutsByClient = new Map<string, number>();
      for (const l of logsRes.data || []) {
        workoutsByClient.set(l.client_id, (workoutsByClient.get(l.client_id) ?? 0) + 1);
      }
      const clientIdByProfile = new Map<string, string>();
      for (const c of clients) {
        const pid = profileIdByEmail.get(c.email);
        if (pid) clientIdByProfile.set(pid, c.id);
      }
      const sessionsByClient = new Map<string, number>();
      for (const s of sessRes.data || []) {
        const cid = s.client_record_id ?? clientIdByProfile.get(s.client_id ?? "");
        if (!cid || !clientIds.includes(cid)) continue;
        sessionsByClient.set(cid, (sessionsByClient.get(cid) ?? 0) + 1);
      }
      const foodByProfile = new Map<string, AdherenceLogRow[]>();
      for (const r of (foodRes.data as unknown as Array<{
        user_id: string;
        logged_date: string;
        quantity_g: number;
        food:
          | { calories: number; protein: number; serving_size_g: number | null }
          | Array<{ calories: number; protein: number; serving_size_g: number | null }>
          | null;
      }>) || []) {
        const food = Array.isArray(r.food) ? r.food[0] : r.food;
        if (!food) continue;
        if (!foodByProfile.has(r.user_id)) foodByProfile.set(r.user_id, []);
        foodByProfile.get(r.user_id)!.push({
          logged_date: r.logged_date,
          quantity_g: r.quantity_g,
          calories: food.calories,
          protein: food.protein,
          serving_size_g: food.serving_size_g,
        });
      }
      const targetsByProfile = new Map(
        ((targetsRes.data as unknown as Array<{ user_id: string; calories: number; protein_g: number }>) || []).map(
          (t) => [t.user_id, t],
        ),
      );
      const programByClient = new Map<string, string>();
      for (const p of progRes.data || []) {
        if (p.client_id && !programByClient.has(p.client_id)) {
          programByClient.set(p.client_id, p.name);
        }
      }

      // Phase 50: derivative credits per client (pool of their packages)
      const pkgSessionsByClient = new Map<string, Array<{ status: string | null; created_at: string | null }>>();
      for (const s of pkgSessRes.data || []) {
        if (!s.client_record_id) continue;
        if (!pkgSessionsByClient.has(s.client_record_id)) pkgSessionsByClient.set(s.client_record_id, []);
        pkgSessionsByClient.get(s.client_record_id)!.push({ status: s.status, created_at: s.created_at });
      }
      const creditsByClient = new Map<string, number>();
      const pkgsByClient = new Map<string, Array<{ id: string; total_credits: number; created_at: string | null }>>();
      for (const p of pkgRes.data || []) {
        if (!pkgsByClient.has(p.client_id)) pkgsByClient.set(p.client_id, []);
        pkgsByClient.get(p.client_id)!.push(p);
      }
      for (const [cid, pkgs] of pkgsByClient) {
        creditsByClient.set(cid, remainingCredits(pkgs, pkgSessionsByClient.get(cid) ?? []));
      }

      const sundayStr = dateStr(sunday);
      const built: Row[] = clients.map((c) => {
        const pid = profileIdByEmail.get(c.email);
        const w = checkinWeight.get(c.id);
        const pw = priorWeight.get(c.id);
        const week = pid
          ? aggregateWeek(foodByProfile.get(pid) ?? [], sundayStr)
          : null;
        const t = pid ? targetsByProfile.get(pid) : undefined;
        const pct =
          week && t
            ? targetPercents(week, { calories: t.calories, protein: t.protein_g })
            : null;
        return {
          clientId: c.id,
          name: c.full_name,
          checkinThisWeek: checkinWeight.has(c.id) || (subsRes.data || []).some((s) => s.client_id === c.id),
          weightDelta: w !== undefined && pw !== undefined ? Math.round((w - pw) * 10) / 10 : null,
          workoutsCompleted: workoutsByClient.get(c.id) ?? 0,
          sessionsScheduled: sessionsByClient.get(c.id) ?? 0,
          daysLogged: week?.daysLogged ?? 0,
          kcalPct: pct?.kcalPct ?? null,
          hasProgram: programByClient.has(c.id),
          programName: programByClient.get(c.id) ?? null,
          creditsRemaining: creditsByClient.get(c.id) ?? null,
        };
      });

      setRows(sortDigestRows(built));
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, window, sunday]);

  const summary = useMemo(() => (rows ? summarizeRows(rows) : null), [rows]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      {/* Header + week nav */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarRange size={20} style={{ color: "var(--azfit-primary)" }} />
          <h1 className="text-xl font-bold" style={{ color: "var(--page-text)" }}>
            Weekly Digest
          </h1>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setWeekOffset((o) => o + 1)}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition hover:opacity-80"
            style={{ backgroundColor: "var(--light-elevated)", color: "var(--page-text)" }}
          >
            <ChevronLeft size={12} />
            Previous week
          </button>
          <span
            className="rounded-lg px-2.5 py-1.5 text-[11px] font-medium"
            style={{ color: "var(--light-text-muted)" }}
          >
            {fmtDay(window.start)} – {fmtDay(sunday)}
          </span>
          <button
            onClick={() => setWeekOffset((o) => Math.max(0, o - 1))}
            disabled={weekOffset === 0}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition hover:opacity-80 disabled:opacity-40"
            style={{ backgroundColor: "var(--light-elevated)", color: "var(--page-text)" }}
          >
            Next week
            <ChevronRight size={12} />
          </button>
        </div>
      </div>

      {/* Summary strip */}
      {summary && summary.total > 0 && (
        <div
          className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border px-4 py-3 text-[11px]"
          style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
        >
          <span style={{ color: "var(--page-text)" }}>
            <strong style={{ color: "#22C55E" }}>{summary.checkedIn}/{summary.total}</strong> checked in
          </span>
          <span style={{ color: "var(--page-text)" }}>
            <strong style={{ color: "#00AEEF" }}>{summary.workoutsCompleted}</strong> workouts completed this week
          </span>
          <span style={{ color: "var(--page-text)" }}>
            <strong style={{ color: "#8B5CF6" }}>{summary.loggedAny}/{summary.total}</strong> logged food this week
          </span>
        </div>
      )}

      {/* Body */}
      {!rows ? (
        <div className="h-48 animate-pulse rounded-2xl border" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }} />
      ) : rows.length === 0 ? (
        <div
          className="flex flex-col items-center rounded-2xl border py-14"
          style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
        >
          <CalendarRange size={28} style={{ color: "var(--light-text-muted)" }} />
          <p className="mt-2 text-sm font-medium" style={{ color: "var(--page-text)" }}>
            No clients yet
          </p>
          <p className="text-xs" style={{ color: "var(--light-text-muted)" }}>
            Add clients from the Clients page and their week will show up here.
          </p>
        </div>
      ) : (
        <motion.div
          key={weekOffset}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-1.5"
        >
          {rows.map((r) => (
            <button
              key={r.clientId}
              onClick={() => navigate(`/client/${r.clientId}?tab=overview`)}
              className="flex w-full flex-col gap-2 rounded-xl border px-3 py-2.5 text-left transition hover:opacity-90 md:flex-row md:items-center md:justify-between"
              style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
            >
              <span className="min-w-0 shrink-0 text-xs font-semibold" style={{ color: "var(--page-text)" }}>
                {r.name}
              </span>

              <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
                {/* Check-in */}
                <span className="flex items-center gap-1" title="Weekly check-in">
                  <ClipboardList size={11} style={{ color: r.checkinThisWeek ? "#22C55E" : "#F59E0B" }} />
                  {r.checkinThisWeek ? (
                    <span style={{ color: "#22C55E" }}>
                      ✓{r.weightDelta !== null && ` ${r.weightDelta > 0 ? "+" : ""}${r.weightDelta} kg`}
                    </span>
                  ) : (
                    <span
                      className="rounded-full px-1.5 py-0.5 font-semibold"
                      style={{ backgroundColor: "rgba(245,158,11,0.15)", color: "#F59E0B" }}
                    >
                      Due
                    </span>
                  )}
                </span>

                {/* Training */}
                <span className="flex items-center gap-1" title="Workouts completed this week (workout_logs; scheduled sessions in parens)">
                  <Dumbbell size={11} style={{ color: r.workoutsCompleted > 0 ? "#00AEEF" : "var(--light-text-muted)" }} />
                  {r.workoutsCompleted > 0 ? (
                    <span style={{ color: "var(--page-text)" }}>
                      {r.workoutsCompleted} workout{r.workoutsCompleted !== 1 ? "s" : ""}
                      {r.sessionsScheduled > 0 && ` (${r.sessionsScheduled} sched)`}
                    </span>
                  ) : (
                    <span style={{ color: "var(--light-text-muted)" }}>
                      {r.sessionsScheduled > 0 ? `0/${r.sessionsScheduled}` : "—"}
                    </span>
                  )}
                </span>

                {/* Nutrition */}
                <span className="flex items-center gap-1" title="Days logged / avg kcal vs target">
                  <Apple size={11} style={{ color: r.daysLogged > 0 ? "#8B5CF6" : "var(--light-text-muted)" }} />
                  {r.daysLogged > 0 ? (
                    <span style={{ color: "var(--page-text)" }}>
                      {r.daysLogged}/7{r.kcalPct !== null && ` · ${r.kcalPct}%`}
                    </span>
                  ) : (
                    <span style={{ color: "var(--light-text-muted)" }}>—</span>
                  )}
                </span>

                {/* Program */}
                <span className="flex items-center gap-1" title="Active program">
                  <FileSpreadsheet size={11} style={{ color: r.hasProgram ? "var(--azfit-primary)" : "#EF4444" }} />
                  {r.hasProgram ? (
                    <span className="max-w-[140px] truncate" style={{ color: "var(--page-text)" }}>
                      {r.programName}
                    </span>
                  ) : (
                    <span
                      className="rounded-full px-1.5 py-0.5 font-semibold"
                      style={{ backgroundColor: "rgba(239,68,68,0.12)", color: "#EF4444" }}
                    >
                      No program
                    </span>
                  )}
                </span>

                {/* Phase 50: credits (red at ≤1, dash without a package) */}
                <span className="flex items-center gap-1" title="Session credits remaining">
                  <Ticket size={11} style={{ color: r.creditsRemaining !== null ? (r.creditsRemaining <= 1 ? "#EF4444" : "#8B5CF6") : "var(--light-text-muted)" }} />
                  {r.creditsRemaining !== null ? (
                    <span
                      className="font-semibold"
                      style={{ color: r.creditsRemaining <= 1 ? "#EF4444" : "var(--page-text)" }}
                    >
                      {r.creditsRemaining} cr
                    </span>
                  ) : (
                    <span style={{ color: "var(--light-text-muted)" }}>—</span>
                  )}
                </span>
              </span>
            </button>
          ))}
        </motion.div>
      )}
    </div>
  );
}
