/**
 * Minimal RFC 5545 iCalendar generator (no external dependencies).
 * Builds VCALENDAR/VEVENT strings with UTC datetimes and basic escaping.
 */

export interface ICSEventInput {
  id: string;
  title: string;
  startsAt: string; // ISO 8601
  endsAt: string;   // ISO 8601
  location?: string | null;
  notes?: string | null;
}

const CRLF = "\r\n";

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

export function toUTCDateTime(iso: string): string {
  const d = new Date(iso);
  const year = d.getUTCFullYear();
  const month = pad2(d.getUTCMonth() + 1);
  const day = pad2(d.getUTCDate());
  const hour = pad2(d.getUTCHours());
  const minute = pad2(d.getUTCMinutes());
  const second = pad2(d.getUTCSeconds());
  return `${year}${month}${day}T${hour}${minute}${second}Z`;
}

export function escapeICS(value: string): string {
  // RFC 5545: escape backslash, semicolon, comma, newline.
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let i = 0;
  while (i < line.length) {
    const chunk = line.slice(i, i + 75);
    parts.push(i === 0 ? chunk : " " + chunk);
    i += 75;
  }
  return parts.join(CRLF);
}

function buildEvent(event: ICSEventInput, now: string): string {
  const lines: string[] = [
    "BEGIN:VEVENT",
    `UID:${event.id}@azfit`,
    `DTSTAMP:${now}`,
    `DTSTART:${toUTCDateTime(event.startsAt)}`,
    `DTEND:${toUTCDateTime(event.endsAt)}`,
    `SUMMARY:${escapeICS(event.title)}`,
  ];
  if (event.location?.trim()) {
    lines.push(`LOCATION:${escapeICS(event.location.trim())}`);
  }
  if (event.notes?.trim()) {
    lines.push(`DESCRIPTION:${escapeICS(event.notes.trim())}`);
  }
  lines.push("END:VEVENT");
  return lines.map(foldLine).join(CRLF);
}

export function generateICS(event: ICSEventInput): string {
  const now = toUTCDateTime(new Date().toISOString());
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AzFIT//AzFIT AI//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    buildEvent(event, now),
    "END:VCALENDAR",
  ].join(CRLF) + CRLF;
}

export function generateICSBundle(events: ICSEventInput[]): string {
  const now = toUTCDateTime(new Date().toISOString());
  const body = events.map((e) => buildEvent(e, now)).join(CRLF);
  return (
    [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//AzFIT//AzFIT AI//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
    ].join(CRLF) +
    CRLF +
    body +
    CRLF +
    "END:VCALENDAR" +
    CRLF
  );
}

export function downloadICS(content: string, filename: string): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function icsFilename(startsAt: string): string {
  const d = new Date(startsAt);
  const date = d.toISOString().split("T")[0];
  return `azfit-session-${date}.ics`;
}
