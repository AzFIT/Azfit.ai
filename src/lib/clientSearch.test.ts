import { describe, it, expect } from "vitest";
import {
  filterClients,
  groupClients,
  clientStatusLabel,
  type BookableClient,
} from "./clientSearch";

const roster: BookableClient[] = [
  { id: "1", name: "Ben Sabre", email: "ben@example.com", status: "active" },
  { id: "2", name: "Jonny Mclarnon", email: "jonny@example.com", status: "active" },
  { id: "3", name: "Steve Bai", email: "steve@noemail.azfit", status: "on_holiday" },
  { id: "4", name: "Alex NoEmail", status: "active" }, // no email key
];

describe("filterClients", () => {
  it("returns the full roster for an empty/blank query", () => {
    expect(filterClients(roster, "")).toHaveLength(4);
    expect(filterClients(roster, "   ")).toHaveLength(4);
  });

  it("matches name case-insensitively", () => {
    expect(filterClients(roster, "ben").map((c) => c.id)).toEqual(["1"]);
    expect(filterClients(roster, "SABRE")).toHaveLength(1);
  });

  it("matches email substrings", () => {
    expect(filterClients(roster, "noemail.azfit").map((c) => c.id)).toEqual(["3"]);
  });

  it("handles clients without an email", () => {
    expect(filterClients(roster, "alex").map((c) => c.id)).toEqual(["4"]);
    expect(filterClients(roster, "@").some((c) => c.id === "4")).toBe(false);
  });

  it("returns [] when nothing matches", () => {
    expect(filterClients(roster, "zzzzz")).toEqual([]);
  });
});

describe("groupClients", () => {
  it("puts active first and preserves input order", () => {
    const g = groupClients(roster);
    expect(g.active.map((c) => c.id)).toEqual(["1", "2", "4"]);
    expect(g.others.map((c) => c.id)).toEqual(["3"]);
  });

  it("treats a missing status as active", () => {
    const g = groupClients([{ id: "x", name: "No Status" }]);
    expect(g.active).toHaveLength(1);
    expect(g.others).toHaveLength(0);
  });
});

describe("clientStatusLabel", () => {
  it("maps known/unknown statuses to readable chips", () => {
    expect(clientStatusLabel("active")).toBe("Active");
    expect(clientStatusLabel(undefined)).toBe("Active");
    expect(clientStatusLabel("on_holiday")).toBe("On_holiday".replace("_h", " H")); // "On Holiday"
  });
});
