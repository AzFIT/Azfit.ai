// Phase 99a — client invitation status derivation (pure, unit-tested).
//
// The trainer's Invite button shows exactly one state, always from real
// data:
//   · account exists          → hide the button (the client can log in)
//   · invited < 24h ago       → "Invited ✓ · resend tomorrow" (disabled)
//   · invited ≥ 24h ago       → "Resend invite" (re-invite allowed)
//   · never invited           → "Invite"
// A client row with no email never renders a button (handled by the caller
// — there is nothing to derive here).

export const INVITE_RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;

export type InviteStatus = "has-account" | "invited-recent" | "resend" | "invite";

/** `invitedAt` = ISO timestamp or null; `now` injectable for tests. */
export function deriveInviteStatus(
  accountExists: boolean,
  invitedAt: string | null,
  now: Date = new Date()
): InviteStatus {
  if (accountExists) return "has-account";
  if (!invitedAt) return "invite";
  const t = new Date(invitedAt).getTime();
  if (Number.isNaN(t)) return "invite"; // garbage value → honest default
  return now.getTime() - t < INVITE_RECENT_WINDOW_MS ? "invited-recent" : "resend";
}

/** Button label per status (null = render no button). */
export function inviteLabel(status: InviteStatus): string | null {
  switch (status) {
    case "has-account":
      return null;
    case "invited-recent":
      return "Invited ✓ · resend tomorrow";
    case "resend":
      return "Resend invite";
    case "invite":
      return "Invite";
  }
}

/** True when the button is tappable (the disabled state is still rendered,
 *  with its honest label, for invited-recent). */
export function inviteEnabled(status: InviteStatus): boolean {
  return status === "invite" || status === "resend";
}
