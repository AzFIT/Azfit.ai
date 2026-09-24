/**
 * LANDING-A2 — before/after compare engine for the landing page.
 * Hand-ported from the Aceternity UI "Compare" pattern, Vite-compatible:
 * no @aceternity/registry, no next/* imports.
 *
 * Mechanics: the "after" image is the base layer; the "before" image sits
 * on top clipped by `clip-path: inset(0 <right>% 0 0)`, so the seam is a
 * single vertical line at `position`. Dragging (pointer, touch via
 * pointer events) and keyboard (role="slider", Arrow/Home/End) move the
 * seam. All color is landing tokens — no new hex.
 *
 * Accessibility: the grip is a real button with role="slider",
 * aria-valuemin/max/now, and an aria-label; prefers-reduced-motion swaps
 * the interactive slider for a static side-by-side pair (no seam, no
 * required dragging).
 */
import { useCallback, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { ChevronsLeftRight } from "lucide-react";

interface CompareSliderProps {
  beforeSrc: string;
  afterSrc: string;
  beforeAlt: string;
  afterAlt: string;
  beforeLabel?: string;
  afterLabel?: string;
  /** Initial seam position, 0–100. Default 50. */
  initialPosition?: number;
}

const clamp = (v: number) => Math.min(100, Math.max(0, v));

const badge =
  "text-chrome font-display rounded-lg border px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] lg:text-xs";
const badgeBorder = { borderColor: "var(--landing-panel-border)" };

export function CompareSlider({
  beforeSrc,
  afterSrc,
  beforeAlt,
  afterAlt,
  beforeLabel = "WEEK 1",
  afterLabel = "WEEK 12",
  initialPosition = 50,
}: CompareSliderProps) {
  const reducedMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(clamp(initialPosition));
  const draggingRef = useRef(false);

  const posFromClientX = useCallback((clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos(clamp(((clientX - rect.left) / rect.width) * 100));
  }, []);

  /* Static side-by-side fallback — no seam, no forced dragging. */
  if (reducedMotion) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {[beforeSrc, afterSrc].map((src, i) => (
          <figure key={src} className="landing-surface overflow-hidden rounded-2xl">
            <img
              src={src}
              alt={i === 0 ? beforeAlt : afterAlt}
              className="aspect-[3/4] w-full object-cover sm:aspect-[4/5]"
              draggable={false}
            />
            <figcaption className={`${badge} m-3 inline-block`} style={badgeBorder}>
              {i === 0 ? beforeLabel : afterLabel}
            </figcaption>
          </figure>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="landing-surface relative aspect-[3/4] w-full touch-none select-none overflow-hidden rounded-2xl sm:aspect-[4/3] lg:aspect-[16/9]"
      onPointerDown={(e) => {
        posFromClientX(e.clientX);
        draggingRef.current = true;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* synthetic/legacy pointers may not be capturable — dragging
             still works because we track draggingRef on this element */
        }
      }}
      onPointerMove={(e) => {
        if (draggingRef.current) posFromClientX(e.clientX);
      }}
      onPointerUp={(e) => {
        draggingRef.current = false;
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          /* see onPointerDown */
        }
      }}
      onPointerCancel={() => {
        draggingRef.current = false;
      }}
    >
      {/* After = base layer */}
      <img
        src={afterSrc}
        alt={afterAlt}
        className="absolute inset-0 h-full w-full object-cover"
        draggable={false}
      />
      {/* Before = clipped top layer; seam at `pos` */}
      <img
        src={beforeSrc}
        alt={beforeAlt}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        draggable={false}
      />

      {/* Corner badges */}
      <span className={`${badge} absolute left-3 top-3`} style={badgeBorder}>
        {beforeLabel}
      </span>
      <span className={`${badge} absolute right-3 top-3`} style={badgeBorder}>
        {afterLabel}
      </span>

      {/* Seam + grip */}
      <div
        aria-hidden="true"
        className="absolute inset-y-0"
        style={{
          left: `${pos}%`,
          width: 2,
          marginLeft: -1,
          backgroundColor: "var(--landing-cyan)",
          boxShadow: "0 0 12px var(--landing-cyan)",
        }}
      />
      <button
        type="button"
        role="slider"
        aria-label="Reveal before and after"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pos)}
        className="absolute top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
        style={{
          left: `${pos}%`,
          backgroundColor: "var(--landing-navy-from)",
          border: "2px solid var(--landing-cyan)",
          boxShadow: "0 0 16px var(--landing-cyan)",
          touchAction: "none",
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            setPos((p) => clamp(p - 2));
          } else if (e.key === "ArrowRight") {
            e.preventDefault();
            setPos((p) => clamp(p + 2));
          } else if (e.key === "Home") {
            e.preventDefault();
            setPos(0);
          } else if (e.key === "End") {
            e.preventDefault();
            setPos(100);
          }
        }}
      >
        <ChevronsLeftRight className="h-5 w-5" style={{ color: "var(--landing-cyan)" }} aria-hidden="true" />
      </button>
    </div>
  );
}

export default CompareSlider;
