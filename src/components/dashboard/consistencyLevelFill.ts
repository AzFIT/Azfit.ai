/* Intensity fill per level — THEME TOKENS ONLY, surface → brand cyan
   via color-mix (no new hex literals). Level 0 is a neutral trace so
   the grid structure stays visible. Single shared source for the
   Phase 86 heatmap and the Phase 90c compact month calendar — both
   must intensity-map with the identical token map. Extracted to its
   own module (Phase 90c) because react-refresh forbids exporting
   non-component constants from component files. */

export const LEVEL_FILL: Record<number, string> = {
  0: "color-mix(in srgb, var(--page-text) 7%, transparent)",
  1: "color-mix(in srgb, var(--azfit-primary) 25%, transparent)",
  2: "color-mix(in srgb, var(--azfit-primary) 45%, transparent)",
  3: "color-mix(in srgb, var(--azfit-primary) 70%, transparent)",
  4: "var(--azfit-primary)",
};
