process.env.TZ = 'Asia/Shanghai';

import { describe, it, expect } from 'vitest';
import { formatDateKeyLocal, formatDateKeyUtc } from './utils';

describe('formatDateKeyLocal', () => {
  it('keys a UTC evening session to the next local day at UTC+8', () => {
    const d = new Date('2026-09-01T22:30:00Z');
    expect(d.getTimezoneOffset()).toBe(-480);
    expect(formatDateKeyLocal(d)).toBe('2026-09-02');
  });

  it('matches local calendar day for a noon session', () => {
    const d = new Date('2026-09-05T04:00:00Z'); // 12:00 local +8
    expect(formatDateKeyLocal(d)).toBe('2026-09-05');
  });
});

describe('formatDateKeyUtc', () => {
  it('returns the UTC ISO date part unchanged', () => {
    const d = new Date('2026-09-01T22:30:00Z');
    expect(formatDateKeyUtc(d)).toBe('2026-09-01');
  });
});
