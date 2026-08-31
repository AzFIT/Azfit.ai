import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  aggregateWeek,
  last7Dates,
  targetPercents,
  type AdherenceLogRow,
  type WeekAdherence,
} from "@/lib/weeklyAdherence";

/* ═══════════════════════════════════════════════════════════════════
   Weekly Adherence Strip (Phase 38, Item 2)
   Same component on the client Nutrition page (userId omitted → the
   signed-in user) and the trainer's per-client Nutrition tab
   (userId = the client's profile id; trainer read RLS covers it).
   Self-contained: fetches its own targets row (distinguishes "no
   targets" from defaults) and one 7-day logs query.
   ═══════════════════════════════════════════════════════════════════ */

interface Props {
  userId?: string; // profiles.id; defaults to the signed-in user
  /** Bump to refetch (e.g. after logging food on the same screen) */
  refreshKey?: number;
}

interface Targets {
  calories: number;
  protein: number;
}

function todayLocal(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

export default function WeeklyAdherenceStrip({ userId, refreshKey = 0 }: Props) {
  const [week, setWeek] = useState<WeekAdherence | null>(null);
  const [targets, setTargets] = useState<Targets | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let uid = userId;
      if (!uid) {
        const { data: userData } = await supabase.auth.getUser();
        uid = userData.user?.id;
      }
      if (!uid) {
        if (!cancelled) setError(true);
        return;
      }

      const today = todayLocal();
      const windowStart = last7Dates(today)[0];

      const [targetsRes, logsRes] = await Promise.all([
        supabase
          .from("nutrition_targets")
          .select("calories, protein_g")
          .eq("user_id", uid)
          .maybeSingle(),
        supabase
          .from("nutrition_logs")
          .select("logged_date, quantity_g, food:foods_cache(calories, protein, serving_size_g)")
          .eq("user_id", uid)
          .gte("logged_date", windowStart)
          .lte("logged_date", today)
          .limit(2000),
      ]);
      if (cancelled) return;
      if (logsRes.error) {
        setError(true);
        return;
      }

      const rows: AdherenceLogRow[] = (
        (logsRes.data as unknown as Array<{
          logged_date: string;
          quantity_g: number;
          food:
            | { calories: number; protein: number; serving_size_g: number | null }
            | Array<{ calories: number; protein: number; serving_size_g: number | null }>
            | null;
        }>) || []
      ).flatMap((r) => {
        const food = Array.isArray(r.food) ? r.food[0] : r.food;
        if (!food) return [];
        return [
          {
            logged_date: r.logged_date,
            quantity_g: r.quantity_g,
            calories: food.calories,
            protein: food.protein,
            serving_size_g: food.serving_size_g,
          },
        ];
      });

      setWeek(aggregateWeek(rows, today));
      setTargets(
        targetsRes.data
          ? {
              calories: targetsRes.data.calories ?? 0,
              protein: targetsRes.data.protein_g ?? 0,
            }
          : null,
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, refreshKey]);

  if (error) {
    return (
      <div
        className="rounded-2xl border p-4"
        style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
      >
        <p className="text-xs" style={{ color: "var(--light-text-muted)" }}>
          Couldn’t load the weekly adherence — refresh to retry.
        </p>
      </div>
    );
  }

  if (!week) {
    return (
      <div
        className="h-24 animate-pulse rounded-2xl border"
        style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
      />
    );
  }

  const pct = targetPercents(week, targets);
  const maxKcal = Math.max(targets?.calories ?? 0, ...week.days.map((d) => d.kcal), 1);
  const targetLinePct = targets ? Math.min(100, (targets.calories / maxKcal) * 100) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      className="rounded-2xl border p-4"
      style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} style={{ color: "#84CC16" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--page-text)" }}>
            This Week
          </span>
        </div>
        <span className="text-[11px]" style={{ color: "var(--light-text-muted)" }}>
          <strong style={{ color: "var(--page-text)" }}>{week.daysLogged}/7</strong> days logged
        </span>
      </div>

      {week.daysLogged === 0 ? (
        <p className="py-2 text-center text-xs" style={{ color: "var(--light-text-muted)" }}>
          Nothing logged this week yet
        </p>
      ) : (
        <>
          {/* 7-bar mini chart with target line */}
          <div className="relative h-14">
            {targetLinePct !== null && (
              <div
                className="pointer-events-none absolute left-0 right-0 border-t border-dashed"
                style={{ bottom: `${targetLinePct}%`, borderColor: "rgba(245,158,11,0.7)" }}
                title={`Target ${targets?.calories} kcal`}
              />
            )}
            <div className="flex h-full items-end gap-1.5">
              {week.days.map((d) => (
                <div key={d.date} className="flex-1">
                  <div
                    className="w-full rounded-t-md"
                    style={
                      d.kcal > 0
                        ? {
                            height: `${Math.max(8, (d.kcal / maxKcal) * 100)}%`,
                            background: "linear-gradient(180deg, #00AEEF, #8B5CF6)",
                          }
                        : {
                            height: "3px",
                            backgroundColor: "var(--card-border)",
                          }
                    }
                    title={`${d.date}: ${d.kcal} kcal`}
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="mt-1 flex gap-1.5">
            {week.days.map((d) => (
              <span
                key={d.date}
                className="flex-1 text-center text-[9px]"
                style={{ color: "var(--light-text-muted)" }}
              >
                {DAY_LETTERS[new Date(`${d.date}T12:00:00`).getDay()]}
              </span>
            ))}
          </div>

          <p className="mt-2 text-[11px]" style={{ color: "var(--light-text-muted)" }}>
            avg <strong style={{ color: "var(--page-text)" }}>{week.avgKcal} kcal</strong>
            {" · "}
            protein <strong style={{ color: "var(--page-text)" }}>{week.avgProtein}g</strong>
            {pct ? (
              <>
                {" — "}
                <span style={{ color: "#00AEEF" }}>{pct.kcalPct}% of kcal target</span>
                {" · "}
                <span style={{ color: "var(--azfit-primary)" }}>{pct.proteinPct}% of protein target</span>
              </>
            ) : (
              <>
                {" — "}
                <span>Set targets first to see adherence %</span>
              </>
            )}
          </p>
        </>
      )}
    </motion.div>
  );
}
