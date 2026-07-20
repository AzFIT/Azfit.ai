# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> Smoke: public pages >> login page loads
- Location: e2e\smoke.spec.ts:28:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: /Welcome Back/i })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('heading', { name: /Welcome Back/i })
    - waiting for" http://localhost:4173/login" navigation to finish...
    - navigated to "http://localhost:4173/login"

```

```yaml
- region "Notifications alt+T"
- navigation:
  - img "AzFIT"
  - link "Features":
    - /url: "#features"
  - link "How It Works":
    - /url: "#how-it-works"
  - link "Testimonials":
    - /url: "#testimonials"
  - link "Download":
    - /url: "#download"
  - button "View Demo"
  - button "Log In"
  - button "Sign Up"
- img "AzFIT AI"
- paragraph: Personal Training, Reimagined.
- heading "Your Fitness Data, Beautifully Visualized." [level=1]
- text: 🚀 Live Demo Available
- paragraph: Track workouts, monitor nutrition, and crush your goals with AzFIT — the intelligent training companion that turns your data into progress.
- button "Download AzFIT"
- button "View Dashboard Demo"
- img
- text: App Store — Coming Soon
- img
- text: Google Play — Coming Soon 0+ Active Athletes 0+ Workouts Logged 0+ Personal Records 4.9/5 App Store Rating
- paragraph: FEATURES
- heading "Everything You Need to Train Smarter" [level=2]
- paragraph: From workout logging to nutrition tracking, AzFIT gives you complete visibility into your fitness journey.
- heading "Visual Progress Tracking" [level=3]
- paragraph: See your fitness score, body composition, and performance trends with beautiful charts and circular progress indicators.
- heading "Smart Workout Logging" [level=3]
- paragraph: Log sets, reps, and weight with our spreadsheet-style interface. Track RPE, rest times, and exercise history effortlessly.
- heading "Nutrition Monitoring" [level=3]
- paragraph: Track macros, calories, and meal timing. Get insights into your protein, carbs, and fat intake to fuel your performance.
- paragraph: HOW IT WORKS
- heading "Three Steps to Better Training" [level=2]
- text: "01"
- heading "Log Your Data" [level=3]
- paragraph: Use our intuitive spreadsheet mode to quickly enter workouts, meals, and daily metrics. Autofill and smart suggestions save you time.
- text: "02"
- heading "Watch Your Progress" [level=3]
- paragraph: Your dashboard visualizes every rep, every meal, and every night's sleep. Circular progress rings and trend charts keep you motivated.
- text: "03"
- heading "Crush Your Goals" [level=3]
- paragraph: Achievement badges celebrate milestones. Your coach reviews your data and adjusts your program — all within the app.
- paragraph: TESTIMONIALS
- heading "Loved by Athletes Worldwide" [level=2]
- paragraph: "\"AzFIT transformed how I track my training. The spreadsheet mode is genius — I can log my entire workout in under 2 minutes, and the progress rings keep me honest about my sleep and steps.\""
- img "Alex Chen"
- paragraph: Alex Chen
- paragraph: Powerlifter, 3 years
- paragraph: "\"My coach uses the coach view to program my workouts and track my progress remotely. The achievement badges are surprisingly motivating — I'm chasing that 10,000 sets badge now!\""
- img "Sarah Kim"
- paragraph: Sarah Kim
- paragraph: CrossFit Athlete
- paragraph: "\"I've tried dozens of fitness apps. AzFIT is the first one that actually understands how serious lifters track data. The RPE logging, rest timer, and volume charts are exactly what I needed.\""
- img "Marcus Johnson"
- paragraph: Marcus Johnson
- paragraph: Bodybuilder, 5 years
- paragraph: Trusted by leading fitness brands
- text: Elite Fitness Academy CrossFit Central Iron Gym FitLife Pro PowerHouse Training Velocity Athletics
- paragraph: Pricing
- heading "Simple, Transparent Pricing" [level=2]
- paragraph: Start free, upgrade when you need more power
- heading "Free" [level=3]
- text: $0 forever
- paragraph: Perfect for individual athletes
- list:
  - listitem:
    - img
    - text: Workout logging & tracking
  - listitem:
    - img
    - text: Basic progress charts
  - listitem:
    - img
    - text: Community challenges
  - listitem:
    - img
    - text: Mobile app access
- button "Get Started"
- text: Most Popular
- heading "Pro" [level=3]
- text: $9.99 /month
- paragraph: For serious lifters
- list:
  - listitem:
    - img
    - text: Everything in Free
  - listitem:
    - img
    - text: AI Program Builder
  - listitem:
    - img
    - text: Advanced analytics
  - listitem:
    - img
    - text: Nutrition tracking
  - listitem:
    - img
    - text: Priority support
- button "Start Free Trial"
- heading "Coach" [level=3]
- text: $29.99 /month
- paragraph: For personal trainers
- list:
  - listitem:
    - img
    - text: Everything in Pro
  - listitem:
    - img
    - text: Unlimited clients
  - listitem:
    - img
    - text: Client management
  - listitem:
    - img
    - text: Custom branding
  - listitem:
    - img
    - text: API access
- button "Contact Sales"
- heading "Start Your Journey Today" [level=2]
- paragraph: Download AzFIT and join 10,000+ athletes who train smarter.
- button "Try AzFIT Free"
- img: Download on the App Store
- img: GET IT ON Google Play
- contentinfo:
  - img "AzFIT"
  - text: AzFIT
  - paragraph: Personal training, reimagined.
  - paragraph: © 2025 AzFIT
  - heading "Product" [level=4]
  - link "Features":
    - /url: "#"
  - link "Pricing":
    - /url: "#"
  - link "Changelog":
    - /url: "#"
  - link "Roadmap":
    - /url: "#"
  - heading "Resources" [level=4]
  - link "Blog":
    - /url: "#"
  - link "Exercise Library":
    - /url: "#"
  - link "Nutrition Guide":
    - /url: "#"
  - link "API":
    - /url: "#"
  - heading "Company" [level=4]
  - link "About":
    - /url: "#"
  - link "Careers":
    - /url: "#"
  - link "Privacy":
    - /url: "#"
  - link "Terms":
    - /url: "#"
  - link:
    - /url: "#"
  - link:
    - /url: "#"
  - link:
    - /url: "#"
  - link:
    - /url: "#"
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | /**
  4  |  * AzFIT smoke tests
  5  |  * These verify the app loads, login works, and the dashboard is not blank.
  6  |  * They run against the demo accounts on the live Supabase project.
  7  |  */
  8  | 
  9  | const DEMO_CLIENT = {
  10 |   email: 'client@azfit.demo',
  11 |   password: 'AzFitDemo2026!',
  12 | };
  13 | 
  14 | const DEMO_TRAINER = {
  15 |   email: 'trainer@azfit.demo',
  16 |   password: 'AzFitDemo2026!',
  17 | };
  18 | 
  19 | test.describe('Smoke: public pages', () => {
  20 |   test('home page loads with CTA buttons', async ({ page }) => {
  21 |     await page.goto('/');
  22 |     await expect(page).toHaveTitle(/AzFIT/i);
  23 |     await expect(page.getByRole('button', { name: /View Demo/i })).toBeVisible();
  24 |     await expect(page.getByRole('button', { name: /Log In/i })).toBeVisible();
  25 |     await expect(page.getByRole('button', { name: /Sign Up/i })).toBeVisible();
  26 |   });
  27 | 
  28 |   test('login page loads', async ({ page }) => {
  29 |     await page.goto('/login');
> 30 |     await expect(page.getByRole('heading', { name: /Welcome Back/i })).toBeVisible();
     |                                                                        ^ Error: expect(locator).toBeVisible() failed
  31 |     await expect(page.getByPlaceholder(/you@example.com/i)).toBeVisible();
  32 |   });
  33 | });
  34 | 
  35 | test.describe('Smoke: auth flow', () => {
  36 |   test('client logs in and sees dashboard content', async ({ page }) => {
  37 |     await page.goto('/login');
  38 |     await page.getByPlaceholder(/you@example.com/i).fill(DEMO_CLIENT.email);
  39 |     await page.getByPlaceholder(/Enter your password/i).fill(DEMO_CLIENT.password);
  40 |     await page.getByRole('button', { name: /Sign In/i }).click();
  41 | 
  42 |     // Wait for auth context + redirect to dashboard
  43 |     await page.waitForURL('**/dashboard', { timeout: 10000 });
  44 | 
  45 |     // The dashboard should render actual content (not a blank white screen)
  46 |     await expect(page.locator('body')).not.toBeEmpty();
  47 |     await expect(page.getByText(/No upcoming session|Next session|Dashboard/i).first()).toBeVisible({ timeout: 10000 });
  48 |   });
  49 | 
  50 |   test('trainer logs in and sees client list', async ({ page }) => {
  51 |     await page.goto('/login');
  52 |     await page.getByPlaceholder(/you@example.com/i).fill(DEMO_TRAINER.email);
  53 |     await page.getByPlaceholder(/Enter your password/i).fill(DEMO_TRAINER.password);
  54 |     await page.getByRole('button', { name: /Sign In/i }).click();
  55 | 
  56 |     await page.waitForURL('**/dashboard', { timeout: 10000 });
  57 | 
  58 |     // Trainer dashboard should show client-related content
  59 |     await expect(page.locator('body')).not.toBeEmpty();
  60 |     await expect(page.getByText(/Clients|client|Today.s Sessions|Dashboard/i).first()).toBeVisible({ timeout: 10000 });
  61 |   });
  62 | });
  63 | 
```