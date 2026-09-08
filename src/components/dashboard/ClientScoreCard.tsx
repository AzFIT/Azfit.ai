// ═══════════════════════════════════════════════════════════════
// ClientScoreCard (Phase 78 Item 2) — Hume-style score hero on the
// client dashboard. Semi-circular SVG gauge (reuses arcSlider.ts
// path math), brand gradient fill on the ring-track token, big
// numeral + label chip, and the four contributors with raw % and
// weight. Excluded components are greyed with "Not enough data yet"
// — never silently 0 or 100. The formula is documented at the top
// of src/lib/clientScore.ts.
// ═══════════════════════════════════════════════════════════════

import { motion } from "framer-motion";
import { Gauge } from "lucide-react";
import { GlassCard } from "./shared/GlassCard";
import { useClientScore } from "@/hooks/useClientScore";
import { arcGeometry, arcEndpoints, arcPath, angleForValue } from "@/lib/arcSlider";

function ScoreGauge({ score }: { score: number }) {
  const size = 200;
  const stroke = 14;
  const g = arcGeometry(size, stroke, 180);
  const { start, end } = arcEndpoints(g);
  const scoreAngle = angleForValue(score, 0, 100, 180);
  return (
    <svg
      viewBox={`0 0 ${size} ${size / 2 + stroke}`}
      className="mx-auto w-full max-w-[220px]"
      role="img"
      aria-label={`Score ${score} out of 100`}
    >
      <defs>
        <linearGradient id="score-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--azfit-primary)" />
          <stop offset="100%" stopColor="var(--azfit-accent)" />
        </linearGradient>
      </defs>
      {/* track */}
      <path
        d={arcPath(g, 180)}
        fill="none"
        stroke="var(--ring-track)"
        strokeWidth={stroke}
        strokeLinecap="round"
        opacity={0.35}
      />
      {/* fill (static under reduced motion — the value text carries the info) */}
      <motion.path
        d={arcPath(g, scoreAngle)}
        fill="none"
        stroke="url(#score-grad)"
        strokeWidth={stroke}
        strokeLinecap="round"
        initial={false}
      />
      {/* endpoints keep the round caps aligned (arcPath spans start→angle) */}
      <circle cx={start.x} cy={start.y} r={0.1} fill="none" />
      <circle cx={end.x} cy={end.y} r={0.1} fill="none" />
    </svg>
  );
}

export default function ClientScoreCard() {
  const { result, loading, error } = useClientScore();

  return (
    <GlassCard glass padding="p-4 sm:p-5" className="mb-6">
      <div className="mb-3 flex items-center gap-2">
        <Gauge className="h-4 w-4" style={{ color: "var(--azfit-primary)" }} />
        <h3 className="text-sm font-semibold" style={{ color: "var(--page-text)" }}>
          Your AzFIT Score
        </h3>
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="mx-auto h-[110px] w-[220px] animate-pulse rounded-t-full" style={{ backgroundColor: "var(--light-elevated)" }} />
          <div className="h-3 animate-pulse rounded" style={{ backgroundColor: "var(--light-elevated)" }} />
          <div className="h-3 animate-pulse rounded" style={{ backgroundColor: "var(--light-elevated)" }} />
        </div>
      ) : error ? (
        <p className="py-6 text-center text-xs" style={{ color: "var(--light-text-muted)" }}>
          Score unavailable right now — check back in a bit.
        </p>
      ) : result?.score === null || !result ? (
        <p className="py-6 text-center text-xs" style={{ color: "var(--light-text-muted)" }}>
          Your score appears once you start logging — complete a session, tick a plan, or log a habit.
        </p>
      ) : (
        <>
          <div className="relative">
            <ScoreGauge score={result.score} />
            <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
              <span className="stat-numeral text-4xl" style={{ color: "var(--page-text)" }}>
                {result.score}
              </span>
              <span
                className="mt-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--azfit-primary) 15%, transparent)",
                  color: "var(--azfit-primary)",
                }}
              >
                {result.label}
              </span>
            </div>
          </div>

          {/* Contributors: raw % + weight per component */}
          <div className="mt-5 space-y-2.5">
            {result.components.map((c) => {
              const excluded = c.pct === null;
              return (
                <div key={c.key} className={excluded ? "opacity-50" : undefined}>
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="text-xs font-medium" style={{ color: "var(--page-text)" }}>
                      {c.label}
                      <span className="ml-1 text-[10px]" style={{ color: "var(--light-text-muted)" }}>
                        · {Math.round(c.weight * 100)}%
                      </span>
                    </span>
                    <span className="text-[10px] font-semibold" style={{ color: excluded ? "var(--light-text-muted)" : "var(--azfit-primary)" }}>
                      {excluded ? "Not enough data yet" : `${Math.round(c.pct as number)}%`}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: "var(--ring-track)", opacity: 0.4 }}>
                    {!excluded && (
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: "linear-gradient(90deg, var(--azfit-primary), var(--azfit-accent))" }}
                        initial={{ width: 0 }}
                        animate={{ width: `${c.pct}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    )}
                  </div>
                  <p className="mt-0.5 text-[10px]" style={{ color: "var(--light-text-muted)" }}>
                    {c.detail}
                  </p>
                </div>
              );
            })}
          </div>

          <p className="mt-4 text-center text-[10px]" style={{ color: "var(--light-text-muted)" }}>
            Based on your last 4 weeks (plans & habits: last 7 days)
          </p>
        </>
      )}
    </GlassCard>
  );
}
