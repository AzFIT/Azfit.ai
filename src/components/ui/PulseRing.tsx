/* ═══════════════════════════════════════════════════════════════
   PulseRing (Phase 58) — the signature ring. Pure SVG, brand
   cyan→purple gradient by default, theme-token track, rounded
   linecaps. Math lives in src/lib/pulseRing.ts (unit-tested).
   ═══════════════════════════════════════════════════════════════ */

import { useRef } from "react";
import { clampPercent, ringGeometry, ringDashOffset } from "@/lib/pulseRing";

let idCounter = 0;

export interface PulseRingProps {
  /** 0–100 (clamped, NaN-safe) */
  percent: number;
  size?: number;
  strokeWidth?: number;
  /** Big center text (e.g. "82%") */
  centerLabel?: string;
  /** Small muted line under the center label */
  subLabel?: string;
  /** Gradient stops — defaults to the brand cyan→purple */
  gradient?: [string, string];
  /** Accessible label override */
  ariaLabel?: string;
  className?: string;
}

export default function PulseRing({
  percent,
  size = 140,
  strokeWidth = 10,
  centerLabel,
  subLabel,
  gradient = ["var(--azfit-primary)", "var(--azfit-accent)"],
  ariaLabel,
  className = "",
}: PulseRingProps) {
  const pct = clampPercent(percent);
  const { radius, circumference } = ringGeometry(size, strokeWidth);
  const offset = ringDashOffset(pct, circumference);

  const gradientIdRef = useRef<string>("");
  if (!gradientIdRef.current) gradientIdRef.current = `pulse-ring-gradient-${++idCounter}`;
  const gradientId = gradientIdRef.current;

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        role="img"
        aria-label={ariaLabel ?? `${subLabel ?? "progress"}: ${centerLabel ?? `${pct}%`} (${pct}%)`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={gradient[0]} />
            <stop offset="100%" stopColor={gradient[1]} />
          </linearGradient>
        </defs>
        {/* track — Task 7: solid --ring-track (the old opacity-20 on
            --light-border rendered the 0% ring invisible in light theme) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          style={{ stroke: "var(--ring-track)" }}
        />
        {/* progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      {(centerLabel || subLabel) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {centerLabel && (
            <span className="stat-numeral text-xl leading-tight lg:text-2xl" style={{ color: "var(--page-text)" }}>
              {centerLabel}
            </span>
          )}
          {subLabel && (
            <span
              className="mt-0.5 text-[11px] font-medium uppercase leading-tight tracking-wide"
              style={{ color: "var(--light-text-muted)" }}
            >
              {subLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
