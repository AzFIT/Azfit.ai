/* ═══════════════════════════════════════════════════════════════
   Phase 93 — Program Paste Import parser (pure, no deps).

   Canonical format (the owner's locked format — the AI program prompt
   in canonical.md targets exactly THIS):

     **Program Name:** 5-Day GBC: Strength & Stamina
     **Weeks:** 4
     **Training Method:** Free-form
     **Description:** 4 sets per exercise (12/10/8/6) ascending load.
     | Day | Order | Exercise | Sets | Reps | Tempo | Rest |
     | 1 | A1 | Front Squat (Barbell) | 4 | 12/10/8/6 | 4010 | 45s |
     | 1 | A2 | Neutral-Grip Pull-Up (Use lifting straps) | 4 | 12/10/8/6 | 3010 | 45s |

   Contract:
   • Input = raw pasted text (markdown table, TSV, or CSV auto-detected).
   • Metadata: `**Key:** value` or `Key: value` — Program Name / Weeks /
     Training Method / Description.
   • Rows: Day (number or "Day 1"), order codes (A1/B2 kept verbatim),
     exercise with " or " alternates and (parenthetical) notes split out,
     sets integer, reps kept VERBATIM ("12/10/8/6", "6-12" — never
     reinterpreted), tempo normalized to 4 digits, rest → seconds.
   • Blank lines, markdown separator rows (|---|---|) skipped.
   • Every other unparseable line is reported in `errors` with its 1-based
     line number — NOTHING is silently dropped (HONEST DATA).
   ═══════════════════════════════════════════════════════════════ */

export interface ParsedMeta {
  name?: string;
  weeks?: number;
  method?: string;
  description?: string;
}

export interface ParsedRow {
  /** 1-based source line number (for error review cross-reference). */
  line: number;
  /** 1-based training day. */
  day: number;
  /** Order code verbatim, uppercased (A1, B2, …). */
  order: string;
  /** Match name: primary exercise, parentheticals and alternates removed. */
  exercise: string;
  /** The "or" alternate, when the cell offered one ("Hack Squat or Leg Press"). */
  alternate?: string;
  sets: number;
  /** Verbatim reps text — "12/10/8/6" / "6-12" / "10" preserved exactly. */
  reps: string;
  /** Tempo normalized to 4 digits ("3-0-1-0" → "3010"). */
  tempo: string;
  /** Rest in whole seconds ("45s"/"90"/"1:16" → 45/90/76). */
  restSec: number;
  /** Parenthetical instruction, inner text only ("(Use lifting straps)"). */
  notes?: string;
}

export interface ParseError {
  line: number;
  reason: string;
  content: string;
}

export interface ParseResult {
  meta: ParsedMeta;
  rows: ParsedRow[];
  errors: ParseError[];
}

/* ── Table format detection ────────────────────────────────────── */

type TableFormat = "markdown" | "tsv" | "csv";

function detectFormat(line: string, header: string[]): TableFormat | null {
  if (line.includes("|")) return "markdown";
  if (line.includes("\t")) return "tsv";
  // CSV only when the header says so and the line actually carries commas —
  // avoids treating a plain metadata-ish line as a row.
  if (header.length > 1 && line.includes(",")) return "csv";
  return null;
}

function splitRow(line: string, format: TableFormat): string[] {
  if (format === "markdown") {
    const trimmed = line.trim().replace(/^\|/, "").replace(/\|\s*$/, "");
    return trimmed.split("|").map((c) => c.trim());
  }
  if (format === "tsv") return line.split("\t").map((c) => c.trim());
  // CSV without quoted-comma support (sheet paste never quotes these cells).
  return line.split(",").map((c) => c.trim());
}

const HEADER_ALIASES: Record<string, keyof HeaderMap> = {
  day: "day",
  order: "order",
  exercise: "exercise",
  exercises: "exercise",
  sets: "sets",
  reps: "reps",
  tempo: "tempo",
  rest: "rest",
};
interface HeaderMap {
  day: number;
  order: number;
  exercise: number;
  sets: number;
  reps: number;
  tempo: number;
  rest: number;
}

function mapHeader(cells: string[]): HeaderMap | null {
  const map: Partial<HeaderMap> = {};
  cells.forEach((cell, i) => {
    const key = HEADER_ALIASES[cell.toLowerCase().replace(/[*_]/g, "")];
    if (key && map[key] === undefined) map[key] = i;
  });
  if (map.day === undefined || map.exercise === undefined || map.sets === undefined) return null;
  return {
    day: map.day,
    order: map.order ?? -1,
    exercise: map.exercise,
    sets: map.sets,
    reps: map.reps ?? -1,
    tempo: map.tempo ?? -1,
    rest: map.rest ?? -1,
  };
}

/* ── Field parsers ─────────────────────────────────────────────── */

/** Day: bare number or "Day 1" (any case). 1–7 only. */
export function parseDay(raw: string): number | null {
  const m = /^(?:day\s*)?(\d{1,2})$/i.exec(raw.trim());
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n >= 1 && n <= 7 ? n : null;
}

/** Order code: letter(s) + digits (A1, B2, AA3). Uppercased; null if absent. */
export function parseOrder(raw: string): string | null {
  const m = /^([A-Za-z]{1,2}\d{1,2})$/.exec(raw.trim());
  return m ? m[1].toUpperCase() : null;
}

export interface SplitExerciseName {
  /** Primary name — alternates and parentheticals removed, trimmed. */
  primary: string;
  /** "or" alternate, when present. */
  alternate?: string;
  /** Parenthetical instruction, inner text only. */
  notes?: string;
}

/**
 * Split an exercise cell: "X or Y" alternates (first " or " at top level),
 * trailing/inline (parentheticals) → notes. The primary is what the matcher
 * sees; the alternate and notes are preserved alongside.
 */
export function splitExerciseName(raw: string): SplitExerciseName | null {
  let text = raw.trim();
  if (!text) return null;
  const notes: string[] = [];
  // Strip parentheticals anywhere in the cell; keep their inner text.
  text = text
    .replace(/\(([^)]*)\)/g, (_all, inner: string) => {
      const t = inner.trim();
      if (t) notes.push(t);
      return " ";
    })
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null; // no exercise name — the row parser reports this line
  // Split on a top-level " or " (case-insensitive, word-boundaried).
  const parts = text.split(/\s+or\s+/i);
  const primary = (parts[0] ?? "").trim();
  const alternate = parts.length > 1 ? (parts[1] ?? "").trim() || undefined : undefined;
  if (!primary) return null;
  return {
    primary,
    ...(alternate ? { alternate } : {}),
    ...(notes.length > 0 ? { notes: notes.join("; ") } : {}),
  };
}

/** Tempo: "4010" or "3-0-1-0" → 4 digits. Anything else → null. */
export function parseTempo(raw: string): string | null {
  const digits = raw.trim().replace(/[^0-9]/g, "");
  return digits.length === 4 ? digits : null;
}

/** Rest → whole seconds: "45s", "90", "1:16", "2:00". */
export function parseRestSec(raw: string): number | null {
  const t = raw.trim().toLowerCase().replace(/\s+/g, "");
  if (!t) return null;
  const mmss = /^(\d{1,3}):([0-5]\d)$/.exec(t);
  if (mmss) return parseInt(mmss[1], 10) * 60 + parseInt(mmss[2], 10);
  const secs = /^(\d{1,4})s?$/.exec(t);
  if (secs) return parseInt(secs[1], 10);
  return null;
}

/* ── Main entry ────────────────────────────────────────────────── */

const META_RE = /^\*{0,2}\s*(program name|weeks|training method|method|description)\s*:\*{0,2}\s*(.*)$/i;

export function parseProgramPaste(input: string): ParseResult {
  const meta: ParsedMeta = {};
  const rows: ParsedRow[] = [];
  const errors: ParseError[] = [];
  const lines = input.split(/\r?\n/);

  let table: HeaderMap | null = null;
  let format: TableFormat | null = null;

  lines.forEach((rawLine, i) => {
    const lineNo = i + 1;
    const line = rawLine.trim();
    if (!line) return; // blank lines skipped

    // Markdown table separator (| --- | --- |)
    if (/^\|?[\s:|-]+\|?$/.test(line) && line.includes("-") && line.includes("|")) return;

    // Metadata (before or after the table — both accepted)
    const metaMatch = META_RE.exec(line);
    if (metaMatch && table === null) {
      const key = metaMatch[1].toLowerCase();
      const value = metaMatch[2].replace(/\*+$/, "").trim();
      if (key === "program name" && value) meta.name = value;
      else if (key === "weeks") {
        const w = parseInt(value, 10);
        if (Number.isFinite(w) && w > 0 && w <= 52) meta.weeks = w;
        else errors.push({ line: lineNo, reason: `Unparseable weeks "${value}"`, content: rawLine.trim() });
      } else if (key === "training method" || key === "method") {
        if (value) meta.method = value;
      } else if (key === "description" && value) meta.description = value;
      return;
    }

    // Table rows (and header detection)
    const cells = line.includes("|")
      ? splitRow(line, "markdown")
      : line.includes("\t")
        ? splitRow(line, "tsv")
        : splitRow(line, "csv");

    if (table === null) {
      const header = mapHeader(cells);
      if (header) {
        table = header;
        format = detectFormat(line, cells);
        return; // header row consumed
      }
      // No table yet and this isn't a header → unparseable content.
      errors.push({ line: lineNo, reason: "Expected a metadata line or the Day/Order/Exercise table header", content: rawLine.trim() });
      return;
    }

    if (format && format !== "markdown" && !line.includes("\t") && format === "tsv") {
      errors.push({ line: lineNo, reason: "Malformed table row (tab-separated table)", content: rawLine.trim() });
      return;
    }
    if (format === "csv" && !line.includes(",")) {
      errors.push({ line: lineNo, reason: "Malformed table row (CSV table)", content: rawLine.trim() });
      return;
    }

    const cellAt = (idx: number): string => (idx >= 0 ? (cells[idx] ?? "") : "");
    const dayRaw = cellAt(table.day);
    const day = parseDay(dayRaw);
    if (day === null) {
      errors.push({ line: lineNo, reason: `Unparseable day "${dayRaw}" (expected a number or "Day N", 1–7)`, content: rawLine.trim() });
      return;
    }
    const nameCell = cellAt(table.exercise);
    const split = splitExerciseName(nameCell);
    if (!split || !split.primary) {
      errors.push({ line: lineNo, reason: `Unparseable exercise "${nameCell}"`, content: rawLine.trim() });
      return;
    }
    const setsRaw = cellAt(table.sets);
    const sets = parseInt(setsRaw, 10);
    if (!Number.isFinite(sets) || sets <= 0 || sets > 30) {
      errors.push({ line: lineNo, reason: `Unparseable sets "${setsRaw}"`, content: rawLine.trim() });
      return;
    }
    const orderRaw = cellAt(table.order);
    const order = parseOrder(orderRaw) ?? orderRaw.trim();
    const reps = cellAt(table.reps);
    const tempoRaw = cellAt(table.tempo);
    const tempo = tempoRaw ? (parseTempo(tempoRaw) ?? tempoRaw) : "";
    const restRaw = cellAt(table.rest);
    const restSec = restRaw ? parseRestSec(restRaw) : null;
    if (restRaw && restSec === null) {
      errors.push({ line: lineNo, reason: `Unparseable rest "${restRaw}" (expected "45s", "90", or "1:16")`, content: rawLine.trim() });
      return;
    }

    rows.push({
      line: lineNo,
      day,
      order,
      exercise: split.primary,
      ...(split.alternate ? { alternate: split.alternate } : {}),
      sets,
      reps,
      tempo,
      restSec: restSec ?? 0,
      ...(split.notes ? { notes: split.notes } : {}),
    });
  });

  return { meta, rows, errors };
}

/* ── Builder formatting helpers (documented conventions) ───────── */

/** Rest seconds → the wizard's display convention: <60 → "45s"; ≥60 → "m:ss". */
export function formatRest(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** 4-digit tempo → the wizard's dashed convention ("4010" → "4-0-1-0"). */
export function formatTempo(digits: string): string {
  const clean = digits.replace(/[^0-9]/g, "");
  return clean.length === 4 ? clean.split("").join("-") : digits;
}
