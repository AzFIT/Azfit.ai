# Build Rules

These rules apply to every coding session on this repository.

1. **One phase at a time.** Only the current phase's prompt is in scope. Do not build ahead.
2. **Small steps, always green.** One task → implement → verify it runs → commit → next task. Never batch features unverified.
3. **3-Strike Circuit Breaker (anti-loop):** If the same problem fails 3 times: attempt 2 must use a different approach; attempt 3 must simplify scope to the smallest working version; if it still fails, write it to `docs/BLOCKED.md` (error, attempts, hypothesis), flag the founder, and move to the next independent task. NEVER retry a 4th time.
4. **Never break working features.** Start each session by confirming a clean build. If a change breaks something that worked, revert first, then redo in smaller steps.
5. **Verify, don't assume.** A task is done only when its verification step actually ran and passed (build/test/manual check). No "this should work".
6. **No silent placeholders.** Mocks/stubs must be labeled `// TODO(phase-N)` and listed in `docs/PROGRESS.md` under "Deferred".
7. **Update `docs/PROGRESS.md`** (done/next/deferred) at the end of every session. This preserves context across sessions.
8. **Human gates:** payments, production launch, and anything touching real user data require the founder's explicit approval before shipping.
9. **Secrets:** never hardcode keys; use env vars; `.env.example` documents everything; AI API calls only from server-side functions.
10. **Testing:** Playwright smoke test per phase gate; RLS/security tests for any multi-tenant table.

## Standing Rule

End every work session by updating `docs/PROGRESS.md` (done/next/deferred) and committing it with the code.
