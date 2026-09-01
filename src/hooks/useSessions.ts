import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDateKeyLocal } from "@/lib/utils";
import { findSessionConflicts, type ConflictCandidate } from "@/lib/sessionConflicts";

/* ═══════════════════════════════════════════════════════════════════
   useSessions — Real-time session scheduling hook
   ═══════════════════════════════════════════════════════════════════ */

export interface Session {
  id: string;
  trainerId: string;
  clientId: string | null; // null for account-less sessions (see clientRecordId)
  clientRecordId?: string | null; // Phase 35: clients.id for account-less bookings
  title: string;
  type: string;
  status: "requested" | "scheduled" | "completed" | "cancelled";
  startsAt: string;
  endsAt: string;
  location: string | null;
  notes: string | null;
  createdAt: string;
  // Joined fields
  clientName?: string;
  clientAvatar?: string | null;
  trainerName?: string;
}

function toSession(raw: Record<string, unknown>): Session {
  return {
    id: raw.id as string,
    trainerId: raw.trainer_id as string,
    clientId: (raw.client_id as string | null) ?? null,
    clientRecordId: (raw.client_record_id as string | null) ?? null,
    title: raw.title as string,
    type: raw.type as string,
    status: raw.status as Session["status"],
    startsAt: raw.starts_at as string,
    endsAt: raw.ends_at as string,
    location: raw.location as string | null,
    notes: raw.notes as string | null,
    createdAt: raw.created_at as string,
    clientName: (raw as Record<string, unknown>).client_name as string | undefined,
    clientAvatar: (raw as Record<string, unknown>).client_avatar as string | null | undefined,
    trainerName: (raw as Record<string, unknown>).trainer_name as string | undefined,
  };
}

function getDateKey(d: Date): string {
  // Phase 64: human-visible day filtering (today/week/next-upcoming) must use
  // the client's local timezone so sessions render on the correct calendar day.
  return formatDateKeyLocal(d);
}

export function useSessions() {
  const { user } = useAuth();
  const myId = user?.id;
  const isTrainer = user?.role === "admin" || user?.role === "trainer";

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  /* ── Fetch sessions ────────────────────────────────────────────── */
  const fetchSessions = useCallback(async () => {
    if (!myId) return;
    setLoading(true);

    try {
      // Phase 35 ITEM 2d: account-less sessions key on client_record_id
      // (clients.id). Resolve the caller's clients row (client role) so their
      // sessions booked pre-account still show up; embed names from BOTH FKs.
      let myClientsId: string | null = null;
      if (!isTrainer && user?.email) {
        const { data: cr } = await supabase
          .from("clients")
          .select("id")
          .eq("email", user.email)
          .maybeSingle();
        myClientsId = cr?.id ?? null;
      }

      const clientFilter = myClientsId
        ? `client_id.eq.${myId},client_record_id.eq.${myClientsId}`
        : `client_id.eq.${myId}`;

      const { data, error } = await supabase
        .from("sessions")
        .select(`
          *,
          client:profiles!sessions_client_id_fkey(full_name, avatar_url),
          trainer:profiles!sessions_trainer_id_fkey(full_name),
          clientRecord:clients!sessions_client_record_id_fkey(full_name)
        `)
        .or(isTrainer ? `trainer_id.eq.${myId}` : clientFilter)
        .order("starts_at", { ascending: true });

      if (error) throw error;

      const mapped: Session[] = (data || []).map((raw: Record<string, unknown>) => {
        const s = toSession(raw);
        const clientData = raw.client as Record<string, unknown> | undefined;
        const trainerData = raw.trainer as Record<string, unknown> | undefined;
        const recordData = raw.clientRecord as Record<string, unknown> | undefined;
        return {
          ...s,
          clientName: (clientData?.full_name ?? recordData?.full_name) as string | undefined,
          clientAvatar: clientData?.avatar_url as string | null | undefined,
          trainerName: trainerData?.full_name as string | undefined,
        };
      });

      setSessions(mapped);
    } catch (err) {
      console.error("Failed to fetch sessions:", err);
    } finally {
      setLoading(false);
    }
  }, [myId, isTrainer, user?.email]);

  /* ── Create session ────────────────────────────────────────────── */
  const createSession = useCallback(
    async (session: Omit<Session, "id" | "createdAt">) => {
      if (!myId) return false;
      setSaving(true);

      try {
        const payload = {
          trainer_id: isTrainer ? myId : session.trainerId,
          client_id: isTrainer ? session.clientId : myId,
          title: session.title,
          type: session.type,
          status: isTrainer ? "scheduled" : "requested",
          starts_at: session.startsAt,
          ends_at: session.endsAt,
          location: session.location,
          notes: session.notes,
        };

        const { error } = await supabase.from("sessions").insert(payload);
        if (error) throw error;

        if (!isTrainer) {
          toast.success("Request sent to your coach");
        } else {
          toast.success("Session scheduled");
        }

        await fetchSessions();
        return true;
      } catch (err) {
        console.error("Failed to create session:", err);
        toast.error("Failed to schedule session");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [myId, isTrainer, fetchSessions]
  );

  /* ── Update session ────────────────────────────────────────────── */
  const updateSession = useCallback(
    async (id: string, updates: Partial<Session>) => {
      if (!myId) return false;
      setSaving(true);

      try {
        const payload: { [key: string]: string | null } = {};
        if (updates.title !== undefined) payload.title = updates.title;
        if (updates.type !== undefined) payload.type = updates.type;
        if (updates.status !== undefined) payload.status = updates.status;
        if (updates.startsAt !== undefined) payload.starts_at = updates.startsAt;
        if (updates.endsAt !== undefined) payload.ends_at = updates.endsAt;
        if (updates.location !== undefined) payload.location = updates.location;
        if (updates.notes !== undefined) payload.notes = updates.notes;

        // Cast to any to bypass strict generated-type checking
        const { error } = await (supabase.from("sessions").update(payload as never) as unknown as { eq: (field: string, value: string) => Promise<{ error: { message: string } | null }> }).eq("id", id);
        if (error) throw error;

        toast.success("Session updated");
        await fetchSessions();
        return true;
      } catch (err) {
        console.error("Failed to update session:", err);
        toast.error("Failed to update session");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [myId, fetchSessions]
  );

  /* ── Cancel session ───────────────────────────────────────────── */
  const cancelSession = useCallback(
    async (id: string) => {
      if (!myId) return false;
      setSaving(true);

      try {
        const { error } = await supabase
          .from("sessions")
          .update({ status: "cancelled" })
          .eq("id", id);
        if (error) throw error;

        toast.success("Session cancelled");
        await fetchSessions();
        return true;
      } catch (err) {
        console.error("Failed to cancel session:", err);
        toast.error("Failed to cancel session");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [myId, fetchSessions]
  );

  /* ── Delete session (hard delete, optimistic + rollback) ──────── */
  const deleteSession = useCallback(
    async (id: string) => {
      if (!myId) return false;
      setSaving(true);

      // Optimistic removal; rollback on error. Package credits (Phase 50)
      // are derivative of session rows, so deleting auto-refunds the credit.
      let previous: Session[] = [];
      setSessions((cur) => {
        previous = cur;
        return cur.filter((s) => s.id !== id);
      });

      try {
        const { error } = await supabase.from("sessions").delete().eq("id", id);
        if (error) throw error;

        toast.success("Session deleted");
        return true;
      } catch (err) {
        console.error("Failed to delete session:", err);
        setSessions(previous);
        toast.error("Failed to delete session");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [myId]
  );

  /* ── Reschedule (Task 4 drag-and-drop: optimistic move + rollback) ── */
  const rescheduleSession = useCallback(
    async (id: string, startsAt: string, endsAt: string) => {
      if (!myId) return false;

      let previous: Session[] = [];
      setSessions((cur) => {
        previous = cur;
        return cur.map((s) => (s.id === id ? { ...s, startsAt, endsAt } : s));
      });

      try {
        const { error } = await supabase
          .from("sessions")
          .update({ starts_at: startsAt, ends_at: endsAt })
          .eq("id", id);
        if (error) throw error;

        toast.success("Session moved");
        return true;
      } catch (err) {
        console.error("Failed to move session:", err);
        setSessions(previous);
        toast.error("Failed to move session");
        return false;
      }
    },
    [myId]
  );

  /* ── Batch create sessions (recurring) ──────────────────────────── */
  const createSessions = useCallback(
    async (sessionsToCreate: Omit<Session, "id" | "createdAt">[]) => {
      if (!myId || sessionsToCreate.length === 0) return { success: false, count: 0 };
      setSaving(true);

      try {
        const payloads = sessionsToCreate.map((session) => ({
          trainer_id: session.trainerId,
          client_id: session.clientId,
          title: session.title,
          type: session.type,
          status: session.status,
          starts_at: session.startsAt,
          ends_at: session.endsAt,
          location: session.location,
          notes: session.notes,
        }));

        const { error } = await supabase.from("sessions").insert(payloads);
        if (error) throw error;

        await fetchSessions();
        return { success: true, count: sessionsToCreate.length };
      } catch (err) {
        console.error("Failed to create sessions:", err);
        return { success: false, count: 0 };
      } finally {
        setSaving(false);
      }
    },
    [myId, fetchSessions]
  );

  /* ── Find overlapping sessions for a candidate time range ──────── */
  const findConflicts = useCallback(
    (candidate: ConflictCandidate) => findSessionConflicts(sessions, candidate),
    [sessions]
  );

  /* ── Realtime subscription ─────────────────────────────────────── */
  useEffect(() => {
    if (!myId) return;

    fetchSessions();

    const channel = supabase
      .channel(`sessions:${myId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sessions",
        },
        () => {
          fetchSessions();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [myId, fetchSessions]);

  /* ── Derived: today's sessions ─────────────────────────────────── */
  const todaySessions = useCallback(() => {
    const todayKey = getDateKey(new Date());
    return sessions
      .filter((s) => {
        const sKey = getDateKey(new Date(s.startsAt));
        return sKey === todayKey && s.status !== "cancelled";
      })
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }, [sessions]);

  /* ── Derived: next upcoming session for client ─────────────────── */
  const nextUpcomingSession = useCallback(() => {
    const now = new Date().toISOString();
    return sessions
      .filter((s) => s.startsAt > now && s.status === "scheduled")
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0] || null;
  }, [sessions]);

  /* ── Derived: week sessions for a given week start ───────────── */
  const weekSessions = useCallback(
    (weekStart: Date) => {
      const startKey = getDateKey(weekStart);
      const endKey = getDateKey(new Date(weekStart.getTime() + 6 * 86400000));
      return sessions.filter((s) => {
        const sKey = getDateKey(new Date(s.startsAt));
        return sKey >= startKey && sKey <= endKey && s.status !== "cancelled";
      });
    },
    [sessions]
  );

  return {
    sessions,
    loading,
    saving,
    isTrainer,
    fetchSessions,
    createSession,
    createSessions,
    updateSession,
    cancelSession,
    deleteSession,
    rescheduleSession,
    findConflicts,
    todaySessions,
    nextUpcomingSession,
    weekSessions,
  };
}
