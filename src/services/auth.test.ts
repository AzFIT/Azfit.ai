import { describe, it, expect, vi } from 'vitest';

describe('auth admin helpers', () => {
  it('isAdminQuickLoginAvailable returns true only in dev', async () => {
    vi.resetModules();
    vi.stubEnv('DEV', true);
    const { isAdminQuickLoginAvailable } = await import('./auth');
    expect(isAdminQuickLoginAvailable()).toBe(true);
    vi.unstubAllEnvs();
  });

  it('isAdminCredentials rejects when admin password is not configured', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_ADMIN_PASSWORD', '');
    const { isAdminCredentials } = await import('./auth');
    expect(isAdminCredentials('admin@azfit.ai', 'any')).toBe(false);
    vi.unstubAllEnvs();
  });

  it('isAdminCredentials accepts exact email and password', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_ADMIN_EMAIL', 'admin@example.com');
    vi.stubEnv('VITE_ADMIN_PASSWORD', 'secret123');
    const { isAdminCredentials } = await import('./auth');
    expect(isAdminCredentials('admin@example.com', 'secret123')).toBe(true);
    expect(isAdminCredentials('admin@example.com', 'wrong')).toBe(false);
    expect(isAdminCredentials('other@example.com', 'secret123')).toBe(false);
    vi.unstubAllEnvs();
  });
});
