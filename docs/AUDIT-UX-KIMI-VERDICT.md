# AzFIT Audit — Kimi Independent Verdict (Phase 32A cross-check)

**Date:** 2026-07-31 · **Target:** https://azfit.github.io/Azfit.ai/ (deploy of main @ 2236085)
**Method:** Kimi desktop agent, independent pass per `docs/PROMPT-FOR-KIMI-AUDIT.md`. WebBridge was unavailable (owner's browser closed — "No current window"), so runtime checks used Playwright headless against the **live** site; code-level checks used direct source inspection; prior phase-verification history (28D–31B, Jonny regeneration) used as evidence where noted. No code/DB changes; the only localStorage write was removing the test poison after reproduction (trainer account left clean).
**Accounts:** trainer@azfit.demo, client@azfit.demo.

## Route map (trainer role, first visit each, full reloads between)

32/32 routes visited — **all OK**: no crash, no blank, no stuck spinner. (`/`, `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/demo`, `/invite/invalid-id-test`, `/dashboard`, `/analytics`, `/coach`, `/coach-ai`, `/sheets`, `/settings`, `/onboarding`, `/bioprint`, `/nutrition`, `/ai-program-builder`, `/schedule`, `/progress-photos`, `/check-ins`, `/export`, `/timer`, `/notifications`, `/clients`, `/client/f02198e5…`, `/leaderboard`, `/warmup`, `/deload`, `/messages`, `/exercises`, `/form-checks`, `/library`.)

`/notifications` is OK on **first** visit — consistent with the poison model (crash is on the second visit; see verdict #1).

## My findings (formed before reading AUDIT-UX.md)

| # | Page | Element | Issue | Severity | Evidence/tool |
|---|---|---|---|---|---|
| K1 | `/notifications` | whole page | First visit writes `azfit_notification_settings` with `"icon":{"displayName":"Dumbbell"}` junk objects; reload crashes into ErrorBoundary; client-side nav does NOT clear it | critical | Playwright live repro (visit1 ok → poison captured → reload → "Something went wrong" → nav to /dashboard still crashed) + source (Notifications.tsx:30–37, 128) |
| K2 | `/settings` | profile card | Hardcoded "Alex Chen / Premium Member / alex.chen@email.com" for every user | major | Source Settings.tsx:446–452; also visible in owner's screenshot 2026-07-29 |
| K3 | `/coach` `/dashboard` `/analytics` `/leaderboard` | stats/insights | Mock data rendered as real: coach/data.ts "All mock data", MOCK_ACTIVE_CLIENTS/AI_INSIGHTS/REVENUE (TrainerDashboard.tsx:90–129), MOCK_WORKOUT/MOCK_COACH (ClientDashboard.tsx:85–105), Jan-2025 weight series (Analytics.tsx:56–67), MOCK_LEADERS (Leaderboard.tsx:11) | major | Source inspection (all files) |
| K4 | Intake wizard | nutrition math | Uses deprecated flat-kcal pipeline (`GOAL_ADJUSTMENTS`, `calculateGoalCalories` — both marked @deprecated in tdee.ts:106–120) while TdeeCalculator uses the 28E pipeline | major | Source ClientIntakeWizard.tsx:21–24, 169 |
| K5 | `/clients` | route gate | Client role sees the full trainer client-management UI (Add New Client / Invite link / Edit / Archive / filter chips); list empty via RLS | major | Playwright live as client@azfit.demo (page text captured) + App.tsx:269–274 plain `ProtectedRoute` (no requireTrainer); `/coach` correctly redirects client → /dashboard |
| K6 | Wizard Step 7 | buttons | "Preview Workout" / "Analytics" / "Export PDF" mapped with no onClick (AIProgramBuilder.tsx:1305); "Recommend Adjustments" no onClick (1526) | minor | Source inspection |
| K7 | `/messages` | conversation list | Raw ISO timestamp `2026-07-22T03:32:43.18…` rendered | polish | Playwright live page text (route sweep) |
| K8 | `/bioprint` (trainer) | whole page | Trainer sees client-centric dead end "Your trainer needs to add you as a client first" | polish | Playwright live page text (route sweep) |
| K9 | `/nutrition` | water target | `DEFAULT_WATER = 2500` hardcoded, used for seeded/db targets (Nutrition.tsx:107, 131, 140, 149) | minor | Source inspection |
| K10 | `/notifications` | theme | 7 hardcoded `bg-slate-950/slate-800/slate-900` occurrences bypassing theme tokens | minor | Source grep |

## Verdict table — Kimi Code's 16 findings

| KC # | Verdict | My evidence |
|---|---|---|
| 1 (notif crash, critical) | **AGREE** | Reproduced exactly: poison shape `{displayName:'Dumbbell'}` captured byte-for-byte as described; reload crash; cascade. Source mechanism confirmed (saveSettings serializes components; loadSettings returns saved as-is) |
| 2 (Settings fake profile) | **AGREE** | Settings.tsx:446–452 hardcoded; matches owner screenshot |
| 3 (Coach StatsCards) | **AGREE** | coach/data.ts:1 "All mock data for the Coach dashboard" |
| 4 (Analytics mock) | **AGREE** | Analytics.tsx:56–67 hardcoded Jan-2025 series |
| 5 (TrainerDashboard mocks + leaderboard) | **AGREE** | MOCK_ACTIVE_CLIENTS/AI_INSIGHTS/REVENUE at TrainerDashboard.tsx:90–129; MOCK_LEADERS at Leaderboard.tsx:11 |
| 6 (ClientDashboard mock) | **AGREE** | MOCK_WORKOUT/MOCK_COACH at ClientDashboard.tsx:85–105; live client dashboard showed mock "12-day streak / Coach Marc" |
| 7 (intake wizard deprecated pipeline) | **AGREE** | ClientIntakeWizard.tsx:21–24 imports @deprecated symbols; TdeeCalculator verified on 28E pipeline in phase 28E verification |
| 8 (/clients gate missing) | **AGREE** | Code + live client-role repro (full trainer UI visible) |
| 9 (Step 7 dead buttons) | **AGREE** | AIProgramBuilder.tsx:1305 + 1526, no onClick on either |
| 10 (water 2500 hardcoded) | **AGREE** | Nutrition.tsx:107/131/140/149 |
| 11 (Notifications theme) | **AGREE** | 7 slate hardcodes in Notifications.tsx |
| 12 (legacy program data violates rules; new programs hold) | **AGREE** | Personal verification history: Jonny's pre-fix programs had cloned/under-8 days (10 archived by me); regenerated program verified 4 days × 8, focus-matched, zero overlap (29A/29B verifications) |
| 13 (Messages ISO timestamp) | **AGREE** | My own route sweep captured `2026-07-22T03:32:43.18` |
| 14 (bioprint trainer dead-end) | **AGREE** | Route sweep as trainer captured the exact dead-end text |
| 15 (ErrorBoundary no reset) | **AGREE** | Reproduced: after the /notifications crash, client-side nav to /dashboard stayed crashed; only full reload clears. Source: single static Sentry.ErrorBoundary (App.tsx:116), no resetKeys. Extra evidence: the tripped boundary even blocked a subsequent logout→login flow inside the SPA |
| 16 (SW stale-cache chunk 404s) | **CANNOT-REPRODUCE (environment)** | My headless contexts are always fresh profiles, so stale-SW state can't occur; KC observed it in the owner's Chrome. Mechanism is a standard PWA risk; fix still recommended |

## Formula verdicts

AGREE with all 8 rows of KC's table. Independently confirmed: shared Mifflin-St Jeor + activity multipliers (verified in 28E), TdeeCalculator on the 28E pct/guardrail/D6 pipeline, intake wizard on the deprecated pipeline, fiber/water computed in calculator, water tracker hardcoded 2500. Alex's stored targets confirmed live as 2740/206/240/107 (pre-28E user data — note, not a component bug).

## Program-logic verdicts

AGREE with all 6 rows, each backed by my own pre-merge verifications of phases 28D (safety swaps preserve sets), 29A (per-day unique lists), 29B (min-8 top-up, 8/8/8 live on Jonny's program), 30C (supersetGroup badges), 30D (progression rules persisted), 26E/30B (phase names/dates).

## Findings I have that KC missed

None material — KC's report covers everything I found (my K1–K10 map onto its #1–#14). One small addition to #6: the client dashboard's mock coach identity ("Coach Marc") and streak numbers are part of the same MOCK_COACH/compliance cluster.

## Summary

**Agreement: 15/16 AGREE, 1 CANNOT-REPRODUCE (environment-specific), 0 DISAGREE.** Formula verdicts 8/8 agree; program verdicts 6/6 agree. The two audits converged independently on the same top priority: **the /notifications localStorage crash (critical hotfix)**, followed by the de-mock wave, the intake-wizard formula migration, and the `/clients` role gate. KC's top-10 fix list and phase mapping (33A→33E) is endorsed as-is.
