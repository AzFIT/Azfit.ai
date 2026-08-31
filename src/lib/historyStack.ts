/* ═══════════════════════════════════════════════════════════════
   History stack math (Owner Tasks, Task 5) — pure navigation-stack
   advance for HistoryNav's back/forward availability.
   ═══════════════════════════════════════════════════════════════ */

/* Advance the (stack, pointer) pair for a navigation to `path`.
 * Back/forward steps move the pointer; a new path prunes forward
 * history and pushes; the stack is capped at 50 entries. */
export function advanceHistory(
  stack: string[],
  pointer: number,
  path: string,
): { stack: string[]; pointer: number } {
  const next = [...stack];
  let p = pointer;
  if (next.length === 0) {
    next.push(path);
    p = 0;
  } else if (next[p] !== path) {
    if (next[p - 1] === path) {
      p--;
    } else if (next[p + 1] === path) {
      p++;
    } else {
      next.splice(p + 1);
      next.push(path);
      p = next.length - 1;
    }
  }
  // Cap at 50 entries — adjust the pointer for the dropped prefix
  const overflow = Math.max(0, next.length - 50);
  return { stack: next.slice(-50), pointer: p - overflow };
}
