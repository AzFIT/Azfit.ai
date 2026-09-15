/* Phase 95 — app-fired achievement push: pure diff logic. */

import { describe, expect, it } from 'vitest';
import { achievementRefKey, newUnlocks } from '@/lib/achievementNotify';
import type { Achievement } from '@/lib/achievements';

function ach(id: string, unlocked: boolean): Achievement {
  return {
    id,
    title: `Title ${id}`,
    description: `Desc ${id}`,
    requirement: 'req',
    unlocked,
    progress: unlocked ? null : '1 of 7 days',
    evidence: unlocked ? 'evidence' : null,
  };
}

describe('newUnlocks', () => {
  it('null prev (first observation) → nothing is new, even with unlocks', () => {
    expect(newUnlocks(null, [ach('a', true), ach('b', true)])).toEqual([]);
  });

  it('empty prev → every unlocked achievement is new', () => {
    expect(newUnlocks(new Set(), [ach('a', true), ach('b', false)]).map((a) => a.id)).toEqual(['a']);
  });

  it('already-unlocked ids never re-notify', () => {
    const prev = new Set(['a', 'b']);
    expect(newUnlocks(prev, [ach('a', true), ach('b', true)])).toEqual([]);
  });

  it('a newly unlocked id is returned once', () => {
    const prev = new Set(['a']);
    const fresh = newUnlocks(prev, [ach('a', true), ach('c', true)]);
    expect(fresh.map((x) => x.id)).toEqual(['c']);
    // Second pass with the updated set → nothing new.
    expect(newUnlocks(new Set(['a', 'c']), [ach('a', true), ach('c', true)])).toEqual([]);
  });

  it('locked achievements are never returned, even when unseen', () => {
    expect(newUnlocks(new Set(), [ach('x', false)])).toEqual([]);
  });
});

describe('achievementRefKey', () => {
  it('is namespaced and stable (idempotency log ref_key)', () => {
    expect(achievementRefKey('first-steps')).toBe('achievement:first-steps');
  });
});
