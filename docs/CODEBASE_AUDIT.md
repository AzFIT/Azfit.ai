# AzFIT Codebase Audit — Pre-Beta Health Report

**Scope:** whole repo (224 source files under `src/`, plus `supabase/*.sql`, configs, CI).
**Method:** static analysis only. Import-graph reachability from `src/main.tsx`, word-boundary greps across `src/`, `e2e/`, configs, and `index.html`, and a read-only review of the checked-in SQL vs the generated Supabase types. The live DB was **not** queried or changed (except two read-only `pg_policies`/catalog checks used to confirm RLS state).
**Rules honored:** read-only; nothing in this repo was edited except this file and the PROGRESS.md line.

---

## 1. Executive summary

- **Baseline gates all pass, unchanged:** `npx tsc -b` ✅ (no errors), `npm run lint` ✅ (no warnings), `npm run test` ✅ (41 tests, 7 files), `npm run build` ✅ (~486 KB main chunk + lazy route chunks; recharts isolated to the `charts-*.js` chunk, not on the landing path).
- **The app is fundamentally healthy** after 20 phases: RLS coverage is consistent (owner + trainer `is_my_client` patterns everywhere), no hardcoded secrets, the public landing path is bundle-clean (no recharts, no supabase-dependent page code), and the recent feature layers (`foodApi`, `photoMetadata`, `formChecks`, `tdee`, `aiProgramMapper`) are well-factored.
- **One probable privacy issue:** `check_in_submissions.trainer_notes` is readable by the client via the owner SELECT policy — the same hole class Phase 18B fixed for photos, but for check-ins it may be *intentional* shared feedback. Needs an owner decision (see I-1).
- **The biggest structural debt is a split data layer:** 5 of 9 ClientProfile tabs still read localStorage demo data (`client-demo.ts`) while the rest of the app reads Supabase. `storage.ts` + `aiProgramGenerator` also keep a legacy localStorage persistence layer that is now redundant with Supabase.
- **Heavy duplication** in mechanical patterns: "resolve clients.id from email" ×9, "list trainer's clients" ×5, `formatDate`/`formatElapsed` reimplemented ~13 times, program→workouts→exercises fetch ×2, and 3 separate `ProgressRing`/`Client`-type/`Badge` collisions.
- **~7,400 lines of verified dead code**, dominated by `SheetsPanel.tsx` (1,219 lines) and a 38-file shadcn `ui/` island (~4,940 lines) that is unreachable from the app. 6 packages have zero usage; 24 more are used only by dead files.
- **`supabase/schema.sql` is not the "complete schema"** it claims to be: `sessions` and the entire program-library schema live in separate migration files and are absent from it. Types and DDL otherwise match, with 3 naming/drift mismatches.
- **CI caveat carried forward:** the Playwright e2e step is `continue-on-error: true` due to live-demo flakiness (documented; not a regression).

**Counts:** CRITICAL **1** · WARNING **14** · SUGGESTION **12**

---

## 2. Issue inventory

Severity: **CRITICAL** (fix before beta) · **WARNING** (fix soon / decide) · **SUGGESTION** (hygiene).

| # | Severity | File:line | Issue | Why it matters |
|---|----------|-----------|-------|----------------|
| I-1 | **CRITICAL** | `supabase/checkins.sql` → policy "Clients can read their own submissions"; column `check_in_submissions.trainer_notes` | Trainer's check-in review notes are client-readable via the owner SELECT policy. Phase 18B treated the identically-named photo field as trainer-private and moved it to a trainer-only table. | If check-in notes are meant to be private, this is a live privacy leak (client can read coach notes via PostgREST). If they are meant to be shared feedback, it is acceptable but should be surfaced in the client check-in UI. **Owner decision required.** |
| I-2 | WARNING | `src/pages/ClientProfile.tsx:29-36,202,333-336` + `src/lib/client-demo.ts:238-335` | 5 of 9 ClientProfile tabs (Overview, Bio History, Workout Logs, Schedule, Notes) read localStorage demo data via `client-demo.ts` while Nutrition/Programs/Photos/FormChecks read Supabase. | Trainers see stale/demo data for real clients in most of the profile view; two persistence layers in one screen. |
| I-3 | WARNING | `src/lib/storage.ts:4` + `src/lib/aiProgramGenerator.ts:476-483` | Legacy localStorage persistence layer (`azfit-*` keys) for programs/sessions still written, even though programs now persist to Supabase (Phase 12). `storage.ts` declares "ALL storage access goes through here" yet ≥9 files bypass it. | Dead-weight writes, three access paths for the same keys, contradicts the Supabase-only rule. |
| I-4 | WARNING | `supabase/schema.sql` (missing) vs `supabase/sessions.sql`, `supabase/program-library-schema.sql` | `schema.sql` omits `sessions` and the entire program-library schema (goals, methods, program_templates, exercise_library, tags, weekly_structures, categories, score tables). | The "complete schema" file is not complete; a fresh environment built from `schema.sql` alone would be missing live tables the app queries. |
| I-5 | WARNING | `src/types/supabase.ts` vs DDL | Type/DDL drift: `settings_config` and `pipeline_scores` are typed but have no CREATE TABLE anywhere; `method_program_scores` is typed but the DDL is `method_program_template_scores` (name mismatch). | Checked-in types do not match the checked-in DDL; the `useSupabaseData` hooks that read these may break against a fresh DB. |
| I-6 | WARNING | `src/components/SheetsPanel.tsx` (1,219 lines) | 0 importers, 0 string references — fully dead. `/sheets` renders `SheetsPage.tsx`. | Largest single dead file; carries bundle + maintenance cost and is a frequent source of duplicate-logic confusion. |
| I-7 | WARNING | `src/components/ui/` island (38 files, ~4,940 lines) | Unreachable shadcn component set (`sidebar`, `calendar`, `carousel`, `command`, `drawer`, `form`, `chart`, etc.). | Biggest dead block; also drags 7 lib + 17 radix packages that are used nowhere else. |
| I-8 | WARNING | Duplicated resolvers/fetchers (see §5 pattern list) | "resolve clients.id from email" ×9 (`useClientPrograms`, `useBodyComposition`, `AssessmentWizard`, `useHabits`, `Nutrition`, `SessionLauncher`, `CheckInsPage`, `BioPrintPage`, `chatData`); "list trainer's clients" ×5; program→workouts→exercises ×2 (`useClientPrograms` vs `ClientProfile.fetchClientPrograms`). | Each copy can drift; several already have subtle differences. |
| I-9 | WARNING | `src/types/client.ts` vs `src/components/coach/data.ts` vs DB `ClientRow` | Three divergent `Client` shapes (`id: string` / `id: number` mock / generated DB). `Nutrition.tsx` uses meal union `"snack"` while `foodApi.ts` uses `"snacks"` (bridged by a cast at `Nutrition.tsx:229`). | Type confusion across the two ID spaces (`clients.id` vs `profiles.id`) and mismatched constants. |
| I-10 | WARNING | `src/components/ProgressRing.tsx` vs `src/components/dashboard/shared/ProgressRing.tsx`; `src/components/Badge.tsx` vs `src/components/ui/badge.tsx` | Duplicate `ProgressRing` (same props) and a `Badge` name collision (notification pill vs shadcn). | Risk of editing the wrong copy; divergent behavior. |
| I-11 | WARNING | God files (multi-responsibility, >700 lines): `OnboardingPage.tsx` (1,219), `Home.tsx` (1,218), `AIProgramBuilder.tsx` (1,216), `ClientDashboard.tsx` (1,007), `Nutrition.tsx` (957), `ProgramBuilder.tsx` (945), `Analytics.tsx` (899), `CheckInsPage.tsx` (880), `TrainerDashboard.tsx` (878), `Schedule.tsx` (861), `responseGenerator.ts` (741), `Layout.tsx` (693) | Several mix data-fetching, state, and large presentational sub-components. | Hard to review/test; changes have large blast radius. (Report only — suggested splits in §3, not done.) |
| I-12 | WARNING | `src/pages/OnboardingPage.tsx:241-242`, `src/pages/ExportShare.tsx:25-41`, `src/pages/DeloadDetection.tsx:27-35`, `src/pages/Notifications.tsx`, `src/pages/Nutrition.tsx` (WATER_KEY) | Leftover localStorage reads for data that has Supabase homes (client profile, workout logs, bio history, schedule, nutrition plan, water intake). | Contradicts the Supabase-only persistence rule; data will disagree with the DB. |
| I-13 | WARNING | `.github/workflows/ci.yml` e2e step | `continue-on-error: true` on the Playwright smoke tests (live-demo flakiness, documented). | CI can go green with failing e2e; acceptable interim but should not be permanent. |
| I-14 | WARNING | `src/lib/aiProgramGenerator.ts:476,483` | Unguarded `JSON.parse(localStorage…)` (no try/catch) on the generated-programs key. `src/lib/storage.ts:32,489` similar. | Corrupt localStorage would throw at runtime. (Most other `JSON.parse` sites are wrapped in try/catch.) |
| I-15 | SUGGESTION | `src/lib/supabase.ts:31-56` (`createDummyClient`) | A Proxy-backed dummy client silently returns empty data when env vars are missing. | Can mask misconfiguration as "empty app" rather than a clear error. |
| I-16 | SUGGESTION | `src/App.tsx:104-110` | One-time dev Sentry test error (`sessionStorage` gated). | Intentional, but easy to forget to remove. |
| I-17 | SUGGESTION | Mixed naming for "the person who owns this row": `client_id` (habits, programs, sessions, workout_logs, body_composition, check_in_submissions) vs `owner_id` (photo_metadata, form_checks) vs `user_id` (nutrition_logs, nutrition_targets). | Two ID spaces (`clients.id` vs `profiles.id`) for the same person; `NutritionTab` receives `clientId` but re-resolves `profiles.id` from email instead. | Frequent source of mismatched queries (see I-9). |
| I-18 | SUGGESTION | `src/components/chat/chatData.ts` | Re-queries `sessions`/`workout_logs`/`body_composition` that already have dedicated hooks (`useSessions`, `useBodyComposition`, `clientHealthQueries`); also has 5 dead exports. | Bypasses shared helpers. |
| I-19 | SUGGESTION | `src/lib/index.ts` (4-line barrel) | Never imported; consumers import the modules directly. | Dead indirection. |
| I-20 | SUGGESTION | Unused exports inside used files: `storage.ts` (20 fns), `useSupabaseData.ts` (9 hooks), `chatData.ts` (5), `supabase.ts` (`supabaseStorage`, `syncQueue`), `exerciseDatabase.ts` (3), `aiProgramGenerator.ts` (2), plus ~8 single exports (`updateProfile`, `validateSites`, `getClientNutritionLogs`, `triggerBackgroundSync`, `getNavigationSuggestion`, `PAGE_CONTEXTS`, `generatedToMasterProgram`, `getGeneratedPrograms`). | Bloats the public surface and misleads future edits. |
| I-21 | SUGGESTION | Supabase JS client (~207 KB chunk) loaded on the public landing path | `App.tsx` mounts `AuthProvider`/`ChatProvider` on every route including the public landing. | Public landing pays the supabase-js cost; could be deferred. |
| I-22 | SUGGESTION | `src/components/ExerciseCard.tsx` (346), `WorkoutSummary.tsx` (190), `RestTimerOverlay.tsx` (186), `ExerciseReplacer.tsx` (160), `MacroDistributionPieChart.tsx` (51), `WeightTrendChart.tsx` (37), `StepCounter.tsx` (37), `ClientOnly.tsx` (33), `useResilientForm.ts` (228), `App.css` (1) | Verified dead files (0 importers, 0 string refs). | Bundle + maintenance cost. |
| I-23 | SUGGESTION | Zero-usage packages: `@hookform/resolvers`, `date-fns`, `zod`, `tw-animate-css`, `@testing-library/react`, `@testing-library/user-event` | No imports anywhere (src, e2e, configs). | Dependency bloat. |
| I-24 | SUGGESTION | Packages used only by dead files: `cmdk`, `embla-carousel-react`, `input-otp`, `react-day-picker`, `react-hook-form`, `react-resizable-panels`, `vaul`, + 17 `@radix-ui/*` packages | Each imported only by a dead `ui/` file. | Becomes removable once the dead `ui/` island is removed. |
| I-25 | SUGGESTION | `e2e/smoke.spec.ts` + `supabase/demo-seed.sql` | Demo account password (`AzFitDemo2026!`) checked into the repo. | Acceptable for a public demo project, but must never become a real credential. |
| I-26 | SUGGESTION | `src/hooks/useOfflineQueue.ts`, `src/hooks/useResilientForm.ts` | Offline-queue/resilience scaffolding is present but `useResilientForm` is dead and the offline queue is only lightly consumed. | Either finish wiring or remove the scaffolding. |
| I-27 | SUGGESTION | `src/components/chat/responseGenerator.ts` (741) | Large intent-handler module mixing data fetch + text templates. | Candidate for splitting handlers from templates. |

---

## 3. Recommended fix plan

Ordered by **risk-to-fix** (safest, most mechanical first). Effort: **S** (<1h) / **M** (1–4h) / **L** (>4h). "21B-safe" = safe for an automated follow-up pass without human judgment.

1. **Remove the verified dead code** (I-6, I-7, I-22, I-19): delete `SheetsPanel.tsx`, the 38-file `ui/` island, the 9 dead non-ui files, and `lib/index.ts`. Effort **S**. **21B-safe** (pure deletion, all verified 0-import).
2. **Remove unused packages** (I-23, I-24): drop the 6 zero-usage deps, then the 24 dead-file-only deps after step 1. Effort **S**. **21B-safe** (run gates after).
3. **Prune dead exports** (I-20): remove uncalled functions from `storage.ts`, `useSupabaseData.ts`, `chatData.ts`, `exerciseDatabase.ts`, `aiProgramGenerator.ts`, `supabase.ts`, and the ~8 single exports. Effort **S–M**. **21B-safe** (mechanical, but re-run gates + a smoke of ProgramBuilder/Onboarding which consume `useSupabaseData`).
4. **Fix schema.sql completeness** (I-4): append `sessions` and the program-library tables to `supabase/schema.sql` (DDL already exists in the individual migration files — copy, don't re-author). Effort **S**. **21B-safe** (docs/DDL only).
5. **Resolve type/DDL drift** (I-5): either add DDL for `settings_config`/`pipeline_scores` or drop them from `types/supabase.ts`; align `method_program_scores` vs `method_program_template_scores`. Effort **S**. **Human judgment** (confirm which is the live name).
6. **Decide + fix `check_in_submissions.trainer_notes`** (I-1): confirm intent; if private, apply the Phase 18B trainer-only-table pattern; if shared, surface it in the client check-in UI. Effort **M**. **Human decision first**, then 21B-safe.
7. **Migrate the 5 ClientProfile tabs off localStorage** (I-2): point Overview/Bio/WorkoutLogs/Schedule/Notes at Supabase (`workout_logs`, `body_composition`/`skinfold_assessments`, `sessions`, and a notes table). Effort **L**. **Human judgment** (data mapping per tab).
8. **Consolidate mechanical duplicates** (I-8, I-9, I-10): extract `resolveClientIdByEmail`, `useTrainerClients`, one `ProgressRing`, one `Badge` name, unify `formatDate`/`formatTime`/`formatElapsed` onto `lib/utils`, and the shared sign-URL/upload-path helper for photos+form-checks. Effort **M**. **Mostly 21B-safe** after a shared helper is chosen.
9. **Guard the unguarded `JSON.parse`** (I-14): wrap in try/catch like the rest. Effort **S**. **21B-safe**.
10. **Retire the legacy storage layer** (I-3): stop writing `azfit-*` program/session keys in `storage.ts` + `aiProgramGenerator.saveGeneratedProgram`; keep read-only legacy import for the AIProgramBuilder banner. Effort **M**. **Human judgment** (confirm nothing still reads them).
11. **Fix leftover localStorage reads** (I-12): point Onboarding/ExportShare/DeloadDetection/Notifications/Nutrition-water at Supabase. Effort **M**. **Human judgment** per source.
12. **Split god files** (I-11, I-27): extract presentational sub-components and data hooks from the 700+ line pages (Home, Onboarding, AIProgramBuilder, the dashboards, Nutrition, ProgramBuilder, Analytics, CheckIns, TrainerDashboard, Schedule, responseGenerator). Effort **L**. **Human judgment** (do after 1–10 to avoid touching dead/duplicate code twice).
13. **Defer supabase-js off the public landing** (I-21): lazy-mount the auth/chat providers on the landing route. Effort **M**. **Human judgment**.
14. **Decide the offline/resilience scaffolding** (I-26) and the dummy-client behavior (I-15). Effort **M**. **Human judgment**.
15. **Re-enable e2e as a real gate** (I-13) once a dedicated e2e environment exists. Effort **M**. **Human judgment**.

---

## 4. Dependency map (how data flows)

- **Entry:** `index.html` → `src/main.tsx` → `src/App.tsx` (Sentry init, `HashRouter`, lazy routes, `AuthProvider`/`ThemeProvider`/`ChatProvider`/`AIContextProvider`). `ProtectedRoute` (optionally `requireTrainer`) guards routes.
- **Pages** (`src/pages/*`) render **feature components** (`src/components/*`) and read data via three styles:
  - **Shared feature libs** — `src/lib/foodApi.ts` (nutrition + targets), `src/lib/photoMetadata.ts` (photos), `src/lib/formChecks.ts` (form-check videos), `src/lib/aiProgramMapper.ts` (program mapping) → **`src/lib/supabase.ts`** (single proxied client) → Supabase.
  - **Shared hooks** — `src/hooks/*` (`useAuth`, `useSessions`, `useSupabaseData`, `useClientPrograms`, `useActiveWorkoutSession`, `useHabits`, `useClientHealth`, `useAnalytics`, `useTheme`) → `supabase.ts`.
  - **Raw inline** — many pages/components call `supabase.from(...)` directly (`AIProgramBuilder`, `CheckInsPage`, `ClientProfile`, `Clients`, `BioPrintPage`, `chatData`).
- **Components** (`src/components/*`): `dashboard/*` (trainer/client dashboards), `client/*` (ClientProfile tabs), `photos/`, `formchecks/`, `chat/` (AI chat), `checkins/`, `session/` (workout logger), `ui/` (shadcn — only ~13 of 51 files are live), plus top-level shared (`Layout`, `Footer`, `QuickAddClientModal`, `ClientIntakeWizard`, `AIShowcase`).
- **ClientProfile** is the inconsistency hotspot: Nutrition/Programs/Photos/FormChecks tabs → Supabase; Overview/Bio/WorkoutLogs/Schedule/Notes tabs → `src/lib/client-demo.ts` (localStorage).
- **DB:** `supabase/schema.sql` (core + later tables) + per-feature migrations (`sessions`, `program-library-schema`, `checkins`, `nutrition`, `nutrition-targets`, `ai-chat`, `photo-metadata`, `photo-trainer-notes`, `form-checks`, `intake-profile`). RLS = owner-based + `is_trainer()`/`is_my_client()` security-definer helpers. Types in `src/types/supabase.ts` are hand-maintained against these.

---

## 5. Dead / deprecated candidates

All verified **0 importers and 0 string references** (static + dynamic import graph from `main.tsx`, word-boundary greps across `src/`, `e2e/`, `index.html`, and root configs). Each is marked for owner approval before removal.

**DEPRECATED — SAFE TO REMOVE (pending owner approval):**
- `src/components/SheetsPanel.tsx` (1,219 lines) — 0 importers; `/sheets` uses `SheetsPage.tsx`.
- The 38-file shadcn `src/components/ui/` island (~4,940 lines): `accordion, alert-dialog, alert, aspect-ratio, avatar, button-group, calendar, carousel, chart, collapsible, command, context-menu, drawer, empty, field, form, hover-card, input-group, input-otp, item, kbd, menubar, navigation-menu, pagination, popover, radio-group, resizable, scroll-area, separator, sheet, sidebar, skeleton, spinner, table, tabs, toggle-group, toggle, tooltip`. (Closed island; the live `ui/` files are `badge, breadcrumb, button, checkbox, dialog, dropdown-menu, input, label, progress, select, slider, sonner, switch, textarea`.)
- `src/components/ExerciseCard.tsx`, `WorkoutSummary.tsx`, `RestTimerOverlay.tsx`, `ExerciseReplacer.tsx`, `MacroDistributionPieChart.tsx`, `WeightTrendChart.tsx`, `StepCounter.tsx`, `ClientOnly.tsx`, `src/hooks/useResilientForm.ts`, `src/lib/index.ts`, `src/App.css`.
- Dead exports: `storage.ts` (20 fns incl. the offline/draft/template layer), `useSupabaseData.ts` (9 hooks: `useGoals, useMethods, useMethodCategories, useProgramTemplates, useProgramCategories, useTags, useTopPipelines, useGoalWithTags, useProgramTemplateWithTags`), `chatData.ts` (5), `supabase.ts` (`supabaseStorage`, `syncQueue`), `exerciseDatabase.ts` (`getAllCategories, getExerciseAlternatives, getSlotCategory`), `aiProgramGenerator.ts` (`generatedToMasterProgram, getGeneratedPrograms`), `auth.ts` (`updateProfile`), `bodyfat.ts` (`validateSites`), `client-demo.ts` (`getClientNutritionLogs`), `registerSW.ts` (`triggerBackgroundSync`), `intentClassifier.ts` (`getNavigationSuggestion`), `chat/types.ts` (`PAGE_CONTEXTS`).
- Packages: `@hookform/resolvers`, `date-fns`, `zod`, `tw-animate-css`, `@testing-library/react`, `@testing-library/user-event` (zero usage); and after the `ui/` island is removed: `cmdk`, `embla-carousel-react`, `input-otp`, `react-day-picker`, `react-hook-form`, `react-resizable-panels`, `vaul`, and 17 `@radix-ui/*` packages.

**NOT dead (explicitly verified, do not remove):** `src/data/masterWorkouts.ts` (imported by `ProgramBuilder.tsx` + `aiProgramGenerator.ts`), all `*.test.ts` + `src/test/setup.ts` (vitest), `src/index.css` (imported in `main.tsx`).

---

*End of audit. No code was changed. All findings are recommendations pending owner approval.*
