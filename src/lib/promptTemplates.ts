/* ═══════════════════════════════════════════════════════════════
   Phase 92c-fix Item 2 — AI prompt templates, single source of truth.

   Phase 97 imports from here. Strings are owner-provided VERBATIM —
   do not reformat, re-wrap, or "fix" whitespace; the Phase 93 paste
   import parser and the owner's AI workflows target these exact bytes.
   ═══════════════════════════════════════════════════════════════ */

/**
 * Canonical program sheet format (targets the Phase 93 parser's expected
 * columns: Day | Order | Exercise | Sets | Reps | Tempo | Rest).
 */
export const PROGRAM_FORMAT_TEMPLATE = `**Program Name:** [Insert Program Name]
**Weeks:** 4
| Day | Order | Exercise | Sets | Reps | Tempo | Rest |
| [Day#] | A1 | [Insert Exercise - e.g., Lower Body Quad Dominant] | [Sets] | [Reps] | [Tempo] | [Rest] |
| [Day#] | A2 | [Insert Exercise - e.g., Upper Body Pull] | [Sets] | [Reps] | [Tempo] | [Rest] |
| [Day#] | B1 | [Insert Exercise - e.g., Unilateral Lower Body] | [Sets] | [Reps] | [Tempo] | [Rest] |
| [Day#] | B2 | [Insert Exercise - e.g., Upper Body Push] | [Sets] | [Reps] | [Tempo] | [Rest] |
| [Day#] | C1 | [Insert Exercise - e.g., Posterior Chain/Hinge] | [Sets] | [Reps] | [Tempo] | [Rest] |
| [Day#] | C2 | [Insert Exercise - e.g., Core / Accessory Push] | [Sets] | [Reps] | [Tempo] | [Rest] |
| [Day#] | D1 | [Insert Exercise - e.g., Isolation Pull / Cable] | [Sets] | [Reps] | [Tempo] | [Rest] |
| [Day#] | D2 | [Insert Exercise - e.g., Core Stability / Plank] | [Sets] | [Reps] | [Tempo] | [Rest] |`;

/**
 * GBC single-day generator prompt — pasted to an AI chat, its markdown
 * table output pasted back through the Phase 93 import.
 */
export const GBC_DAY_PROMPT = `Act as an expert strength and conditioning coach specializing in GBC (German Body Composition) training. Generate a single day of a 4-week workout program for a client based on the details below.

Client Profile & Guidelines:
- Level: [Insert level, e.g., Beginner-Intermediate]
- Equipment: [Insert available equipment, e.g., Full gym access / Dumbbells and cables]
- Goal/Focus: [Insert focus, e.g., Movement patterns, fat loss, hypertrophy]
- Injuries/Limitations: [Insert any limitations or write "None"]
- Structure requirements: Include 8 exercises total per day, formatted into supersets/circuits (A1/A2, B1/B2, C1/C2, D1/D2) following standard GBC principles (shorter rest periods, higher reps, controlled tempos).`;

/**
 * TDEE / macro calculator prompt. Phase 97 surfaces this; constants +
 * tests only in 92c-fix.
 */
export const TDEE_PROMPT = `Act as an expert sports nutritionist. Calculate my TDEE and macro targets from the details below.

My details:
- Gender: [Insert gender]
- Age: [Insert age]
- Height: [Insert height, e.g., 175 cm]
- Weight: [Insert weight, e.g., 78 kg]
- Body fat %: [Insert % if known, or "unknown"]
- Training frequency: [Insert sessions per week + average duration]
- Average daily steps: [Insert step count]
- Occupation/activity: [e.g., desk job / on feet all day]

Requirements:
- Use Katch-McArdle if body fat % is provided; otherwise Mifflin-St Jeor. State which formula you used.
- Output exactly this structure:
**BMR:** [number] kcal
**TDEE:** [number] kcal
**Fat loss target:** [number] kcal (protein [g] / carbs [g] / fats [g])
**Maintenance:** [number] kcal (protein [g] / carbs [g] / fats [g])
**Muscle gain target:** [number] kcal (protein [g] / carbs [g] / fats [g])
- If any required detail is missing, ask me for it first — never guess or assume.`;

/**
 * 10-section client intake interview prompt. Phase 97 surfaces this;
 * constants + tests only in 92c-fix.
 */
export const INTAKE_PROMPT = `Act as my personal trainer's onboarding assistant. Conduct my intake interview by asking me the questions below ONE SECTION AT A TIME (wait for my answers before moving to the next section). Ask brief follow-ups only if something is unclear or missing. Do not skip sections. Do not give advice yet — this is information gathering only.

Section 1 — BASICS: name/nickname, age, height, current weight, body fat % (or describe current look), where I live, occupation, work schedule (hours, sedentary or active).
Section 2 — GOALS: primary goal (fat loss / muscle gain / recomposition / health / performance), target weight, target look, timeline, long-term goal.
Section 3 — EATING HABITS: typical daily meals, calorie/macro tracking (yes/no/sometimes), foods I refuse to give up, foods I hate or am allergic to, dietary restrictions, cooking ability, food budget, alcohol per week, caffeine per day, sweet tooth (1-10), when cravings hit.
Section 4 — TRAINING & ACTIVITY: current routine, gym access, sports played, experience level, injuries or limitations, training I enjoy, average daily steps.
Section 5 — SLEEP & RECOVERY: average sleep hours, sleep quality, bedtime/wake time, naps, screen time before bed.
Section 6 — HEALTH & MEDICAL: medical conditions, medications, supplements, stress level (1-10), digestive issues, any history of disordered eating.
Section 7 — LIFESTYLE: living situation, who cooks, time to cook, willing to meal prep, meals out per week, biggest obstacle to consistency.
Section 8 — PAST ATTEMPTS: what I've tried before, what worked, what failed and why.
Section 9 — BODY & TRACKING: relationship with the scale, progress photos (yes/no), food scale ownership, recent blood work if any.
Section 10 — PREFERENCES: strict or flexible guidance, meal plans or macro targets, check-in frequency, coaching tone (gentle or direct), anything to avoid, language, time zone.

When all 10 sections are complete, summarize my profile back to me in short bullet points and confirm it is accurate before finishing.`;
