 

export type IntentType =
  | 'workout'
  | 'nutrition'
  | 'client'
  | 'progress'
  | 'settings'
  | 'help'
  | 'greeting'
  | 'navigation'
  | 'unknown';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
  actions?: ChatAction[];
}

export interface ChatAction {
  label: string;
  type: 'navigate' | 'suggest' | 'link';
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
];
