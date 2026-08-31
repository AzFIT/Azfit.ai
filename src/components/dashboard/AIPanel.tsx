/* ═══════════════════════════════════════════════════════════════
   AIPanel (Phase 60, Item 1+2+3) — reusable AI glass container.
   Violet (var(--ai-violet)) appears ONLY on AI surfaces. No hex.
   States: loading (CSS skeleton) · empty (honest message) · content.
   ═══════════════════════════════════════════════════════════════ */

import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";

export type ConfidenceLevel = "High" | "Medium" | "Low";

export default function AIPanel({
  subtitle,
  loading = false,
  empty = false,
  emptyMessage = "Nothing to show right now.",
  confidence,
  children,
}: {
  subtitle?: string;
  loading?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  /** completeness 0–100 → deterministic label; omit to hide the bar */
  confidence?: { percent: number; level: ConfidenceLevel };
  children?: ReactNode;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-[var(--radius-panel)] border p-5 backdrop-blur-xl"
      style={{
        borderColor: "color-mix(in srgb, var(--ai-violet) 35%, transparent)",
        /* Task 7: was --dark-elevated 55% — a dark-tinted panel even in the
           LIGHT theme, where the violet header text failed AA. card-bg is
           theme-aware (white light / #151D27 dark), so the glass follows. */
        background: "color-mix(in srgb, var(--card-bg) 55%, transparent)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      {/* gradient top edge — the AI signature, violet only */}
      <div
        className="absolute left-0 right-0 top-0 h-[3px]"
        style={{ background: "linear-gradient(90deg, var(--azfit-primary), var(--ai-violet))" }}
      />

      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4" style={{ color: "var(--ai-violet)" }} />
        {/* Task 7: --ai-violet text was 2.9:1 on the light glass panel —
            --ai-violet-strong passes AA in light, equals --ai-violet in dark */}
        <span className="text-sm font-bold tracking-wide" style={{ color: "var(--ai-violet-strong)" }}>
          Coach AI
        </span>
        {subtitle && (
          <span className="text-[11px]" style={{ color: "var(--light-text-muted)" }}>
            {subtitle}
          </span>
        )}
      </div>

      {/* Body */}
      {loading ? (
        <div className="space-y-2.5 py-1" aria-busy="true" aria-label="Loading daily brief">
          {[85, 70, 92, 60].map((w, i) => (
            <div
              key={i}
              className="ai-skeleton h-4 rounded-[var(--radius-control)]"
              style={{ width: `${w}%` }}
            />
          ))}
        </div>
      ) : empty ? (
        <div className="py-4 text-center">
          <Sparkles className="mx-auto mb-2 h-5 w-5" style={{ color: "var(--ai-violet)" }} />
          <p className="text-xs" style={{ color: "var(--light-text-muted)" }}>
            {emptyMessage}
          </p>
        </div>
      ) : (
        children
      )}

      {/* Confidence bar (deterministic, data-completeness based) */}
      {confidence && !loading && (
        <div
          className="mt-4 border-t pt-3"
          style={{ borderColor: "var(--card-border)" }}
          title="Based on how much recent client data is available."
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase tracking-wide" style={{ color: "var(--light-text-muted)" }}>
              Confidence: {confidence.level}
            </span>
            <span className="text-[10px] tabular-nums" style={{ color: "var(--light-text-muted)" }}>
              {confidence.percent}%
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: "var(--light-elevated)" }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${confidence.percent}%`,
                background: "linear-gradient(90deg, var(--azfit-primary), var(--ai-violet))",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
