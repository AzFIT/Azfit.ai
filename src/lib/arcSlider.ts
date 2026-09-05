/* ═══════════════════════════════════════════════════════════════
   Phase 69 — ArcSlider pure math. Angle convention: degrees
   CLOCKWISE from 12 o'clock (screen coords, y down): 0 = top,
   90 = right, 180 = bottom, -90/270 = left. The arc is symmetric
   about the top: min sits at -span/2, max at +span/2, with the
   (360-span) gap at the bottom. No DOM in here — unit-tested.
   ═══════════════════════════════════════════════════════════════ */

export interface ArcGeometry {
  cx: number;
  cy: number;
  r: number;
  span: number;
}

export function arcGeometry(size: number, strokeWidth: number, span: 180 | 240 | 270): ArcGeometry {
  return { cx: size / 2, cy: size / 2, r: (size - strokeWidth) / 2 - 2, span };
}

/** Point on the arc for an angle (deg, clockwise from top). */
export function pointForAngle(g: ArcGeometry, angleDeg: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: g.cx + g.r * Math.sin(rad), y: g.cy - g.r * Math.cos(rad) };
}

export function clampValue(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Nearest step from min; result clamped into [min, max]. */
export function snapToStep(value: number, min: number, max: number, step: number): number {
  if (step <= 0) return clampValue(value, min, max);
  const snapped = min + Math.round((value - min) / step) * step;
  // float safety: 0.1-step snapping accumulates FP noise
  const fixed = Number(snapped.toFixed(6));
  return clampValue(fixed, min, max);
}

/** value → arc angle (deg). min → -span/2 (left end), max → +span/2. */
export function angleForValue(value: number, min: number, max: number, span: number): number {
  const frac = max === min ? 0 : (clampValue(value, min, max) - min) / (max - min);
  return -span / 2 + frac * span;
}

/** Pointer position → arc angle (deg, clockwise from top, normalized to
 *  (-180, 180]). Bottom-gap angles get clamped to the nearest arc end in
 *  valueForAngle. */
export function angleFromPoint(px: number, py: number, g: ArcGeometry): number {
  const rad = Math.atan2(px - g.cx, -(py - g.cy));
  let deg = (rad * 180) / Math.PI;
  if (deg > 180) deg -= 360;
  return deg;
}

/** Pointer angle → snapped value. Angles in the bottom gap clamp to the
 *  nearest end (min/max), never wrap mid-arc. */
export function valueForAngle(angleDeg: number, min: number, max: number, span: number, step: number): number {
  const half = span / 2;
  const clamped = clampValue(angleDeg, -half, half);
  const frac = (clamped + half) / span;
  return snapToStep(min + frac * (max - min), min, max, step);
}

/** Center readout: step-appropriate decimals (0.5 steps → 1 decimal). */
export function formatArcValue(value: number, step: number): string {
  const decimals = step < 1 ? 1 : 0;
  return value.toFixed(decimals);
}

/** SVG arc endpoints for the track/fill paths (start at the min angle,
 *  sweep span degrees clockwise over the top). */
export function arcEndpoints(g: ArcGeometry): { start: { x: number; y: number }; end: { x: number; y: number } } {
  return { start: pointForAngle(g, -g.span / 2), end: pointForAngle(g, g.span / 2) };
}

/** SVG path for an arc sweep from -span/2 to the given angle. */
export function arcPath(g: ArcGeometry, toAngleDeg: number): string {
  const start = pointForAngle(g, -g.span / 2);
  const end = pointForAngle(g, clampValue(toAngleDeg, -g.span / 2, g.span / 2));
  const largeArc = toAngleDeg - -g.span / 2 > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${g.r} ${g.r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}
