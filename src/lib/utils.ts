import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format seconds as MM:SS
 * Used by workout timer, rest timer, and session duration displays
 */
export function formatElapsed(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Format a date to locale string
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Null-safe formatDate (Phase 46): "" on empty/invalid input — matches the
 * local formatDate copies previously in ClientFormChecksTab, PhotoGallery,
 * CheckInsPage and FormChecks.
 */
export function formatDateShort(date: string | Date | null | undefined): string {
  if (!date) return "";
  const d = typeof date === 'string' ? new Date(date) : date;
  return Number.isNaN(d.getTime()) ? "" : formatDate(d);
}

/**
 * "Aug 5" without year (Phase 46) — Schedule's formatDisplayDate and the
 * Analytics chart labels (locale pinned to en-US, same output as before).
 */
export function formatDayMonth(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Local-time YYYY-MM-DD key (Phase 46 — TrainerDashboard's formatDateKey). */
export function formatDateKeyLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** UTC YYYY-MM-DD key (Phase 46 — toISOString date part, useHabits + Schedule). */
export function formatDateKeyUtc(d: Date): string {
  return d.toISOString().split("T")[0];
}

/** Locale-default date string with a fallback (Phase 46 — guidedFlows). */
export function formatDateLocale(dateStr: string | null | undefined, fallback = "—"): string {
  if (!dateStr) return fallback;
  return new Date(dateStr).toLocaleDateString();
}

/**
 * Format number with commas
 */
export function formatNumber(n: number, decimals = 0): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Calculate BMI from weight (kg) and height (cm)
 */
export function calculateBMI(weightKg: number, heightCm: number): number {
  if (!weightKg || !heightCm) return 0;
  const heightM = heightCm / 100;
  return +(weightKg / (heightM * heightM)).toFixed(1);
}

import { calculateBMR, calculateTDEE } from "./tdee";

export { calculateBMR, calculateTDEE };
