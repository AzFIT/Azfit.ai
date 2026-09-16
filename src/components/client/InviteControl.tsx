// Phase 99a — trainer-side client invitation control.
//
// Renders exactly one honest state from real data (src/lib/inviteStatus):
//   · account exists          → nothing (the client can already log in)
//   · no email on the row     → nothing (there is no one to invite)
//   · invited < 24h ago       → disabled "Invited ✓ · resend tomorrow"
//   · invited ≥ 24h ago       → "Resend invite"
//   · never invited           → "Invite"
// Below sm it collapses to a 44px icon-only button (row space); the label
// shows at sm+. The invite itself goes through the invite-client edge
// function — the only path allowed to create auth users — and the function
// stamps clients.invited_at server-side, so this component holds no write
// path (no keepalive concern, Fix Pack 2 pattern N/A here).

import { useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  deriveInviteStatus,
  inviteLabel,
  inviteEnabled,
} from "@/lib/inviteStatus";

interface InviteControlProps {
  clientId: string;
  email: string | null | undefined;
  invitedAt: string | null | undefined;
  /** called with the server-stamped invited_at after a successful invite */
  onInvited?: (invitedAt: string) => void;
}

export default function InviteControl({
  clientId,
  email,
  invitedAt,
  onInvited,
}: InviteControlProps) {
  const [accountExists, setAccountExists] = useState<boolean | null>(null);
  const [invitedAtLocal, setInvitedAtLocal] = useState<string | null>(
    invitedAt ?? null
  );
  const [busy, setBusy] = useState(false);

  // Account existence drives the has-account state. ilike both sides —
  // auth emails are lowercased, the clients row may hold the original
  // casing (permanent gotcha, same rule as the login linkage).
  useEffect(() => {
    if (!email) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .ilike("email", email)
        .limit(1)
        .maybeSingle();
      if (!cancelled) setAccountExists(data !== null);
    })();
    return () => {
      cancelled = true;
    };
  }, [email]);

  const status = deriveInviteStatus(
    accountExists === true,
    invitedAtLocal
  );

  if (!email || status === "has-account") return null;

  const label = inviteLabel(status);
  const enabled = inviteEnabled(status) && !busy && accountExists !== null;

  const invite = async () => {
    if (!enabled || busy) return;
    setBusy(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Not signed in");
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-client`,
        {
          method: "POST",
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ client_id: clientId }),
        }
      );
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        code?: string;
        invited_at?: string | null;
        error?: string;
        retry_after_s?: number;
      };

      if (res.ok && body.ok === false && body.code === "already_has_account") {
        setAccountExists(true);
        toast.info("This client already has an account — they can log in");
        return;
      }
      if (res.ok && body.ok) {
        const stamped = body.invited_at ?? new Date().toISOString();
        setInvitedAtLocal(stamped);
        onInvited?.(stamped);
        toast.success("Invitation sent");
        return;
      }
      if (res.status === 409) {
        toast.info("Already invited — resend is available tomorrow");
        return;
      }
      toast.error(body.error ?? "Could not send the invitation");
    } catch (err) {
      console.error("invite failed:", err);
      toast.error("Could not send the invitation");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void invite()}
      disabled={!enabled}
      title={
        status === "invited-recent"
          ? "Invitation sent — resend is available 24h later"
          : undefined
      }
      className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-all"
      style={{
        borderColor: "var(--card-border)",
        color:
          status === "invited-recent"
            ? "var(--success)"
            : "var(--azfit-primary)",
        backgroundColor: "var(--light-elevated)",
        opacity: enabled ? 1 : 0.75,
      }}
      data-invite-status={status}
    >
      <UserPlus size={13} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
