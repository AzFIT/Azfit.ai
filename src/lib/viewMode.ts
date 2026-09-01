/* ═══════════════════════════════════════════════════════════════
   Phase 65B Item 2 — Windows-Explorer-style view modes for the
   Program Creator's tile/card pages (Goal Selection, Method
   Selection, Phase Configuration, Exercise Review). Pure helpers;
   React state lives in src/hooks/useViewMode.ts.
   ═══════════════════════════════════════════════════════════════ */

export type ViewMode = "large" | "medium" | "small" | "list" | "details";

export const VIEW_MODES: ViewMode[] = ["large", "medium", "small", "list", "details"];

export const VIEW_MODE_LABEL: Record<ViewMode, string> = {
  large: "Large",
  medium: "Medium",
  small: "Small",
  list: "List",
  details: "Details",
};

export type WizardViewPage = "goal" | "method" | "phases" | "exercises";

const KEY_PREFIX = "wizardView.";

export function isViewMode(raw: unknown): raw is ViewMode {
  return typeof raw === "string" && (VIEW_MODES as string[]).includes(raw);
}

/** Persisted per page in localStorage (wizardView.goal, wizardView.method, …). */
export function readWizardViewMode(page: WizardViewPage, fallback: ViewMode = "medium"): ViewMode {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + page);
    return isViewMode(raw) ? raw : fallback;
  } catch {
    return fallback; // storage unavailable (private mode) — non-fatal
  }
}

export function writeWizardViewMode(page: WizardViewPage, mode: ViewMode): void {
  try {
    localStorage.setItem(KEY_PREFIX + page, mode);
  } catch {
    /* storage unavailable — non-fatal */
  }
}

/**
 * Container classes for the Steps 1/2 TILE grids. Mobile rules from the
 * brief: large = 1 column, medium = 1–2 columns (the current design),
 * list/details = full-width single-column rows.
 */
export function tileGridClass(mode: ViewMode): string {
  switch (mode) {
    case "large":
      return "grid grid-cols-1 sm:grid-cols-2 gap-3";
    case "medium":
      return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3";
    case "small":
      return "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5";
    case "list":
    case "details":
      return "grid grid-cols-1 gap-1.5";
  }
}

/** Steps 4/6 use row layouts — large gets a 2-col card grid, the rest
 *  stay single-column (dense modes shrink the rows, not the columns). */
export function rowGridClass(mode: ViewMode): string {
  return mode === "large" ? "grid grid-cols-1 lg:grid-cols-2 gap-3" : "grid grid-cols-1 gap-1.5";
}
