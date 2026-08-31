/* ═══════════════════════════════════════════════════════════════
   Session edit mapping (Task 2) — the Book Session wizard doubles as
   the EDIT surface for an existing session. These pure helpers map
   CalendarEvent edits → session-row updates and translate between the
   wizard's session-type vocabulary and the CalendarEvent one.
   ═══════════════════════════════════════════════════════════════ */

import type { CalendarEvent } from "@/types";

/** Camel-case session update payload (matches useSessions' Session fields). */
export interface SessionUpdatePayload {
  title?: string;
  type?: string;
  status?: "requested" | "scheduled" | "completed" | "cancelled";
  startsAt?: string;
  endsAt?: string;
  notes?: string;
  location?: string | null;
}

/** Map CalendarEvent edit fields → a session update payload.
 *  date+startTime / date+endTime pairs become ISO instants (local → UTC). */
export function buildSessionUpdate(updates: Partial<CalendarEvent>): SessionUpdatePayload {
  const out: SessionUpdatePayload = {};
  if (updates.title !== undefined) out.title = updates.title;
  if (updates.type !== undefined) out.type = updates.type;
  if (updates.status !== undefined) {
    out.status = updates.status as SessionUpdatePayload["status"];
  }
  if (updates.date && updates.startTime) {
    out.startsAt = new Date(`${updates.date}T${updates.startTime}`).toISOString();
  }
  if (updates.date && updates.endTime) {
    out.endsAt = new Date(`${updates.date}T${updates.endTime}`).toISOString();
  }
  if (updates.description !== undefined) out.notes = updates.description;
  if (updates.location !== undefined) out.location = updates.location ?? null;
  return out;
}

/** Wizard session-type value → CalendarEvent type.
 *  (The wizard labels are PT Session / Assessment / Consultation / Check-in.) */
export function wizardTypeToEventType(wizardType: string): CalendarEvent["type"] {
  switch (wizardType) {
    case "reminder":
      return "assessment";
    case "blocked":
      return "blocked";
    case "returning":
      return "check-in";
    default:
      return "session";
  }
}

/** CalendarEvent type → wizard session-type value (edit prefill). */
export function eventTypeToWizardType(type: string): string {
  switch (type) {
    case "assessment":
    case "reminder":
      return "reminder";
    case "blocked":
      return "blocked";
    case "check-in":
      return "returning";
    default:
      return "session";
  }
}
