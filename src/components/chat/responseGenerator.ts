import {
  resolveClientId,
  getTrainerClients,
  getLastWorkout,
  getUnreadMessages,
  getLatestBodyComp,
  getTrainerAttention,
  getLatestOneRepMaxPRs,
  getSessionCompliance,
  getLastWorkoutVolumeTrend,
  daysBetween,
  estimateOneRepMax,
  type OneRepMaxEntry,
  type TrainerAttentionSummary,
} from './chatData';
import { logCrisisFlag, logMedicalGuard, fetchFaqEntries } from './chatLogging';
import { findExerciseSubstitutions, findExerciseNameInInput } from '@/lib/exerciseSwap';
import type { IntentResult, ChatMessage, ChatAction, PageContext, MessageContent } from './types';

interface ResponseContext {
  intentResult: IntentResult;
  currentPage?: PageContext;
  userRole?: 'trainer' | 'client' | 'admin';
  userId?: string;
  userEmail?: string;
  messageHistory: ChatMessage[];
}

interface ResponseResult {
  text: string;
  actions?: ChatAction[];
  content?: MessageContent;
}

/* ═══════════════════════════════════════════════════════════════════
   Safety guards — checked before any intent handling
   ═══════════════════════════════════════════════════════════════════ */

const CRISIS_KEYWORDS = [
  'self-harm',
  'suicide',
  'kill myself',
  'end it all',
  'eating disorder',
  'anorexia',
  'bulimia',
];

const MEDICAL_KEYWORDS = [
  'diagnosis',
  'chest pain',
  'doctor',
  'injury diagnosis',
  'sharp pain',
  'severe pain',
  'medical advice',
];

function checkSafety(input: string, userId: string | undefined): ResponseResult | null {
  const lower = input.toLowerCase();

  if (CRISIS_KEYWORDS.some((kw) => lower.includes(kw))) {
    logCrisisFlag(userId, input);
    return {
      text: "I'm really sorry you're feeling this way. I'm an AI fitness assistant, not a mental health professional. If you're in crisis or thinking about hurting yourself, please contact local emergency services or a crisis helpline right away. You don't have to go through this alone.",
      actions: [
        { label: 'Find crisis resources', type: 'link', payload: 'https://findahelpline.com' },
      ],
    };
  }

  if (MEDICAL_KEYWORDS.some((kw) => lower.includes(kw))) {
    logMedicalGuard(userId, input);
    return {
      text: "I'm not a medical professional. For pain, injury, or any medical concern, please see a doctor or physiotherapist. In the meantime, I can suggest joint-friendly exercise substitutions if you'd like.",
      actions: [
        { label: 'Exercise substitutions', type: 'suggest', payload: 'swap squat for knee pain' },
        { label: 'Find a physio', type: 'link', payload: 'https://www.google.com/search?q=physiotherapist+near+me' },
      ],
    };
  }

  return null;
}

/* ═══════════════════════════════════════════════════════════════════
   Main entry point
   ═══════════════════════════════════════════════════════════════════ */

export async function generateResponse(input: string, ctx: ResponseContext): Promise<ResponseResult> {
  const { intentResult, currentPage, userRole, userId, userEmail } = ctx;
  const { intent, confidence } = intentResult;

  const safety = checkSafety(input, userId);
  if (safety) return safety;

  // FAQ fallback before low-confidence generic response
  if (confidence < 60) {
    const faq = await matchFaq(input, userRole || 'client');
    if (faq) {
      return {
        text: faq.answer,
        actions: faq.actions,
      };
    }
  }

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
      return handleProgressIntent(input, currentPage, userRole, userId, userEmail);

    case 'client':
      return handleClientIntent(input, currentPage, userRole);

    case 'settings':
      return {
        text: "You can manage your account, theme, units, and notifications in Settings.",
        actions: [{ label: 'Open Settings', type: 'navigate', payload: '/settings' }],
      };

    case 'help':
      return {
        text: "Here's what I can help you with:",
        actions: [
          { label: '💪 Start Workout', type: 'navigate', payload: '/workouts' },
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
      return handleDeload(input, userRole, userId, userEmail);

    case 'analyze':
      return handleAnalyze(input, userRole, userId, userEmail);

    default: {
      const faq = await matchFaq(input, userRole || 'client');
      if (faq) return { text: faq.answer, actions: faq.actions };
      return {
        text: "I can help with workouts, nutrition, progress tracking, or navigating the app. What do you need?",
        actions: quickActions(currentPage),
      };
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════
   FAQ helper
   ═══════════════════════════════════════════════════════════════════ */

async function matchFaq(
  input: string,
  role: 'trainer' | 'client' | 'admin'
): Promise<{ answer: string; actions: ChatAction[] } | null> {
  const lower = input.toLowerCase();
  const entries = await fetchFaqEntries(role);

  let best: { answer: string; actions: ChatAction[]; score: number } | null = null;

  for (const entry of entries) {
    let score = 0;
    for (const kw of entry.keywords) {
      if (lower.includes(kw.toLowerCase())) score += 1;
    }
    if (score > 0 && (!best || score > best.score)) {
      best = {
        answer: entry.answer,
        actions: [{ label: 'Open related page', type: 'navigate', payload: faqPathForAnswer(entry.answer) }],
        score,
      };
    }
  }

  return best ? { answer: best.answer, actions: best.actions } : null;
}

function faqPathForAnswer(answer: string): string {
  if (answer.includes('/workouts')) return '/workouts';
  if (answer.includes('/bioprint')) return '/bioprint';
  if (answer.includes('/messages')) return '/messages';
  if (answer.includes('/check-ins')) return '/check-ins';
  if (answer.includes('/clients')) return '/clients';
  if (answer.includes('/program-builder')) return '/ai-program-builder';
  if (answer.includes('/nutrition')) return '/nutrition';
  if (answer.includes('/progress-photos')) return '/progress-photos';
  return '/dashboard';
}

/* ═══════════════════════════════════════════════════════════════════
   Intent handlers
   ═══════════════════════════════════════════════════════════════════ */

function handleGenerateProgram(input: string): ResponseResult {
  const lower = input.toLowerCase();
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
    text: `Here's a ${weeks}-week ${daysPerWeek}-day ${goal} STARTING TEMPLATE. You can customize it in the Program Builder.`,
    actions: [
      { label: 'Open in Program Builder', type: 'navigate', payload: '/ai-program-builder' },
    ],
    content: programContent,
  };
}

function handleExerciseSubstitute(input: string): ResponseResult {
  const lower = input.toLowerCase();

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

  if (matchedExercise) {
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
      text: `Got it! Replaced ${matchedExercise} with ${sub.replacement} to reduce ${reason}. Open the Program Builder to apply this to a workout.`,
      actions: [
        { label: 'Open Program Builder', type: 'navigate', payload: '/ai-program-builder' },
        { label: 'Explain Choice', type: 'suggest', payload: 'why this substitution?' },
      ],
      content: swapContent,
    };
  }

  const exerciseName = findExerciseNameInInput(input);
  if (exerciseName) {
    const suggestions = findExerciseSubstitutions(exerciseName, { reason: input }).slice(0, 3);
    if (suggestions.length > 0) {
      return {
        text: `Here are some alternatives for ${exerciseName} based on the library. Tap one to keep the conversation going, or open the Program Builder to apply a swap.`,
        actions: [
          ...suggestions.map((s) => ({
            label: `Try: ${s.name} — ${s.reason}`,
            type: 'suggest' as const,
            payload: `swap ${s.name}`,
          })),
          { label: 'Open Program Builder', type: 'navigate', payload: '/ai-program-builder' },
        ],
      };
    }
  }

  return {
    text: "I can suggest exercise substitutions based on injuries or equipment limitations. Which exercise would you like to replace, and what's the reason?",
    actions: [
      { label: 'Back Pain', type: 'suggest', payload: 'swap deadlift for back pain' },
      { label: 'Shoulder Issues', type: 'suggest', payload: 'swap bench press for shoulder pain' },
      { label: 'Knee Pain', type: 'suggest', payload: 'swap squat for knee pain' },
    ],
  };
}

async function handleDeload(
  _input: string,
  userRole: 'trainer' | 'client' | 'admin' | undefined,
  userId: string | undefined,
  userEmail: string | undefined
): Promise<ResponseResult> {
  if (!userId) {
    return {
      text: "I can help you plan a deload, but I need you to be signed in first.",
      actions: [{ label: 'Sign In', type: 'navigate', payload: '/login' }],
    };
  }

  if (userRole === 'trainer') {
    const attention = await getTrainerAttention(userId);
    const atRisk = attention.atRiskClients.slice(0, 5);

    if (atRisk.length === 0) {
      return {
        text: "All your clients have logged workouts within the last 7 days. No one needs a deload right now based on activity data.",
        actions: [{ label: 'View Clients', type: 'navigate', payload: '/clients' }],
      };
    }

    const list = atRisk
      .map((c) => {
        const date = c.lastWorkoutDate ? new Date(c.lastWorkoutDate).toLocaleDateString() : 'never';
        return `• ${c.name} — last workout ${c.daysSinceWorkout === Infinity ? 'never' : `${c.daysSinceWorkout}d ago`} (${date})`;
      })
      .join('\n');

    return {
      text: `These clients haven't logged a workout in 7+ days and may benefit from a deload or check-in:\n\n${list}\n\nGeneral deload protocol: cut volume by 40-50%, keep intensity moderate, and add one recovery-focused session.`,
      actions: [
        { label: 'View Clients', type: 'navigate', payload: '/clients' },
        { label: 'Check-ins', type: 'navigate', payload: '/check-ins' },
      ],
    };
  }

  // Client view
  if (!userEmail) {
    return {
      text: "I can suggest a deload plan, but I need your account email to look up your client record.",
      actions: [{ label: 'Settings', type: 'navigate', payload: '/settings' }],
    };
  }

  const clientId = await resolveClientId(userId, userEmail);
  if (!clientId) {
    return {
      text: "I couldn't find your client record. Please ask your trainer to connect your account.",
      actions: [{ label: 'Message Coach', type: 'navigate', payload: '/messages' }],
    };
  }

  const lastWorkout = await getLastWorkout(clientId);
  const daysSince = lastWorkout ? daysBetween(new Date(lastWorkout.created_at), new Date()) : null;
  const volumeTrend = await getLastWorkoutVolumeTrend(clientId);

  let text = "Here's what I see for your training:\n";
  if (daysSince !== null) {
    text += `• Last workout: ${daysSince} day${daysSince === 1 ? '' : 's'} ago\n`;
  } else {
    text += "• No recent workouts logged.\n";
  }
  if (volumeTrend) {
    const change = volumeTrend.previous === 0 ? 0 : Math.round(((volumeTrend.current - volumeTrend.previous) / volumeTrend.previous) * 100);
    text += `• This week's volume vs last week: ${change >= 0 ? '+' : ''}${change}%\n`;
  }

  text += "\nIf you've been training hard for 3+ weeks or feel run down, a deload can help: reduce sets by 30-40%, keep weights the same or slightly lighter, and prioritize sleep and recovery.";

  return {
    text,
    actions: [
      { label: 'Start Workout', type: 'navigate', payload: '/workouts' },
      { label: 'View Progress', type: 'navigate', payload: '/bioprint' },
    ],
  };
}

async function handleAnalyze(
  input: string,
  userRole: 'trainer' | 'client' | 'admin' | undefined,
  userId: string | undefined,
  userEmail: string | undefined
): Promise<ResponseResult> {
  if (!userId) {
    return {
      text: "Please sign in so I can pull your real workout data.",
      actions: [{ label: 'Sign In', type: 'navigate', payload: '/login' }],
    };
  }

  if (userRole === 'trainer') {
    const clients = await getTrainerClients(userId);
    if (clients.length === 0) {
      return {
        text: "You don't have any clients yet. Add a client to start analyzing their progress.",
        actions: [{ label: 'Add Client', type: 'navigate', payload: '/clients' }],
      };
    }

    const lower = input.toLowerCase();
    const matched = clients.find((c) => lower.includes(c.full_name.toLowerCase()) || lower.includes(c.email.toLowerCase()));

    if (!matched) {
      const clientList = clients.slice(0, 5).map((c) => ({ label: c.full_name, type: 'suggest' as const, payload: `analyze ${c.full_name}` }));
      return {
        text: "Which client would you like me to analyze?",
        actions: clientList,
      };
    }

    const [prs, compliance] = await Promise.all([
      getLatestOneRepMaxPRs(matched.id),
      getSessionCompliance(matched.id, 4),
    ]);

    const topPrs = prs.slice(0, 3);
    let text = `Analysis for ${matched.full_name}:\n`;
    text += `• Session compliance (last 4 weeks): ${compliance.completed}/${compliance.scheduled} (${compliance.rate}%)\n`;
    if (topPrs.length > 0) {
      text += `• Estimated 1RM PRs:\n`;
      topPrs.forEach((pr) => {
        text += `  — ${pr.exerciseName}: ~${Math.round(pr.estOneRepMax)} kg (${pr.weight} kg × ${pr.reps})\n`;
      });
    } else {
      text += "• No logged sets with load/reps yet, so I can't estimate 1RM PRs.\n";
    }

    return {
      text,
      actions: [
        { label: 'View Profile', type: 'navigate', payload: `/client/${matched.id}` },
        { label: 'Analytics', type: 'navigate', payload: '/analytics' },
      ],
    };
  }

  // Client view
  if (!userEmail) {
    return {
      text: "I need your account email to look up your client record.",
      actions: [{ label: 'Settings', type: 'navigate', payload: '/settings' }],
    };
  }

  const clientId = await resolveClientId(userId, userEmail);
  if (!clientId) {
    return {
      text: "I couldn't find your client record. Please ask your trainer to connect your account.",
      actions: [{ label: 'Message Coach', type: 'navigate', payload: '/messages' }],
    };
  }

  const [prs, compliance, lastWorkout] = await Promise.all([
    getLatestOneRepMaxPRs(clientId),
    getSessionCompliance(clientId, 4),
    getLastWorkout(clientId),
  ]);

  const topPrs = prs.slice(0, 3);
  let text = "Here's your current performance:\n";
  text += `• Session compliance (last 4 weeks): ${compliance.completed}/${compliance.scheduled} (${compliance.rate}%)\n`;
  if (lastWorkout) {
    const daysAgo = daysBetween(new Date(lastWorkout.created_at), new Date());
    text += `• Last workout: ${daysAgo} day${daysAgo === 1 ? '' : 's'} ago\n`;
  }
  if (topPrs.length > 0) {
    text += `• Estimated 1RM PRs:\n`;
    topPrs.forEach((pr) => {
      text += `  — ${pr.exerciseName}: ~${Math.round(pr.estOneRepMax)} kg (${pr.weight} kg × ${pr.reps})\n`;
    });
  } else {
    text += "• No logged sets with load/reps yet, so I can't estimate 1RM PRs.\n";
  }

  return {
    text,
    actions: [
      { label: 'Start Workout', type: 'navigate', payload: '/workouts' },
      { label: 'View Progress', type: 'navigate', payload: '/bioprint' },
    ],
  };
}

function handleWorkoutIntent(input: string, _currentPage?: PageContext, userRole?: string): ResponseResult {
  const lower = input.toLowerCase();

  if (lower.includes('start') || lower.includes('begin') || lower.includes('log')) {
    return {
      text: "Ready to crush a workout? 💪 You can start a session or view your program.",
      actions: [
        { label: 'Start Workout', type: 'navigate', payload: '/workouts' },
        ...(userRole === 'trainer' ? [{ label: 'Program Builder', type: 'navigate', payload: '/ai-program-builder' } as ChatAction] : []),
      ],
    };
  }

  if (lower.includes('program') || lower.includes('routine') || lower.includes('split')) {
    return {
      text:
        userRole === 'trainer'
          ? "You can build custom programs or view existing ones."
          : "Your trainer will assign programs. You can view them in your dashboard.",
      actions:
        userRole === 'trainer'
          ? [{ label: 'Program Builder', type: 'navigate', payload: '/ai-program-builder' }]
          : [{ label: 'View Dashboard', type: 'navigate', payload: '/dashboard' }],
    };
  }

  return {
    text: "I can help you start a workout, view your program, or check your workout history.",
    actions: [
      { label: 'Start Workout', type: 'navigate', payload: '/workouts' },
      { label: 'View Dashboard', type: 'navigate', payload: '/dashboard' },
    ],
  };
}

function handleNutritionIntent(input: string, _currentPage?: PageContext): ResponseResult {
  const lower = input.toLowerCase();

  if (lower.includes('log') || lower.includes('track') || lower.includes('add')) {
    return {
      text: "Let's log your food! 🍎 Track meals and hit your macro targets.",
      actions: [{ label: 'Log Food', type: 'navigate', payload: '/nutrition' }],
    };
  }

  if (lower.includes('water') || lower.includes('hydration')) {
    return {
      text: "Stay hydrated! 💧 Your daily water goal is based on your body weight.",
      actions: [{ label: 'View Nutrition', type: 'navigate', payload: '/nutrition' }],
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

async function handleProgressIntent(
  input: string,
  _currentPage?: PageContext,
  userRole?: string,
  userId?: string,
  userEmail?: string
): Promise<ResponseResult> {
  const lower = input.toLowerCase();

  if (userRole === 'client' && userId && userEmail) {
    const clientId = await resolveClientId(userId, userEmail);
    if (clientId) {
      const [bodyComp, unread] = await Promise.all([getLatestBodyComp(clientId), getUnreadMessages(userId)]);
      let text = "Here's your latest progress:\n";
      if (bodyComp) {
        text += `• Weight: ${bodyComp.weight_kg ?? '—'} kg\n`;
        text += `• Body fat: ${bodyComp.body_fat_percentage ?? '—'}%\n`;
        text += `• Recorded: ${new Date(bodyComp.recorded_at).toLocaleDateString()}\n`;
      } else {
        text += "• No body composition entries yet.\n";
      }
      if (unread > 0) text += `\nYou have ${unread} unread message${unread === 1 ? '' : 's'} from your coach.`;

      return {
        text,
        actions: [
          { label: 'Bio Print', type: 'navigate', payload: '/bioprint' },
          { label: 'Progress Photos', type: 'navigate', payload: '/progress-photos' },
        ],
      };
    }
  }

  if (lower.includes('weight') || lower.includes('body fat') || lower.includes('measurement')) {
    return {
      text: "Track your body composition changes over time with Bio Print.",
      actions: [{ label: 'Bio Print', type: 'navigate', payload: '/bioprint' }],
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

function handleClientIntent(_input: string, _currentPage?: PageContext, userRole?: string): ResponseResult {
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

function handleNavigationIntent(input: string, _currentPage?: PageContext): ResponseResult {
  const lower = input.toLowerCase();

  for (const page of [
    { name: 'dashboard', path: '/dashboard' },
    { name: 'analytics', path: '/analytics' },
    { name: 'coach', path: '/coach' },
    { name: 'settings', path: '/settings' },
    { name: 'sheets', path: '/workouts' },
    { name: 'workout', path: '/workouts' },
    { name: 'nutrition', path: '/nutrition' },
    { name: 'bioprint', path: '/bioprint' },
    { name: 'program', path: '/ai-program-builder' },
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
      { label: '💪 Workouts', type: 'navigate', payload: '/workouts' },
      { label: '🍎 Nutrition', type: 'navigate', payload: '/nutrition' },
      { label: '📊 Progress', type: 'navigate', payload: '/bioprint' },
    ],
  };
}

function quickActions(currentPage?: PageContext): ChatAction[] {
  const actions: ChatAction[] = [
    { label: '💪 Start Workout', type: 'navigate', payload: '/workouts' },
    { label: '🍎 Log Food', type: 'navigate', payload: '/nutrition' },
    { label: '📊 Progress', type: 'navigate', payload: '/bioprint' },
  ];

  if (currentPage?.path !== '/dashboard') {
    actions.unshift({ label: '🏠 Dashboard', type: 'navigate', payload: '/dashboard' });
  }

  return actions.slice(0, 4);
}

export { estimateOneRepMax };
export type { OneRepMaxEntry, TrainerAttentionSummary };
