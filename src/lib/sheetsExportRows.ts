// ═══════════════════════════════════════════════════════════════
// sheetsExportRows (Phase 98a) — PURE worksheet mapping for the
// Google Sheets export. Shared by the sheets-export edge function
// (bundled via relative import) and its unit tests.
//
// HONEST DATA: every cell is the real DB value or an EMPTY STRING.
// Missing values are never fabricated (no "—", no "N/A" inventions,
// no guessed defaults). Money leaves integer cents as DECIMAL STRINGS
// ("45.50") at the sheet boundary. Dates are LOCAL (Phase 90g
// convention — formatDateKeyLocal), never iso.split("T")[0].
// ═══════════════════════════════════════════════════════════════

import { formatDateKeyLocal } from "./utils";

/** Trainer's clients row — only the fields the sheet needs. */
export interface ExportClientRow {
  full_name: string;
  email: string | null;
  status: string | null;
  fitness_goal: string | null;
  created_at: string;
}

/** Sessions row — client identity via client_record_id (roster) or
 *  client_id (account-only session, Phase 35). The resolver decides
 *  the human name; the mapper stays pure. */
export interface ExportSessionRow {
  starts_at: string;
  type: string | null;
  status: string | null;
  client_record_id: string | null;
  client_id: string | null;
}

export interface ExportPaymentRow {
  paid_at: string;
  kind: string | null;
  amount_cents: number;
  client_record_id: string;
}

export interface ExportPackageRow {
  name: string;
  total_sessions: number;
  sessions_used: number;
  expires_at: string | null;
  client_record_id: string;
}

export const CLIENTS_HEADER = ["Name", "Email", "Status", "Goal", "Created"] as const;
export const SESSIONS_HEADER = ["Date", "Client", "Type", "Status"] as const;
export const PAYMENTS_HEADER = ["Date", "Client", "Kind", "Amount"] as const;
export const PACKAGES_HEADER = ["Client", "Name", "Used/Total", "Expires"] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Integer cents → decimal string with exactly two places ("4550" →
 *  "45.50"). The sheet stores money as TEXT on purpose — Sheets
 *  locales mangle float cells; a decimal string survives intact. */
export function centsToDecimal(cents: number): string {
  const safe = Number.isSafeInteger(cents) ? cents : 0;
  const neg = safe < 0 ? "-" : "";
  const abs = Math.abs(safe);
  return `${neg}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** Sessions whose LOCAL start date falls within the last 90 days
 *  (inclusive of today), sorted oldest → newest. `now` is injectable
 *  (Fix Pack 2 lesson: never read the wall clock inside pure logic). */
export function filterSessionsLast90<T extends { starts_at: string }>(
  rows: T[],
  now: Date,
): T[] {
  const start = new Date(now.getTime() - 90 * DAY_MS);
  return rows
    .filter((r) => {
      const d = new Date(r.starts_at);
      return !Number.isNaN(d.getTime()) && d >= start && d <= now;
    })
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
}

export function buildClientsSheet(rows: ExportClientRow[]): string[][] {
  return [
    [...CLIENTS_HEADER],
    ...rows.map((r) => [
      r.full_name,
      r.email ?? "",
      r.status ?? "",
      r.fitness_goal ?? "",
      formatDateKeyLocal(new Date(r.created_at)),
    ]),
  ];
}

/** resolveName receives the full session row — the caller owns the
 *  roster-map / account-fallback policy. */
export function buildSessionsSheet(
  rows: ExportSessionRow[],
  resolveName: (row: ExportSessionRow) => string,
  now: Date,
): string[][] {
  const window = filterSessionsLast90(rows, now);
  return [
    [...SESSIONS_HEADER],
    ...window.map((r) => [
      formatDateKeyLocal(new Date(r.starts_at)),
      resolveName(r),
      r.type ?? "",
      r.status ?? "",
    ]),
  ];
}

export function buildPaymentsSheet(
  rows: ExportPaymentRow[],
  resolveName: (row: ExportPaymentRow) => string,
): string[][] {
  const sorted = [...rows].sort((a, b) => new Date(a.paid_at).getTime() - new Date(b.paid_at).getTime());
  return [
    [...PAYMENTS_HEADER],
    ...sorted.map((r) => [
      formatDateKeyLocal(new Date(r.paid_at)),
      resolveName(r),
      r.kind ?? "",
      centsToDecimal(r.amount_cents),
    ]),
  ];
}

export function buildPackagesSheet(
  rows: ExportPackageRow[],
  resolveName: (row: ExportPackageRow) => string,
): string[][] {
  return [
    [...PACKAGES_HEADER],
    ...rows.map((r) => [
      resolveName(r),
      r.name,
      `${r.sessions_used}/${r.total_sessions}`,
      r.expires_at ? formatDateKeyLocal(new Date(r.expires_at)) : "",
    ]),
  ];
}

/** Data-row count for the response's row_counts (header excluded —
 *  an empty sheet honestly reports 0, never a fabricated number). */
export function dataRowCount(sheet: string[][]): number {
  return Math.max(0, sheet.length - 1);
}

export interface SheetsConfigDoc {
  spreadsheet_id?: string | null;
  url?: string | null;
  created_at?: string | null;
  last_export_at?: string | null;
  row_counts?: Record<string, number> | null;
  [key: string]: unknown;
}

/** Merge a fresh export result into the stored config doc. Pure —
 *  unknown existing keys are preserved; fresh values win. */
export function mergeSheetsConfig(
  prev: SheetsConfigDoc | null,
  fresh: {
    spreadsheet_id: string;
    url: string;
    last_export_at: string;
    row_counts: Record<string, number>;
  },
): SheetsConfigDoc {
  return {
    ...(prev ?? {}),
    spreadsheet_id: fresh.spreadsheet_id,
    url: fresh.url,
    created_at: prev?.created_at ?? fresh.last_export_at,
    last_export_at: fresh.last_export_at,
    row_counts: fresh.row_counts,
  };
}
