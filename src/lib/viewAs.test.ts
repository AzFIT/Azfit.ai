import { describe, it, expect } from "vitest";
import {
  viewAsStorageKey,
  serializeViewAs,
  parseViewAs,
  loggedByForWrite,
  isRouteBlockedInViewAs,
  VIEW_AS_KEY_PREFIX,
  type ViewAsIdentity,
} from "@/lib/viewAs";

const IDENTITY: ViewAsIdentity = {
  clientId: "client-uuid-1",
  email: "sarah@example.com",
  name: "Sarah Chen",
};

describe("viewAsStorageKey (Phase 90e)", () => {
  it("scopes the key to the client id under the shared prefix", () => {
    expect(viewAsStorageKey("abc")).toBe("azfit:view-as:abc");
    expect(viewAsStorageKey("abc")).toMatch(new RegExp(`^${VIEW_AS_KEY_PREFIX}`));
  });

  it("produces distinct keys per client", () => {
    expect(viewAsStorageKey("a")).not.toBe(viewAsStorageKey("b"));
  });
});

describe("parseViewAs (Phase 90e)", () => {
  it("null input → null", () => {
    expect(parseViewAs(null)).toBeNull();
  });

  it("empty string → null", () => {
    expect(parseViewAs("")).toBeNull();
  });

  it("non-JSON garbage → null (never throws)", () => {
    expect(parseViewAs("not json {{{")).toBeNull();
    expect(parseViewAs("undefined")).toBeNull();
  });

  it("valid JSON but not an object → null", () => {
    expect(parseViewAs("42")).toBeNull();
    expect(parseViewAs('"hi"')).toBeNull();
    expect(parseViewAs("null")).toBeNull();
    expect(parseViewAs("[1,2]")).toBeNull();
  });

  it("missing email → null", () => {
    expect(parseViewAs(JSON.stringify({ clientId: "c1", name: "N" }))).toBeNull();
  });

  it("empty clientId → null", () => {
    expect(
      parseViewAs(JSON.stringify({ clientId: "", email: "e@x.com", name: "N" })),
    ).toBeNull();
  });

  it("empty email → null", () => {
    expect(
      parseViewAs(JSON.stringify({ clientId: "c1", email: "", name: "N" })),
    ).toBeNull();
  });

  it("wrong types → null", () => {
    expect(
      parseViewAs(JSON.stringify({ clientId: 7, email: "e@x.com", name: "N" })),
    ).toBeNull();
    expect(
      parseViewAs(JSON.stringify({ clientId: "c1", email: {}, name: "N" })),
    ).toBeNull();
    expect(
      parseViewAs(JSON.stringify({ clientId: "c1", email: "e@x.com", name: 9 })),
    ).toBeNull();
  });

  it("valid payload → identity", () => {
    expect(parseViewAs(serializeViewAs(IDENTITY))).toEqual(IDENTITY);
  });

  it("ignores extra stored fields (savedAt) and tolerates missing name", () => {
    expect(
      parseViewAs(
        JSON.stringify({ ...IDENTITY, savedAt: 1720000000000 }),
      ),
    ).toEqual(IDENTITY);
    expect(
      parseViewAs(JSON.stringify({ clientId: "c1", email: "e@x.com", savedAt: 1 })),
    ).toEqual({ clientId: "c1", email: "e@x.com", name: "" });
  });
});

describe("serializeViewAs round-trip (Phase 90e)", () => {
  it("serialize → parse returns the same identity", () => {
    expect(parseViewAs(serializeViewAs(IDENTITY))).toEqual(IDENTITY);
  });
});

describe("loggedByForWrite (Phase 90e)", () => {
  it("no override → null (self-logged stays NULL)", () => {
    expect(loggedByForWrite(null, "trainer-uid")).toBeNull();
  });

  it("override active → trainer uid", () => {
    expect(loggedByForWrite(IDENTITY, "trainer-uid")).toBe("trainer-uid");
  });

  it("override with empty uid → null (defensive)", () => {
    expect(loggedByForWrite(IDENTITY, "")).toBeNull();
    expect(loggedByForWrite(IDENTITY, "   ")).toBeNull();
  });
});

describe("isRouteBlockedInViewAs (Phase 90e)", () => {
  it.each([
    "/settings",
    "/settings/profile",
    "/trainer-profile",
    "/onboarding",
    "/bioprint",
    "/progress-photos",
    "/analytics",
    "/coach",
    "/coach-ai",
    "/sheets",
    "/workouts",
    "/plan-summary",
    "/clients",
    "/clients/some-uuid",
    "/exercises",
    "/library",
    "/demo",
  ])("blocks %s", (path) => {
    expect(isRouteBlockedInViewAs(path)).toBe(true);
  });

  it.each([
    "/dashboard",
    "/check-ins",
    "/nutrition",
    "/schedule",
    "/notifications",
    "/messages",
    "/deload",
    "/warmup",
    "/export",
    "/timer",
    "/form-checks",
    "/client/some-uuid",
    "/print/program/x",
  ])("allows %s", (path) => {
    expect(isRouteBlockedInViewAs(path)).toBe(false);
  });

  it("prefix boundaries: /settings-x and /coach-x are NOT blocked", () => {
    expect(isRouteBlockedInViewAs("/settings-x")).toBe(false);
    expect(isRouteBlockedInViewAs("/coach-x")).toBe(false);
    expect(isRouteBlockedInViewAs("/clients-x")).toBe(false);
    expect(isRouteBlockedInViewAs("/workouts-x")).toBe(false);
  });

  it("segment boundary: nested paths of a blocked root ARE blocked", () => {
    expect(isRouteBlockedInViewAs("/settings/security")).toBe(true);
    expect(isRouteBlockedInViewAs("/clients/abc/plan-summary/print")).toBe(true);
  });
});
