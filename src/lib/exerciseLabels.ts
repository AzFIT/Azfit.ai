/**
 * Exercise order-label logic (Phase 33C Fix 4) — pure + unit-testable.
 * Labels are a series letter plus an optional 1-based index: 'A', 'A1', 'B2'.
 * Convention: a singleton series shows the plain letter ('E'); a series with
 * 2+ members shows letter+index ('E1', 'E2', …).
 */

export interface OrderLabel {
  letter: string;
  num: number | null;
}

export function parseOrderLabel(label: string): OrderLabel {
  const m = (label || "").trim().match(/^([A-Za-z])(\d+)?$/);
  if (!m) return { letter: "A", num: null };
  return { letter: m[1].toUpperCase(), num: m[2] ? parseInt(m[2], 10) : null };
}

/** First-appearance-ordered groups keyed by series letter, indices in list order. */
function groupsByLetter(labels: string[]): Map<string, number[]> {
  const byLetter = new Map<string, number[]>();
  labels.forEach((label, i) => {
    const { letter } = parseOrderLabel(label);
    const list = byLetter.get(letter) ?? [];
    list.push(i);
    byLetter.set(letter, list);
  });
  return byLetter;
}

/**
 * Repair/renumber a label list: duplicate letters get numbered within their
 * series (D1,D1 → D1,D2); singletons collapse to the plain letter (E1 → E
 * when it's the only E).
 */
export function normalizeOrderLabels(labels: string[]): string[] {
  const out = [...labels];
  for (const [letter, indices] of groupsByLetter(labels)) {
    if (indices.length === 1) {
      out[indices[0]] = letter;
    } else {
      indices.forEach((idx, n) => {
        out[idx] = `${letter}${n + 1}`;
      });
    }
  }
  return out;
}

/** Letter for a brand-new series: one past the highest in use (capped at Z). */
export function nextSeriesLetter(labels: string[]): string {
  let max = 64; // 'A' - 1
  for (const label of labels) {
    max = Math.max(max, parseOrderLabel(label).letter.charCodeAt(0));
  }
  return String.fromCharCode(Math.min(max + 1, 90));
}

/**
 * Pair a new exercise with the LAST series: a singleton becomes <L>1 and the
 * new one <L>2; an existing series <L>1..<L>n gains <L>(n+1).
 */
export function labelsForPairAdd(labels: string[]): { updated: string[]; newLabel: string } {
  if (labels.length === 0) return { updated: [], newLabel: "A" };
  const lastLetter = parseOrderLabel(labels[labels.length - 1]).letter;
  const groupIndices = labels
    .map((label, i) => ({ letter: parseOrderLabel(label).letter, i }))
    .filter((g) => g.letter === lastLetter)
    .map((g) => g.i);
  const updated = normalizeOrderLabels(labels);
  if (groupIndices.length === 1) {
    updated[groupIndices[0]] = `${lastLetter}1`;
    return { updated, newLabel: `${lastLetter}2` };
  }
  return { updated, newLabel: `${lastLetter}${groupIndices.length + 1}` };
}

/** Labels after removing an entry — the survivor of a pair reverts to the plain letter. */
export function labelsAfterRemove(labels: string[], removedIndex: number): string[] {
  return normalizeOrderLabels(labels.filter((_, i) => i !== removedIndex));
}
