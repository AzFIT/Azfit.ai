// Fix Pack 2 Item 3 — clientScopeOr unit tests.
import { describe, it, expect } from "vitest";
import { clientScopeOr } from "./clientScope";

describe("clientScopeOr", () => {
  it("scopes across both id spaces when both exist", () => {
    expect(clientScopeOr("p1", "c1")).toBe("client_id.eq.p1,client_record_id.eq.c1");
  });

  it("drops the client_record_id half when clientId is null", () => {
    expect(clientScopeOr("p1", null)).toBe("client_id.eq.p1");
    expect(clientScopeOr("p1", undefined)).toBe("client_id.eq.p1");
  });

  it("drops the client_id half when profileId is null", () => {
    expect(clientScopeOr(null, "c1")).toBe("client_record_id.eq.c1");
  });

  it("returns null when NEITHER id exists (caller must skip the query)", () => {
    expect(clientScopeOr(null, null)).toBeNull();
    expect(clientScopeOr(undefined, undefined)).toBeNull();
    expect(clientScopeOr("", "")).toBeNull();
    expect(clientScopeOr(null, "")).toBeNull();
  });

  it("treats empty-string ids as absent (old ?? '' interpolation 400'd)", () => {
    expect(clientScopeOr("", "c1")).toBe("client_record_id.eq.c1");
  });
});
