// ═══════════════════════════════════════════════════════════════
// clientSearch (Phase 73 Item 2b) — pure logic for the booking
// dialog's searchable client combobox. Filtering runs client-side on
// the loaded roster (the roster is one trainer's clients — fine at
// this scale; documented limit in PROGRESS.md).
// ═══════════════════════════════════════════════════════════════

export interface BookableClient {
  id: string;
  name: string;
  email?: string;
  status?: string;
}

/** Case-insensitive name/email substring filter. Empty query = all. */
export function filterClients<T extends BookableClient>(
  clients: T[],
  query: string,
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return clients;
  return clients.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q),
  );
}

export interface ClientGroups<T extends BookableClient = BookableClient> {
  active: T[];
  others: T[];
}

/** Active clients first, then everyone else (archived never reaches the
 * picker — the roster query excludes them). Input order preserved.
 * Generic so callers keep their richer row type (e.g. BookingClient). */
export function groupClients<T extends BookableClient>(
  clients: T[],
): ClientGroups<T> {
  const active: T[] = [];
  const others: T[] = [];
  for (const c of clients) {
    (c.status === undefined || c.status === "active" ? active : others).push(c);
  }
  return { active, others };
}

/** Human-readable chip label for a client status. */
export function clientStatusLabel(status: string | undefined): string {
  if (!status || status === "active") return "Active";
  return status
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
