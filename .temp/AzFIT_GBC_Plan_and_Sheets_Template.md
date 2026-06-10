# AZFIT GBC — COMPLETE PLAN & GOOGLE SHEETS TEMPLATE

> Based on analysis of `NEWAZFIT Trainer master sheet.xlsx` (38 tabs, 51 unique exercises, GBC periodization system)

---

## PART 1: WHAT YOU HAVE (Excel Analysis)

### The GBC Program Structure

| Phase | Weeks | Sets | Reps | Tempo | Rest | Goal |
|-------|-------|------|------|-------|------|------|
| **Block 1** | 1-4 | 2 | 10-15 | 3-2-1-1 | 45-60s | Accumulation — metabolic stress |
| **Block 2** | 5-8 | 3 | 8-10 | 4-0-1-2 | 45-60s | Intensification — mechanical tension |
| **Block 3** | 9-12 | 3-4 | 6-8 | 5-0-X-0 | 60-90s | Realization — strength expression |

### 5 Workouts Per Phase

| Workout | Type | Exercises | Focus |
|---------|------|-----------|-------|
| **Full Body 1** | GBC | 7-8 | Pull → Quad → Push → Hinge → Delt → Arm → Core |
| **Full Body 2** | GBC | 7-8 | Push → Posterior → Pull → Quad → Delt → Arm → Core |
| **Upper Focus** | Metabolic Strength/Endurance | 7-8 | Push → Quad → Pull → Delt → Arm → Core |
| **Custom 1** | User-defined | — | Empty template for coach |
| **Custom 2** | User-defined | — | Empty template for coach |

### Exercise Organization (ORDER system)
- **A1/A2**: First superset pair (e.g., Chin up + DB Split Squat)
- **B1/B2**: Second superset pair (e.g., DB Incline Press + Seated Leg Curl)
- **C1/C2/C3**: Third tri-set (e.g., Lateral Raise + Bicep Curl + Plank)
- **D**: Finisher/conditioning (e.g., Metcon/Bracing)

### Motion Categories (11 types)
`PULLING`, `PRESSING`, `UNILATERAL_QUAD`, `BILATERAL_QUAD`, `POSTERIOR`, `DELT_SCAP_CONTROL`, `BICEPS`, `TRICEPS`, `BRACING`, `METCON_BRACING`, `TARGET_AREAS`

### 51 Unique Exercises in Master Sheet

---

## PART 2: PARSED DATA FOR YOUR APP (masterWorkouts.ts)

This is the exact structure Kimi Code should generate from the Excel:

```typescript
// src/data/masterWorkouts.ts

// ═══════════════════════════════════════════
// GBC PROGRAM — GERMAN BODY COMPOSITION
// ═══════════════════════════════════════════

export interface GBCExercise {
  order: string;           // "A1", "A2", "B1", "B2", "C1", "C2", "C3", "D"
  motion: string;          // "PULLING", "PRESSING", etc.
  name: string;            // "Chin up - Semi supinated"
  reps: number;
  sets: number;
  tempo: string;           // "3-2-1-1" (eccentric-isometric-concentric-isometric)
  tut: number;             // Time Under Tension per set (seconds)
  rest: number;            // Rest between sets (seconds)
  description?: string;    // Optional coaching cue
  videoUrl?: string;       // Link to exercise demo
}

export interface GBCWorkout {
  id: string;              // "p1-w1-fb1"
  name: string;            // "Full Body 1"
  phase: number;           // 1, 2, or 3
  week: number;            // 1-4 (within phase)
  session: number;         // 1-5 (within week)
  category: string;        // "Hypertrophy", "Metabolic Strength", etc.
  method: string;          // "GBC", "Linear", etc.
  exercises: GBCExercise[];
  sessionTime?: number;    // Estimated minutes
}

export interface GBCPhase {
  id: number;              // 1, 2, 3
  name: string;            // "GBC Block 1"
  label: string;           // "Accumulation", "Intensification", "Realization"
  weeks: number;           // 4
  sets: number;            // 2, 3, or 3-4
  repRange: string;        // "10-15", "8-10", "6-8"
  tempo: string;           // Default tempo for phase
  restSeconds: number;     // Default rest
  color: string;           // #8B5CF6, #F59E0B, #22C55E
  workouts: GBCWorkout[];
}

export interface GBCProgram {
  id: string;              // "gbc-foundation"
  name: string;            // "GBC Foundation"
  description: string;
  totalWeeks: number;      // 12
  totalPhases: number;     // 3
  phases: GBCPhase[];
}

// ═══════════════════════════════════════════
// THE COMPLETE GBC PROGRAM DATA
// ═══════════════════════════════════════════

export const GBC_PROGRAM: GBCProgram = {
  id: 'gbc-foundation',
  name: 'GBC Foundation',
  description: 'German Body Composition — 12-week periodized program with metabolic stress, mechanical tension, and strength expression phases.',
  totalWeeks: 12,
  totalPhases: 3,
  phases: [
    {
      id: 1,
      name: 'GBC Block 1',
      label: 'Accumulation',
      weeks: 4,
      sets: 2,
      repRange: '10-15',
      tempo: '3-2-1-1',
      restSeconds: 60,
      color: '#8B5CF6',
      workouts: [
        // PHASE 1 — WEEK 1-4 — FULL BODY 1
        {
          id: 'p1-w1-fb1',
          name: 'Full Body 1',
          phase: 1, week: 1, session: 1,
          category: 'Hypertrophy',
          method: 'GBC',
          sessionTime: 45,
          exercises: [
            { order: 'A1', motion: 'PULLING', name: 'Chin up - Semi supinated', reps: 10, sets: 2, tempo: '3-2-1-1', tut: 60, rest: 60, description: 'Neutral grip, full range, squeeze at top' },
            { order: 'A2', motion: 'UNILATERAL_QUAD', name: 'DB Split Squat', reps: 10, sets: 2, tempo: '3-2-1-1', tut: 72, rest: 60, description: 'Front knee tracks toe, torso upright' },
            { order: 'B1', motion: 'PRESSING', name: '15° DB Incline Press', reps: 10, sets: 2, tempo: '3-2-1-1', tut: 72, rest: 60, description: 'Control eccentric, press through mid-foot' },
            { order: 'B2', motion: 'POSTERIOR', name: 'Seated Leg Curl', reps: 10, sets: 2, tempo: '3-2-1-1', tut: 72, rest: 60, description: 'Squeeze hamstrings, control the negative' },
            { order: 'C1', motion: 'DELT_SCAP_CONTROL', name: 'DB Lateral Raise - Seated', reps: 10, sets: 2, tempo: '3-2-1-1', tut: 90, rest: 45, description: 'Lead with elbows, pinkies up, slow eccentric' },
            { order: 'C2', motion: 'BICEPS', name: '80° DB Incline Curl', reps: 10, sets: 2, tempo: '3-2-1-1', tut: 90, rest: 45, description: 'Full stretch at bottom, supinate at top' },
            { order: 'C3', motion: 'BRACING', name: 'Front Plank', reps: 6, sets: 2, tempo: '3-2-1-1', tut: 36, rest: 45, description: 'Brace abs, neutral spine, breathe' },
          ]
        },
        // ... (Full Body 2, Upper Focus, Custom 1, Custom 2)
        // PHASE 1 — WEEK 1-4 — FULL BODY 2
        {
          id: 'p1-w1-fb2',
          name: 'Full Body 2',
          phase: 1, week: 1, session: 2,
          category: 'Hypertrophy',
          method: 'GBC',
          sessionTime: 45,
          exercises: [
            { order: 'A1', motion: 'PRESSING', name: '80° DB Incline Press', reps: 10, sets: 2, tempo: '3-2-1-1', tut: 60, rest: 60 },
            { order: 'A2', motion: 'POSTERIOR', name: '40° Incline Hyper', reps: 10, sets: 2, tempo: '3-2-1-1', tut: 72, rest: 60 },
            { order: 'B1', motion: 'PULLING', name: 'Seated Cable Row - Neutral Grip', reps: 10, sets: 2, tempo: '3-2-1-1', tut: 72, rest: 60 },
            { order: 'B2', motion: 'BILATERAL_QUAD', name: 'Goblet Squat', reps: 10, sets: 2, tempo: '3-2-1-1', tut: 72, rest: 60 },
            { order: 'C1', motion: 'UNILATERAL_QUAD', name: 'DB Step Up', reps: 10, sets: 2, tempo: '3-2-1-1', tut: 90, rest: 45 },
            { order: 'C2', motion: 'TRICEPS', name: 'Dual Rope Tricep Extension - Kneeling', reps: 10, sets: 2, tempo: '3-2-1-1', tut: 90, rest: 45 },
            { order: 'C3', motion: 'DELT_SCAP_CONTROL', name: 'Face Pull', reps: 10, sets: 2, tempo: '3-2-1-1', tut: 90, rest: 45 },
          ]
        },
        // ... (additional workouts)
      ]
    },
    // PHASE 2 — Block 2
    {
      id: 2,
      name: 'GBC Block 2',
      label: 'Intensification',
      weeks: 4,
      sets: 3,
      repRange: '8-10',
      tempo: '4-0-1-2',
      restSeconds: 60,
      color: '#F59E0B',
      workouts: [
        {
          id: 'p2-w1-fb1',
          name: 'Full Body 1',
          phase: 2, week: 1, session: 1,
          category: 'Hypertrophy',
          method: 'GBC',
          sessionTime: 50,
          exercises: [
            { order: 'A1', motion: 'PULLING', name: 'Lat Pulldown - Semi Supinated', reps: 8, sets: 3, tempo: '4-0-1-2', tut: 60, rest: 60 },
            { order: 'A2', motion: 'BILATERAL_QUAD', name: 'Machine Hack Squat', reps: 8, sets: 3, tempo: '4-0-1-2', tut: 60, rest: 75 },
            { order: 'B1', motion: 'PRESSING', name: 'Decline BB Press', reps: 8, sets: 3, tempo: '4-0-1-2', tut: 60, rest: 60 },
            { order: 'B2', motion: 'POSTERIOR', name: 'Lying Leg Curl', reps: 8, sets: 3, tempo: '4-0-1-2', tut: 60, rest: 60 },
            { order: 'C1', motion: 'DELT_SCAP_CONTROL', name: 'Cable Lateral Raise - Lying', reps: 8, sets: 3, tempo: '2-1-2-1', tut: 60, rest: 45 },
            { order: 'C2', motion: 'BICEPS', name: 'DB Preacher Curl', reps: 8, sets: 3, tempo: '4-0-1-2', tut: 60, rest: 45 },
            { order: 'C3', motion: 'METCON_BRACING', name: 'Farmers Walk', reps: 8, sets: 3, tempo: '', tut: 0, rest: 60 },
          ]
        },
        // ... (additional workouts)
      ]
    },
    // PHASE 3 — Block 3
    {
      id: 3,
      name: 'GBC Block 3',
      label: 'Realization',
      weeks: 4,
      sets: 3,
      repRange: '6-8',
      tempo: '5-0-X-0',
      restSeconds: 90,
      color: '#22C55E',
      workouts: [
        // ... (workouts with lower reps, heavier loads, longer rest)
      ]
    },
  ]
};

// Helper functions
export function getWorkoutById(id: string): GBCWorkout | undefined
export function getWorkoutsByPhase(phaseId: number): GBCWorkout[]
export function getWorkoutsByWeek(phaseId: number, week: number): GBCWorkout[]
export function getAllExercises(): string[]  // Unique exercise names
export function getTotalSets(workout: GBCWorkout): number
export function getTotalTUT(workout: GBCWorkout): number  // Total time under tension
export function getSessionTime(workout: GBCWorkout): number  // Estimated minutes

// ═══════════════════════════════════════════
// SET TYPE CONFIGURATION (for ExerciseCard)
// ═══════════════════════════════════════════

export const GBC_SET_TYPES = [
  { value: 'Normal', label: 'Straight Set', color: '#94A3B8' },
  { value: 'Superset', label: 'Superset', color: '#00AEEF' },
  { value: 'Triset', label: 'Triset', color: '#8B5CF6' },
  { value: 'Giant Set', label: 'Giant Set', color: '#EC4899' },
  { value: 'AMRAP', label: 'AMRAP', color: '#22C55E' },
  { value: 'Drop Set', label: 'Drop Set', color: '#EF4444' },
  { value: 'To Failure', label: 'To Failure', color: '#F59E0B' },
] as const;

// Default rest timer options (from Excel)
export const GBC_REST_OPTIONS = [30, 45, 60, 75, 90, 120, 150, 180] as const;

// Tempo notation guide: "3-2-1-1" = Eccentric-Pause-Concentric-Pause
export const TEMPO_GUIDE = {
  '3-2-1-1': { eccentric: 3, isometric_bottom: 2, concentric: 1, isometric_top: 1, description: 'Slow eccentric, 2s pause, explosive up, 1s squeeze' },
  '4-0-1-2': { eccentric: 4, isometric_bottom: 0, concentric: 1, isometric_top: 2, description: '4s negative, no pause, explosive up, 2s squeeze' },
  '5-0-X-0': { eccentric: 5, isometric_bottom: 0, concentric: 'X', isometric_top: 0, description: '5s negative, explosive concentric, no pauses' },
  '2-1-2-1': { eccentric: 2, isometric_bottom: 1, concentric: 2, isometric_top: 1, description: 'Controlled tempo with 1s pauses' },
} as const;
```

---

## PART 3: GOOGLE SHEETS TEMPLATE — ALL TABS

Here's the complete tab structure for your Google Sheets template. Copy this into a new Google Sheets workbook:

### TABS (in order):

| # | Tab Name | Purpose | Who Edits |
|---|----------|---------|-----------|
| 1 | **📋 INTRO** | Client onboarding, goals, start date, program selection | Coach fills, Client reviews |
| 2 | **🎯 Goal Setting** | TDEE calc, target weight, macro targets, calorie goals | Auto-calculated + Coach input |
| 3 | **📏 Measurements** | Body weight, body fat %, skinfolds, circumferences, BMI | Client enters weekly |
| 4 | **📐 Assessments** | Initial gym floor assessment, quarterly re-assessments | Coach-administered |
| 5 | **⚖️ Macro Calculator** | Advanced macro breakdown with meal timing | Auto from Goal Setting |
| 6 | **🍽️ Meal Plan** | Daily meal template, Mediterranean Reset option | Client follows template |
| 7 | **🥗 Food List** | Approved foods by category (protein, carbs, fats, veg) | Reference only |
| 8 | **📸 Food Photos** | Client uploads meal photos for accountability | Client uploads |
| 9 | **🏋️ Exercise Database** | All 51 exercises with video links, descriptions, cues | Reference only |
| 10 | **📊 REP SCHEMES** | Tempo guide, set/rep ranges by phase, rest periods | Reference only |
| 11 | **📅 Phase 1 (W1-4)** | Week-by-week workout logging for Block 1 | Client logs each set |
| 12 | **📅 Phase 2 (W5-8)** | Week-by-week workout logging for Block 2 | Client logs each set |
| 13 | **📅 Phase 3 (W9-12)** | Week-by-week workout logging for Block 3 | Client logs each set |
| 14 | **📈 Volume Tracker** | Total volume per session, progressive overload chart | Auto-calculated |
| 15 | **📊 Weekly Check-In** | Weight, adherence, sleep, stress, energy, hunger | Client fills weekly |
| 16 | **📸 Progress Photos** | Front/side/back photos by week | Client uploads |
| 17 | **⚡ Strength Targets** | 1RM goals, rep PRs, progressive targets | Coach sets, Client tracks |
| 18 | **📋 Program Creator** | Master workout data (the source of truth) | Coach-only, hidden |
| 19 | **🔄 Adjustments** | Program modifications, deload triggers, changes log | Coach only |
| 20 | **📊 Timeline** | Visual calendar of all 12 weeks with phase colors | Auto-generated |
| 21 | **✅ Habit Tracker** | Daily habits: sleep, water, steps, protein, veggies | Client checks daily |
| 22 | **🗓️ Daily Schedule** | Hour-by-hour daily routine template | Client fills |
| 23 | **📊 Q1 Review** | 3-month progress summary, adjustments for next quarter | Coach + Client |
| 24 | **📊 Q2 Review** | 6-month progress summary | Coach + Client |
| 25 | **📊 Q3 Review** | 9-month progress summary | Coach + Client |
| 26 | **📊 Q4 Review** | 12-month progress summary + next year planning | Coach + Client |
| 27 | **🔒 HIDE DATA** | Raw data, formulas, lookup tables | Auto-generated, hidden |

### Key Tab Specifications:

**📋 INTRO Tab:**
```
A1: "AZFIT GBC PROGRAM — CLIENT ONBOARDING"
B3: Client Name: [__________]
B4: Start Date: [__________]
B5: Program: [GBC Foundation — 12 Weeks]
B6: Phase: [Block 1: Accumulation (Weeks 1-4)]
B8: GOALS:
B9: Primary Goal: [Fat Loss / Muscle Gain / Strength / Performance]
B10: Target Weight: [___] kg
B11: Target Body Fat: [___]%
B12: Training Days/Week: [4]
B14: EQUIPMENT ACCESS:
B15: [x] Barbell  [x] Dumbbells  [x] Machines  [x] Cables  [ ] Kettlebells
```

**📏 Measurements Tab:**
```
Columns: Date | Weight (kg) | Body Fat % | Chest | Waist | Hips | Thigh | Arm | Shoulder | BMI | Notes
Row 1: Headers (frozen)
Row 2: Initial assessment (Week 0)
Rows 3+: Weekly entries (every Monday)
Conditional formatting: Green if weight decreasing (fat loss goal), Red if increasing
Sparkline chart in column L showing weight trend
```

**📅 Phase 1 (W1-4) Tab — THE WORKOUT LOG:**
```
For each of 5 workouts (Full Body 1, Full Body 2, Upper Focus, Custom 1, Custom 2):

WORKOUT HEADER:
A1: "SESSION 1 — FULL BODY 1 — PHASE 1: GBC BLOCK 1"
A2: "Week: [dropdown 1-4] | Date: [date picker] | Start Time: [time] | Duration: [auto]"

EXERCISE TABLE (columns A-M):
A: ORDER (A1, A2, B1, B2...)
B: MOTION (PULLING, PRESSING...)
C: EXERCISE (dropdown from Exercise Database)
D: TARGET REPS (auto-filled from program)
E: TARGET SETS (auto-filled)
F: TEMPO (auto-filled: "3-2-1-1")
G: TUT (auto-filled)
H: TARGET REST (auto-filled: 60s)
I: SET 1 — LOAD (client enters kg)
J: SET 1 — REPS (client enters actual reps)
K: SET 1 — RPE (1-10, client enters)
L: SET 1 — DONE (checkbox ✓)
M: SET 1 — NOTES (optional)
N-R: SET 2 (same columns)
S-W: SET 3 (same columns, if applicable)
X: TOTAL VOLUME (auto: sum of load×reps for done sets)
Y: SETS COMPLETED (auto-count of checked boxes)
Z: AVG RPE (auto-average)

AUTO-CALCULATED ROW AT BOTTOM:
- Total Session Volume
- Total Sets Completed / Total Sets
- Total TUT
- Average RPE
- Rest Timer (live countdown when set marked done)
```

**📈 Volume Tracker Tab:**
```
Columns: Week | Session | Workout Name | Total Volume | Sets Done | Avg RPE | vs Last Week
Line chart: Volume trend over 12 weeks
Bar chart: Volume by workout type
Conditional formatting: Green arrow if volume increasing week-over-week
```

**📊 Weekly Check-In Tab:**
```
Columns: Week | Date | Weight | Body Fat | Sleep (hrs) | Sleep Quality (1-10) | Stress (1-10) | Energy (1-10) | Hunger (1-10) | Adherence % | Notes
Sparkline charts for each metric
Auto-averages at bottom
```

---

## PART 4: PROGRAM BUILDER UI FLOW

### Step 1: Client Selects Program
```
┌─────────────────────────────────────────┐
│  SELECT PROGRAM                         │
│                                         │
│  ┌─────────────┐  ┌─────────────┐      │
│  │ GBC         │  │ Strength    │      │
│  │ Foundation  │  │ Focus       │      │
│  │ 12 weeks    │  │ 8 weeks     │      │
│  │ 3 phases    │  │ 2 phases    │      │
│  │ [SELECT]    │  │ [SELECT]    │      │
│  └─────────────┘  └─────────────┘      │
│                                         │
│  ┌─────────────┐  ┌─────────────┐      │
│  │ Hypertrophy │  │ Custom      │      │
│  │ High Intens │  │ Template    │      │
│  │ 6 weeks     │  │ Build your  │      │
│  │ 2 phases    │  │ own...      │      │
│  │ [SELECT]    │  │ [SELECT]    │      │
│  └─────────────┘  └─────────────┘      │
└─────────────────────────────────────────┘
```

### Step 2: Program Overview
```
┌─────────────────────────────────────────┐
│  GBC FOUNDATION — 12 WEEKS              │
│                                         │
│  ┌──────────┬──────────┬──────────┐    │
│  │ BLOCK 1  │ BLOCK 2  │ BLOCK 3  │    │
│  │ Weeks 1-4│ Weeks 5-8│ Weeks 9-12│   │
│  │ 2 sets   │ 3 sets   │ 3-4 sets │    │
│  │ 10-15 reps│ 8-10   │ 6-8 reps │    │
│  │ Tempo:   │ Tempo:   │ Tempo:   │    │
│  │ 3-2-1-1  │ 4-0-1-2  │ 5-0-X-0  │    │
│  │ [VIOLET] │ [AMBER]  │ [GREEN]  │    │
│  └──────────┴──────────┴──────────┘    │
│                                         │
│  TIMELINE BAR:                          │
│  [████VIOLET████][███AMBER███][██GREEN██] │
│  W1      W4      W5      W8      W9   W12│
│                                         │
│  WORKOUTS: 5 per week                   │
│  • Full Body 1 (GBC)                    │
│  • Full Body 2 (GBC)                    │
│  • Upper Focus (Metabolic)              │
│  • Custom 1 (Coach-defined)             │
│  • Custom 2 (Coach-defined)             │
│                                         │
│  [ASSIGN TO CLIENT]  [PREVIEW WORKOUTS] │
└─────────────────────────────────────────┘
```

### Step 3: Workout Preview (Sheets Mode)
```
┌─────────────────────────────────────────┐
│  WEEK 1 — FULL BODY 1                   │
│  Phase 1: Accumulation | GBC Method     │
│                                         │
│  TIMELINE: W1 ████ W2 ░░░░ W3 ░░░░ W4 ░░░░ │
│                                         │
│  EXERCISES:                             │
│  ┌─────────────────────────────────────┐│
│  │ A1 Chin up        10 reps  2 sets  ││
│  │ A2 DB Split Squat 10 reps  2 sets  ││
│  │    [SUPERSET — 60s rest between]   ││
│  ├─────────────────────────────────────┤│
│  │ B1 DB Incline     10 reps  2 sets  ││
│  │ B2 Seated Leg Curl 10 reps 2 sets  ││
│  │    [SUPERSET — 60s rest between]   ││
│  ├─────────────────────────────────────┤│
│  │ C1 Lateral Raise  10 reps  2 sets  ││
│  │ C2 DB Incline Curl 10 reps 2 sets  ││
│  │ C3 Front Plank     6 reps  2 sets  ││
│  │    [TRISET — 45s rest between]     ││
│  └─────────────────────────────────────┘│
│                                         │
│  TEMPO: 3-2-1-1 (slow eccentric)       │
│  EST. TIME: 45 minutes                  │
│  TOTAL SETS: 14                         │
│                                         │
│  [START WORKOUT]  [EDIT EXERCISES]      │
└─────────────────────────────────────────┘
```

### Step 4: Active Workout (Sheets Mode — THE PROGRAM BUILDER)
```
┌─────────────────────────────────────────┐
│  ⏱ 32:15  |  Lower Body Day  | [FINISH]│ ← Sticky header
├─────────────────────────────────────────┤
│  LOAD: 4,320kg | PROG: 87% | 8/12 SETS │ ← Stats bar
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ A1 Barbell Back Squat       [v]    ││ ← Collapsed
│  │ [Superset] Target: 4×6 @ 120kg     ││
│  └─────────────────────────────────────┘│
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ A2 Romanian Deadlift        [▼]    ││ ← EXPANDED
│  │ [Superset] Target: 3×8 @ 100kg     ││
│  ├─────────────────────────────────────┤│
│  │ SET 1  3×8 @ 100kg  [100] 100 [8] ││
│  │        [7] [60s ▾] [Normal ▾]  [✓] ││ ← DONE (green)
│  ├─────────────────────────────────────┤│
│  │ SET 2  3×8 @ 100kg  [100] 100 [8] ││
│  │        [8] [45s ▾] [Normal ▾]  [✓] ││ ← DONE (green)
│  ├─────────────────────────────────────┤│
│  │ SET 3  3×8 @ 100kg  [___] ___ [__] ││
│  │        [ ] [60s ▾] [Normal ▾]  [ ] ││ ← ACTIVE (input)
│  └─────────────────────────────────────┘│
│           [+ Add Set]      Vol: 1,600kg │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ B1 Leg Press                [v]    ││ ← Collapsed
│  └─────────────────────────────────────┘│
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ REST TIMER — 0:32 remaining        ││ ← Overlay (if active)
│  │ [+15s]  [+30s]  [Skip]             ││
│  └─────────────────────────────────────┘│
│                                         │
├─────────────────────────────────────────┤
│  [⏱]  [Load: 4,320kg]  [87%]  [Finish]│ ← Sticky bottom (mobile)
└─────────────────────────────────────────┘
```

---

## PART 5: PHASED IMPLEMENTATION PLAN

### Phase A: Data Layer (Week 1 — DONE ✅)
- ✅ Parse Excel → `masterWorkouts.ts`
- ✅ localStorage helpers

### Phase B: Program Wizard (Week 1-2)
1. Program selection screen (4 program cards)
2. Program overview with phase timeline
3. Workout preview with exercise list
4. Assignment to client
5. Save to localStorage

### Phase C: Sheets Mode / Program Builder (Week 2-3)
1. Day tab selector (Full Body 1, 2, Upper, Custom)
2. Exercise cards (collapsed/expanded)
3. Set rows with all inputs (load, reps, RPE, rest, type, done)
4. Stats bar (total load, progression %, timer)
5. Rest timer overlay
6. Sticky bottom bar (mobile)
7. Workout completion summary

### Phase D: Dashboard Integration (Week 3)
1. "Today's Workout" widget
2. Ring data from actual sessions
3. Activity timeline from session history
4. Achievement badges

### Phase E: Google Sheets Export (Week 4)
1. Generate Google Sheets with all 27 tabs
2. Pre-fill client data
3. Pre-fill program workouts
4. Set up formulas and conditional formatting

---

## PART 6: EXERCISE CARD — FINAL SPEC

This is the most critical component. Based on your feedback:

### What to KEEP from old Program Builder:
- ✅ Total Load display
- ✅ Progression % (actual/target)
- ✅ Workout timer
- ✅ Total exercises | sets completed/total
- ✅ Exercise code + name notation (A1, B2, etc.)
- ✅ Type dropdown (Superset, Triset, etc.)
- ✅ Client Load — manual input
- ✅ Load column — auto-displayed from Client Load
- ✅ Done checkbox — highlights entire row green
- ✅ Rest timer overlay
- ✅ + Add Set button (bottom right)
- ✅ Volume progress bar
- ✅ Vol / Avg RPE / Est 1RM summary

### What to CHANGE:
- 🔧 **Reps is now EDITABLE** — typing new reps updates the Prescribed display
- 🔧 **Prescribed auto-updates** when target or reps change
- 🔧 **Target sets×reps editable in header** — not just kg

### What to REMOVE:
- ❌ -2.5 / +2.5 quick adjust pills
- ❌ "All sets" adjustment row

### The Set Row (final):
```
SET | PRESCRIBED          | CLIENT LOAD | LOAD | REPS | RPE | REST    | TYPE     | DONE
 1  | 4×6 @ 120 kg        | [120]       | 120  | [6]  | [7] | [60s ▾] | [Normal] | [ ]
 2  | 4×6 @ 120 kg        | [120]       | 120  | [6]  | [8] | [60s ▾] | [Normal] | [✓]  ← GREEN
 3  | 4×6 @ 120 kg        | [___]       | —    | [__] | [ ] | [60s ▾] | [Normal] | [ ]
```

---

**END OF PLAN. Start with Phase B: Program Wizard.**
