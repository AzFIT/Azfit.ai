/* ═══════════════════════════════════════════════════════════════
   My Progress (Phase 55, Item 1) — client dashboard section.
   Week banner (54 mapper) • 90-day weight trend (shared 55 chart)
   • weekly compliance ring (workout_logs vs sessions) • the 38
   WeeklyAdherenceStrip. Self-loading; honest empty states; hidden
   pieces when there's simply no data.
   ═══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { programWeek } from "@/lib/planPackPrint";
import { weekWindow } from "@/lib/weeklyDigest";
import { withMovingAverage, type WeightPoint } from "@/lib/weightTrend";
import { compliancePct } from "@/lib/lifestyleTargets";
import WeightTrendChart from "@/components/shared/WeightTrendChart";
import WeeklyAdherenceStrip from "@/components/nutrition/WeeklyAdherenceStrip";
import { GlassCard } from "./shared/GlassCard";
import { ProgressRing } from "./shared/ProgressRing";

interface Props {
  clientsId: string; // clients.id
  userId: string; // profiles.id
}

const DAY_MS = 86400000;

export default function MyProgressSection({ clientsId, userId }: Props) {
  const [week, setWeek] = useState<{ week: number; total: number; programName: string } | null>(null);
  const [weightData, setWeightData] = useState<WeightPoint[]>([]);
  const [ring, setRing] = useState<{ completed: number; planned: number } | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { start, end } = weekWindow(0);
      const startIso = start.toISOString();
      const endIso = end.toISOString();
      const weightCutoff = new Date(Date.now() - 90 * DAY_MS).toISOString();

      const [progRes, bcRes, logsRes, sessRes] = await Promise.all([
        supabase
          .from("programs")
          .select("name, start_date, duration_weeks")
          .eq("client_id", clientsId)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("body_composition")
          .select("recorded_at, weight_kg")
          .eq("client_id", clientsId)
          .not("weight_kg", "is", null)
          .gte("recorded_at", weightCutoff)
          .order("recorded_at", { ascending: true }),
        // completed workouts this week (45 digest source: workout_logs)
        supabase
          .from("workout_logs")
          .select("id", { count: "exact", head: true })
          .eq("client_id", clientsId)
          .not("completed_at", "is", null)
          .gte("completed_at", startIso)
          .lt("completed_at", endIso),
        // planned sessions this week (both id spaces, 35 pattern)
        supabase
          .from("sessions")
          .select("id", { count: "exact", head: true })
          .or(`client_record_id.eq.${clientsId},client_id.eq.${userId}`)
          .neq("status", "cancelled")
          .gte("starts_at", startIso)
          .lt("starts_at", endIso),
      ]);
      if (cancelled) return;

      const prog = progRes.data;
      if (prog) {
        const w = programWeek(prog.start_date, prog.duration_weeks, new Date());
        setWeek(w ? { ...w, programName: prog.name } : { week: 0, total: prog.duration_weeks, programName: prog.name });
      }

      const pts = ((bcRes.data as { recorded_at: string; weight_kg: number | null }[] | null) ?? [])
        .filter((r) => r.weight_kg != null)
        .map((r) => ({ date: r.recorded_at, weight: r.weight_kg as number }));
      setWeightData(withMovingAverage(pts));

      setRing({ completed: logsRes.count ?? 0, planned: sessRes.count ?? 0 });
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [clientsId, userId]);

  if (!loaded) return null;

  const pct = ring ? compliancePct(ring.completed, ring.planned) : null;

  return (
    <GlassCard title="My Progress" titleIcon={<TrendingUp className="h-4 w-4" />} glass hover accentColor="#00AEEF">
      <div className="space-y-5 py-2">
        {/* Week banner (hidden when no active program) */}
        {week && (
          <div
            className="flex items-center justify-between rounded-xl border px-4 py-3"
            style={{ borderColor: "var(--card-border)", backgroundColor: "var(--light-elevated)" }}
          >
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold" style={{ color: "var(--page-text)" }}>
                {week.programName}
              </p>
              <p className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>
                Active program
              </p>
            </div>
            <span
              className="shrink-0 rounded-full px-3 py-1 text-xs font-bold text-white"
              style={{ background: "linear-gradient(135deg, #00AEEF, #8B5CF6)" }}
            >
              {week.week === 0 ? "Starts soon" : `Week ${week.week} of ${week.total}`}
            </span>
          </div>
        )}

        {/* Weight trend (90 days) */}
        <div>
          <p className="mb-2 text-xs font-semibold" style={{ color: "var(--page-text)" }}>
            Weight trend <span style={{ color: "var(--light-text-muted)" }}>(90 days)</span>
          </p>
          {weightData.length < 2 ? (
            <p className="py-4 text-center text-xs" style={{ color: "var(--light-text-muted)" }}>
              {weightData.length === 0
                ? "No weight data yet — your coach will log measurements, or use Quick Log below."
                : "Not enough measurements yet — check back after your next one."}
            </p>
          ) : (
            <WeightTrendChart data={weightData} height={180} />
          )}
        </div>

        {/* Compliance ring + adherence strip */}
        <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-[auto_1fr]">
          <div className="flex flex-col items-center">
            {pct === null ? (
              <div className="py-3 text-center">
                <p className="text-sm font-semibold" style={{ color: "var(--page-text)" }}>
                  {ring?.completed ?? 0} workout{(ring?.completed ?? 0) === 1 ? "" : "s"} done
                </p>
                <p className="text-[11px]" style={{ color: "var(--light-text-muted)" }}>
                  No sessions scheduled this week
                </p>
              </div>
            ) : (
              <ProgressRing
                size={120}
                strokeWidth={10}
                percentage={pct}
                color="#00AEEF"
                gradientEndColor="#8B5CF6"
                label="this week"
                value={`${pct}%`}
                subtitle={ring ? `${ring.completed}/${ring.planned} sessions` : undefined}
                glowClass="glow-cyan"
              />
            )}
          </div>
          <div className="min-w-0">
            <WeeklyAdherenceStrip />
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
