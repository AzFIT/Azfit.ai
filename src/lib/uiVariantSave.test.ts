/* Phase 92c-fix Item 1 — UiVariantSaveController regressions.
   Root cause under test: the 92c disabled-until-read gate plus a SW
   controllerchange reload could silently drop/abort a legitimate save,
   leaving control, html attribute, and DB in disagreement. */

import { describe, expect, it } from 'vitest';
import { UiVariantSaveController } from '@/lib/uiVariantSave';

describe('UiVariantSaveController', () => {
  it('click before read resolves is queued (no premature save)', () => {
    const ctrl = new UiVariantSaveController('default');
    expect(ctrl.select('metal')).toBeNull(); // queued, not saved
    expect(ctrl.pending).toBe('metal');
    expect(ctrl.value).toBe('metal'); // optimistic
  });

  it('queued click persists EXACTLY ONCE when the read resolves', () => {
    const ctrl = new UiVariantSaveController('default');
    ctrl.select('metal');
    expect(ctrl.readResolved('default')).toBe('metal'); // the one save
    expect(ctrl.readResolved('default')).toBeNull(); // never a second
    expect(ctrl.loaded).toBe(true);
  });

  it('queued click persists once even when the DB already holds that value', () => {
    const ctrl = new UiVariantSaveController('default');
    ctrl.select('metal'); // queued while read in flight
    expect(ctrl.readResolved('metal')).toBe('metal'); // one (idempotent) save
    expect(ctrl.readResolved('metal')).toBeNull(); // never a second
    expect(ctrl.saveFailed()).toBe('metal'); // revert target = DB value
  });

  it('read adopts the DB value when nothing is queued', () => {
    const ctrl = new UiVariantSaveController('default');
    expect(ctrl.readResolved('metal')).toBeNull();
    expect(ctrl.value).toBe('metal');
  });

  it('null DB value = default', () => {
    const ctrl = new UiVariantSaveController('metal');
    ctrl.readResolved(null);
    expect(ctrl.value).toBe('default');
  });

  it('read failure unblocks the control without wiping the value', () => {
    const ctrl = new UiVariantSaveController('metal');
    ctrl.readFailed();
    expect(ctrl.loaded).toBe(true);
    expect(ctrl.value).toBe('metal');
  });

  it('select after read returns the variant to persist; failure reverts to pre-save', () => {
    const ctrl = new UiVariantSaveController('default');
    ctrl.readResolved('default');
    expect(ctrl.select('metal')).toBe('metal');
    expect(ctrl.value).toBe('metal');
    expect(ctrl.saveFailed()).toBe('default'); // control + attribute revert together
    expect(ctrl.value).toBe('default');
  });

  it('selecting the current value is a no-op (no save)', () => {
    const ctrl = new UiVariantSaveController('default');
    ctrl.readResolved('default');
    expect(ctrl.select('default')).toBeNull();
  });

  it('saveSucceeded clears the revert target', () => {
    const ctrl = new UiVariantSaveController('default');
    ctrl.readResolved('default');
    ctrl.select('metal');
    ctrl.saveSucceeded();
    expect(ctrl.saveFailed()).toBe('metal'); // nothing to revert — stay put
  });
});
