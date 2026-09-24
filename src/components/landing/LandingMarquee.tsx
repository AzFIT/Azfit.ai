/**
 * LANDING-A1 — shared infinite-marquee engine for the landing page.
 * Consumed by TestimonialMarquee (cards, pause-on-hover) and
 * TrustedStrip (bare row, no pause). Hand-ported from the Aceternity UI
 * "Infinite Moving Cards" pattern, Vite-compatible: no @aceternity/registry,
 * no next/* imports; the keyframes live in tailwind.config.js (`marquee`).
 *
 * Mechanics: an overflow-hidden mask wraps a `w-max` flex track whose
 * content is duplicated 2× — one `translateX(-50%)` sweep is therefore a
 * seamless loop. Speed is a CSS custom property so call sites set duration
 * without extra keyframes. prefers-reduced-motion collapses to a static
 * wrapped layout with no animation at all.
 */
import { useReducedMotion } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";

interface LandingMarqueeProps {
  children: ReactNode;
  direction?: "left" | "right";
  /** Seconds per full loop. Default 60. */
  duration?: number;
  pauseOnHover?: boolean;
  className?: string;
}

export function LandingMarquee({
  children,
  direction = "left",
  duration = 60,
  pauseOnHover = false,
  className = "",
}: LandingMarqueeProps) {
  const reducedMotion = useReducedMotion();

  if (reducedMotion) {
    return (
      <div className={`flex flex-wrap items-center gap-6 ${className}`}>
        {children}
      </div>
    );
  }

  const trackClass = [
    "flex w-max items-center",
    "animate-marquee",
    direction === "right" ? "[animation-direction:reverse]" : "",
    pauseOnHover ? "hover:[animation-play-state:paused]" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const trackStyle = {
    "--marquee-duration": `${duration}s`,
  } as CSSProperties;

  /* Each half carries the same gap + trailing padding so the seam where
     half 1 meets half 2 is indistinguishable from any other boundary —
     that is what makes the -50% sweep seamless. */
  return (
    <div className={`overflow-hidden ${className}`}>
      <div className={trackClass} style={trackStyle}>
        <div className="mr-6 flex items-center gap-6">{children}</div>
        <div className="mr-6 flex items-center gap-6" aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  );
}
