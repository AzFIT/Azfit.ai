# AzFIT RLS Audit — Foundation Sprint

**Scope:** Static review of the SQL policy files in `supabase/`. Live integration RLS tests are planned for Phase 1 when the multi-tenant tables are exercised end-to-end.

## Summary

| Check | Status | Notes |
|---|---|---|
| `public.is_trainer()` SECURITY DEFINER function exists | ✅ | Defined in `schema.sql` and `fix-profiles-rls-recursion.sql` |
| `profiles` SELECT policy uses `is_trainer()`, not self-referencing EXISTS | ✅ | Recursion bug fixed |
| No SELECT policy queries its own table in `USING` | ✅ | Static test passes |
| Every table with a policy has `ENABLE ROW LEVEL SECURITY` | ✅ | Static test passes |
| `clients` table policy uses email match to link auth user to client record | ⚠️ | Works, but relies on `profiles.email` staying in sync; prefer a `user_id` FK in `clients` |
| `goal_categories` / `method_categories` / `program_categories` trainer policies use direct `SELECT FROM profiles` | ⚠️ | Not self-referencing, but should be standardized to `public.is_trainer()` for consistency |

## Tables with RLS enabled

From `schema.sql` and other migration files:

- `profiles`
- `clients`
- `programs`
- `workouts`
- `exercises`
- `workout_logs`
- `workout_log_entries`
- `body_composition`
- `messages`
- `notifications`
- `skinfold_assessments`
- `sessions`

## Known risks / follow-ups

1. **Category table policies** (`category-tables-rls.sql`) use `EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'trainer')` directly. They will not recurse because they are on `*_categories` tables, not `profiles`, but using `public.is_trainer()` everywhere is safer and more consistent.
2. **`clients` email-based linkage** ties a client row to the auth user via `clients.email = profiles.email`. If a user changes their email, the link breaks. A future migration should add `clients.user_id uuid references auth.users(id)` and update the policy.
3. **No live integration RLS tests yet.** The static tests catch schema anti-patterns. Phase 1 should add Playwright or Node-based tests that sign in as two different clients and prove cross-tenant reads are blocked.

## Static test file

`src/services/rlsAudit.test.ts` runs the checks above on every `npm test`.
