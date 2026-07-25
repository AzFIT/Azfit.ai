 
import type { IntentType, IntentResult, PageContext } from './types';

const INTENT_KEYWORDS: Record<IntentType, string[]> = {
  workout: [
    'workout', 'exercise', 'training', 'gym', 'lift', 'lifting', 'session',
    'set', 'rep', 'bench', 'squat', 'deadlift', 'cardio', 'hiit',
    'start workout', 'begin workout', 'log workout', 'workout log',
    'program', 'routine', 'split', 'full body', 'upper', 'lower',
    'rest timer', 'rest between sets', 'volume', 'pr', 'personal record',
  ],
  nutrition: [
    'food', 'eat', 'meal', 'calorie', 'macro', 'protein', 'carb', 'fat',
    'diet', 'nutrition', 'track food', 'log food', 'meal plan',
    'breakfast', 'lunch', 'dinner', 'snack', 'water', 'hydration',
    'kcal', 'calories', 'gram', 'serving', 'recipe',
  ],
  client: [
    'client', 'customer', 'member', 'profile', 'personal info',
    'onboarding', 'new client', 'add client', 'client list',
    'assessment', 'par-q', 'fitness background', 'experience',
  ],
  progress: [
    'progress', 'bio print', 'body composition', 'weight', 'body fat',
    'measurement', 'inch', 'cm', 'track progress', 'see progress',
    'chart', 'graph', 'trend', 'history', 'compare',
    'photo', 'before after', 'transformation',
  ],
  settings: [
    'setting', 'preference', 'account', 'profile', 'theme', 'dark mode',
    'light mode', 'unit', 'kg', 'lbs', 'notification', 'password',
    'email', 'logout', 'sign out',
  ],
  help: [
    'help', 'how to', 'how do i', 'what is', 'explain', 'tutorial',
    'guide', 'support', 'faq', 'question', 'confused', 'stuck',
  ],
  greeting: [
    'hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening',
    'what\'s up', 'how are you', 'sup', 'yo',
  ],
  navigation: [
    'go to', 'open', 'show me', 'take me', 'navigate', 'where is',
    'find', 'page', 'screen', 'dashboard', 'analytics', 'coach',
  ],
  generate_program: [
    'generate program', 'create program', 'build program', 'make program',
    'program for', 'workout plan', 'training plan', 'routine for',
    '4 week', '6 week', '8 week', 'hypertrophy program', 'strength program',
    'fat loss program', 'muscle building', 'upper body program', 'lower body',
    'push pull', 'full body', 'split routine', 'periodization',
  ],
  exercise_substitute: [
    'swap', 'replace', 'substitute', 'alternative', 'instead of',
    'change exercise', 'different exercise', 'variation',
    'back hurts', 'wrist pain', 'shoulder pain', 'knee pain',
    'lower back', 'spinal loading', 'joint friendly',
  ],
  deload: [
    'deload', 'reduce volume', 'take it easy', 'light week', 'recovery week',
    'tired', 'fatigue', 'burned out', 'overreaching', 'overtraining',
    'hrv down', 'sleep bad', 'stressed', 'need rest',
  ],
  analyze: [
    'analyze', 'review', 'check', 'how is', 'status of', 'look at',
    'concerned about', 'worried about', 'what about', 'tell me about',
  ],
  unknown: [],
};

export function classifyIntent(input: string): IntentResult {
  const lower = input.toLowerCase().trim();

  let bestIntent: IntentType = 'unknown';
  let bestScore = 0;
  const matchedKeywords: string[] = [];

  (Object.keys(INTENT_KEYWORDS) as IntentType[]).forEach((intent) => {
    if (intent === 'unknown') return;

    let score = 0;
    const keywords = INTENT_KEYWORDS[intent];

    keywords.forEach((kw) => {
      if (lower.includes(kw)) {
        score += kw.split(' ').length * 10; // Multi-word matches score higher
        matchedKeywords.push(kw);
      }
    });

    // Bonus for exact phrase match
    if (keywords.some((kw) => lower === kw)) {
      score += 20;
    }

    if (score > bestScore) {
      bestScore = score;
      bestIntent = intent;
    }
  });

  // Normalize confidence (0-100)
  const confidence = Math.min(100, bestScore * 2);

  return { intent: bestIntent, confidence, matchedKeywords };
}

export function getPageContext(path: string): PageContext | undefined {
  const contexts: PageContext[] = [
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
  return contexts.find((p: PageContext) => path === p.path || path.startsWith(p.path + '/'));
}

