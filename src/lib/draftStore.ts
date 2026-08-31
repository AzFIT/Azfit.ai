/* ═══════════════════════════════════════════════════════════════
   Draft autosave store (Owner Tasks, Task 6) — localStorage-backed
   per-entity drafts with debounced writes. Survives screen lock /
   tab close; newest wins via an explicit Resume/Discard banner —
   drafts never silently overwrite server data.
   ═══════════════════════════════════════════════════════════════ */

export interface Draft<T> {
  data: T;
  savedAt: number; // epoch ms
}

const PREFIX = "azfit-draft:";
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const pending = new Map<string, unknown>();

/** Write immediately (rarely needed directly — prefer saveDraft). */
export function saveDraftNow<T>(key: string, data: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ data, savedAt: Date.now() }));
  } catch {
    // storage full/unavailable — drafts are best-effort
  }
}

/** Debounced save (~1s): rapid edits coalesce into one write. */
export function saveDraft<T>(key: string, data: T, delayMs = 1000): void {
  pending.set(key, data);
  const existing = timers.get(key);
  if (existing) clearTimeout(existing);
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key);
      const latest = pending.get(key);
      pending.delete(key);
      if (latest !== undefined) saveDraftNow(key, latest);
    }, delayMs),
  );
}

/** Read a draft, or null when none / unreadable. */
export function loadDraft<T>(key: string): Draft<T> | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Draft<T>;
    if (typeof parsed?.savedAt !== "number" || parsed.data === undefined) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Remove the draft AND cancel any pending debounced write. */
export function clearDraft(key: string): void {
  const t = timers.get(key);
  if (t) clearTimeout(t);
  timers.delete(key);
  pending.delete(key);
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    /* best-effort */
  }
}

/** True when the draft is newer than the entity's last-known update. */
export function draftIsNewer(draft: Draft<unknown>, entityUpdatedAt: number | null): boolean {
  if (entityUpdatedAt === null) return true;
  return draft.savedAt > entityUpdatedAt;
}

/** "14:32" today, "Aug 30, 14:32" otherwise — for the banner copy. */
export function formatDraftTime(savedAt: number, now: number = Date.now()): string {
  const d = new Date(savedAt);
  const sameDay = d.toDateString() === new Date(now).toDateString();
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return time;
  return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${time}`;
}
