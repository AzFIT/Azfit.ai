# PROMPT FOR KIMI — Independent AzFIT App Audit (copy-paste as-is)

You are Kimi, a desktop agent. Perform an INDEPENDENT UX/UI + logic audit of the live AzFIT app and compare your findings against an existing audit report. Work READ-ONLY: no code edits, no DB writes, no form submissions that persist data (open dialogs, then cancel). The only file you may write is your verdict report at `docs/AUDIT-UX-KIMI-VERDICT.md`.

## Environment

- **Live app:** https://azfit.github.io/Azfit.ai/ (HashRouter — routes are `/#/<route>`)
- **Logins (audit BOTH roles):** trainer@azfit.demo / AzFitDemo2026! and client@azfit.demo / AzFitDemo2026!
- **WebBridge endpoint:** http://127.0.0.1:10086/command — POST JSON `{"action": ..., "args": ..., "session": "kimi-audit"}`.
  Actions: `navigate {url, newTab}`, `evaluate {code}`, `snapshot`, `click {selector}`, `fill {selector, value}`, `screenshot {format, quality, path}`, `list_tabs`, `cdp {method, params}` (use `Emulation.setDeviceMetricsOverride` {width:390,height:844,mobile:true} for mobile checks, clear with `Emulation.clearDeviceMetricsOverride`).
  On Windows, send request bodies as files with `curl.exe --data-binary "@file"` (inline non-ASCII gets corrupted). Keep one session name for the whole task.
- **Existing audit to compare against:** `docs/AUDIT-UX.md` in this repo (read it AFTER forming your own findings).
- **Reference data:** Alex Carter `clients.id = f02198e5-c4c8-4991-ae5a-9c10c9f900e9`, `profiles.id = 992ffcaa-d5f6-4b92-b6a1-4a513f83f74c`.
- If WebBridge is unreachable, use Playwright inside the repo (`npm run dev`, app on http://localhost:3000) and note which tool produced each finding.

## Part 1 — Page-by-page audit (visit EVERY route, both roles where applicable)

Routes: `/`, `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/demo`, `/invite/:trainerId` (try an invalid id), `/dashboard`, `/analytics`, `/coach`, `/coach-ai`, `/sheets`, `/settings`, `/onboarding`, `/bioprint`, `/nutrition`, `/ai-program-builder`, `/schedule`, `/progress-photos`, `/check-ins`, `/export`, `/timer`, `/notifications`, `/clients`, `/client/f02198e5-c4c8-4991-ae5a-9c10c9f900e9`, `/leaderboard`, `/warmup`, `/deload`, `/messages`, `/exercises`, `/form-checks`, `/library`.

Per page record: (a) buttons/links — does each do something sensible (open, then cancel anything that persists data); flag dead/wrong/erroring ones; (b) layout — header/sidebar consistency, overflow/clipping at 1280px and 390px; (c) theme — the design system is dark glass (CSS vars like `--card-bg`), cyan→purple gradient accents (#00AEEF → #8B5CF6), consistent badges/radii; light mode exists; flag hardcoded off-palette styles and low contrast; (d) states — loading/empty/error states; a blank area, infinite spinner, or raw error is a finding; (e) screenshot any issue you find (save to a temp dir, reference filenames).

Also verify role gating: client role must NOT get trainer pages (`/coach`, `/coach-ai`, `/ai-program-builder`, `/library` redirect; check `/clients` too), and the sidebar must hide trainer-only items for clients.

## Part 2 — Formula & logic consistency

**Nutrition spec (src/lib/tdee.ts is the source of truth):**
- BMR Mifflin-St Jeor: male `10w + 6.25h − 5a + 5`, female `− 161`, rounded.
- TDEE = BMR × activity (sedentary 1.2, light 1.375, moderate 1.55, very 1.725, extreme 1.9).
- Goal adjustments (PERCENTAGE, capped at ±1000 kcal, never below 0): aggressive_fat_loss −20%, fat_loss −10%, maintenance 0, lean_gain +5%, muscle_gain +10%.
- Guardrails after goal adjustment: floor = BMR × 1.2, ceiling = TDEE + 1000 — clamp ONLY with a visible warning, never silently.
- Macros (D6): protein on lean mass (LBM = w×(1−BF%) or w×0.8 if BF unknown): 2.0 g/kg base; 2.2 if BF>25% or goal in (muscle_gain, lean_gain, aggressive_fat_loss); 1.8 if BF<12% or vegetarian/vegan; hard cap 1.6 with kidneyConcern; also capped at 35% of kcal. Fats = 25% of remaining kcal, floor 0.6 g/kg weight, female min 25% of kcal. Carbs = remainder. Fiber = max(14 g/1000 kcal, 25 g female / 38 g male). Water = 35 ml/kg + 500 ml per training day (default 3), rounded to 50 ml.
- Verify every surface that shows nutrition numbers uses these same formulas (TDEE calculator, intake wizard, client Nutrition tab, meal plans). Hand-check ONE client (Alex: 80 kg, 178 cm, 1996-03-14, male, moderate): BMR 1768, TDEE 2740, maintenance 2740, macros (BF unknown, LBM 64): P 128 g, F 62 g, C 418 g, fiber 38 g, water 4300 ml. Flag any deprecated flat-kcal usage (−500/−750/+250) or divergent math.

**Program logic rules:**
- Generated training days must match their split focus (Upper Push day = only upper-push exercises), no identical cloned days.
- Every generated day has ≥ 8 exercises.
- Exercises contraindicated by client limitations are flagged (warn/exclude) or auto-swapped; swaps preserve sets/reps.
- Superset pair badges and progression rules render from saved data (exercises.notes jsonb, programs.progression_rules).
- Phase names/dates appear on program cards.
Verify in the wizard (generate a program — do NOT save) and on a client's Programs tab.

**Data honesty:** flag fabricated content — fake profiles/descriptions, placeholder stats presented as real, hardcoded demo values on non-demo accounts, mock workout/analytics data, empty states that lie.

## Part 3 — Compare & report

1. Write your findings FIRST (table: # | Page | Element | Issue | Severity (critical/major/minor/polish) | Evidence/tool).
2. Then read `docs/AUDIT-UX.md` and produce a **verdict table**: for each of its 16 findings + formula/program verdicts — AGREE (with your confirming evidence), DISAGREE (with counter-evidence), or CANNOT-REPRODUCE (why). List any findings YOU have that it missed.
3. Write everything to `docs/AUDIT-UX-KIMI-VERDICT.md`: your route map, your findings table, the verdict table, and a short summary of agreement rate.

Known traps (verify, don't assume): `/notifications` has a reported crash tied to stale localStorage — check `localStorage.getItem('azfit_notification_settings')` and whether `icon` values are plain objects instead of components; the root ErrorBoundary does not reset on client-side navigation (one crash cascades); if lazy chunks 404, unregister the service worker and clear caches before concluding anything about the deploy.
