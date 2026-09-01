/* ═══════════════════════════════════════════════════════════════
   Phase 65B Item 5 — "example draft week" for a training method,
   derived honestly from its Phase 48 methods.defaults jsonb:
   frequencyPerWeek → weekday spread (curated static mapping),
   preferredCategories → the session focus (live category labels),
   setsReps/notation/rest → the session detail. Curated presentation
   of REAL defaults only — nothing invented.
   ═══════════════════════════════════════════════════════════════ */

import { getCategoryById } from "@/data/exerciseDatabase";
import type { MethodDefaults } from "./methodDefaults";

/** Curated weekday spreads per weekly frequency (documented static mapping). */
const DAY_SPREADS: Record<number, string[]> = {
  2: ["Mon", "Thu"],
  3: ["Mon", "Wed", "Fri"],
  4: ["Mon", "Tue", "Thu", "Sat"],
  5: ["Mon", "Tue", "Wed", "Thu", "Fri"],
  6: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
};

export interface ExampleSession {
  day: string;
  /** Session focus derived from preferredCategories (rotates through them). */
  label: string;
  /** Prescription line from the defaults (setsReps · notation · rest). */
  detail: string;
}

function titleCase(upper: string): string {
  return upper
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Days of the week a method's sessions land on (frequency clamped 2–6). */
export function exampleWeekForMethod(d: MethodDefaults): ExampleSession[] {
  const freq = Math.min(6, Math.max(2, Math.round(d.frequencyPerWeek)));
  const days = DAY_SPREADS[freq] ?? DAY_SPREADS[3];
  return days.map((day, i) => {
    const catId = d.preferredCategories.length > 0 ? d.preferredCategories[i % d.preferredCategories.length] : null;
    const catLabel = catId ? titleCase(getCategoryById(catId)?.label ?? catId) : "Full Body";
    return {
      day,
      label: `${catLabel} session`,
      detail: `${d.setsReps}${d.notation !== "straight" ? ` · ${d.notation}` : ""} · rest ${d.rest}`,
    };
  });
}
