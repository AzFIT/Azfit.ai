/* ═══════════════════════════════════════════════════════════════
   Phase 92c-fix Item 3 — paste-import review state machine (pure).

   The PasteImportDialog review stage used to force resolution of every
   row (Import gated on allResolved). These transitions add the missing
   paths: rejecting a wrong "Did you mean?" suggestion back to the
   top-3 picker, skipping a row (excluded from import, reversible until
   the dialog closes), and the truthful N/M import counts.

   Skipped rows are always UNRESOLVED rows — a resolved row counts
   toward N and there is no skip affordance on it (accept-all stays
   byte-identical to Phase 93).
   ═══════════════════════════════════════════════════════════════ */

export interface ReviewCounts {
  /** Rows that will actually enter the program (resolved, not skipped). */
  importable: number;
  /** Rows explicitly skipped by the coach. */
  skipped: number;
}

/** Reject a wrong suggestion: the row drops to the top-3 picker state. */
export function rejectSuggestion(rejected: ReadonlySet<number>, line: number): Set<number> {
  return new Set(rejected).add(line);
}

/** Clear the rejection (a suggestion was accepted / a pick was made). */
export function clearRejection(rejected: ReadonlySet<number>, line: number): Set<number> {
  const next = new Set(rejected);
  next.delete(line);
  return next;
}

/** Skip a row: excluded from the import, reversible via undoSkip. */
export function skipLine(skipped: ReadonlySet<number>, line: number): Set<number> {
  return new Set(skipped).add(line);
}

/** Undo a skip — the row returns to its suggestion/picker state. */
export function undoSkip(skipped: ReadonlySet<number>, line: number): Set<number> {
  const next = new Set(skipped);
  next.delete(line);
  return next;
}

/**
 * Truthful import counts. `resolvedLines` are rows with a resolution
 * (auto-matched or manually picked); `skippedLines` are coach-skipped.
 * Defense in depth: even if a line were both, skipped wins and it never
 * enters the program.
 */
export function reviewCounts(
  resolvedLines: Iterable<number>,
  skippedLines: Iterable<number>,
): ReviewCounts {
  const skipped = new Set(skippedLines);
  let importable = 0;
  for (const line of resolvedLines) {
    if (!skipped.has(line)) importable++;
  }
  return { importable, skipped: skipped.size };
}

/**
 * Bottom-bar truth. M > 0 → "Import N exercises (M skipped)";
 * N = 0 with skips → the honest "Nothing to import"; otherwise plain
 * "Import N exercises".
 */
export function importButtonLabel(counts: ReviewCounts): string {
  if (counts.importable === 0 && counts.skipped > 0) return 'Nothing to import';
  const noun = counts.importable === 1 ? 'exercise' : 'exercises';
  return counts.skipped > 0
    ? `Import ${counts.importable} ${noun} (${counts.skipped} skipped)`
    : `Import ${counts.importable} ${noun}`;
}

/**
 * Builds what actually enters the program: skipped rows and unresolved
 * rows are excluded; auto-matches fold in exactly once. When nothing is
 * skipped and everything resolved this equals the Phase 93 behavior
 * byte-for-byte (same rows, same map contents).
 */
export function buildImportSelection<Row extends { line: number }, Lib>(input: {
  rows: readonly Row[];
  explicit: ReadonlyMap<number, Lib>;
  skippedLines: ReadonlySet<number>;
  autoMatchFor: (line: number) => Lib | null;
}): { rows: Row[]; resolutions: Map<number, Lib> } {
  const final = new Map<number, Lib>();
  const kept: Row[] = [];
  for (const row of input.rows) {
    if (input.skippedLines.has(row.line)) continue;
    const lib = input.explicit.get(row.line) ?? input.autoMatchFor(row.line);
    if (!lib) continue;
    final.set(row.line, lib);
    kept.push(row);
  }
  return { rows: kept, resolutions: final };
}
