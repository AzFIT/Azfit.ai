import { describe, it, expect } from "vitest";
import {
  centsToDecimal,
  filterSessionsLast90,
  buildClientsSheet,
  buildSessionsSheet,
  buildPaymentsSheet,
  buildPackagesSheet,
  dataRowCount,
  mergeSheetsConfig,
  type ExportClientRow,
  type ExportSessionRow,
  type ExportPaymentRow,
  type ExportPackageRow,
} from "./sheetsExportRows";

describe("centsToDecimal", () => {
  it("formats cents as a two-place decimal string", () => {
    expect(centsToDecimal(4550)).toBe("45.50");
    expect(centsToDecimal(45)).toBe("0.45");
    expect(centsToDecimal(0)).toBe("0.00");
    expect(centsToDecimal(100000)).toBe("1000.00");
  });
  it("never produces float artifacts", () => {
    // 0.1 + 0.2 style drift is impossible: integer math only.
    expect(centsToDecimal(4095)).toBe("40.95");
    expect(centsToDecimal(7)).toBe("0.07");
  });
});

describe("filterSessionsLast90", () => {
  const now = new Date(2026, 8, 16, 12, 0, 0); // local noon 2026-09-16
  const iso = (d: Date) => d.toISOString();
  const mk = (start: Date) => ({ starts_at: iso(start) });

  it("keeps sessions inside the inclusive 90-day window, oldest first", () => {
    const d89 = new Date(now.getTime() - 89 * 24 * 3600 * 1000);
    const d1 = new Date(now.getTime() - 1 * 24 * 3600 * 1000);
    const rows = [mk(d1), mk(d89)];
    const out = filterSessionsLast90(rows, now);
    expect(out.map((r) => r.starts_at)).toEqual([iso(d89), iso(d1)]);
  });

  it("drops sessions older than 90 days and future sessions", () => {
    const d91 = new Date(now.getTime() - 91 * 24 * 3600 * 1000);
    const future = new Date(now.getTime() + 24 * 3600 * 1000);
    expect(filterSessionsLast90([mk(d91), mk(future)], now)).toEqual([]);
  });

  it("drops unparseable dates instead of guessing", () => {
    expect(filterSessionsLast90([{ starts_at: "not-a-date" }], now)).toEqual([]);
  });
});

describe("buildClientsSheet", () => {
  it("maps known rows to exact worksheet arrays", () => {
    const rows: ExportClientRow[] = [
      {
        full_name: "Smoke Client",
        email: "smoke98a-client@azfit.demo",
        status: "active",
        fitness_goal: "Fat loss",
        created_at: new Date(2026, 8, 1, 10, 0, 0).toISOString(),
      },
      {
        full_name: "Sparse Client",
        email: null,
        status: null,
        fitness_goal: null,
        created_at: new Date(2026, 8, 2, 10, 0, 0).toISOString(),
      },
    ];
    const sheet = buildClientsSheet(rows);
    expect(sheet[0]).toEqual(["Name", "Email", "Status", "Goal", "Created"]);
    expect(sheet[1]).toEqual([
      "Smoke Client",
      "smoke98a-client@azfit.demo",
      "active",
      "Fat loss",
      "2026-09-01",
    ]);
    // Missing values are empty strings — never fabricated placeholders.
    expect(sheet[2]).toEqual(["Sparse Client", "", "", "", "2026-09-02"]);
    expect(dataRowCount(sheet)).toBe(2);
  });
});

describe("buildSessionsSheet", () => {
  const now = new Date(2026, 8, 16, 12, 0, 0);
  const nameOf = (r: ExportSessionRow) =>
    r.client_record_id === "c1" ? "Client One" : r.client_id ? "(account client)" : "(no client)";

  it("emits LOCAL dates, resolved names, and honors the 90-day window", () => {
    const rows: ExportSessionRow[] = [
      {
        starts_at: new Date(2026, 8, 10, 9, 30, 0).toISOString(),
        type: "1-on-1",
        status: "completed",
        client_record_id: "c1",
        client_id: null,
      },
      {
        starts_at: new Date(2026, 5, 1, 9, 0, 0).toISOString(), // >90d ago → excluded
        type: "1-on-1",
        status: "completed",
        client_record_id: "c1",
        client_id: null,
      },
      {
        starts_at: new Date(2026, 8, 11, 18, 0, 0).toISOString(),
        type: "consultation",
        status: "scheduled",
        client_record_id: null,
        client_id: "acc-1",
      },
    ];
    const sheet = buildSessionsSheet(rows, nameOf, now);
    expect(sheet[0]).toEqual(["Date", "Client", "Type", "Status"]);
    expect(sheet.length).toBe(3); // header + 2 in-window rows
    expect(sheet[1]).toEqual(["2026-09-10", "Client One", "1-on-1", "completed"]);
    expect(sheet[2]).toEqual(["2026-09-11", "(account client)", "consultation", "scheduled"]);
    expect(dataRowCount(sheet)).toBe(2);
  });
});

describe("buildPaymentsSheet", () => {
  it("sorts by paid date and writes money as decimal strings", () => {
    const rows: ExportPaymentRow[] = [
      {
        paid_at: new Date(2026, 8, 5, 12, 0, 0).toISOString(),
        kind: "package",
        amount_cents: 25000,
        client_record_id: "c1",
      },
      {
        paid_at: new Date(2026, 8, 3, 12, 0, 0).toISOString(),
        kind: "single_session",
        amount_cents: 5000,
        client_record_id: "c2",
      },
    ];
    const sheet = buildPaymentsSheet(rows, (r) => (r.client_record_id === "c1" ? "One" : "Two"));
    expect(sheet[0]).toEqual(["Date", "Client", "Kind", "Amount"]);
    expect(sheet[1]).toEqual(["2026-09-03", "Two", "single_session", "50.00"]);
    expect(sheet[2]).toEqual(["2026-09-05", "One", "package", "250.00"]);
    expect(dataRowCount(sheet)).toBe(2);
  });
});

describe("buildPackagesSheet", () => {
  it("writes used/total and an honest empty expiry", () => {
    const rows: ExportPackageRow[] = [
      {
        name: "10-pack",
        total_sessions: 10,
        sessions_used: 3,
        expires_at: new Date(2026, 11, 31, 0, 0, 0).toISOString(),
        client_record_id: "c1",
      },
      {
        name: "Open",
        total_sessions: 20,
        sessions_used: 0,
        expires_at: null,
        client_record_id: "c2",
      },
    ];
    const sheet = buildPackagesSheet(rows, (r) => (r.client_record_id === "c1" ? "One" : "Two"));
    expect(sheet[0]).toEqual(["Client", "Name", "Used/Total", "Expires"]);
    expect(sheet[1]).toEqual(["One", "10-pack", "3/10", "2026-12-31"]);
    expect(sheet[2]).toEqual(["Two", "Open", "0/20", ""]);
    expect(dataRowCount(sheet)).toBe(2);
  });
});

describe("mergeSheetsConfig", () => {
  it("preserves unknown keys and adopts fresh values", () => {
    const prev = {
      spreadsheet_id: "old",
      url: "https://old",
      created_at: "2026-09-01T00:00:00Z",
      custom_owner_field: "keep-me",
    };
    const merged = mergeSheetsConfig(prev, {
      spreadsheet_id: "new",
      url: "https://new",
      last_export_at: "2026-09-16T00:00:00Z",
      row_counts: { clients: 3, sessions: 8, payments: 2, packages: 1 },
    });
    expect(merged).toEqual({
      spreadsheet_id: "new",
      url: "https://new",
      created_at: "2026-09-01T00:00:00Z", // first creation is sticky
      last_export_at: "2026-09-16T00:00:00Z",
      row_counts: { clients: 3, sessions: 8, payments: 2, packages: 1 },
      custom_owner_field: "keep-me",
    });
  });

  it("seeds created_at from the first export when nothing existed", () => {
    const merged = mergeSheetsConfig(null, {
      spreadsheet_id: "s1",
      url: "https://s1",
      last_export_at: "2026-09-16T00:00:00Z",
      row_counts: { clients: 0, sessions: 0, payments: 0, packages: 0 },
    });
    expect(merged.created_at).toBe("2026-09-16T00:00:00Z");
  });
});
