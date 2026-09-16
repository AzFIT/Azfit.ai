// Phase 99a — invite status derivation unit tests.
import { describe, it, expect } from "vitest";
import {
  deriveInviteStatus,
  inviteLabel,
  inviteEnabled,
  INVITE_RECENT_WINDOW_MS,
} from "./inviteStatus";

const NOW = new Date("2026-09-16T12:00:00Z");
const RECENT = "2026-09-16T06:00:00Z"; // 6h ago
const STALE = "2026-09-10T12:00:00Z"; // 6d ago

describe("deriveInviteStatus", () => {
  it("account exists → has-account regardless of invited_at", () => {
    expect(deriveInviteStatus(true, null, NOW)).toBe("has-account");
    expect(deriveInviteStatus(true, RECENT, NOW)).toBe("has-account");
    expect(deriveInviteStatus(true, STALE, NOW)).toBe("has-account");
  });

  it("never invited → invite", () => {
    expect(deriveInviteStatus(false, null, NOW)).toBe("invite");
  });

  it("invited inside 24h → invited-recent", () => {
    expect(deriveInviteStatus(false, RECENT, NOW)).toBe("invited-recent");
    // boundary: 1ms under the window still recent
    const justInside = new Date(NOW.getTime() - INVITE_RECENT_WINDOW_MS + 1).toISOString();
    expect(deriveInviteStatus(false, justInside, NOW)).toBe("invited-recent");
  });

  it("invited at/over 24h → resend", () => {
    expect(deriveInviteStatus(false, STALE, NOW)).toBe("resend");
    const atBoundary = new Date(NOW.getTime() - INVITE_RECENT_WINDOW_MS).toISOString();
    expect(deriveInviteStatus(false, atBoundary, NOW)).toBe("resend");
  });

  it("garbage invited_at → honest invite default", () => {
    expect(deriveInviteStatus(false, "not-a-date", NOW)).toBe("invite");
  });
});

describe("inviteLabel", () => {
  it("has-account renders no button", () => {
    expect(inviteLabel("has-account")).toBeNull();
  });
  it("labels match the states", () => {
    expect(inviteLabel("invite")).toBe("Invite");
    expect(inviteLabel("resend")).toBe("Resend invite");
    expect(inviteLabel("invited-recent")).toContain("Invited");
  });
});

describe("inviteEnabled", () => {
  it("only invite/resend are tappable", () => {
    expect(inviteEnabled("invite")).toBe(true);
    expect(inviteEnabled("resend")).toBe(true);
    expect(inviteEnabled("invited-recent")).toBe(false);
    expect(inviteEnabled("has-account")).toBe(false);
  });
});
