import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router";
import { Apple, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { CollapsibleSection } from "./shared/CollapsibleSection";
import {
  nutritionDot,
  sortNutritionRows,
  type NutritionDot,
} from "@/lib/nutritionCommand";

/* ═══════════════════════════════════════════════════════════════════
   Nutrition Command Center (Phase 37)
   One row per client: targets (nutrition_targets), meal-plan status
   (meal_plans via clients.id — covers account-less clients), adherence
   (nutrition_logs distinct days in the last 7 — profile-linked only).
   Real queries only; honest empty states; no fabricated numbers.
   ═══════════════════════════════════════════════════════════════════ */

interface Targets {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fats_g: number;
}

interface Row {
  clientId: string;
  name: string;
  hasTargets: boolean;
  hasPlan: boolean;
  targets: Targets | null;
  planItemCount: number | null;
  /** distinct logged days in the last 7; null = no linked profile */
  loggedDays: number | null;
}

const DOT_COLOR: Record<NutritionDot, string> = {
  red: "var(--danger)",
  amber: "var(--warning)",
  green: "var(--success)",
};

const DAY_MS = 86400000;

export default function NutritionCommandCenter() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    (async () => {
      const { data: clients, error: clientsErr } = await supabase
        .from("clients")
        .select("id, full_name, email")
        .eq("trainer_id", user.id)
        .neq("status", "archived")
        .order("full_name", { ascending: true });
      if (cancelled) return;
      if (clientsErr) {
        setLoadError(true);
        return;
      }
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
      const profileIdByEmail = new Map(
        (profiles || []).map((p) => [p.email, p.id]),
      );
      const profileIds = [...new Set((profiles || []).map((p) => p.id))];

      const sevenDaysAgo = new Date(Date.now() - 6 * DAY_MS)
        .toISOString()
        .slice(0, 10);

      const [targetsRes, plansRes, logsRes] = await Promise.all([
        profileIds.length
          ? supabase
              .from("nutrition_targets")
              .select("user_id, calories, protein_g, carbs_g, fats_g")
              .in("user_id", profileIds)
          : Promise.resolve({ data: [] as (Targets & { user_id: string })[] }),
        supabase
          .from("meal_plans")
          .select("id, client_id, items")
          .in("client_id", clientIds),
        profileIds.length
          ? supabase
              .from("nutrition_logs")
              .select("user_id, logged_date")
              .in("user_id", profileIds)
              .gte("logged_date", sevenDaysAgo)
              .limit(2000)
          : Promise.resolve({
              data: [] as { user_id: string; logged_date: string }[],
            }),
      ]);
      if (cancelled) return;

      const targetsByProfile = new Map(
        (
          (targetsRes.data as (Targets & { user_id: string })[]) || []
        ).map((t) => [t.user_id, t]),
      );

      // Latest plan per client (a client may have several saved plans)
      const planCountByClient = new Map<string, number>();
      for (const p of plansRes.data || []) {
        const count = Array.isArray(p.items) ? p.items.length : 0;
        planCountByClient.set(p.client_id, count);
      }

      const loggedDatesByProfile = new Map<string, Set<string>>();
      for (const l of logsRes.data || []) {
        if (!loggedDatesByProfile.has(l.user_id)) {
          loggedDatesByProfile.set(l.user_id, new Set());
        }
        loggedDatesByProfile.get(l.user_id)!.add(l.logged_date);
      }

      const built: Row[] = clients.map((c) => {
        const pid = profileIdByEmail.get(c.email);
        const t = pid ? targetsByProfile.get(pid) : undefined;
        const planCount = planCountByClient.get(c.id);
        return {
          clientId: c.id,
          name: c.full_name,
          hasTargets: !!t,
          hasPlan: planCount !== undefined,
          targets: t
            ? {
                calories: t.calories,
                protein_g: t.protein_g,
                carbs_g: t.carbs_g,
                fats_g: t.fats_g,
              }
            : null,
          planItemCount: planCount ?? null,
          loggedDays: pid
            ? (loggedDatesByProfile.get(pid)?.size ?? 0)
            : null,
        };
      });

      setRows(sortNutritionRows(built));
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (!rows && !loadError) return null; // loading — render nothing (matches FollowUpsWidget)
  if (rows && rows.length === 0) return null; // zero clients — hide widget entirely

  const withTargets = (rows || []).filter((r) => r.hasTargets).length;
  const withPlans = (rows || []).filter((r) => r.hasPlan).length;

  const nutritionUrl = (clientId: string) => `/client/${clientId}?tab=nutrition`;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="mb-6"
    >
      <CollapsibleSection
        title="Nutrition Command Center"
        icon={<Apple className="h-4 w-4" />}
        defaultExpanded
        accentColor="var(--success)"
        badge={
          rows ? (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={{
                backgroundColor: "var(--light-elevated)",
                color: "var(--light-text-muted)",
              }}
            >
              {withTargets} of {rows.length} with targets · {withPlans} with plans
            </span>
          ) : undefined
        }
      >
        {loadError ? (
          <p
            className="text-xs"
            style={{ color: "var(--light-text-muted)" }}
          >
            Couldn’t load the nutrition overview — refresh to retry.
          </p>
        ) : (
          <div className="space-y-1.5">
            {(rows || []).map((r) => {
              const dot = nutritionDot(r);
              return (
                <div
                  key={r.clientId}
                  className="flex flex-col gap-2 rounded-xl border px-3 py-2 md:flex-row md:items-center md:justify-between"
                  style={{
                    backgroundColor: "var(--card-bg)",
                    borderColor: "var(--card-border)",
                  }}
                >
                  {/* Client + status dot */}
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: DOT_COLOR[dot] }}
                      title={
                        dot === "red"
                          ? "No nutrition targets"
                          : dot === "amber"
                            ? "Targets set, no meal plan"
                            : "Meal plan saved"
                      }
                    />
                    <button
                      onClick={() => navigate(nutritionUrl(r.clientId))}
                      className="truncate text-xs font-medium transition-opacity hover:opacity-70"
                      style={{ color: "var(--page-text)" }}
                    >
                      {r.name}
                    </button>
                  </div>

                  {/* Targets / plan / adherence */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 md:justify-end">
                    {r.targets ? (
                      <span className="flex flex-wrap items-center gap-1">
                        <span
                          className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                          style={{
                            backgroundColor: "var(--light-elevated)",
                            color: "var(--page-text)",
                          }}
                        >
                          {r.targets.calories} kcal
                        </span>
                        {(
                          [
                            ["P", r.targets.protein_g],
                            ["C", r.targets.carbs_g],
                            ["F", r.targets.fats_g],
                          ] as const
                        ).map(([label, grams]) => (
                          <span
                            key={label}
                            className="rounded-md px-1.5 py-0.5 text-[10px] font-medium"
                            style={{
                              backgroundColor: "var(--light-elevated)",
                              color: "var(--light-text-muted)",
                            }}
                          >
                            {label} {grams}g
                          </span>
                        ))}
                      </span>
                    ) : (
                      <button
                        onClick={() => navigate(nutritionUrl(r.clientId))}
                        className="text-[11px] font-medium transition-opacity hover:opacity-70"
                        style={{ color: "var(--danger)" }}
                      >
                        No targets — Set targets
                      </button>
                    )}

                    <span
                      className="text-[10px]"
                      style={{
                        color: r.hasPlan
                          ? "var(--success)"
                          : "var(--light-text-muted)",
                      }}
                    >
                      {r.hasPlan
                        ? `Saved plan · ${r.planItemCount} items`
                        : "No plan"}
                    </span>

                    <span
                      className="text-[10px]"
                      style={{ color: "var(--light-text-muted)" }}
                    >
                      {r.loggedDays === null
                        ? "No food logging yet"
                        : `logged ${r.loggedDays} of last 7 days`}
                    </span>

                    <button
                      onClick={() => navigate(nutritionUrl(r.clientId))}
                      className="flex shrink-0 items-center gap-0.5 text-[11px] font-semibold transition-opacity hover:opacity-70"
                      style={{ color: "var(--azfit-primary)" }}
                    >
                      Open Nutrition
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CollapsibleSection>
    </motion.section>
  );
}
