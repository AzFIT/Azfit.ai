/* ═══════════════════════════════════════════════════════════════
   Phase 68 Item 3 — editable emoji completion markers. Pure logic:
   emoji validation (single grapheme, emoji content) + honest
   day-completion derivation (ALL scheduled sessions completed).
   Persistence: profiles.calendar_emoji (additive nullable column —
   the "Users can update own profile" RLS already covers it).
   ═══════════════════════════════════════════════════════════════ */

export const EMOJI_PRESETS = ["🔥", "✅", "⭐", "💪"] as const;
export const DEFAULT_COMPLETION_EMOJI = "🔥";

const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

/** Single emoji grapheme or empty string; anything else stripped to ''. */
export function sanitizeEmojiInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (!segmenter) {
    // very old engines: allow single code point emoji only
    const pts = [...trimmed];
    return pts.length === 1 && /\p{Emoji}/u.test(pts[0]) ? pts[0] : "";
  }
  const graphemes = [...segmenter.segment(trimmed)];
  if (graphemes.length !== 1) return "";
  const g = graphemes[0].segment;
  return /\p{Emoji}/u.test(g) ? g : "";
}

/** A day is complete when it HAS scheduled sessions and ALL are completed. */
export function isCompleteDay(statuses: string[]): boolean {
  return statuses.length > 0 && statuses.every((s) => s === "completed");
}

/** The marker for a day cell: the chosen emoji only on a fully-completed
 *  day; null for empty/incomplete days or when the user chose 'None'. */
export function completionEmojiFor(statuses: string[], emoji: string): string | null {
  if (!emoji) return null;
  return isCompleteDay(statuses) ? emoji : null;
}
