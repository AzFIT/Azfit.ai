/**
 * Phase 92c-fix — ui_variant save controller (pure state machine).
 *
 * Root cause of the Item 1 real-account failure: the Phase 33A
 * auto-reload on SW controllerchange aborts in-flight page fetches, so
 * the toggle's profiles PATCH could be silently lost exactly when a new
 * service worker took over (the owner clicked seconds after the 92c
 * deploy). Two defenses (see uiVariant.ts / Settings.tsx):
 *   1. the write goes out with fetch keepalive — it survives navigation;
 *   2. this controller removes the disabled-until-read gate that could
 *      block (or race) a legitimate save: a click before the row read
 *      resolves is QUEUED and persisted exactly once when the read lands.
 *
 * The controller is deliberately framework-free so every transition is
 * unit-testable.
 */

export type UiVariant = 'default' | 'metal';

export class UiVariantSaveController {
  /** Row read has resolved at least once. */
  loaded = false;
  /** What the control shows — always in sync with the html attribute. */
  value: UiVariant;
  /** Revert target while a persist is in flight. */
  private beforeSave: UiVariant | null = null;
  /** Click queued until the first row read resolves. */
  pending: UiVariant | null = null;

  constructor(initial: UiVariant = 'default') {
    this.value = initial;
  }

  /**
   * Row read resolved. `db` is the stored value (null = default). When a
   * click was queued before the read, this returns that variant exactly
   * ONCE — the caller persists it (update lands exactly once, never also
   * as a second save). Otherwise returns null and adopts the DB value.
   */
  readResolved(db: UiVariant | null): UiVariant | null {
    this.loaded = true;
    if (this.pending) {
      const queued = this.pending;
      this.pending = null;
      this.beforeSave = db ?? 'default';
      this.value = queued;
      return queued;
    }
    this.value = db ?? 'default';
    return null;
  }

  /** Read failed/hung past its timeout: unblock the control, keep state. */
  readFailed(): void {
    this.loaded = true;
  }

  /**
   * User selected a variant. Returns the variant to persist immediately,
   * or null when the click was queued (pre-read) or was a no-op.
   */
  select(next: UiVariant): UiVariant | null {
    if (!this.loaded) {
      this.pending = next;
      this.value = next; // optimistic even while queued
      return null;
    }
    if (next === this.value) return null;
    this.beforeSave = this.value;
    this.value = next;
    return next;
  }

  /** Persist succeeded — nothing to revert anymore. */
  saveSucceeded(): void {
    this.beforeSave = null;
  }

  /** Persist failed → the value to revert BOTH control and attribute to. */
  saveFailed(): UiVariant {
    // beforeSave null (stray failure after success) → stay at the current
    // committed value; never invent 'default'.
    const revert = this.beforeSave ?? this.value;
    this.value = revert;
    this.beforeSave = null;
    this.pending = null;
    return revert;
  }
}
