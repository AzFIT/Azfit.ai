

import type { IntentResult, ChatMessage, ChatAction, PageContext, MessageContent } from './types';

interface ResponseContext {
  intentResult: IntentResult;
  currentPage?: PageContext;
  userRole?: 'trainer' | 'client' | 'admin';
  messageHistory: ChatMessage[];
}

export function generateResponse(input: string, ctx: ResponseContext): { text: string; actions?: ChatAction[]; content?: MessageContent } {
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

    case 'generate_program':
      return handleGenerateProgram(input);

    case 'exercise_substitute':
      return handleExerciseSubstitute(input);

    case 'deload':
      return handleDeload(input);

    case 'analyze':
      return handleAnalyze(input);

    default:
      return {
        text: "I can help with workouts, nutrition, progress tracking, or navigating the app. What do you need?",
        actions: quickActions(currentPage),
      };
  }
}

/* ── Enhanced Intent Handlers ─────────────────────────── */

function handleGenerateProgram(input: string): { text: string; actions?: ChatAction[]; content?: MessageContent } {
  const lower = input.toLowerCase();

  // Parse basic constraints from input
  const daysMatch = lower.match(/(\d+)\s*day/);
  const daysPerWeek = daysMatch ? parseInt(daysMatch[1]) : 4;
  const weeks = lower.includes('6 week') ? 6 : lower.includes('8 week') ? 8 : 4;
  const goal = lower.includes('strength') ? 'strength' : lower.includes('fat loss') ? 'fat_loss' : 'hypertrophy';
  const upperFocus = lower.includes('upper') || lower.includes('push') || lower.includes('pull');

  const programContent: MessageContent = {
    type: 'program',
    days: [
      {
        dayNumber: 1,
        name: upperFocus ? 'Push (Chest emphasis)' : 'Day 1: Upper Body',
        exercises: [
          { name: 'Bench Press', sets: '4', reps: '6-8', rpe: '8', notes: 'Progressive overload focus' },
          { name: 'Incline DB Press', sets: '3', reps: '8-10', rpe: '8' },
          { name: 'Cable Fly', sets: '3', reps: '12-15', rpe: '9' },
          { name: 'OHP', sets: '3', reps: '8-10', rpe: '8' },
          { name: 'Lateral Raise', sets: '3', reps: '15-20', rpe: '9' },
          { name: 'Tricep Pushdown', sets: '3', reps: '12-15', rpe: '9' },
        ],
      },
      {
        dayNumber: 2,
        name: upperFocus ? 'Pull (Back emphasis)' : 'Day 2: Lower Body',
        exercises: [
          { name: 'Deadlift', sets: '3', reps: '5', rpe: '7', notes: 'Reset each rep' },
          { name: 'Barbell Row', sets: '4', reps: '8-10', rpe: '8' },
          { name: 'Pull-up', sets: '3', reps: '8-10', rpe: '8' },
          { name: 'Face Pull', sets: '3', reps: '15-20', rpe: '9' },
          { name: 'Barbell Curl', sets: '3', reps: '10-12', rpe: '8' },
          { name: 'Hammer Curl', sets: '3', reps: '12-15', rpe: '9' },
        ],
      },
      {
        dayNumber: 3,
        name: 'Legs & Core',
        exercises: [
          { name: 'Squat', sets: '4', reps: '6-8', rpe: '8', notes: 'Depth focus' },
          { name: 'Romanian Deadlift', sets: '3', reps: '8-10', rpe: '8' },
          { name: 'Leg Press', sets: '3', reps: '10-12', rpe: '8' },
          { name: 'Leg Curl', sets: '3', reps: '12-15', rpe: '9' },
          { name: 'Calf Raise', sets: '4', reps: '15-20', rpe: '9' },
          { name: 'Plank', sets: '3', reps: '45-60s', rpe: '7' },
        ],
      },
    ],
    periodization: 'Linear',
    weeks,
    daysPerWeek,
  };

  return {
    text: `Here's a customized ${weeks}-week ${daysPerWeek}-day ${goal} program. I've designed it with progressive overload and appropriate volume for your goals.`,
    actions: [
      { label: 'Apply Full Program', type: 'apply', payload: 'apply_program' },
      { label: 'Modify', type: 'customize', payload: 'modify_program' },
      { label: 'Export as PDF', type: 'link', payload: '/export' },
    ],
    content: programContent,
  };
}

function handleExerciseSubstitute(input: string): { text: string; actions?: ChatAction[]; content?: MessageContent } {
  const lower = input.toLowerCase();

  // Common substitution pairs
  const substitutions: Record<string, { replacement: string; reasoning: string; sets: string; reps: string; rpe: string }> = {
    deadlift: { replacement: 'Rack Pull (below knee)', reasoning: 'Reduces lower back stress while maintaining posterior chain development', sets: '3', reps: '6-8', rpe: '8' },
    squat: { replacement: 'Belt Squat', reasoning: 'Eliminates spinal loading while maintaining quad development', sets: '3', reps: '10-12', rpe: '9' },
    'bench press': { replacement: 'Floor Press', reasoning: 'Reduces shoulder strain by limiting range of motion', sets: '3', reps: '6-8', rpe: '8' },
    'overhead press': { replacement: 'Landmine Press', reasoning: 'More shoulder-friendly pressing angle', sets: '3', reps: '8-10', rpe: '8' },
    'barbell row': { replacement: 'Chest-Supported Row', reasoning: 'Eliminates lower back fatigue and isolates lats', sets: '3', reps: '10-12', rpe: '8' },
  };

  let matchedExercise = '';
  for (const [exercise] of Object.entries(substitutions)) {
    if (lower.includes(exercise)) {
      matchedExercise = exercise;
      break;
    }
  }

  if (!matchedExercise) {
    return {
      text: "I can suggest exercise substitutions based on injuries or equipment limitations. Which exercise would you like to replace, and what's the reason?",
      actions: [
        { label: 'Back Pain', type: 'suggest', payload: 'swap deadlift for back pain' },
        { label: 'Shoulder Issues', type: 'suggest', payload: 'swap bench press for shoulder pain' },
        { label: 'Knee Pain', type: 'suggest', payload: 'swap squat for knee pain' },
      ],
    };
  }

  const sub = substitutions[matchedExercise];
  const reason = lower.includes('back') ? 'lower back stress' : lower.includes('shoulder') ? 'shoulder strain' : lower.includes('knee') ? 'knee stress' : 'joint-friendly alternative';

  const swapContent: MessageContent = {
    type: 'exercise_swap',
    original: { name: matchedExercise.charAt(0).toUpperCase() + matchedExercise.slice(1), reason },
    replacement: {
      name: sub.replacement,
      sets: sub.sets,
      reps: sub.reps,
      rpe: sub.rpe,
      reasoning: sub.reasoning,
    },
  };

  return {
    text: `Got it! Replaced ${matchedExercise} with ${sub.replacement} to reduce ${reason}.`,
    actions: [
      { label: 'Apply Changes', type: 'apply', payload: 'apply_swap' },
      { label: 'Undo', type: 'dismiss', payload: 'undo_swap' },
      { label: 'Explain Choice', type: 'suggest', payload: 'why this substitution?' },
    ],
    content: swapContent,
  };
}

function handleDeload(input: string): { text: string; actions?: ChatAction[]; content?: MessageContent } {
  const lower = input.toLowerCase();
  const clientName = lower.includes('mike') ? 'Mike' : lower.includes('alex') ? 'Alex' : 'your client';

  const insightContent: MessageContent = {
    type: 'insight',
    severity: 'warning',
    clientName,
    title: `Recommend deload for ${clientName}`,
    description: `${clientName} hasn't logged a workout in 4 days. HRV is down 12% according to Apple Health sync. Training volume has been high for 6 consecutive weeks.`,
    suggestedAction: 'Apply 60% volume deload',
  };

  return {
    text: `Based on ${clientName}'s recovery data and training history, I recommend:\n\n1. Deload to 60% volume this week\n2. Prioritize sleep (avg 6.2h → target 7.5h)\n3. Substitute heavy squats with mobility work\n4. Re-test next Monday`,
    actions: [
      { label: 'Apply Recommendations', type: 'apply', payload: 'apply_deload' },
      { label: 'Customize', type: 'customize', payload: 'customize_deload' },
      { label: 'Dismiss', type: 'dismiss', payload: 'dismiss' },
    ],
    content: insightContent,
  };
}

function handleAnalyze(input: string): { text: string; actions?: ChatAction[]; content?: MessageContent } {
  const lower = input.toLowerCase();
  const clientName = lower.includes('mike') ? 'Mike Wong' : lower.includes('lisa') ? 'Lisa Lau' : lower.includes('alex') ? 'Alex Rivera' : 'your client';

  const insightContent: MessageContent = {
    type: 'insight',
    severity: 'info',
    clientName,
    title: `${clientName} hit a new PR`,
    description: `${clientName} bench pressed 62.5kg x 5 yesterday — a 7.5kg improvement from 8 weeks ago. Compliance is at 92%, and volume has been consistently increasing.`,
    suggestedAction: 'Auto-progress program',
  };

  return {
    text: `${clientName} is performing well! Here's what stands out:\n\n• New PR on bench: 62.5kg x 5 (+7.5kg from 8 weeks ago)\n• Compliance: 92% (excellent)\n• Weekly volume trending up 8%\n• Sleep average: 7.1h (good)\n\nShould I auto-progress their program for the next mesocycle?`,
    actions: [
      { label: 'Progress Program', type: 'apply', payload: 'progress_program' },
      { label: 'Review First', type: 'navigate', payload: '/analytics' },
      { label: 'Dismiss', type: 'dismiss', payload: 'dismiss' },
    ],
    content: insightContent,
  };
}

/* ── Existing Intent Handlers ──────────────────────────── */

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
    { name: 'ai coach', path: '/coach-ai' },
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
