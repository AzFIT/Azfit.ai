# AzFIT Full-App UX/UI + Logic Audit (Phase 32A)

**Date:** 2026-07-29 · **Target:** https://azfit.github.io/Azfit.ai/ (deploy of main @ 2236085)
**Method:** Kimi WebBridge (user's Chrome, both demo roles) + Playwright headless (cross-checks) + read-only SQL + code inspection. No code/DB changes were made.
**Accounts audited:** trainer@azfit.demo, client@azfit.demo.

Evidence screenshots (`.temp/audit/shots/`): `notifications-crash.jpg`, `settings-fake-profile.jpg`, `analytics-mock.jpg`, `coach-statscards.jpg`, `clients-as-client-role.jpg`, `client-dashboard-mock.jpg`.

## Route map & audit coverage

| Route | Roles | Audited | Notes |
|---|---|---|---|
| `/` (landing) | public | ✅ | Healthy |
| `/login` `/signup` `/forgot-password` `/reset-password` | public | ✅ | Healthy |
| `/demo` | public | ✅ | Demo mode renders |
| `/invite/:trainerId` | public | ✅ | Invalid-id friendly state verified |
| `/dashboard` | trainer + client | ✅ | 28C widgets live; mock findings #4/#5 |
| `/analytics` | both | ✅ | Mock findings #4 |
| `/coach` | trainer | ✅ | StatsCards mock #3 |
| `/coach-ai` | trainer | ✅ | Renders chat UI |
| `/sheets` | both | ✅ | Honest empty state |
| `/settings` | both | ✅ | Fake profile #2 |
| `/onboarding` | both | ✅ | Renders |
| `/bioprint` | both | ✅ | Trainer dead-end #14 |
| `/nutrition` | both | ✅ | Water finding #10 |
| `/ai-program-builder` | trainer | ✅ | Dead buttons #9; client correctly redirected |
| `/schedule` | both | ✅ | Calendar renders |
| `/progress-photos` | both | ✅ | Renders |
| `/check-ins` | both | ✅ | Forms + habits render |
| `/export` | both | ✅ | Renders |
| `/timer` | both | ✅ | Renders |
| `/notifications` | both | ✅ | **CRASHES for returning visitors — Finding #1** |
| `/clients` | trainer | ✅ | Client-role gate missing — Finding #8 |
| `/client/:clientId` | trainer | ✅ | Profile + tabs render |
| `/leaderboard` | both | ✅ | Renders (mock leaderboard data — see #5 note) |
| `/warmup` | both | ✅ | Renders |
| `/deload` | both | ✅ | Renders |
| `/messages` | both | ✅ | Timestamp nit #13 |
| `/exercises` | both | ✅ | 458 live rows, search works |
| `/form-checks` | both | ✅ | Renders |
| `/library` | trainer | ✅ | 48 templates; client correctly redirected |

Mobile (390px via CDP device override): zero horizontal overflow on dashboard, clients, library, exercises, ai-program-builder, nutrition, schedule.

## Findings

| # | Page | Element | Issue | Severity | Recommendation |
|---|---|---|---|---|---|
| 1 | `/notifications` | whole page | **Crash for every returning visitor.** `saveSettings` JSON-stringifies lucide icon components (`{displayName:'Dumbbell'}`); on the next visit `loadSettings` returns those plain objects and `<setting.icon>` is an invalid React element → render throws → root ErrorBoundary. Boundary persists across client-side navigation until a full reload. Confirmed in the user's Chrome (stale localStorage); fresh profiles don't crash — first visit writes the poison. | **critical** | `loadSettings` must merge saved `id/enabled/time` onto `DEFAULT_SETTINGS` icons by id (never persist components); clear/repair existing bad entries. |
| 2 | `/settings` | profile card | Hardcoded fake identity for every user: "Alex Chen, Premium Member, alex.chen@email.com, +1 (555) 123-4567, Mar 15 1997" (Settings.tsx:416-483). | **major** | Wire to auth/profile data; honest empty fields otherwise. |
| 3 | `/coach` | StatsCards | 100% hardcoded stats: 24 clients / 8 programs / 42 sessions / 78% progress (StatsCards.tsx:4-33). | **major** | Compute from real queries or remove the cards. |
| 4 | `/analytics` | stat cards + weight chart | Hardcoded "84,200 kg Total Lifted", "42 This Month", and a Jan-2025 mock weight series rendered as the chart (Analytics.tsx:55,112,301). | **major** | Wire to real aggregates; hide chart without data. |
| 5 | `/dashboard` (trainer) | counts + AI insights | `MOCK_ACTIVE_CLIENTS` count 24 renders as the active-clients card; `MOCK_AI_INSIGHTS` renders fabricated insights incl. a fake client "Alex Rivera" with invented Apple-Health HRV claims (TrainerDashboard.tsx:90-96, 766-908). Leaderboard also renders from mock data. | **major** | Replace with real queries (28C Follow-Ups already computes real attention data — reuse). |
| 6 | `/dashboard` (client) | workout + compliance | `MOCK_WORKOUT` ("TODO: wire to Supabase") renders as today's workout; `WEEKLY_COMPLIANCE` mock bars; "Sat" hardcoded as today (ClientDashboard.tsx:85-94, 192, 933). | **major** | Wire to real sessions/logs; honest empty state. |
| 7 | Intake wizard | nutrition targets | `ClientIntakeWizard.tsx` still calls the **deprecated** flat-kcal pipeline (`GOAL_ADJUSTMENTS` −500/−750/+250, `calculateGoalCalories`, `calculateMacroBreakdown` pct-split + 1.6 g/kg floor) while `TdeeCalculator` uses the 28E pipeline (pct goals ±1000 cap, BMR×1.2/TDEE+1000 guardrails, D6 lean-mass macros). Same client gets different numbers depending on entry point. | **major** | Migrate intake wizard to `calculateGoalCaloriesPct` + `applySafetyGuardrails` + `calculateMacroTargets`. |
| 8 | `/clients` | route gate | No `requireTrainer`: a client sees the full trainer Client List UI — Add New Client, Invite link (would mint an invite with the client's own id as trainer), Edit/Archive buttons, filter chips. List is empty via RLS, but the UI is wrong and actions error out. (App.tsx: `/clients` is plain `ProtectedRoute`; `/coach`, `/coach-ai`, `/ai-program-builder`, `/library` are gated — inconsistent.) | **major** | Add `requireTrainer` to `/clients`; hide trainer actions by role. |
| 9 | Wizard Step 7 | action buttons | "Preview Workout", "Analytics", "Export PDF" (AIProgramBuilder.tsx:1305) and "Recommend Adjustments" (1526) have **no onClick** — dead buttons. | minor | Wire them or remove them. |
| 10 | `/nutrition` | water target | Hardcoded `DEFAULT_WATER = 2500` for every user (Nutrition.tsx:107,131,140) — the 28E computed `waterMl` (35 ml/kg + 500 ml/training day) is shown in the calculator but never used for the tracker target. | minor | Use the computed waterMl when targets came from the calculator; keep 2500 as fallback. |
| 11 | `/notifications` | theme | Page bypasses the design system: hardcoded `bg-slate-950`, `slate-800/900`, `text-white` instead of CSS vars (Notifications.tsx:85-174) — clashes with the dark-glass theme and light mode. | minor | Convert to theme tokens. |
| 12 | Programs (legacy data) | workouts/exercises | Pre-29A/29B rows violate current rules in production: `Untitled Program` has 4 cloned days (identical 6 exercises, incl. squats on "Push" days) and 42 duplicated exercise rows on its PPL days (repeated saves); `GBC Phase 1 ` days have 0/2/6 exercises (<8). New programs hold (Upper/Lower — Build Muscle: 8/8/8, focus-matched). | minor (data) | Remediate per client: Load Saved → per-day edit/re-save; consider a one-off duplicate-row cleanup script. |
| 13 | `/messages` | conversation list | Raw ISO timestamp rendered (`2026-07-22T03:32:43.183564+00:00`) instead of a formatted date. | polish | Format with the shared date helper. |
| 14 | `/bioprint` (trainer) | whole page | Trainers get a client-centric dead end: "Your trainer needs to add you as a client first" (0 actionable elements) — no guidance to client bio tabs. | polish | Trainer-specific landing (client picker → client bio tab). |
| 15 | App shell | ErrorBoundary | The root boundary does not reset on client-side navigation: one route crash poisons the SPA for every subsequent route until a full reload (observed live: /notifications crash cascaded to all later routes). | minor | Reset boundary state on route change. |
| 16 | App shell (PWA) | service worker | After a deploy, open clients with a stale SW cache crash on uncached lazy chunks (observed during audit) — old hashed chunks 404. | minor | SW update prompt / skip-waiting + reload strategy. |

## Formula consistency verdicts (Part 2, Step 3)

| Formula | Verdict | Evidence |
|---|---|---|
| Mifflin-St Jeor BMR | ✅ consistent | Shared `calculateBMR`; cross-checked Alex: 10×80 + 6.25×178 − 5×30 + 5 = 1768 |
| Activity multipliers | ✅ consistent | Shared `ACTIVITY_LEVELS` (moderate 1.55 → TDEE 2740 for Alex) |
| Goal adjustments (pct, lean_gain +5%, ±1000 cap) | ⚠️ inconsistent | `TdeeCalculator` uses `calculateGoalCaloriesPct` ✅ (5 goals verified live incl. Lean Gain +5%); `ClientIntakeWizard` uses deprecated flat −500/−750/+250 ❌ |
| Guardrails (BMR×1.2 floor / TDEE+1000 ceiling, never silent) | ⚠️ inconsistent | Present with amber banner in `TdeeCalculator` ✅; absent in intake wizard ❌ |
| D6 macro ladder (protein 2.0/2.2/1.8/1.6 g/kg LBM, kidney cap, 35% kcal cap, fat floors, carbs remainder) | ⚠️ inconsistent | `TdeeCalculator` uses `calculateMacroTargets` ✅; intake wizard uses old pct+1.6 g/kg split ❌ |
| Fiber minimums (25f/38m) | ✅ consistent | Lib-tested; shown in calculator result panel (verified live) |
| Water (35 ml/kg + 500 ml/training day, /50 ml) | ❌ inconsistent | Computed in calculator ✅; tracker target is hardcoded 2500 ml ❌ |
| Stored targets sanity (Alex) | ℹ️ note | Stored 2740/206/240/107 (pre-28E values) vs current pipeline 2740/128/418/62 — stored targets are user data and only update on Apply; not a component bug |

## Program logic verdicts (Part 2, Step 4)

| Rule | Verdict | Evidence |
|---|---|---|
| Split focus matching / no cloned days | ✅ holds for new programs | 29A unit tests + live SQL on `Upper/Lower — Build Muscle` (distinct focus-matched days). ❌ violated in legacy rows (`Untitled Program` cloned days; Push days contain squats) |
| Minimum 8 exercises/day | ✅ holds for new programs | 29B top-up + tests; live 8/8/8. ❌ violated in legacy rows (0/2/6) |
| Safety flags per limitations; swaps preserve sets | ✅ holds | 28D verified live (banner, swap preserving sets 3→3, notes jsonb `isSubstituted`) |
| Superset badges from saved data | ✅ holds | 30C verified live (badges on all days; `supersetGroup` in notes jsonb) |
| Progression rules render from saved data | ✅ holds | 30D verified live (rules persisted, week-4 deload note) |
| Phase names/dates on program cards | ✅ holds | 26E phase_name + 30B phases jsonb round-trip verified |

## Top-10 prioritized fixes

| # | Fix | Severity | Suggested phase |
|---|---|---|---|
| 1 | NotificationsPage localStorage icon corruption → crash for returning visitors (merge-by-id onto default icons; repair bad entries) | critical | 33A hotfix |
| 2 | De-mock wave 1: Settings fake profile, Coach StatsCards, TrainerDashboard mock counts/insights | major | 33B |
| 3 | De-mock wave 2: ClientDashboard MOCK_WORKOUT/compliance/Sat-today, Analytics mock stats + chart | major | 33B |
| 4 | ClientIntakeWizard → shared 28E nutrition pipeline (pct goals, guardrails, D6) | major | 33C |
| 5 | `requireTrainer` on `/clients` (+ hide trainer actions from clients; guard Invite-link) | major | 33C |
| 6 | Wizard Step 7 dead buttons (wire or remove) + "Recommend Adjustments" | minor | 33D |
| 7 | Nutrition water target from computed waterMl (fallback 2500) | minor | 33D |
| 8 | ErrorBoundary resets on route change + SW update prompt for stale clients | minor | 33D |
| 9 | NotificationsPage theme tokens + Messages timestamp formatting | polish | 33E |
| 10 | Legacy program data remediation (re-save via Load Saved; duplicate-row cleanup script) | polish (data) | 33E |

## Tool notes

- WebBridge (user's Chrome) drove all live page audits, interactive checks (Add New Client modal ✅, Invite-link toast ✅, TDEE calculator with Lean Gain/Fiber/Water ✅, exercise picker ✅), mobile overrides, and screenshots.
- Playwright headless cross-checked the `/notifications` crash (does **not** reproduce with fresh localStorage → root cause is stale saved settings, not the deploy) and local dev (`/notifications` fine on dev).
- The mid-audit cascade of "Something went wrong" on many routes was the ErrorBoundary persistence (Finding #15) after hitting Finding #1 — routes re-audited individually, all healthy except #1.
