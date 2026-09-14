import { describe, it, expect } from "vitest";
import { buildBookingRoster } from "./bookingRoster";

describe("buildBookingRoster", () => {
  it("maps a client with an account to that profile id", () => {
    const roster = buildBookingRoster(
      [{ id: "c1", full_name: "Ada Lovelace", email: "ada@mail.com", status: "active" }],
      [{ id: "p1", email: "ada@mail.com" }],
    );
    expect(roster).toHaveLength(1);
    expect(roster[0]).toEqual({
      profileId: "p1",
      recordId: "c1",
      name: "Ada Lovelace",
      email: "ada@mail.com",
      status: "active",
    });
  });

  it("keeps account-less clients in the roster with profileId null", () => {
    const roster = buildBookingRoster(
      [{ id: "c1", full_name: "No Account", email: "none@mail.com", status: "active" }],
      [{ id: "p1", email: "other@mail.com" }],
    );
    expect(roster).toHaveLength(1);
    expect(roster[0].profileId).toBeNull();
    expect(roster[0].recordId).toBe("c1");
  });

  it("joins case-mismatched emails (Supabase lowercases auth emails)", () => {
    const roster = buildBookingRoster(
      [{ id: "c1", full_name: "Casey User", email: "User@Mail.com", status: "active" }],
      [{ id: "p1", email: "user@mail.com" }],
    );
    expect(roster[0].profileId).toBe("p1");
  });

  it("returns every client with null profileId when profiles is empty", () => {
    const roster = buildBookingRoster(
      [
        { id: "c1", full_name: "A", email: "a@mail.com", status: "active" },
        { id: "c2", full_name: "B", email: "b@mail.com", status: "paused" },
      ],
      [],
    );
    expect(roster.map((r) => r.profileId)).toEqual([null, null]);
  });

  it("tolerates duplicate and missing emails without crashing", () => {
    const roster = buildBookingRoster(
      [
        { id: "c1", full_name: "Dup", email: "dup@mail.com", status: "active" },
        { id: "c2", full_name: "Dup2", email: "dup@mail.com", status: "active" },
        { id: "c3", full_name: "No Email", email: null, status: "active" },
      ],
      [{ id: "p1", email: "dup@mail.com" }],
    );
    expect(roster).toHaveLength(3);
    expect(roster[0].profileId).toBe("p1");
    expect(roster[1].profileId).toBe("p1");
    expect(roster[2].profileId).toBeNull();
    expect(roster[2].email).toBe("");
  });

  it("falls back to 'active' when status is null or missing", () => {
    const roster = buildBookingRoster(
      [
        { id: "c1", full_name: "A", email: "a@mail.com", status: null },
        { id: "c2", full_name: "B", email: "b@mail.com" },
      ],
      [],
    );
    expect(roster[0].status).toBe("active");
    expect(roster[1].status).toBe("active");
  });

  it("preserves the input ordering of the clients query", () => {
    const roster = buildBookingRoster(
      [
        { id: "c3", full_name: "Zed", email: "z@mail.com", status: "active" },
        { id: "c1", full_name: "Amy", email: "a@mail.com", status: "active" },
        { id: "c2", full_name: "Mel", email: "m@mail.com", status: "active" },
      ],
      [{ id: "p2", email: "m@mail.com" }],
    );
    expect(roster.map((r) => r.recordId)).toEqual(["c3", "c1", "c2"]);
    expect(roster.map((r) => r.profileId)).toEqual([null, null, "p2"]);
  });

  it("trims whitespace around emails before joining", () => {
    const roster = buildBookingRoster(
      [{ id: "c1", full_name: "Spaced", email: "  pad@mail.com  ", status: "active" }],
      [{ id: "p1", email: " pad@mail.com " }],
    );
    expect(roster[0].profileId).toBe("p1");
    expect(roster[0].email).toBe("pad@mail.com");
  });
});
