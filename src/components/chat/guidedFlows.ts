import {
  resolveClientId,
  getLatestBodyComp,
  getActiveHabits,
  upsertHabitLog,
  getHabitStreak,
  insertBodyComposition,
} from "./chatData";
import { logChatEvent } from "./chatLogging";
import { formatDateLocale } from "@/lib/utils";
import type { ChatAction, GuidedFlow } from "./types";

interface FlowResult {
  text: string;
  actions?: ChatAction[];
  pendingFlow?: GuidedFlow | null;
}

interface FlowContext {
  userId?: string;
  userEmail?: string;
  userRole?: "trainer" | "client" | "admin";
  pendingFlow: GuidedFlow | null;
}

const CANCEL_ACTION: ChatAction = { label: "Cancel", type: "suggest", payload: "cancel" };

function parseWeightAndBodyFat(text: string): { weight?: number; bodyFat?: number } {
  const numbers = Array.from(text.matchAll(/\d+(?:\.\d+)?/g)).map((m) => parseFloat(m[0]));
  if (numbers.length === 0) return {};
  const weight = numbers[0];
  const hasBodyFatHint = /\b(bf|body fat|bodyfat|%)\b/i.test(text);
  const bodyFat = hasBodyFatHint ? numbers[1] : undefined;
  return { weight, bodyFat };
}

function isLogWeightTrigger(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("log my weight") ||
    lower.includes("weigh") ||
    lower.includes("i weighed") ||
    lower.includes("my weight is") ||
    lower.includes("weight today") ||
    lower.includes("log weight")
  );
}

function isHabitDoneTrigger(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("mark my habit") ||
    lower.includes("habit done") ||
    lower.includes("did my") ||
    lower.includes("completed my") ||
    lower.includes("finished my") ||
    lower.includes("drank my") ||
    (lower.includes("steps") && lower.includes("done"))
  );
}

function findMatchingHabits(text: string, habits: { id: string; name: string }[]) {
  const lower = text.toLowerCase();
  return habits.filter((h) => lower.includes(h.name.toLowerCase()));
}

async function handleLogWeight(
  text: string,
  ctx: FlowContext
): Promise<FlowResult | null> {
  if (ctx.userRole === "trainer") {
    return {
      text: "Weight logging is for clients. Trainers can log measurements from the client's profile.",
      actions: [{ label: "Clients", type: "navigate", payload: "/clients" }],
      pendingFlow: null,
    };
  }

  if (!ctx.userId || !ctx.userEmail) {
    return {
      text: "I need you to be signed in to log your weight.",
      actions: [{ label: "Sign In", type: "navigate", payload: "/login" }],
      pendingFlow: null,
    };
  }

  const clientId = await resolveClientId(ctx.userId, ctx.userEmail);
  if (!clientId) {
    return {
      text: "Your trainer needs to add you as a client first. Once you're connected, I can log measurements for you.",
      actions: [{ label: "Message Coach", type: "navigate", payload: "/messages" }],
      pendingFlow: null,
    };
  }

  const { weight, bodyFat } = parseWeightAndBodyFat(text);

  if (weight === undefined) {
    return {
      text: "What's your weight today (kg)?",
      actions: [CANCEL_ACTION],
      pendingFlow: { type: "log_weight" },
    };
  }

  try {
    const previous = await getLatestBodyComp(clientId);
    await insertBodyComposition(clientId, { weight_kg: weight, body_fat_percentage: bodyFat });

    let responseText = `Logged ${weight} kg`;
    if (bodyFat !== undefined) responseText += ` at ${bodyFat}% body fat`;
    responseText += ".";

    if (previous?.weight_kg) {
      const diff = Number((weight - Number(previous.weight_kg)).toFixed(1));
      const diffText = diff === 0 ? "no change" : `${diff > 0 ? "+" : ""}${diff} kg`;
      responseText += ` That's ${diffText} vs your last entry on ${formatDateLocale(previous.recorded_at)}.`;
    }

    logChatEvent(ctx.userId, "guided_flow", { flow: "log_weight", result: "success" });
    return { text: responseText, pendingFlow: null };
  } catch (err) {
    console.error("Failed to log weight:", err);
    logChatEvent(ctx.userId, "guided_flow", { flow: "log_weight", result: "error" });
    return { text: "Sorry, I couldn't log that. Please try again or enter it in Bio Print.", actions: [{ label: "Bio Print", type: "navigate", payload: "/bioprint" }], pendingFlow: null };
  }
}

async function handleHabitDone(
  text: string,
  ctx: FlowContext
): Promise<FlowResult | null> {
  if (ctx.userRole === "trainer") {
    return {
      text: "Habit tracking is for clients. Trainers can assign habits from the Check-ins page.",
      actions: [{ label: "Check-ins", type: "navigate", payload: "/check-ins" }],
      pendingFlow: null,
    };
  }

  if (!ctx.userId || !ctx.userEmail) {
    return {
      text: "I need you to be signed in to log habits.",
      actions: [{ label: "Sign In", type: "navigate", payload: "/login" }],
      pendingFlow: null,
    };
  }

  const clientId = await resolveClientId(ctx.userId, ctx.userEmail);
  if (!clientId) {
    return {
      text: "Your trainer needs to add you as a client first. Once you're connected, I can log your habits.",
      actions: [{ label: "Message Coach", type: "navigate", payload: "/messages" }],
      pendingFlow: null,
    };
  }

  const habits = await getActiveHabits(clientId);
  if (habits.length === 0) {
    return {
      text: "You don't have any active habits yet. Ask your coach to assign some.",
      actions: [{ label: "Message Coach", type: "navigate", payload: "/messages" }],
      pendingFlow: null,
    };
  }

  const candidates = ctx.pendingFlow?.type === "habit_done" ? ctx.pendingFlow.candidates : habits;
  const matching = findMatchingHabits(text, candidates);

  if (matching.length === 0 && ctx.pendingFlow?.type === "habit_done") {
    // Re-ask with the same candidate list
    return {
      text: "Which habit did you complete?",
      actions: [
        ...candidates.map((h) => ({ label: h.name, type: "suggest" as const, payload: `done ${h.name}` })),
        CANCEL_ACTION,
      ],
      pendingFlow: ctx.pendingFlow,
    };
  }

  if (matching.length === 0) {
    // No match and not in a flow — show all habits
    return {
      text: "Which habit did you complete?",
      actions: [
        ...habits.map((h) => ({ label: h.name, type: "suggest" as const, payload: `done ${h.name}` })),
        CANCEL_ACTION,
      ],
      pendingFlow: { type: "habit_done", candidates: habits },
    };
  }

  if (matching.length > 1) {
    return {
      text: "I found a few habits that match. Which one did you complete?",
      actions: [
        ...matching.map((h) => ({ label: h.name, type: "suggest" as const, payload: `done ${h.name}` })),
        CANCEL_ACTION,
      ],
      pendingFlow: { type: "habit_done", candidates: matching },
    };
  }

  const habit = matching[0];
  try {
    await upsertHabitLog(habit.id, clientId, true);
    const streak = await getHabitStreak(habit.id, clientId);
    logChatEvent(ctx.userId, "guided_flow", { flow: "habit_done", result: "success", habitId: habit.id });
    return {
      text: `Marked "${habit.name}" as done today. 🔥 Current streak: ${streak} day${streak === 1 ? "" : "s"}.`,
      pendingFlow: null,
    };
  } catch (err) {
    console.error("Failed to log habit:", err);
    logChatEvent(ctx.userId, "guided_flow", { flow: "habit_done", result: "error" });
    return {
      text: "Sorry, I couldn't log that habit. Please try again in Check-ins.",
      actions: [{ label: "Check-ins", type: "navigate", payload: "/check-ins" }],
      pendingFlow: null,
    };
  }
}

export async function tryHandleGuidedFlow(
  text: string,
  ctx: FlowContext
): Promise<FlowResult | null> {
  const lower = text.toLowerCase();

  if (lower === "cancel") {
    if (ctx.pendingFlow) {
      logChatEvent(ctx.userId, "guided_flow", { flow: ctx.pendingFlow.type, result: "cancelled" });
    }
    return { text: "Cancelled. Anything else I can help with?", pendingFlow: null };
  }

  if (ctx.pendingFlow?.type === "log_weight") {
    return handleLogWeight(text, ctx);
  }

  if (ctx.pendingFlow?.type === "habit_done") {
    return handleHabitDone(text, ctx);
  }

  if (isLogWeightTrigger(text)) {
    return handleLogWeight(text, ctx);
  }

  if (isHabitDoneTrigger(text)) {
    return handleHabitDone(text, ctx);
  }

  return null;
}

export type { FlowResult };
