/**
 * Client status metadata (Phase 27A) — single source of truth for the
 * 11-value clients.status set. Everywhere statuses render (client list,
 * edit modal, profile header badge, filter chips) uses this — no
 * scattered hardcoded labels.
 */

import type { Database } from "@/types/supabase";

export type ClientStatus = Database["public"]["Tables"]["clients"]["Row"]["status"];

export interface ClientStatusMeta {
  label: string;
  description: string;
  /** Badge text color */
  color: string;
  /** Badge background color */
  bg: string;
}

export const CLIENT_STATUS_VALUES = [
  "active",
  "inactive",
  "paused",
  "on_holiday",
  "on_break",
  "pending_start",
  "trial",
  "cancelled",
  "unavailable",
  "transferred",
  "archived",
] as const satisfies readonly ClientStatus[];

export const CLIENT_STATUSES: Record<ClientStatus, ClientStatusMeta> = {
  active: {
    label: "Active",
    description: "Currently training and engaged",
    color: "#22C55E",
    bg: "rgba(34,197,94,0.12)",
  },
  inactive: {
    label: "Inactive",
    description: "Not training, no sessions scheduled",
    color: "#94A3B8",
    bg: "rgba(148,163,184,0.12)",
  },
  paused: {
    label: "Paused",
    description: "Temporarily stopped, may resume later",
    color: "#F59E0B",
    bg: "rgba(245,158,11,0.12)",
  },
  on_holiday: {
    label: "On Holiday",
    description: "Away for vacation",
    color: "#06B6D4",
    bg: "rgba(6,182,212,0.12)",
  },
  on_break: {
    label: "On Break",
    description: "Short personal break",
    color: "var(--azfit-primary)",
    bg: "color-mix(in srgb, var(--azfit-primary) 12%, transparent)",
  },
  pending_start: {
    label: "Pending Start",
    description: "Signed up, not yet started",
    color: "#3B82F6",
    bg: "rgba(59,130,246,0.12)",
  },
  trial: {
    label: "Trial",
    description: "In trial period",
    color: "#8B5CF6",
    bg: "rgba(139,92,246,0.12)",
  },
  cancelled: {
    label: "Cancelled",
    description: "Membership/training cancelled",
    color: "#EF4444",
    bg: "rgba(239,68,68,0.12)",
  },
  unavailable: {
    label: "Unavailable",
    description: "Not reachable",
    color: "#F97316",
    bg: "rgba(249,115,22,0.12)",
  },
  transferred: {
    label: "Transferred",
    description: "Moved to another trainer/program",
    color: "#6366F1",
    bg: "rgba(99,102,241,0.12)",
  },
  archived: {
    label: "Archived",
    description: "Past client, record kept",
    color: "#64748B",
    bg: "rgba(100,116,139,0.15)",
  },
};

export function clientStatusMeta(status: string | null | undefined): ClientStatusMeta {
  return CLIENT_STATUSES[(status as ClientStatus) || "active"] ?? CLIENT_STATUSES.active;
}
