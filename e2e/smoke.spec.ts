import { test, expect } from '@playwright/test';

/**
 * AzFIT smoke tests
 * These verify the app loads, login works, and the dashboard is not blank.
 * They run against the demo accounts on the live Supabase project.
 */

const DEMO_CLIENT = {
  email: 'client@azfit.demo',
  password: 'AzFitDemo2026!',
};

const DEMO_TRAINER = {
  email: 'trainer@azfit.demo',
  password: 'AzFitDemo2026!',
};

test.describe('Smoke: public pages', () => {
  test('home page loads with CTA buttons', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/AzFIT/i);
    await expect(page.getByRole('button', { name: /View Demo/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Log In/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Sign Up/i })).toBeVisible();
  });

  test('login page loads', async ({ page }) => {
    await page.goto('/#/login');
    await expect(page.getByRole('heading', { name: /Welcome Back/i })).toBeVisible();
    await expect(page.getByPlaceholder(/you@example.com/i)).toBeVisible();
  });
});

test.describe('Smoke: auth flow', () => {
  test('client logs in and sees dashboard content', async ({ page }) => {
    await page.goto('/#/login');
    await page.getByPlaceholder(/you@example.com/i).fill(DEMO_CLIENT.email);
    await page.getByPlaceholder(/Enter your password/i).fill(DEMO_CLIENT.password);
    await page.getByRole('button', { name: /Sign In/i }).click();

    // Wait for auth context + redirect to dashboard
    await page.waitForURL('**/#/dashboard', { timeout: 10000 });

    // The dashboard should render actual content (not a blank white screen)
    await expect(page.locator('body')).not.toBeEmpty();
    await expect(page.getByText(/No upcoming session|Next session|Dashboard/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('trainer logs in and sees client list', async ({ page }) => {
    await page.goto('/#/login');
    await page.getByPlaceholder(/you@example.com/i).fill(DEMO_TRAINER.email);
    await page.getByPlaceholder(/Enter your password/i).fill(DEMO_TRAINER.password);
    await page.getByRole('button', { name: /Sign In/i }).click();

    await page.waitForURL('**/#/dashboard', { timeout: 10000 });

    // Trainer dashboard should show client-related content
    await expect(page.locator('body')).not.toBeEmpty();
    await expect(page.getByText(/Clients|client|Today.s Sessions|Dashboard/i).first()).toBeVisible({ timeout: 10000 });
  });
});
