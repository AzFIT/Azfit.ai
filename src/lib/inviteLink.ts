/**
 * Client invite auto-link (Phase 28A)
 * A trainer shares /invite/<trainerId>. The invitee lands on signup/login
 * with ?trainer=<id> (persisted in sessionStorage through redirects), and
 * after successful auth we create their clients row (status pending_start)
 * via the "Invited clients can create own record" INSERT policy.
 */

import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const KEY = "azfit_invite_trainer";

/** Store ?trainer=<uuid> from the current URL (survives redirects). */
export function captureInviteTrainer(search: string): void {
  const t = new URLSearchParams(search).get("trainer");
  if (t && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t)) {
    sessionStorage.setItem(KEY, t);
  }
}

export function getInviteTrainer(): string | null {
  return sessionStorage.getItem(KEY);
}

export function clearInviteTrainer(): void {
  sessionStorage.removeItem(KEY);
}

/**
 * After successful auth: link the user to the inviting trainer by creating
 * their clients row. No-op without a stored trainer id. Never blocks auth.
 * Returns "linked" | "already-linked" | "already-other" | "skipped" | "failed".
 */
export async function linkInvitedClient(
  trainerId: string | null,
): Promise<"linked" | "already-linked" | "already-other" | "skipped" | "failed"> {
  if (!trainerId) return "skipped";
  try {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user?.email) return "skipped";

    const { data: existing } = await supabase
      .from("clients")
      .select("id, trainer_id")
      .eq("email", user.email)
      .limit(1)
      .maybeSingle();

    if (existing) {
      clearInviteTrainer();
      if (existing.trainer_id !== trainerId) {
        toast.info("Your account is already linked to a trainer");
        return "already-other";
      }
      return "already-linked";
    }

    const fullName =
      (user.user_metadata as { full_name?: string } | null)?.full_name ||
      user.email.split("@")[0];

    const { error } = await supabase.from("clients").insert({
      trainer_id: trainerId,
      email: user.email,
      full_name: fullName,
      status: "pending_start",
    });
    if (error) throw error;

    const { data: trainerName } = await supabase.rpc("get_trainer_display_name", {
      p_trainer_id: trainerId,
    });
    toast.success(`You're connected with ${trainerName || "your trainer"}`);
    clearInviteTrainer();
    return "linked";
  } catch (err) {
    // Non-blocking: account works anyway; the trainer can add them manually.
    console.error("[inviteLink] failed:", err);
    return "failed";
  }
}
