import { supabase } from "@/lib/supabase";
import { formatDateKeyLocal } from "@/lib/utils";
import { loggedByForWrite, type ViewAsIdentity } from "@/lib/viewAs";
import type {
  MealData,
  SleepData,
  TrainingData,
  WaterData,
  WeightData,
} from "@/lib/quickLog";

/* ═══════════════════════════════════════════════════════════════════
   Quick-log writers (Phase 97a) — every intent writes through the
   EXISTING real tables and real write conventions, never a parallel
   store:

     weight   → body_composition (client_id = clients.id)
     meal     → foods_cache ('custom', 0-default macros = the table's
                own convention for partial data) + nutrition_logs
                (user_id = SIGNED-IN profile id — RLS is own-row only
                and the table has no logged_by column, so meal logging
                is unavailable under View As Client; honest message)
     water    → habit_logs, ADDITIVE on today's value (read → sum →
                upsert), converted liters → the habit's own unit
     sleep    → habit_logs, REPLACE today's value
     training → habit_logs flag habit (target_value NULL, done:true) —
                workout_logs is unreachable here (workout_id NOT NULL,
                no program context in chat) so training is a flag +
                chat summary, documented deviation

   logged_by: NULL = self-logged; the trainer's auth uid while a
   90e View As Client override is active (habit paths only — the only
   tables that carry the column). Identity resolution is the caller's
   job (useEffectiveClientIdentity + useViewAs + useAuth).
   ═══════════════════════════════════════════════════════════════════ */

export interface QuickLogWriterIdentity {
  /** clients.id of the person the entry belongs to (own, or the
   *  override target's). */
  clientId: string;
  /** profiles.id of the SIGNED-IN user (nutrition_logs.user_id). */
  authUserId: string;
}

export interface WriteResult {
  ok: boolean;
  /** Human sentence for the assistant bubble / toast. */
  message: string;
}

function today(): string {
  return formatDateKeyLocal(new Date());
}

function fail(message: string): WriteResult {
  return { ok: false, message };
}

/* ── Weight ─────────────────────────────────────────────────────── */

export async function writeWeight(
  id: QuickLogWriterIdentity,
  data: WeightData,
  override: ViewAsIdentity | null,
): Promise<WriteResult> {
  const { error } = await supabase.from("body_composition").insert({
    client_id: id.clientId,
    weight_kg: data.kg,
    notes: override ? "Logged by coach (AI quick-log)" : "AI quick-log",
  });
  if (error) return fail(`Couldn't save your weight: ${error.message}`);
  return { ok: true, message: `Logged weight ${data.kg} kg ✓` };
}

/* ── Meal ───────────────────────────────────────────────────────── */

export async function writeMeal(
  id: QuickLogWriterIdentity,
  data: MealData,
  override: ViewAsIdentity | null,
): Promise<WriteResult> {
  if (override) {
    return fail(
      "Meal logging isn't available in Coach view — nutrition logs are tied to the client's own account. Ask the client to log it from their device.",
    );
  }
  const { data: food, error: foodErr } = await supabase
    .from("foods_cache")
    .insert({
      source: "custom",
      source_id: null,
      name: data.name,
      serving_size_g: 100,
      // foods_cache macros are NOT NULL DEFAULT 0 — 0 = "not provided",
      // the app's existing convention for partial custom foods.
      calories: data.calories ?? 0,
      protein: data.protein_g ?? 0,
      carbs: data.carbs_g ?? 0,
      fats: data.fats_g ?? 0,
      created_by: id.authUserId,
    })
    .select("id")
    .single();
  if (foodErr || !food) {
    return fail(`Couldn't save that meal: ${foodErr?.message ?? "unknown error"}`);
  }
  const { error: logErr } = await supabase.from("nutrition_logs").insert({
    user_id: id.authUserId,
    logged_date: today(),
    meal_type: data.meal_type ?? "snacks",
    food_id: (food as { id: string }).id,
    quantity_g: 100,
  });
  if (logErr) return fail(`Couldn't add it to today's log: ${logErr.message}`);
  const bits: string[] = [];
  if (data.calories != null) bits.push(`${data.calories} kcal`);
  if (data.protein_g != null) bits.push(`${data.protein_g}g protein`);
  return {
    ok: true,
    message: `Logged ${data.name}${bits.length ? ` (${bits.join(", ")})` : ""} as ${data.meal_type} ✓`,
  };
}

/* ── Habits (water / sleep / training) ──────────────────────────── */

/** Convert a liter amount into the habit's own unit (habit_logs.value
 *  is stored in that unit — a 2000-target "Water" habit means ml). */
export function litersToHabitUnit(liters: number, unit: string | null): number {
  const u = (unit ?? "l").toLowerCase();
  if (u === "ml" || u === "milliliter" || u === "milliliters") return Math.round(liters * 1000);
  if (u.startsWith("glass")) return Math.round(liters / 0.25);
  if (u.startsWith("cup")) return Math.round(liters / 0.24);
  return Math.round(liters * 100) / 100;
}

async function findHabit(
  clientId: string,
  patterns: string[],
): Promise<{ id: string; unit: string | null; targetValue: number | null } | null> {
  const orFilter = patterns.map((p) => `name.ilike.${p}`).join(",");
  const { data } = await supabase
    .from("habits")
    .select("id, unit, target_value")
    .eq("client_id", clientId)
    .eq("active", true)
    .or(orFilter)
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const row = data as { id: string; unit: string | null; target_value: number | null };
  return { id: row.id, unit: row.unit, targetValue: row.target_value };
}

async function upsertHabitLog(params: {
  habitId: string;
  clientId: string;
  value: number | null;
  loggedBy: string | null;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from("habit_logs").upsert(
    {
      habit_id: params.habitId,
      client_id: params.clientId,
      log_date: today(),
      done: true,
      value: params.value,
      logged_by: params.loggedBy,
    },
    { onConflict: "habit_id,log_date" },
  );
  return { error: error?.message ?? null };
}

export async function writeWater(
  id: QuickLogWriterIdentity,
  data: WaterData,
  override: ViewAsIdentity | null,
  trainerUid: string,
): Promise<WriteResult> {
  const habit = await findHabit(id.clientId, ["%water%", "%hydrat%"]);
  if (!habit) {
    return fail("Your coach hasn't set up a water habit for you yet — ask them to add one.");
  }
  const added = litersToHabitUnit(data.liters, habit.unit);
  // Additive: read today's row, sum, upsert (water counts up across the day).
  const { data: existing } = await supabase
    .from("habit_logs")
    .select("value")
    .eq("habit_id", habit.id)
    .eq("log_date", today())
    .maybeSingle();
  const base = Number((existing as { value: number | null } | null)?.value ?? 0);
  const total = Math.round((base + added) * 100) / 100;
  const { error } = await upsertHabitLog({
    habitId: habit.id,
    clientId: id.clientId,
    value: total,
    loggedBy: loggedByForWrite(override, trainerUid),
  });
  if (error) return fail(`Couldn't save your water intake: ${error}`);
  return { ok: true, message: `Logged ${data.liters} l of water (today: ${total} ${habit.unit ?? "l"}) ✓` };
}

export async function writeSleep(
  id: QuickLogWriterIdentity,
  data: SleepData,
  override: ViewAsIdentity | null,
  trainerUid: string,
): Promise<WriteResult> {
  const habit = await findHabit(id.clientId, ["%sleep%"]);
  if (!habit) {
    return fail("Your coach hasn't set up a sleep habit for you yet — ask them to add one.");
  }
  const { error } = await upsertHabitLog({
    habitId: habit.id,
    clientId: id.clientId,
    value: data.hours,
    loggedBy: loggedByForWrite(override, trainerUid),
  });
  if (error) return fail(`Couldn't save your sleep: ${error}`);
  return { ok: true, message: `Logged ${data.hours} h of sleep ✓` };
}

export async function writeTraining(
  id: QuickLogWriterIdentity,
  data: TrainingData,
  override: ViewAsIdentity | null,
  trainerUid: string,
): Promise<WriteResult> {
  const habit = await findHabit(id.clientId, ["%train%", "%workout%", "%gym%", "%exercise%"]);
  if (!habit) {
    return fail(
      "Your coach hasn't set up a training habit for you yet — ask them to add one.",
    );
  }
  const { error } = await upsertHabitLog({
    habitId: habit.id,
    clientId: id.clientId,
    value: null,
    loggedBy: loggedByForWrite(override, trainerUid),
  });
  if (error) return fail(`Couldn't log your training: ${error}`);
  const dur = data.duration_min != null ? `, ${data.duration_min} min` : "";
  return { ok: true, message: `Training logged ✓ (${data.summary}${dur})` };
}
