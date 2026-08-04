/* ═══════════════════════════════════════════════════════════════════
   Weekly nutrition adherence (Phase 38, Item 2) — pure logic.
   A week = the 7 client-local dates ending TODAY (inclusive).
   Averages are taken over LOGGED days only (a day with no rows is
   absent, not zero) — documented choice: averaging in empty days
   would punish clients who simply haven't logged yet.
   ═══════════════════════════════════════════════════════════════════ */

export interface AdherenceLogRow {
  logged_date: string; // YYYY-MM-DD
  quantity_g: number;
  /** food macros per serving_size_g (flattened from foods_cache) */
  calories: number;
  protein: number;
  serving_size_g: number | null;
}

export interface DayMacros {
  date: string; // YYYY-MM-DD
  kcal: number;
  protein: number;
}

export interface WeekAdherence {
  /** 7 entries, oldest → today, every window date present */
  days: DayMacros[];
  /** days with at least one logged row */
  daysLogged: number;
  /** averages over logged days; null when nothing was logged */
  avgKcal: number | null;
  avgProtein: number | null;
}

const DAY_MS = 86400000;

function parseLocal(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function fmtLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** The 7 window dates, oldest first, ending at `today` (YYYY-MM-DD). */
export function last7Dates(today: string): string[] {
  const end = parseLocal(today);
  const out: string[] = [];
  for (let i = 6; i >= 0; i--) {
    out.push(fmtLocal(new Date(end.getTime() - i * DAY_MS)));
  }
  return out;
}

export function aggregateWeek(
  rows: AdherenceLogRow[],
  today: string,
): WeekAdherence {
  const dates = last7Dates(today);
  const inWindow = new Set(dates);
  const kcalByDate = new Map<string, number>();
  const proteinByDate = new Map<string, number>();

  for (const r of rows) {
    if (!inWindow.has(r.logged_date)) continue;
    const ratio = r.quantity_g / (r.serving_size_g ?? 100);
    kcalByDate.set(
      r.logged_date,
      (kcalByDate.get(r.logged_date) ?? 0) + r.calories * ratio,
    );
    proteinByDate.set(
      r.logged_date,
      (proteinByDate.get(r.logged_date) ?? 0) + r.protein * ratio,
    );
  }

  const days: DayMacros[] = dates.map((date) => ({
    date,
    kcal: Math.round(kcalByDate.get(date) ?? 0),
    protein: Math.round((proteinByDate.get(date) ?? 0) * 10) / 10,
  }));

  const logged = days.filter((d) => d.kcal > 0);
  const daysLogged = logged.length;
  return {
    days,
    daysLogged,
    avgKcal:
      daysLogged > 0
        ? Math.round(logged.reduce((s, d) => s + d.kcal, 0) / daysLogged)
        : null,
    avgProtein:
      daysLogged > 0
        ? Math.round(
            (logged.reduce((s, d) => s + d.protein, 0) / daysLogged) * 10,
          ) / 10
        : null,
  };
}

/** Average-vs-target percentages; null when targets are missing or
 * nothing was logged (caller shows an honest state instead). */
export function targetPercents(
  week: WeekAdherence,
  targets: { calories: number; protein: number } | null,
): { kcalPct: number; proteinPct: number } | null {
  if (!targets || !targets.calories || !targets.protein) return null;
  if (week.avgKcal === null || week.avgProtein === null) return null;
  return {
    kcalPct: Math.round((week.avgKcal / targets.calories) * 100),
    proteinPct: Math.round((week.avgProtein / targets.protein) * 100),
  };
}
