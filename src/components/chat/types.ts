

/* ── Rich Content Types ────────────────────────────────── */

export interface ProgramContent {
  type: 'program';
  days: {
    dayNumber: number;
    name: string;
    exercises: {
      name: string;
      sets: string;
      reps: string;
      rpe: string;
      notes?: string;
    }[];
  }[];
  periodization: string;
  weeks: number;
  daysPerWeek: number;
}

export interface ExerciseSwapContent {
  type: 'exercise_swap';
  original: { name: string; reason: string };
  replacement: { name: string; sets: string; reps: string; rpe: string; reasoning: string };
}

export interface InsightContent {
  type: 'insight';
  severity: 'warning' | 'danger' | 'info';
  clientName: string;
  title: string;
  description: string;
  suggestedAction: string;
}

export type MessageContent = ProgramContent | ExerciseSwapContent | InsightContent;

export type GuidedFlow =
  | { type: 'log_weight' }
  | { type: 'habit_done'; candidates: { id: string; name: string }[] };

/* ── Base Types ────────────────────────────────────────── */

export type IntentType =
  | 'workout'
  | 'nutrition'
  | 'client'
  | 'progress'
  | 'settings'
  | 'help'
  | 'greeting'
  | 'navigation'
  | 'generate_program'
  | 'exercise_substitute'
  | 'deload'
  | 'analyze'
  | 'unknown';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
  actions?: ChatAction[];
  content?: MessageContent;
  dbId?: string;
  feedback?: 1 | -1;
}

export interface ChatAction {
  label: string;
  type: 'navigate' | 'suggest' | 'link' | 'apply' | 'dismiss' | 'customize';
  payload: string;
}

export interface IntentResult {
  intent: IntentType;
  confidence: number;
  matchedKeywords: string[];
}

export interface PageContext {
  pageId: string;
  path: string;
  primaryContext: IntentType;
  label: string;
}

export const PAGE_CONTEXTS: PageContext[] = [
  { pageId: 'dashboard', path: '/dashboard', primaryContext: 'workout', label: 'Dashboard' },
  { pageId: 'analytics', path: '/analytics', primaryContext: 'progress', label: 'Analytics' },
  { pageId: 'coach', path: '/coach', primaryContext: 'client', label: 'Coach' },
  { pageId: 'program-builder', path: '/program-builder', primaryContext: 'workout', label: 'Program Builder' },
  { pageId: 'sheets', path: '/sheets', primaryContext: 'workout', label: 'Workout Sheets' },
  { pageId: 'settings', path: '/settings', primaryContext: 'settings', label: 'Settings' },
  { pageId: 'onboarding', path: '/onboarding', primaryContext: 'client', label: 'Onboarding' },
  { pageId: 'bioprint', path: '/bioprint', primaryContext: 'progress', label: 'Bio Print' },
  { pageId: 'nutrition', path: '/nutrition', primaryContext: 'nutrition', label: 'Nutrition' },
  { pageId: 'coach-ai', path: '/coach-ai', primaryContext: 'help', label: 'AI Coach' },
];
