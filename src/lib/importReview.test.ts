/* Phase 92c-fix Item 3 — review state machine: reject / skip / undo / counts. */

import { describe, expect, it } from 'vitest';
import {
  buildImportSelection,
  clearRejection,
  importButtonLabel,
  rejectSuggestion,
  reviewCounts,
  skipLine,
  undoSkip,
} from '@/lib/importReview';

describe('reject flow', () => {
  it('rejectSuggestion marks the row for the picker state; clearRejection reverses', () => {
    let rejected = new Set<number>();
    rejected = rejectSuggestion(rejected, 7);
    expect(rejected.has(7)).toBe(true);
    rejected = clearRejection(rejected, 7);
    expect(rejected.has(7)).toBe(false);
  });

  it('rejects accumulate across rows', () => {
    let rejected = new Set<number>();
    rejected = rejectSuggestion(rejected, 3);
    rejected = rejectSuggestion(rejected, 9);
    expect([...rejected].sort()).toEqual([3, 9]);
  });
});

describe('skip flow', () => {
  it('skip then undo returns the row to importable consideration', () => {
    let skipped = new Set<number>();
    skipped = skipLine(skipped, 4);
    expect(skipped.has(4)).toBe(true);
    skipped = undoSkip(skipped, 4);
    expect(skipped.has(4)).toBe(false);
  });

  it('skips are reversible independently per row', () => {
    let skipped = new Set<number>();
    skipped = skipLine(skipLine(skipped, 1), 2);
    skipped = undoSkip(skipped, 1);
    expect([...skipped]).toEqual([2]);
  });
});

describe('reviewCounts', () => {
  it('auto-matched + manually resolved count toward N; skipped toward M', () => {
    // 8 rows: 5 resolved (lines 1-5), 2 skipped (6,7), 1 unresolved
    const c = reviewCounts([1, 2, 3, 4, 5], [6, 7]);
    expect(c).toEqual({ importable: 5, skipped: 2 });
  });

  it('defense in depth: a line both resolved and skipped never imports', () => {
    const c = reviewCounts([1, 2], [2]);
    expect(c.importable).toBe(1);
    expect(c.skipped).toBe(1);
  });

  it('empty everything', () => {
    expect(reviewCounts([], [])).toEqual({ importable: 0, skipped: 0 });
  });
});

describe('importButtonLabel', () => {
  it('states N and M when skips exist', () => {
    expect(importButtonLabel({ importable: 6, skipped: 2 })).toBe('Import 6 exercises (2 skipped)');
  });

  it('singular exercise', () => {
    expect(importButtonLabel({ importable: 1, skipped: 0 })).toBe('Import 1 exercise');
  });

  it('no skips → plain label (Phase 93 parity)', () => {
    expect(importButtonLabel({ importable: 8, skipped: 0 })).toBe('Import 8 exercises');
  });

  it('all skipped → honest empty state', () => {
    expect(importButtonLabel({ importable: 0, skipped: 3 })).toBe('Nothing to import');
  });

  it('zero rows at all → plain label (button disabled by caller)', () => {
    expect(importButtonLabel({ importable: 0, skipped: 0 })).toBe('Import 0 exercises');
  });
});

describe('buildImportSelection', () => {
  const rows = [
    { line: 1, exercise: 'Front Squat' },
    { line: 2, exercise: 'Row' },
    { line: 3, exercise: 'Weird Move' },
    { line: 4, exercise: 'Press' },
  ];
  const lib = (id: string) => ({ id }) as { id: string };

  it('accept-all = Phase 93 parity: every resolved row kept, auto folded once', () => {
    const { rows: kept, resolutions } = buildImportSelection({
      rows,
      explicit: new Map([[1, lib('a')]]), // line 1 picked manually
      skippedLines: new Set(),
      autoMatchFor: (line) => (line === 2 || line === 4 ? lib(`auto-${line}`) : null),
    });
    expect(kept.map((r) => r.line)).toEqual([1, 2, 4]);
    expect(resolutions.get(1)).toEqual({ id: 'a' });
    expect(resolutions.get(2)).toEqual({ id: 'auto-2' });
    expect(resolutions.get(4)).toEqual({ id: 'auto-4' });
    expect(resolutions.has(3)).toBe(false); // never resolved, excluded
  });

  it('skipped rows never enter the program even when a match exists', () => {
    const { rows: kept, resolutions } = buildImportSelection({
      rows,
      explicit: new Map(),
      skippedLines: new Set([2]),
      autoMatchFor: (line) => lib(`auto-${line}`),
    });
    expect(kept.map((r) => r.line)).toEqual([1, 3, 4]);
    expect(resolutions.has(2)).toBe(false);
  });

  it('unresolved + unskipped rows are excluded (not silently imported)', () => {
    const { rows: kept } = buildImportSelection({
      rows,
      explicit: new Map(),
      skippedLines: new Set(),
      autoMatchFor: () => null,
    });
    expect(kept).toEqual([]);
  });
});
