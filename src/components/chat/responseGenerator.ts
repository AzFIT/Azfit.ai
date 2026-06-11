 
import type { IntentResult, ChatMessage, ChatAction, PageContext } from './types';

interface ResponseContext {
  intentResult: IntentResult;
  currentPage?: PageContext;
  userRole?: 'trainer' | 'client' | 'admin';
  messageHistory: ChatMessage[];
}

export function generateResponse(input: string, ctx: ResponseContext): { text: string; actions?: ChatAction[] } {
  const { intentResult, currentPage, userRole } = ctx;
  const { intent, confidence } = intentResult;

  // Low confidence → ask clarifying question
  if (confidence < 30) {
    return {
      text: "I'm not sure I understood. Are you looking for help with workouts, nutrition, tracking progress, or something else?",
      actions: [
        { label: '💪 Workouts', type: 'suggest', payload: 'workout' },
        { label: '🍎 Nutrition', type: 'suggest', payload: 'nutrition' },
        { label: '📊 Progress', type: 'suggest', payload: 'progress' },
        { label: '⚙️ Settings', type: 'suggest', payload: 'settings' },
      ],
    };
  }

  switch (intent) {
    case 'greeting':
      return {
        text: `Hey there! 👋 I'm AzFIT AI. I can help you start workouts, log food, check progress, or navigate the app. What would you like to do?`,
        actions: quickActions(currentPage),
      };

    case 'workout':
      return handleWorkoutIntent(input, currentPage, userRole);

    case 'nutrition':
      return handleNutritionIntent(input, currentPage);

    case 'progress':
      return handleProgressIntent(input, currentPage);

    case 'client':
      return handleClientIntent(input, currentPage, userRole);

    case 'settings':
      return {
        text: "You can manage your account, theme, units, and notifications in Settings.",
        actions: [
          { label: 'Open Settings', type: 'navigate', payload: '/settings' },
        ],
      };

    case 'help':
      return {
        text: "Here's what I can help you with:",
        actions: [
          { label: '💪 Start Workout', type: 'navigate', payload: '/sheets' },
          { label: '🍎 Log Food', type: 'navigate', payload: '/nutrition' },
          { label: '📊 View Progress', type: 'navigate', payload: '/bioprint' },
          { label: '⚙️ Settings', type: 'navigate', payload: '/settings' },
        ],
      };

    case 'navigation':
      return handleNavigationIntent(input, currentPage);

    default:
      return {
        text: "I can help with workouts, nutrition, progress tracking, or navigating the app. What do you need?",
        actions: quickActions(currentPage),
      };
  }
}

function handleWorkoutIntent(input: string, _currentPage?: PageContext, userRole?: string): { text: string; actions?: ChatAction[] } {
  const lower = input.toLowerCase();

  if (lower.includes('start') || lower.includes('begin') || lower.includes('log')) {
    return {
      text: "Ready to crush a workout? 💪 You can start a session or view your program.",
      actions: [
        { label: 'Start Workout', type: 'navigate', payload: '/sheets' },
        ...(userRole === 'trainer' ? [{ label: 'Program Builder', type: 'navigate', payload: '/program-builder' } as ChatAction] : []),
      ],
    };
  }

  if (lower.includes('program') || lower.includes('routine') || lower.includes('split')) {
    return {
      text: userRole === 'trainer'
        ? "You can build custom programs or view existing ones."
        : "Your trainer will assign programs. You can view them in your dashboard.",
      actions: userRole === 'trainer'
        ? [{ label: 'Program Builder', type: 'navigate', payload: '/program-builder' }]
        : [{ label: 'View Dashboard', type: 'navigate', payload: '/dashboard' }],
    };
  }

  return {
    text: "I can help you start a workout, view your program, or check your workout history.",
    actions: [
      { label: 'Start Workout', type: 'navigate', payload: '/sheets' },
      { label: 'View Dashboard', type: 'navigate', payload: '/dashboard' },
    ],
  };
}

function handleNutritionIntent(input: string, _currentPage?: PageContext): { text: string; actions?: ChatAction[] } {
  const lower = input.toLowerCase();

  if (lower.includes('log') || lower.includes('track') || lower.includes('add')) {
    return {
      text: "Let's log your food! 🍎 Track meals and hit your macro targets.",
      actions: [
        { label: 'Log Food', type: 'navigate', payload: '/nutrition' },
      ],
    };
  }

  if (lower.includes('water') || lower.includes('hydration')) {
    return {
      text: "Stay hydrated! 💧 Your daily water goal is based on your body weight.",
      actions: [
        { label: 'View Nutrition', type: 'navigate', payload: '/nutrition' },
      ],
    };
  }

  return {
    text: "I can help you log meals, track macros, or check your nutrition plan.",
    actions: [
      { label: 'Log Food', type: 'navigate', payload: '/nutrition' },
      { label: 'View Dashboard', type: 'navigate', payload: '/dashboard' },
    ],
  };
}

function handleProgressIntent(input: string, _currentPage?: PageContext): { text: string; actions?: ChatAction[] } {
  const lower = input.toLowerCase();

  if (lower.includes('weight') || lower.includes('body fat') || lower.includes('measurement')) {
    return {
      text: "Track your body composition changes over time with Bio Print.",
      actions: [
        { label: 'Bio Print', type: 'navigate', payload: '/bioprint' },
      ],
    };
  }

  if (lower.includes('chart') || lower.includes('graph') || lower.includes('analytics')) {
    return {
      text: "View detailed analytics and trends for your fitness journey.",
      actions: [
        { label: 'Analytics', type: 'navigate', payload: '/analytics' },
        { label: 'Bio Print', type: 'navigate', payload: '/bioprint' },
      ],
    };
  }

  return {
    text: "Check your progress with Bio Print tracking or detailed analytics.",
    actions: [
      { label: 'Bio Print', type: 'navigate', payload: '/bioprint' },
      { label: 'Analytics', type: 'navigate', payload: '/analytics' },
    ],
  };
}

function handleClientIntent(_input: string, _currentPage?: PageContext, userRole?: string): { text: string; actions?: ChatAction[] } {
  if (userRole === 'trainer') {
    return {
      text: "Manage your clients, view their progress, and assign programs from the Coach dashboard.",
      actions: [
        { label: 'Coach Dashboard', type: 'navigate', payload: '/coach' },
        { label: 'Add Client', type: 'navigate', payload: '/onboarding' },
      ],
    };
  }

  return {
    text: "Your profile and fitness background help us personalize your experience.",
    actions: [
      { label: 'View Profile', type: 'navigate', payload: '/dashboard' },
      { label: 'Update Info', type: 'navigate', payload: '/settings' },
    ],
  };
}

function handleNavigationIntent(input: string, _currentPage?: PageContext): { text: string; actions?: ChatAction[] } {
  const lower = input.toLowerCase();

  for (const page of [
    { name: 'dashboard', path: '/dashboard' },
    { name: 'analytics', path: '/analytics' },
    { name: 'coach', path: '/coach' },
    { name: 'settings', path: '/settings' },
    { name: 'sheets', path: '/sheets' },
    { name: 'workout', path: '/sheets' },
    { name: 'nutrition', path: '/nutrition' },
    { name: 'bioprint', path: '/bioprint' },
    { name: 'program', path: '/program-builder' },
  ]) {
    if (lower.includes(page.name)) {
      return {
        text: `Taking you to ${page.name.charAt(0).toUpperCase() + page.name.slice(1)}...`,
        actions: [{ label: `Go to ${page.name.charAt(0).toUpperCase() + page.name.slice(1)}`, type: 'navigate', payload: page.path }],
      };
    }
  }

  return {
    text: "Where would you like to go?",
    actions: [
      { label: '🏠 Dashboard', type: 'navigate', payload: '/dashboard' },
      { label: '💪 Workouts', type: 'navigate', payload: '/sheets' },
      { label: '🍎 Nutrition', type: 'navigate', payload: '/nutrition' },
      { label: '📊 Progress', type: 'navigate', payload: '/bioprint' },
    ],
  };
}

function quickActions(currentPage?: PageContext): ChatAction[] {
  const actions: ChatAction[] = [
    { label: '💪 Start Workout', type: 'navigate', payload: '/sheets' },
    { label: '🍎 Log Food', type: 'navigate', payload: '/nutrition' },
    { label: '📊 Progress', type: 'navigate', payload: '/bioprint' },
  ];

  if (currentPage?.path !== '/dashboard') {
    actions.unshift({ label: '🏠 Dashboard', type: 'navigate', payload: '/dashboard' });
  }

  return actions.slice(0, 4);
}
