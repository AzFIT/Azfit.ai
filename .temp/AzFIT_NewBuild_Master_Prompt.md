# AZFIT.AI — MASTER BUILD PROMPT FOR KIMI CODE

> **COPY THIS ENTIRE DOCUMENT INTO KIMI CODE AS A SINGLE PROMPT**
> One shot. Complete build from scratch. Clean code. No spaghetti.

---

## SECTION 0: PROJECT CONTEXT

**GitHub repo:** `https://github.com/AzFIT/Azfit.ai.git`
**Tech stack:** React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui + Framer Motion
**Hosting:** GitHub Pages (static) — HashRouter with `#/` prefix
**Data:** localStorage (all keys prefixed with `azfit_`)
**Design source:** `index.html` prototype (5301 lines — your uploaded design system)
**Assets:** `AzFIT_LOGO_Transparent.png`, `AZFITLOGOWITHTEXT.png`, `background_ai_landingpage.png`, `AZFIT_BACKGROUND_2.png`

---

## SECTION 1: NON-NEGOTIABLE RULES (VIOLATE = INSTANT FAIL)

### 1.1 File Structure (NEVER deviate)
```
src/
  main.tsx                 # Entry point — wrap app in ThemeProvider + HashRouter
  App.tsx                  # Routes only — NO logic, NO state, just <Routes>
  index.css                # Tailwind directives + CSS variables + keyframes ONLY
  types/
    index.ts               # ALL types in ONE file — no sub-files
  data/
    exercises.ts           # 200 exercises (port from old build)
    programTemplates.ts    # 84 templates (port from old build)
    constants.ts           # Colors, set types, method types, phase defaults
  lib/
    calculations.ts        # TDEE, BioPrint, macros, volume, progression math
    storage.ts             # localStorage read/write helpers — ALL storage goes through here
    utils.ts               # Formatters (time, weight, date), validators
  hooks/
    useTheme.ts            # Light/dark mode — returns 'light' | 'dark' + toggle
    useStorage.ts          # Generic localStorage hook with useState sync
    useRestTimer.ts        # Rest timer logic — port from old build, clean up
    useWorkoutSession.ts   # Active session state machine
  components/
    ui/                    # shadcn/ui components (auto-generated, DON'T hand-write)
    layout/
      Header.tsx           # Navy header bar, 64px, fixed top
      MobileNav.tsx        # Bottom tab bar on mobile, hidden on desktop
      DesktopNav.tsx       # Left sidebar on desktop, hidden on mobile
      Layout.tsx           # Orchestrates Header + Nav + main content area
    shared/
      ThemeProvider.tsx     # React Context for theme — wraps entire app
      ModeToggle.tsx        # Dashboard/Sheets animated pill toggle
      ViewToggle.tsx        # Coach/Client view switcher
      ProgressRing.tsx      # SVG circular ring — reusable for ALL rings
      ProgressBar.tsx       # Linear progress bar (wizard steps, volume)
      PhaseTimeline.tsx     # Colored segmented bar for periodization
      StepIndicator.tsx     # 5-dot wizard step indicator
      ExerciseCard.tsx      # Mobile workout card (sets as mini-cards inside)
      SetRow.tsx            # Individual set row (desktop table view)
      RestTimerOverlay.tsx  # Full-screen rest timer countdown
      ProgramWizard.tsx     # 5-step program creation wizard
      SessionLauncher.tsx   # Bottom sheet — "Start Workout?"
      WorkoutSummary.tsx    # Post-workout completion modal
      ToastProvider.tsx     # Toast notification system
  pages/
    LandingPage.tsx         # Hero with orb, AI showcase, data ticker
    DashboardPage.tsx       # 4 rings + activity timeline + badges + FAB
    SheetsPage.tsx          # Program Builder — THE main workout interface
    ProgramWizardPage.tsx   # Wrapper for ProgramWizard component
    CoachPage.tsx           # Sidebar nav, client list, program assignment
    AnalyticsPage.tsx       # Charts: weight, volume, adherence (recharts)
    SettingsPage.tsx        # Units, theme, profile, defaults
  App.tsx                   # HashRouter routes only
```

### 1.2 Architecture Rules
- **ONE types file:** `src/types/index.ts` — every type/interface/export lives here. No exceptions.
- **ONE storage layer:** `src/lib/storage.ts` — every `localStorage.getItem/setItem` call goes through helpers here. No direct localStorage access anywhere else.
- **React Context ONLY:** Use `useContext` for shared state (theme, toast, active session). NO Redux, NO Zustand, NO external state library.
- **Custom hooks for data:** Every component that reads/writes data uses a custom hook. No inline localStorage calls.
- **No prop drilling deeper than 2 levels:** If a prop needs to go 3+ levels down, use Context.
- **Components max 300 lines:** If a component exceeds 300 lines, split it into sub-components in the same file (not new files).
- **Inline styles ONLY for dynamic values:** Use Tailwind classes for all static styling. Inline styles only for dynamically calculated values (progress bar width, ring percentage).
- **Lucide icons ONLY:** No other icon library. Check lucide-react exports before using.
- **NO `any` type:** Every variable, prop, and return type must be explicitly typed. Use `unknown` if you must, then narrow.

### 1.3 Code Quality Rules
- **Comments:** JSDoc on every exported function/component. One-line comments for complex logic only. NO commented-out code.
- **Naming:** PascalCase for components/types, camelCase for functions/variables, UPPER_SNAKE for constants. Prefix booleans with `is`/`has`/`should`.
- **Imports:** Grouped order: React → third-party → components → hooks → types → utils. Absolute imports (`@/components/...`) preferred.
- **Error handling:** Every localStorage read wrapped in try/catch. Every async operation has error state. No silent failures.
- **Console:** ZERO console.log in production code. Use the toast system for user-facing messages.

---

## SECTION 2: DESIGN TOKENS (EXACT VALUES FROM PROTOTYPE)

### 2.1 Light Mode (default)
```css
:root {
  --azfit-bg-primary: #F8FAFC;
  --azfit-bg-card: #FFFFFF;
  --azfit-bg-elevated: #F1F5F9;
  --azfit-border-default: #E2E8F0;
  --azfit-border-focus: #00AEEF;
  --azfit-text-primary: #0F172A;
  --azfit-text-secondary: #64748B;
  --azfit-text-muted: #94A3B8;
  --azfit-cyan: #00AEEF;
  --azfit-cyan-hover: #0095CC;
  --azfit-navy: #0B1120;
  --azfit-success: #22C55E;
  --azfit-warning: #F59E0B;
  --azfit-error: #EF4444;
  --azfit-phase-accumulation: #8B5CF6;
  --azfit-phase-intensification: #F59E0B;
  --azfit-phase-realization: #22C55E;
  --azfit-shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --azfit-shadow-md: 0 4px 12px rgba(0,0,0,0.08);
  --azfit-shadow-lg: 0 8px 24px rgba(0,0,0,0.12);
  --azfit-shadow-glow: 0 0 20px rgba(0,174,239,0.3);
  --azfit-radius-card: 10px;
  --azfit-radius-input: 6px;
  --azfit-radius-pill: 9999px;
}
```

### 2.2 Dark Mode
```css
[data-theme="dark"] {
  --azfit-bg-primary: #0B1120;
  --azfit-bg-card: #151D2E;
  --azfit-bg-elevated: #1E2940;
  --azfit-border-default: #2A3A50;
  --azfit-border-focus: #00AEEF;
  --azfit-text-primary: #F1F5F9;
  --azfit-text-secondary: #94A3B8;
  --azfit-text-muted: #64748B;
  --azfit-shadow-md: 0 4px 12px rgba(0,0,0,0.25);
  --azfit-shadow-lg: 0 8px 24px rgba(0,0,0,0.35);
}
```

### 2.3 Tailwind Config Extensions
```javascript
// tailwind.config.js — extend theme
theme: {
  extend: {
    colors: {
      azfit: {
        bg: 'var(--azfit-bg-primary)',
        card: 'var(--azfit-bg-card)',
        elevated: 'var(--azfit-bg-elevated)',
        border: 'var(--azfit-border-default)',
        'border-focus': 'var(--azfit-border-focus)',
        text: 'var(--azfit-text-primary)',
        'text-secondary': 'var(--azfit-text-secondary)',
        'text-muted': 'var(--azfit-text-muted)',
        cyan: '#00AEEF',
        'cyan-hover': '#0095CC',
        navy: '#0B1120',
      }
    },
    fontFamily: {
      sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
    },
    borderRadius: {
      card: '10px',
      input: '6px',
    },
    boxShadow: {
      'azfit-sm': 'var(--azfit-shadow-sm)',
      'azfit-md': 'var(--azfit-shadow-md)',
      'azfit-lg': 'var(--azfit-shadow-lg)',
      'azfit-glow': 'var(--azfit-shadow-glow)',
    }
  }
}
```

---

## SECTION 3: DATA LAYER (src/lib/storage.ts)

ALL localStorage access goes through here. No exceptions.

```typescript
// Storage keys — ALL prefixed with azfit_
const KEYS = {
  THEME: 'azfit_theme',
  CLIENTS: 'azfit_clients',
  PROGRAMS: 'azfit_programs',
  SESSIONS: 'azfit_sessions',
  SCHEDULED: 'azfit_scheduled_sessions',
  ACTIVE_SESSION: 'azfit_active_session',
  SETTINGS: 'azfit_settings',
  NOTES: (clientId: string) => `azfit_notes_${clientId}`,
} as const;

// Generic helpers
function get<T>(key: string, fallback: T): T
function set<T>(key: string, value: T): void
function remove(key: string): void

// Domain-specific helpers
function getClients(): Client[]
function saveClient(client: Client): void
function getPrograms(): Program[]
function saveProgram(program: Program): void
function getSessions(): WorkoutSession[]
function saveSession(session: WorkoutSession): void
function getActiveSession(): WorkoutSession | null
function setActiveSession(session: WorkoutSession | null): void
function getSettings(): Settings
function saveSettings(settings: Partial<Settings>): void
```

---

## SECTION 4: TYPE DEFINITIONS (src/types/index.ts)

```typescript
// ═══════════════════════════════════════════
// CORE TYPES
// ═══════════════════════════════════════════

export type Theme = 'light' | 'dark';
export type ViewMode = 'coach' | 'client';
export type AppMode = 'dashboard' | 'sheets';
export type Gender = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type DietPreference = 'balanced' | 'low_carb' | 'high_carb' | 'high_protein';
export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
export type ProgramCategory = 'Strength' | 'Hypertrophy' | 'Fat Loss' | 'Performance' | 'Powerlifting' | 'Athletic' | 'Bodybuilding' | 'Functional' | 'HIIT' | 'Endurance' | 'Rehab';
export type ProgramLevel = 'Beginner' | 'Intermediate' | 'Advanced';
export type SetType = 'Normal' | 'Warm-up' | 'Drop Set' | 'To Failure' | 'AMRAP' | 'Superset' | 'Giant Set' | 'Cluster' | 'Back-off' | 'Eccentric';
export type SplitType = 'Upper/Lower' | 'Push/Pull/Legs' | 'Full Body' | 'Bro Split' | 'Custom';
export type WizardStep = 1 | 2 | 3 | 4 | 5;

// ═══════════════════════════════════════════
// CLIENT
// ═══════════════════════════════════════════

export interface PersonalInfo {
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: Gender;
  emergencyContact: { name: string; phone: string };
}

export interface ClientGoals {
  primary: string;
  secondary: string;
  experienceLevel: 'beginner' | 'intermediate' | 'advanced';
  equipment: string[];
  sessionsPerWeek: number;
  duration: string;
  targetWeight: number;
}

export interface BodyAssessment {
  date: string;
  weight: number;
  height: number;
  bmi: number;
  bodyFatPercent: number;
  skinfolds: Record<string, number>;
  circumferences: Record<string, number>;
  tdee: number;
}

export interface MedicalInfo {
  injuries: string[];
  medications: string[];
  allergies: string[];
  clearedToExercise: 'yes' | 'no' | 'with_restrictions';
  restrictions: string;
  conditions: string[];
}

export interface NutritionData {
  dietPreference: DietPreference;
  maintenanceCalories: number;
  fatLossCalories: number;
  muscleGainCalories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  waterIntake: number;
  mealsPerDay: number;
  foodAllergies: string[];
  supplements: string[];
}

export interface Client {
  id: string;
  personal: PersonalInfo;
  goals: ClientGoals;
  bodyAssessments: BodyAssessment[];  // ARRAY — history of all assessments
  nutrition: NutritionData;
  medical: MedicalInfo;
  status: 'active' | 'paused' | 'archived';
  createdAt: string;
  updatedAt: string;
}

// ═══════════════════════════════════════════
// PROGRAM
// ═══════════════════════════════════════════

export interface ProgramTemplate {
  id: string;
  name: string;
  category: ProgramCategory;
  level: ProgramLevel;
  durationWeeks: number;
  frequency: number;
  split: SplitType;
  description: string;
  equipment: string[];
  phases: PhaseConfig[];
  exercises: { exerciseId: string; sets: number; reps: string; rest: number }[];
}

export interface PhaseConfig {
  name: string;
  weeks: number;
  sets: string;
  reps: string;
  intensity: string;
  restSeconds: number;
  tempo: string;
  color: string;
}

export interface WorkoutExercise {
  exerciseId: string;
  exerciseName: string;
  targetSets: number;
  targetReps: string;
  targetLoad: number;
  restSeconds: number;
  notes: string;
  sets: LoggedSet[];
}

export interface LoggedSet {
  setNumber: number;
  type: SetType;
  prescribed: string;       // "4×6 @ 120 kg"
  clientLoad: number;       // editable input
  load: number;             // displayed (mirrors clientLoad)
  reps: number;             // editable input
  rpe: number;              // 1-10
  restSeconds: number;
  done: boolean;
  isPr: boolean;
}

export interface Program {
  id: string;
  coachId: string;
  clientId: string;
  clientName: string;
  name: string;
  templateId: string;
  status: 'active' | 'paused' | 'completed';
  config: {
    goal: string;
    split: SplitType;
    trainingDays: DayOfWeek[];
    frequency: number;
    durationWeeks: number;
    phases: PhaseConfig[];
  };
  exercises: WorkoutExercise[];
  createdAt: string;
  updatedAt: string;
}

// ═══════════════════════════════════════════
// WORKOUT SESSION
// ═══════════════════════════════════════════

export interface WorkoutSession {
  id: string;
  programId: string;
  clientId: string;
  clientName: string;
  programName: string;
  dayName: string;
  dayOfWeek: DayOfWeek;
  phaseName: string;
  exercises: WorkoutExercise[];
  startTime: string;
  endTime?: string;
  durationMinutes: number;
  totalVolume: number;
  totalSets: number;
  completedSets: number;
  avgRpe: number;
  coachNotes: string;
  status: 'in_progress' | 'completed' | 'cancelled';
  createdAt: string;
}

// ═══════════════════════════════════════════
// EXERCISE
// ═══════════════════════════════════════════

export interface Exercise {
  id: string;
  name: string;
  primaryMuscle: string;
  secondaryMuscle: string;
  equipment: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  type: 'Compound' | 'Isolation' | 'Isometric' | 'Olympic';
  description: string;
  safetyNotes: string;
  met: number;
}

// ═══════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════

export interface Settings {
  units: 'metric' | 'imperial';
  defaultRestSeconds: number;
  currency: string;
  defaultSessionPrice: number;
  theme: Theme;
  soundEnabled: boolean;
  hapticEnabled: boolean;
}

// ═══════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  duration: number;
}
```

---

## SECTION 5: COMPONENT SPECS

### 5.1 ThemeProvider (src/components/shared/ThemeProvider.tsx)
```
- React Context providing: theme ('light' | 'dark'), toggleTheme(), setTheme()
- On mount: reads azfit_theme from localStorage, defaults to 'light'
- On change: writes to localStorage, sets data-theme attribute on <html>
- ALL themed elements use CSS custom properties — no JS color switching
- Smooth transition: background-color 300ms, color 300ms, border-color 300ms
```

### 5.2 Header (src/components/layout/Header.tsx)
```
Height: 64px, fixed top, z-50
Background: #0B1120 (ALWAYS navy — doesn't change with theme)
Left: Logo icon (36px circle, cyan bg, "AF" text) + "AzFIT" text (white, 18px, font-bold)
Center (desktop only): Page title (14px, rgba(255,255,255,0.7), border-left)
Right: ModeToggle pill (Dashboard/Sheets) + Theme toggle button (sun/moon) + User avatar
Mobile: Hide center title, compact ModeToggle
```

### 5.3 ModeToggle (src/components/shared/ModeToggle.tsx)
```
Animated pill toggle: Dashboard | Sheets
Background track: #1E293B, rounded-full
Active tab: cyan bg (#00AEEF), white text, slides with CSS transition
Inactive tab: transparent, gray text
Click triggers: navigate to /dashboard or /sheets
Current route determines active tab
Transition: 300ms ease, transform + background-color
```

### 5.4 MobileNav (src/components/layout/MobileNav.tsx)
```
Fixed bottom bar, 56px height, z-40
Background: var(--azfit-bg-card), border-top: 1px solid var(--azfit-border-default)
5 tabs: Home, Sheets, Analytics, Coach, Settings
Each: icon (20px) + label (10px), centered vertically
Active: cyan icon + cyan text
Inactive: muted gray
Hidden on desktop (md:hidden)
```

### 5.5 DesktopNav (src/components/layout/DesktopNav.tsx)
```
Fixed left sidebar, 240px width, top: 64px, bottom: 0
Background: var(--azfit-bg-card), border-right: 1px solid var(--azfit-border-default)
Navigation items with icons: Dashboard, Sheets, Analytics, Coach, Settings
Active: cyan left border, cyan text, bg rgba(0,174,239,0.06)
Hover: bg var(--azfit-bg-elevated)
Hidden on mobile (hidden md:flex)
```

### 5.6 ProgressRing (src/components/shared/ProgressRing.tsx)
```
Props: { value: number; max: number; size: number; color: string; label: string; sublabel: string }
SVG circle with stroke-dasharray animation
Center text: value (font-mono, bold) + label below (small, muted)
Subtle glow shadow when value > 80%
Animated on mount: stroke-dashoffset transitions from full to calculated
Duration: 1000ms, easing: cubic-bezier(0.4, 0, 0.2, 1)
```

### 5.7 ProgramWizard (src/components/shared/ProgramWizard.tsx)
```
5-step wizard: Setup → Phases → Split → Review → Save
Step indicator: 5 dots connected by lines (see prototype CSS)
Active dot: cyan fill + glow
Completed dot: green fill + checkmark
Upcoming dot: gray border only
Progress bar above steps: linear, cyan gradient fill
Step transitions: slide left/right, 400ms ease
Each step is a wizard-step div with .active/.entering/.leaving classes
```

### 5.8 ExerciseCard — MOBILE (src/components/shared/ExerciseCard.tsx)
```
THE CRITICAL COMPONENT. This IS the Program Builder on mobile.

Collapsed state:
┌─────────────────────────────────────┐
│ [A1] Barbell Back Squat     [v]    │
│ [Superset]  Target: 4×6 @ 120kg    │
└─────────────────────────────────────┘
- Exercise code: mono, cyan bg/10, cyan text, rounded
- Exercise name: 15px, bold, primary text
- Method badge: only shown if NOT "Normal". Colors per set type.
- Scheme: "4×6" in cyan, tabular-nums
- Target input: 56px wide, editable number — changing updates Prescribed
- Unit: "kg" or "lbs"
- Chevron: rotates 180° when expanded

Expanded state:
- Border: cyan/25, subtle glow shadow
- Set table header: Set | Prescribed | Client Load | Load | Reps | RPE | Rest | Type | Done
- Each set row: 44px height, border-b

SET ROW (the core interaction):
- Set number: 32px wide, mono, muted
- Prescribed: "{sets}×{reps} @ {target} {unit}" — auto-updates when target/reps change
- Client Load: 64px input, editable — on change updates Load column
- Load: display only, mirrors Client Load, shows "—" if empty
- Reps: 40px input, EDITABLE — on change updates Prescribed column
- RPE: 40px input, 1-10
- Rest: select dropdown (30s-360s) OR active countdown with +15/+30/Skip
- Type: select dropdown with SET_TYPES
- Done: checkbox — when checked → row bg green/22, green left border, auto-start rest timer

Summary bar (bottom of card):
- Progress bar: gradient fill (cyan→purple), shows completion %
- Vol: {actual} / {target} {unit}
- Avg RPE: cyan colored
- Est 1RM: purple colored
- Note toggle button (sticky note icon)
- + Add Set button: gradient cyan→purple, white text

When ALL sets done:
- Card border: green/20, green glow shadow
- "All Sets Complete" badge

Done behavior:
1. Checkbox clicked → auto-fill clientLoad from target, auto-fill reps from target
2. Copy clientLoad → load
3. Check for PR (compare to lift records)
4. Start rest timer
5. Carry over to next empty set (auto-fill same load/reps)

REMOVE: -2.5/+2.5 quick adjust pills (NOT in this design)
```

### 5.9 RestTimerOverlay (src/components/shared/RestTimerOverlay.tsx)
```
Full-screen overlay, z-50, bg rgba(11,17,32,0.95)
Center: large countdown MM:SS
  - < 15s: red, bold
  - < 30s: amber
  - >= 30s: cyan
Below countdown: [+15s] [+30s] [Skip] buttons
Bottom: "Next: {exercise name} — Set {number}"
Dismiss: timer hits 0 OR Skip clicked
Animation: fade in 200ms, fade out 200ms
```

### 5.10 SessionLauncher (src/components/shared/SessionLauncher.tsx)
```
Bottom sheet modal (mobile) / centered modal (desktop)
Slide up from bottom on mobile, fade in on desktop

Content:
- Client name (large, bold)
- Program name + "Day {N} of {total}"
- Current phase name
- List of today's exercises with set counts
- Est. duration
- "Last session: X days ago"
- [Start Workout] button: cyan, large, full-width on mobile
- [Choose Different Day] dropdown

Behavior:
- Creates WorkoutSession object
- Pre-fills prescribed sets/reps from program's current phase
- Sets startTime to now
- Navigates to /sheets?session={sessionId}
- Saves session to localStorage with status 'in_progress'
```

### 5.11 WorkoutSummary (src/components/shared/WorkoutSummary.tsx)
```
Modal overlay, centered
Content:
- "Workout Complete!" with checkmark animation
- Duration: MM:SS
- Total Volume: X,XXX kg
- Sets Done: X/Y
- Avg RPE: X.X
- Volume vs last week: bar chart + percentage
- [View Full Summary] / [Done] buttons
- [Add Coach Notes] expandable textarea

Saves session to localStorage with status 'completed'
Updates client's body assessment if weight/reps changed
```

---

## SECTION 6: PAGE SPECS

### 6.1 LandingPage (src/pages/LandingPage.tsx)
```
Hero section (full viewport):
- Left (55%): Label "The First of Its Kind", Title "AZFIT" (gradient cyan→blue, 110px),
  Subtitle, Description, CTA buttons (trial + features), Trust text, 3 stats
- Right (45%): The AzFIT Orb (from AzFIT_Hero_Orb.html — breathing, wireframes, orbiting dots)

Features section (id="features"):
- 3×2 grid of feature cards with icons
- Card: white bg, border, rounded-card, shadow-sm, hover lift

AI Showcase section:
- Left: "AI That Coaches With You" title, description, 3 checkmark features, CTA button
- Right: Central brain icon with 8 orbiting skill icons (dumbbell, pulse, brain, heart,
  chart, message, calendar, bar chart) rotating at different speeds,
  floating coaching cue card, pulse wave ripples

Data Stream Ticker (bottom):
- 3 rows of scrolling monospace text
- Row 1: LOAD • VOLUME • INTENSITY • HR_ZONE • RECOVERY • STREAK • SYNC • COACH • ...
- Row 2: AI_COACH • BIOPRINT • TDEE_CALC • WEARABLE • MACRO • SET • REP • REST • ...
- Row 3: SESSION_01 • SESSION_02 • CLIENT_247 • CHECK_IN • STREAK_14 • GOAL_HIT • ...
- Edge fade mask, different scroll speeds, reverse directions
```

### 6.2 DashboardPage (src/pages/DashboardPage.tsx)
```
Stats bar (top):
4 circular rings in a row (2×2 grid on mobile):
1. Fitness Score — 87% (green if >80, amber if 50-80, red if <50)
2. Macros — 65% protein target
3. Steps — 8,432 / 10,000
4. Sleep — 7h 12m / 8h
Ring size: 140px desktop, 110px tablet, 90px mobile

Activity Timeline (below rings):
Vertical timeline with dots connected by line
Each entry: time, activity type (color-coded), description, duration
Types: workout (cyan), meal (green), sleep (purple), note (amber)

Achievement Badges (horizontal scroll):
Row of circular badges with icons, scrollable horizontally
Badge: 64px circle, locked=gray/dim, unlocked=cyan border + colored fill
Examples: First Session, Volume PR, 7-Day Streak, Perfect Week, Heavy Lifter

FAB (bottom right):
+ button, cyan bg, navy text, shadow-glow
Opens: Start Session (if program assigned) or Create Program

Today Widget (top on mobile):
"Today's Workout: Lower Body — 4 exercises"
[Start Workout] button
If no workout: "Rest Day 😴" or "No program assigned"
```

### 6.3 SheetsPage (src/pages/SheetsPage.tsx)
```
THE PROGRAM BUILDER. This is the main workout interface.

Header bar (below app header):
- If in active session: Timer (cyan, mono) | "Lower Body Day" | [Finish]
- If viewing program: Program name | Day selector | [Start Session]

Stats bar (sticky below header):
┌──────────────────────────────────────────────────────────┐
│ Total Load: 4,320kg  |  Progression: 87% ↑  |  Exercises: 4 | 12/16 sets  |  ⏱ 32:15 │
└──────────────────────────────────────────────────────────┘
- Total Load: sum of (load × reps) for all completed sets
- Progression: (actualTotalLoad / targetTotalLoad) × 100
- Exercises: count | completedSets/totalSets
- Timer: elapsed time since session start

Day tabs (if program has multiple days):
Horizontal scrollable tabs: Day 1: Push | Day 2: Pull | Day 3: Legs | Day 4: Rest
Active: cyan border/bottom, bold text
Inactive: gray border, muted text
Rest days: dashed border, dimmed

Exercise list:
Array of ExerciseCard components (collapsed by default)
Tap/click to expand
First exercise auto-expands if session is in_progress

Empty state:
"No workout assigned" illustration + [Assign Program] button

Sticky bottom bar (mobile only):
[⏱ Timer]  [Load: X,XXXkg]  [XX%]  [Finish Workout]
```

### 6.4 ProgramWizardPage (src/pages/ProgramWizardPage.tsx)
```
Full-page wizard (no side nav, minimal header)
5 steps:
1. Setup: Goal select, Experience level, Frequency, Duration (radio cards), Equipment (checkboxes)
2. Phases: 3 phase cards (Foundation/Development/Peak), timeline bar, auto-generated from goal+level
3. Split: Day cards in 2-column grid (Mon-Sun), tap to assign Push/Pull/Legs/Rest, split summary sidebar
4. Review: Exercise list table, AI suggestion banner, edit/remove exercises
5. Save: Program name input, client assignment, [Save Program] button

Progress bar: linear, cyan gradient, percentage text
Step indicator: 5 dots with labels
Navigation: [Back] [Continue] (Back hidden on step 1, Continue becomes [Save] on step 5)
```

### 6.5 CoachPage (src/pages/CoachPage.tsx)
```
Left sidebar (desktop): Client list with avatars + status dots
Main content area:
- Client cards: name, avatar, status badge, last session, adherence %
- Tap card → Client detail view
- Client detail: profile info, body assessment history, assigned program, workout history
- [Assign Program] button → opens ProgramWizard with client pre-selected
- [Start Session] button → opens SessionLauncher

Mobile: Client list is full-screen, tap pushes detail view
```

### 6.6 AnalyticsPage (src/pages/AnalyticsPage.tsx)
```
Tab selector: Weight | Body Fat | Volume | Adherence

Weight tab: LineChart (recharts), X=dates, Y=weight, goal line dashed
Body Fat tab: LineChart, shaded healthy range
Volume tab: BarChart, weekly total volume
Adherence tab: PieChart, completed/missed/skipped

Each chart: responsive container, tooltip on hover, grid lines
Time range selector: 7d | 30d | 90d | All

Install: npm install recharts
```

### 6.7 SettingsPage (src/pages/SettingsPage.tsx)
```
Card-based layout, single column max-width 600px centered

Sections:
1. Profile: Name, email, studio name, logo upload
2. Units: Metric/Imperial toggle (radio cards)
3. Defaults: Default rest time (select), Default session price (input), Currency (select)
4. Preferences: Sound toggle, Haptic toggle (mobile only)
5. Theme: Light/Dark/System (radio cards)
6. Danger: [Export Data] [Import Data] [Reset All] — all with confirmation

Each section: card bg, rounded, border, padding
Toggle switches for booleans (see prototype CSS)
Select dropdowns for choices (see prototype CSS)
```

---

## SECTION 7: CONSTANTS (src/data/constants.ts)

```typescript
export const SET_TYPES: { value: SetType; label: string; color: string }[] = [
  { value: 'Normal', label: 'Normal', color: '#94A3B8' },
  { value: 'Warm-up', label: 'Warm-up', color: '#F59E0B' },
  { value: 'Drop Set', label: 'Drop Set', color: '#EF4444' },
  { value: 'To Failure', label: 'To Failure', color: '#8B5CF6' },
  { value: 'AMRAP', label: 'AMRAP', color: '#22C55E' },
  { value: 'Superset', label: 'Superset', color: '#F59E0B' },
  { value: 'Giant Set', label: 'Giant Set', color: '#EC4899' },
  { value: 'Cluster', label: 'Cluster', color: '#06B6D4' },
  { value: 'Back-off', label: 'Back-off', color: '#64748B' },
  { value: 'Eccentric', label: 'Eccentric', color: '#A855F7' },
];

export const PHASE_COLORS = {
  accumulation: '#8B5CF6',
  intensification: '#F59E0B',
  realization: '#22C55E',
} as const;

export const DEFAULT_PHASES: PhaseConfig[] = [
  { name: 'Foundation', weeks: 4, sets: '3-4', reps: '8-12', intensity: '70%', restSeconds: 90, tempo: '3-0-1-0', color: '#8B5CF6' },
  { name: 'Development', weeks: 4, sets: '3', reps: '6-8', intensity: '80%', restSeconds: 120, tempo: '2-1-1-0', color: '#F59E0B' },
  { name: 'Intensification', weeks: 4, sets: '2-3', reps: '4-6', intensity: '85%', restSeconds: 180, tempo: '2-0-X-0', color: '#22C55E' },
];

export const REST_OPTIONS = [30, 45, 60, 90, 120, 150, 180, 210, 240, 300, 360];

export const MOBILE_NAV_ITEMS = [
  { label: 'Home', icon: 'Home', path: '/dashboard' },
  { label: 'Sheets', icon: 'Sheet', path: '/sheets' },
  { label: 'Analytics', icon: 'BarChart3', path: '/analytics' },
  { label: 'Coach', icon: 'Users', path: '/coach' },
  { label: 'Settings', icon: 'Settings', path: '/settings' },
] as const;
```

---

## SECTION 8: BUILD ORDER (EXECUTE IN THIS EXACT ORDER)

### Phase 0: Project Scaffold (1 session)
1. Run `npm create vite@latest azfit.ai -- --template react-ts`
2. `cd azfit.ai && npm install`
3. `npm install react-router-dom framer-motion lucide-react recharts clsx tailwind-merge class-variance-authority @radix-ui/react-slot`
4. `npx tailwindcss init -p` — configure tailwind.config.js with theme extensions (Section 2.3)
5. `npx shadcn@latest init` — select Vite, React, New York, Inter, CSS variables
6. Create folder structure from Section 1.1
7. Copy assets to `public/`: logo PNGs, background PNGs
8. Write `src/types/index.ts` (Section 4)
9. Write `src/data/constants.ts` (Section 7)
10. Write `src/lib/storage.ts` (Section 3)
11. Write `src/lib/utils.ts` (formatters)
12. Write `src/index.css` (Tailwind directives + CSS variables from Section 2)
13. Write `src/main.tsx` (ThemeProvider + HashRouter wrapper)
14. Commit: `git add . && git commit -m "Phase 0: Project scaffold" && git push`

### Phase 1: Layout Shell (1 session)
15. Write `src/components/shared/ThemeProvider.tsx`
16. Write `src/components/layout/Header.tsx`
17. Write `src/components/layout/MobileNav.tsx`
18. Write `src/components/layout/DesktopNav.tsx`
19. Write `src/components/layout/Layout.tsx`
20. Write `src/components/shared/ModeToggle.tsx`
21. Write `src/components/shared/ViewToggle.tsx`
22. Write `src/components/shared/ToastProvider.tsx`
23. Write `src/App.tsx` (routes only — all pages stubbed with placeholder div)
24. **VERIFY:** All routes work, layout renders, theme toggles, mode toggle navigates, toast works
25. Commit + push

### Phase 2: Landing Page (1 session)
26. Write `src/pages/LandingPage.tsx` — hero with orb, features grid, AI showcase, data ticker
27. Use AzFIT_Hero_Orb.html and AzFIT_AI_Showcase.html as visual references
28. **VERIFY:** Hero orb animates, AI icons rotate, ticker scrolls, responsive
29. Commit + push

### Phase 3: Dashboard Page (1 session)
30. Write `src/components/shared/ProgressRing.tsx`
31. Write `src/pages/DashboardPage.tsx` — 4 rings, activity timeline, badges, FAB
32. Use hardcoded data for rings (will connect to real data in Phase 6)
33. **VERIFY:** Rings animate on mount, timeline scrolls, badges horizontal scroll, FAB visible
34. Commit + push

### Phase 4: Sheets Mode / Program Builder (2-3 sessions)
35. Port `src/data/exercises.ts` from old build (200 exercises)
36. Port `src/data/programTemplates.ts` from old build (84 templates)
37. Port `src/lib/calculations.ts` from old build (TDEE, macros, volume)
38. Write `src/hooks/useRestTimer.ts` (port + clean up from old build)
39. Write `src/hooks/useWorkoutSession.ts`
40. Write `src/components/shared/ExerciseCard.tsx` — THE critical component (Section 5.8)
41. Write `src/components/shared/RestTimerOverlay.tsx`
42. Write `src/components/shared/SessionLauncher.tsx`
43. Write `src/components/shared/WorkoutSummary.tsx`
44. Write `src/pages/SheetsPage.tsx` — stats bar, day tabs, exercise list, sticky bottom bar
45. **VERIFY:** Exercise cards expand/collapse, set logging works, rest timer fires, volume calculates, done highlighting works, add set works, progression % updates
46. Commit + push

### Phase 5: Program Wizard (1-2 sessions)
47. Write `src/components/shared/StepIndicator.tsx`
48. Write `src/components/shared/PhaseTimeline.tsx`
49. Write `src/components/shared/ProgramWizard.tsx` — 5 steps
50. Write `src/pages/ProgramWizardPage.tsx`
51. **VERIFY:** All 5 steps work, preview sidebar updates, save to localStorage
52. Commit + push

### Phase 6: Data Integration (1 session)
53. Connect Dashboard rings to real session data
54. Connect activity timeline to session history
55. Connect achievement badges to workout milestones
56. Write `src/hooks/useStorage.ts`
57. **VERIFY:** Dashboard shows real data after completing a workout session
58. Commit + push

### Phase 7: Coach + Analytics + Settings (1-2 sessions)
59. Write `src/pages/CoachPage.tsx`
60. Write `src/pages/AnalyticsPage.tsx` (recharts)
61. Write `src/pages/SettingsPage.tsx`
62. **VERIFY:** All pages render, charts show data, settings persist
63. Commit + push

### Phase 8: Polish & Deploy (1 session)
64. Responsive testing: 320px, 768px, 1024px, 1440px
65. Dark mode testing: every page, every component
66. Animation audit: all transitions smooth, no jank
67. localStorage data integrity: refresh preserves all state
68. Build: `npm run build` — zero errors, zero warnings
69. Deploy to GitHub Pages
70. Final commit + push

---

## SECTION 9: VERIFICATION CHECKLIST

After EVERY phase, verify ALL of these before proceeding:

- [ ] `npm run build` succeeds with ZERO errors and ZERO warnings
- [ ] No console errors in browser dev tools
- [ ] Responsive at 320px (mobile), 768px (tablet), 1024px+ (desktop)
- [ ] Dark mode toggle works on every page
- [ ] All routes navigate correctly (no 404s)
- [ ] localStorage data persists after page refresh
- [ ] All animations are smooth (no jank, no flash of unstyled content)
- [ ] All interactive elements are keyboard accessible
- [ ] Touch targets are minimum 44px on mobile
- [ ] No `any` types (run `npx tsc --noEmit`)
- [ ] No unused imports or variables
- [ ] Code is under 300 lines per component file

---

## SECTION 10: REMINDERS

1. **Start from Phase 0.** Do NOT skip the scaffold. The folder structure and types are the foundation.
2. **Commit after EVERY phase.** Push to GitHub after each section.
3. **Verify before proceeding.** Use the checklist in Section 9.
4. **The ExerciseCard is the hardest part.** Spend extra time on it. Everything else builds on top.
5. **Port data from old build.** The exercises.ts, programTemplates.ts, and calculations.ts from the old AzFIT repo are battle-tested — use them.
6. **Keep it simple.** If a feature feels complex, simplify it. Better to ship clean code than perfect features.
7. **Ask if stuck.** If something in this prompt is unclear, ask before making assumptions.

---

**END OF PROMPT. Start with Phase 0: Project Scaffold.**
