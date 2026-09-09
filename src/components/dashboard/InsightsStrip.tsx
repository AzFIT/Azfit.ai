/* ═══════════════════════════════════════════════════════════════
   InsightsStrip (Phase 83 Item 2) — Hume-style insight cards on the
   client dashboard. Template-based rule cards from src/lib/insights.ts
   (real numbers in every line; NO LLM, NO filler). Mounted below
   MetricTilesGrid, above My Plan for Today.
   ═══════════════════════════════════════════════════════════════ */

import { useNavigate } from "react-router";
import { TrendingUp, Flame, ListChecks, ClipboardCheck, Droplets, Sparkles } from "lucide-react";
import IconTile from "@/components/ui/IconTile";
import { GlassCard } from "./shared/GlassCard";
import { useInsights } from "@/hooks/useInsights";
import type { InsightCard } from "@/lib/insights";

const CARD_ICONS: Record<string, typeof TrendingUp> = {
  "momentum-up": TrendingUp,
  "momentum-down": TrendingUp,
  streak: Flame,
  plan: ListChecks,
  "checkin-due": ClipboardCheck,
  habits: Droplets,
  neutral: Sparkles,
};

function InsightCardView({ card }: { card: InsightCard }) {
  const navigate = useNavigate();
  const Icon = CARD_ICONS[card.key] ?? Sparkles;
  const inner = (
    <>
      <IconTile icon={Icon} size="sm" tone={card.tone} />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold leading-snug" style={{ color: "var(--page-text)" }}>
          {card.text}
        </p>
        <p className="text-[9px] leading-tight" style={{ color: "var(--light-text-muted)" }}>
          {card.numbers}
        </p>
      </div>
    </>
  );
  const cls =
    "flex min-h-[44px] w-full items-center gap-2.5 rounded-xl border border-[var(--card-border)] bg-[var(--page-bg)] p-3 text-left transition-all motion-reduce:transition-none";
  if (card.path) {
    return (
      <button
        type="button"
        onClick={() => navigate(card.path!)}
        aria-label={card.text}
        className={`${cls} hover:-translate-y-0.5 hover:border-[var(--azfit-primary)]/40 active:scale-[0.98]`}
      >
        {inner}
      </button>
    );
  }
  return (
    <div aria-label={card.text} className={cls}>
      {inner}
    </div>
  );
}

export default function InsightsStrip() {
  const { cards, loading, error } = useInsights();

  if (loading) {
    return (
      <GlassCard glass padding="p-4 sm:p-5" className="mb-6">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-[56px] animate-pulse rounded-xl border border-[var(--card-border)] bg-[var(--page-bg)]" />
          ))}
        </div>
      </GlassCard>
    );
  }

  if (error || !cards) return null; // honest: render nothing rather than filler

  return (
    <GlassCard glass padding="p-4 sm:p-5" className="mb-6">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {cards.map((c) => (
          <InsightCardView key={c.key} card={c} />
        ))}
      </div>
    </GlassCard>
  );
}
