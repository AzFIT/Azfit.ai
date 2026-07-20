# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> Smoke: auth flow >> client logs in and sees dashboard content
- Location: e2e\smoke.spec.ts:36:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.fill: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByPlaceholder(/you@example.com/i)

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - region "Notifications alt+T"
  - generic [ref=e3]:
    - navigation [ref=e4]:
      - img "AzFIT" [ref=e6]
      - generic [ref=e7]:
        - link "Features" [ref=e8] [cursor=pointer]:
          - /url: "#features"
        - link "How It Works" [ref=e9] [cursor=pointer]:
          - /url: "#how-it-works"
        - link "Testimonials" [ref=e10] [cursor=pointer]:
          - /url: "#testimonials"
        - link "Download" [ref=e11] [cursor=pointer]:
          - /url: "#download"
        - button "View Demo" [ref=e12] [cursor=pointer]
        - button "Log In" [ref=e13] [cursor=pointer]
        - button "Sign Up" [ref=e14] [cursor=pointer]
    - generic [ref=e15]:
      - generic [ref=e18]:
        - generic [ref=e21]:
          - generic:
            - generic "Strength":
              - img
            - generic "Activity":
              - img
            - generic "AI Coach":
              - img
            - generic "Health":
              - img
            - generic "Progress":
              - img
            - generic "Messages":
              - img
            - generic "Schedule":
              - img
            - generic "Analytics":
              - img
          - generic [ref=e22]:
            - img "AzFIT AI"
        - paragraph [ref=e23]: Personal Training, Reimagined.
        - heading "Your Fitness Data, Beautifully Visualized." [level=1] [ref=e24]
        - generic [ref=e25]:
          - generic [ref=e26]: 🚀
          - generic [ref=e27]: Live Demo Available
        - paragraph [ref=e28]: Track workouts, monitor nutrition, and crush your goals with AzFIT — the intelligent training companion that turns your data into progress.
        - generic [ref=e29]:
          - button "Download AzFIT" [ref=e30] [cursor=pointer]
          - button "View Dashboard Demo" [ref=e31] [cursor=pointer]
        - generic [ref=e32]:
          - generic [ref=e33]:
            - img [ref=e34]
            - generic [ref=e36]: App Store — Coming Soon
          - generic [ref=e37]:
            - img [ref=e38]
            - generic [ref=e40]: Google Play — Coming Soon
      - img [ref=e42]
    - generic [ref=e45]:
      - generic [ref=e46]:
        - generic [ref=e48]: 0+
        - generic [ref=e49]: Active Athletes
      - generic [ref=e51]:
        - generic [ref=e53]: 0+
        - generic [ref=e54]: Workouts Logged
      - generic [ref=e56]:
        - generic [ref=e58]: 0+
        - generic [ref=e59]: Personal Records
      - generic [ref=e61]:
        - generic [ref=e62]: 4.9/5
        - generic [ref=e63]: App Store Rating
    - generic [ref=e65]:
      - generic [ref=e66]:
        - paragraph [ref=e67]: FEATURES
        - heading "Everything You Need to Train Smarter" [level=2] [ref=e68]
        - paragraph [ref=e69]: From workout logging to nutrition tracking, AzFIT gives you complete visibility into your fitness journey.
      - generic [ref=e70]:
        - generic [ref=e72]:
          - img [ref=e74]
          - heading "Visual Progress Tracking" [level=3] [ref=e77]
          - paragraph [ref=e78]: See your fitness score, body composition, and performance trends with beautiful charts and circular progress indicators.
        - generic [ref=e80]:
          - img [ref=e82]
          - heading "Smart Workout Logging" [level=3] [ref=e88]
          - paragraph [ref=e89]: Log sets, reps, and weight with our spreadsheet-style interface. Track RPE, rest times, and exercise history effortlessly.
        - generic [ref=e91]:
          - img [ref=e93]
          - heading "Nutrition Monitoring" [level=3] [ref=e96]
          - paragraph [ref=e97]: Track macros, calories, and meal timing. Get insights into your protein, carbs, and fat intake to fuel your performance.
    - generic [ref=e99]:
      - generic [ref=e100]:
        - paragraph [ref=e101]: HOW IT WORKS
        - heading "Three Steps to Better Training" [level=2] [ref=e102]
      - generic [ref=e105]:
        - generic [ref=e106]:
          - generic: "01"
          - heading "Log Your Data" [level=3] [ref=e107]
          - paragraph [ref=e108]: Use our intuitive spreadsheet mode to quickly enter workouts, meals, and daily metrics. Autofill and smart suggestions save you time.
        - generic [ref=e109]:
          - generic: "02"
          - heading "Watch Your Progress" [level=3] [ref=e110]
          - paragraph [ref=e111]: Your dashboard visualizes every rep, every meal, and every night's sleep. Circular progress rings and trend charts keep you motivated.
        - generic [ref=e112]:
          - generic: "03"
          - heading "Crush Your Goals" [level=3] [ref=e113]
          - paragraph [ref=e114]: Achievement badges celebrate milestones. Your coach reviews your data and adjusts your program — all within the app.
    - generic [ref=e116]:
      - generic [ref=e117]:
        - paragraph [ref=e118]: TESTIMONIALS
        - heading "Loved by Athletes Worldwide" [level=2] [ref=e119]
      - generic [ref=e120]:
        - generic [ref=e122]:
          - img [ref=e123]
          - paragraph [ref=e126]: "\"AzFIT transformed how I track my training. The spreadsheet mode is genius — I can log my entire workout in under 2 minutes, and the progress rings keep me honest about my sleep and steps.\""
          - generic [ref=e127]:
            - img "Alex Chen" [ref=e128]
            - generic [ref=e129]:
              - paragraph [ref=e130]: Alex Chen
              - paragraph [ref=e131]: Powerlifter, 3 years
          - generic [ref=e132]:
            - img [ref=e133]
            - img [ref=e135]
            - img [ref=e137]
            - img [ref=e139]
            - img [ref=e141]
        - generic [ref=e144]:
          - img [ref=e145]
          - paragraph [ref=e148]: "\"My coach uses the coach view to program my workouts and track my progress remotely. The achievement badges are surprisingly motivating — I'm chasing that 10,000 sets badge now!\""
          - generic [ref=e149]:
            - img "Sarah Kim" [ref=e150]
            - generic [ref=e151]:
              - paragraph [ref=e152]: Sarah Kim
              - paragraph [ref=e153]: CrossFit Athlete
          - generic [ref=e154]:
            - img [ref=e155]
            - img [ref=e157]
            - img [ref=e159]
            - img [ref=e161]
            - img [ref=e163]
        - generic [ref=e166]:
          - img [ref=e167]
          - paragraph [ref=e170]: "\"I've tried dozens of fitness apps. AzFIT is the first one that actually understands how serious lifters track data. The RPE logging, rest timer, and volume charts are exactly what I needed.\""
          - generic [ref=e171]:
            - img "Marcus Johnson" [ref=e172]
            - generic [ref=e173]:
              - paragraph [ref=e174]: Marcus Johnson
              - paragraph [ref=e175]: Bodybuilder, 5 years
          - generic [ref=e176]:
            - img [ref=e177]
            - img [ref=e179]
            - img [ref=e181]
            - img [ref=e183]
            - img [ref=e185]
    - generic [ref=e188]:
      - paragraph [ref=e190]: Trusted by leading fitness brands
      - generic [ref=e191]:
        - generic [ref=e192]: Elite Fitness Academy
        - generic [ref=e193]: CrossFit Central
        - generic [ref=e194]: Iron Gym
        - generic [ref=e195]: FitLife Pro
        - generic [ref=e196]: PowerHouse Training
        - generic [ref=e197]: Velocity Athletics
    - generic [ref=e199]:
      - generic [ref=e200]:
        - paragraph [ref=e201]: Pricing
        - heading "Simple, Transparent Pricing" [level=2] [ref=e202]
        - paragraph [ref=e203]: Start free, upgrade when you need more power
      - generic [ref=e204]:
        - generic [ref=e206]:
          - heading "Free" [level=3] [ref=e207]
          - generic [ref=e208]:
            - generic [ref=e209]: $0
            - generic [ref=e210]: forever
          - paragraph [ref=e211]: Perfect for individual athletes
          - list [ref=e212]:
            - listitem [ref=e213]:
              - img [ref=e214]
              - text: Workout logging & tracking
            - listitem [ref=e216]:
              - img [ref=e217]
              - text: Basic progress charts
            - listitem [ref=e219]:
              - img [ref=e220]
              - text: Community challenges
            - listitem [ref=e222]:
              - img [ref=e223]
              - text: Mobile app access
          - button "Get Started" [ref=e225] [cursor=pointer]
        - generic [ref=e227]:
          - generic [ref=e228]: Most Popular
          - heading "Pro" [level=3] [ref=e229]
          - generic [ref=e230]:
            - generic [ref=e231]: $9.99
            - generic [ref=e232]: /month
          - paragraph [ref=e233]: For serious lifters
          - list [ref=e234]:
            - listitem [ref=e235]:
              - img [ref=e236]
              - text: Everything in Free
            - listitem [ref=e238]:
              - img [ref=e239]
              - text: AI Program Builder
            - listitem [ref=e241]:
              - img [ref=e242]
              - text: Advanced analytics
            - listitem [ref=e244]:
              - img [ref=e245]
              - text: Nutrition tracking
            - listitem [ref=e247]:
              - img [ref=e248]
              - text: Priority support
          - button "Start Free Trial" [ref=e250] [cursor=pointer]
        - generic [ref=e252]:
          - heading "Coach" [level=3] [ref=e253]
          - generic [ref=e254]:
            - generic [ref=e255]: $29.99
            - generic [ref=e256]: /month
          - paragraph [ref=e257]: For personal trainers
          - list [ref=e258]:
            - listitem [ref=e259]:
              - img [ref=e260]
              - text: Everything in Pro
            - listitem [ref=e262]:
              - img [ref=e263]
              - text: Unlimited clients
            - listitem [ref=e265]:
              - img [ref=e266]
              - text: Client management
            - listitem [ref=e268]:
              - img [ref=e269]
              - text: Custom branding
            - listitem [ref=e271]:
              - img [ref=e272]
              - text: API access
          - button "Contact Sales" [ref=e274] [cursor=pointer]
    - generic [ref=e278]:
      - heading "Start Your Journey Today" [level=2] [ref=e279]
      - paragraph [ref=e280]: Download AzFIT and join 10,000+ athletes who train smarter.
      - button "Try AzFIT Free" [ref=e281] [cursor=pointer]
      - generic [ref=e282]:
        - img [ref=e283] [cursor=pointer]:
          - generic [ref=e285]: Download on the
          - generic [ref=e286]: App Store
        - img [ref=e288] [cursor=pointer]:
          - generic [ref=e290]: GET IT ON
          - generic [ref=e291]: Google Play
    - contentinfo [ref=e297]:
      - generic [ref=e298]:
        - generic [ref=e299]:
          - generic [ref=e300]:
            - img "AzFIT" [ref=e301]
            - generic [ref=e302]: AzFIT
          - paragraph [ref=e303]: Personal training, reimagined.
          - paragraph [ref=e304]: © 2025 AzFIT
        - generic [ref=e305]:
          - heading "Product" [level=4] [ref=e306]
          - link "Features" [ref=e307] [cursor=pointer]:
            - /url: "#"
          - link "Pricing" [ref=e308] [cursor=pointer]:
            - /url: "#"
          - link "Changelog" [ref=e309] [cursor=pointer]:
            - /url: "#"
          - link "Roadmap" [ref=e310] [cursor=pointer]:
            - /url: "#"
        - generic [ref=e311]:
          - heading "Resources" [level=4] [ref=e312]
          - link "Blog" [ref=e313] [cursor=pointer]:
            - /url: "#"
          - link "Exercise Library" [ref=e314] [cursor=pointer]:
            - /url: "#"
          - link "Nutrition Guide" [ref=e315] [cursor=pointer]:
            - /url: "#"
          - link "API" [ref=e316] [cursor=pointer]:
            - /url: "#"
        - generic [ref=e317]:
          - heading "Company" [level=4] [ref=e318]
          - link "About" [ref=e319] [cursor=pointer]:
            - /url: "#"
          - link "Careers" [ref=e320] [cursor=pointer]:
            - /url: "#"
          - link "Privacy" [ref=e321] [cursor=pointer]:
            - /url: "#"
          - link "Terms" [ref=e322] [cursor=pointer]:
            - /url: "#"
      - generic [ref=e323]:
        - link [ref=e324] [cursor=pointer]:
          - /url: "#"
          - img [ref=e325]
        - link [ref=e328] [cursor=pointer]:
          - /url: "#"
          - img [ref=e329]
        - link [ref=e331] [cursor=pointer]:
          - /url: "#"
          - img [ref=e332]
        - link [ref=e335] [cursor=pointer]:
          - /url: "#"
          - img [ref=e336]
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
  30 |     await expect(page.getByRole('heading', { name: /Welcome Back/i })).toBeVisible();
  31 |     await expect(page.getByPlaceholder(/you@example.com/i)).toBeVisible();
  32 |   });
  33 | });
  34 | 
  35 | test.describe('Smoke: auth flow', () => {
  36 |   test('client logs in and sees dashboard content', async ({ page }) => {
  37 |     await page.goto('/login');
> 38 |     await page.getByPlaceholder(/you@example.com/i).fill(DEMO_CLIENT.email);
     |                                                     ^ Error: locator.fill: Test timeout of 30000ms exceeded.
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