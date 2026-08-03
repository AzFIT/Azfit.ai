/**
 * Pure client-side session overlap detection.
 */

import type { Session } from "@/hooks/useSessions";

export interface ConflictCandidate {
  trainerId: string;
  clientId: string;
  startsAt: string;
  endsAt: string;
  excludeId?: string;
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return new Date(aStart) < new Date(bEnd) && new Date(aEnd) > new Date(bStart);
}

export function findSessionConflicts(
  sessions: Session[],
  candidate: ConflictCandidate
): Session[] {
  const { trainerId, clientId, startsAt, endsAt, excludeId } = candidate;
  return sessions.filter((s) => {
    if (s.id === excludeId) return false;
    if (s.status === "cancelled") return false;
    if (s.trainerId !== trainerId && s.clientId !== clientId) return false;
    return overlaps(s.startsAt, s.endsAt, startsAt, endsAt);
  });
}

export function formatConflictList(sessions: Session[]): string {
  return sessions
    .map((s) => {
      const start = new Date(s.startsAt);
      const day = start.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      const time = start.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      });
      const end = new Date(s.endsAt).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      });
      return `${s.title} — ${day}, ${time}–${end}`;
    })
    .join("\n");
}

export function generateWeeklyOccurrences(
  base: {
    trainerId: string;
    clientId: string;
    title: string;
    type: string;
    status: Session["status"];
    startsAt: string;
    endsAt: string;
    location: string | null;
    notes: string | null;
  },
  count: number
  // clientId stays non-null here — occurrences always carry the caller's id
): (Omit<Session, "id" | "createdAt" | "clientName" | "clientAvatar" | "trainerName"> & { clientId: string })[] {
  const duration =
    new Date(base.endsAt).getTime() - new Date(base.startsAt).getTime();
  const out: (Omit<Session, "id" | "createdAt" | "clientName" | "clientAvatar" | "trainerName"> & { clientId: string })[] = [];
  for (let i = 0; i < count; i++) {
    const start = new Date(base.startsAt);
    start.setDate(start.getDate() + i * 7);
    const end = new Date(start.getTime() + duration);
    out.push({
      ...base,
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
    });
  }
  return out;
}
