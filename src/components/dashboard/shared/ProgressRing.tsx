import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";

// Module-level counter for stable gradient IDs across renders
let idCounter = 0;

export interface ProgressRingProps {
  /** Outer diameter of the SVG in pixels */
  size?: number;
  /** Stroke width of the ring in pixels */
  strokeWidth?: number;
  /** Progress percentage (0–100) */
  percentage: number;
  /** Primary color for the progress arc (hex, rgb, hsl) */
  color: string;
  /** Label shown below the center value (e.g. "Steps") */
  label: string;
  /** Center value text (e.g. "9,245") */
  value: string;
  /** Optional secondary color for gradient end */
  gradientEndColor?: string;
  /** Whether to animate the ring on mount / value change */
  animate?: boolean;
  /** Animation duration in ms */
  animationDuration?: number;
  /** Optional CSS class for the glow filter */
  glowClass?: string;
  /** Optional subtitle shown below the label (e.g. "Goal: 10,000") */
  subtitle?: string;
  /** Optional icon rendered in the center above the value */
  icon?: React.ReactNode;
  /** Whether to show a pulsing dot indicator */
  showPulse?: boolean;
  /** Optional additional className for the wrapper */
  className?: string;
}

/**
 * ProgressRing
 * ───────────────────────────────────────────
 * A reusable SVG circular progress ring with:
 *   • Animated stroke-dashoffset transitions
 *   • Optional gradient stroke (linear gradient along the arc)
 *   • Neon glow via CSS drop-shadow filters
 *   • Framer Motion for center-text entry animations
 *   • Fully responsive and accessible
 *
 * Used across both Trainer and Client dashboards for:
 *   Revenue, Compliance, Steps, Macros, Recovery, Hydration.
 */
export function ProgressRing({
  size = 140,
  strokeWidth = 10,
  percentage,
  color,
  label,
  value,
  gradientEndColor,
  animate = true,
  animationDuration = 1200,
  glowClass = "glow-teal",
  subtitle,
  icon,
  showPulse = false,
  className = "",
}: ProgressRingProps) {
  const [animatedPercentage, setAnimatedPercentage] = useState(0);
  const hasAnimated = useRef(false);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    circumference - (animatedPercentage / 100) * circumference;

  const gradientIdRef = useRef<string>("");
  if (!gradientIdRef.current) {
    // Use a counter-based ID to avoid impure functions in render
    gradientIdRef.current = `ring-gradient-${++idCounter}`;
  }
  const gradientId = gradientIdRef.current;
  const useGradient = !!gradientEndColor;

  useEffect(() => {
    if (animate) {
      // Start from 0 on first mount, then animate to target
      if (!hasAnimated.current) {
        setAnimatedPercentage(0);
        requestAnimationFrame(() => {
          setTimeout(() => setAnimatedPercentage(percentage), 50);
        });
        hasAnimated.current = true;
      } else {
        setAnimatedPercentage(percentage);
      }
    } else {
      setAnimatedPercentage(percentage);
    }
  }, [percentage, animate]);

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div className="relative">
        {/* Optional pulse indicator dot */}
        {showPulse && (
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ backgroundColor: color }}
            />
            <span
              className="relative inline-flex rounded-full h-3 w-3"
              style={{ backgroundColor: color }}
            />
          </span>
        )}

        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
          role="img"
          aria-label={`${label}: ${value} (${percentage}%)`}
        >
          <defs>
            {useGradient && (
              <linearGradient
                id={gradientId}
                x1="0%"
                y1="0%"
                x2="100%"
                y2="0%"
              >
                <stop offset="0%" stopColor={color} />
                <stop offset="100%" stopColor={gradientEndColor} />
              </linearGradient>
            )}
          </defs>

          {/* Track ring (background) */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="opacity-20"
            style={{ color: "var(--light-border)" }}
          />

          {/* Progress ring (fill) */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={useGradient ? `url(#${gradientId})` : color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={glowClass}
            style={{
              transition: `stroke-dashoffset ${animationDuration}ms cubic-bezier(0.4, 0, 0.2, 1)`,
            }}
          />
        </svg>

        {/* Center content */}
        <motion.div
          className="absolute inset-0 flex flex-col items-center justify-center"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5, ease: "easeOut" }}
        >
          {icon && (
            <div className="mb-1" style={{ color }}>
              {icon}
            </div>
          )}
          <span
            className="font-mono text-xl font-semibold leading-tight lg:text-2xl"
            style={{ color }}
          >
            {value}
          </span>
          <span
            className="mt-0.5 text-[11px] font-medium leading-tight tracking-wide uppercase lg:text-xs"
            style={{ color: "var(--light-text-muted)" }}
          >
            {label}
          </span>
          {subtitle && (
            <span
              className="mt-0.5 text-[10px] leading-tight"
              style={{ color: "var(--light-text-muted)" }}
            >
              {subtitle}
            </span>
          )}
        </motion.div>
      </div>
    </div>
  );
}

export default ProgressRing;
