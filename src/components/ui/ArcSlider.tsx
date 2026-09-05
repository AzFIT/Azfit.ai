// ═══════════════════════════════════════════════════════════════
// ArcSlider (Phase 69) — semi-circular dial input. Drag along the
// arc (Pointer Events: touch + mouse), tap-to-set, full keyboard
// support (arrows ±step, Home/End min/max), role="slider" + aria-*.
// Pure SVG + theme tokens only (brand gradient fill). Controlled:
// the parent owns state; onChange fires live while dragging. The
// center readout doubles as the exact-value fallback (tap → type).
// value: null = unset (center shows '—'; first interaction sets).
// ═══════════════════════════════════════════════════════════════

import { useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  arcGeometry,
  arcPath,
  pointForAngle,
  angleForValue,
  angleFromPoint,
  valueForAngle,
  clampValue,
  snapToStep,
  formatArcValue,
} from "@/lib/arcSlider";

export interface ArcSliderProps {
  value: number | null;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
  size?: number;
  arcSpan?: 180 | 240 | 270;
  disabled?: boolean;
  "aria-label": string;
}

export default function ArcSlider({
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
  size = 200,
  arcSpan = 240,
  disabled = false,
  "aria-label": ariaLabel,
}: ArcSliderProps) {
  const gradientId = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");

  const stroke = Math.max(10, Math.round(size * 0.07));
  const g = arcGeometry(size, stroke, arcSpan);
  const set = value != null;
  const angle = set ? angleForValue(value, min, max, arcSpan) : -arcSpan / 2;
  const handle = pointForAngle(g, angle);

  const commitFromPoint = (clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    onChange(valueForAngle(angleFromPoint(px, py, g), min, max, arcSpan, step));
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (disabled) return;
    // commit FIRST (tap-to-set must work even when capture fails), then
    // capture — guarded: synthetic/keyboard-originated pointer ids throw
    // NotFoundError and must never kill the commit (caught by the 69 probe).
    commitFromPoint(e.clientX, e.clientY);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic pointer — no capture needed */
    }
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging || disabled) return;
    commitFromPoint(e.clientX, e.clientY);
  };
  const endDrag = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging) return;
    setDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    const cur = value ?? min;
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = snapToStep(cur + step, min, max, step);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = snapToStep(cur - step, min, max, step);
    else if (e.key === "Home") next = min;
    else if (e.key === "End") next = max;
    if (next != null) {
      e.preventDefault();
      onChange(clampValue(next, min, max));
    }
  };

  const commitEdit = () => {
    const n = parseFloat(editText);
    if (Number.isFinite(n)) onChange(clampValue(snapToStep(n, min, max, step), min, max));
    setEditing(false);
  };

  return (
    <div className={cn("relative select-none", disabled && "opacity-50")} style={{ width: size, height: size }}>
      <svg
        ref={svgRef}
        width={size}
        height={size}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={ariaLabel}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={set ? value : undefined}
        aria-valuetext={set ? `${formatArcValue(value, step)}${unit ?? ""}` : "Not set"}
        aria-disabled={disabled}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        className="block outline-none focus-visible:ring-2 focus-visible:ring-[#00AEEF] rounded-full"
        style={{ touchAction: "none", cursor: disabled ? "default" : "pointer" }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--azfit-primary)" />
            <stop offset="100%" stopColor="var(--azfit-accent)" />
          </linearGradient>
        </defs>
        {/* track */}
        <path d={arcPath(g, arcSpan / 2)} fill="none" stroke="var(--card-border)" strokeWidth={stroke} strokeLinecap="round" />
        {/* fill (progress) */}
        {set && (
          <path
            d={arcPath(g, angle)}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            className="transition-[stroke-dashoffset] motion-reduce:transition-none"
          />
        )}
        {/* drag handle (transparent 44px+ hit area over the visual knob) */}
        {set && (
          <>
            <circle cx={handle.x} cy={handle.y} r={22} fill="transparent" className="motion-reduce:transition-none" />
            <circle
              cx={handle.x}
              cy={handle.y}
              r={Math.max(8, stroke * 0.8)}
              fill="var(--card-bg)"
              stroke="var(--azfit-primary)"
              strokeWidth={3}
              className={cn(!dragging && "transition-transform motion-reduce:transition-none")}
            />
          </>
        )}
      </svg>
      {/* center readout — tap to type an exact value (the no-drag fallback) */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        {editing ? (
          <input
            autoFocus
            type="number"
            inputMode="decimal"
            min={min}
            max={max}
            step={step}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitEdit();
              if (e.key === "Escape") setEditing(false);
            }}
            aria-label={`${ariaLabel} — type exact value`}
            className="pointer-events-auto w-20 rounded-lg border border-[var(--card-border)] bg-[var(--page-bg)] px-2 py-1 text-center text-lg font-bold text-[var(--page-text)] outline-none focus:border-[#00AEEF]"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              if (disabled) return;
              setEditText(set ? String(value) : "");
              setEditing(true);
            }}
            disabled={disabled}
            aria-label={`${ariaLabel} — tap to type exact value`}
            className="pointer-events-auto flex flex-col items-center rounded-lg px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-[#00AEEF]"
          >
            <span className="text-2xl font-bold leading-none text-[var(--page-text)]" style={{ fontVariantNumeric: "tabular-nums" }}>
              {set ? formatArcValue(value, step) : "—"}
            </span>
            {unit && (
              <span className="mt-1 text-[10px] font-medium text-[var(--light-text-muted)]">{unit}</span>
            )}
            {!set && (
              <span className="mt-1 text-[9px] text-[var(--light-text-muted)]">drag or tap to set</span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
