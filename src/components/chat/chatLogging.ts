import { supabase } from "@/lib/supabase";
import type { ChatAction } from "./types";

type EventMetadata = Record<string, string | number | boolean | null>;

export async function logChatMessage(
  userId: string | undefined,
  role: "user" | "assistant",
  content: string,
  extras?: { intent?: string; tokensInput?: number; tokensOutput?: number; modelUsed?: string; latencyMs?: number }
): Promise<string | null> {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({
      user_id: userId,
      role,
      content,
      intent: extras?.intent || null,
      tokens_input: extras?.tokensInput || null,
      tokens_output: extras?.tokensOutput || null,
      model_used: extras?.modelUsed || null,
      latency_ms: extras?.latencyMs || null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to log chat message:", error.message);
    return null;
  }
  return data?.id ?? null;
}

export function logChatEvent(
  userId: string | undefined,
  eventType: string,
  metadata: EventMetadata = {}
) {
  if (!userId) return;
  supabase
    .from("chat_events")
    .insert({
      user_id: userId,
      event_type: eventType,
      metadata,
    })
    .then(
      ({ error }) => {
        if (error) console.error("Failed to log chat event:", error.message);
      },
      (err) => console.error("Failed to log chat event:", err)
    );
}

export async function submitFeedback(
  messageId: string | undefined,
  userId: string | undefined,
  rating: 1 | -1
): Promise<boolean> {
  if (!messageId || !userId) return false;

  const { data: existing } = await supabase
    .from("chat_feedback")
    .select("id")
    .eq("message_id", messageId)
    .eq("user_id", userId)
    .single();

  if (existing) {
    const { error } = await supabase
      .from("chat_feedback")
      .update({ rating })
      .eq("id", existing.id);
    if (error) {
      console.error("Failed to update feedback:", error.message);
      return false;
    }
    return true;
  }

  const { error } = await supabase.from("chat_feedback").insert({
    message_id: messageId,
    user_id: userId,
    rating,
  });
  if (error) {
    console.error("Failed to insert feedback:", error.message);
    return false;
  }
  return true;
}

export function logActionClick(userId: string | undefined, action: ChatAction) {
  logChatEvent(userId, "action_click", { label: action.label, type: action.type, payload: action.payload });
}

export function logCrisisFlag(userId: string | undefined, input: string) {
  logChatEvent(userId, "crisis_flag", { input: input.slice(0, 500) });
}

export function logMedicalGuard(userId: string | undefined, input: string) {
  logChatEvent(userId, "medical_guard", { input: input.slice(0, 500) });
}

export async function fetchFaqEntries(role: "trainer" | "client" | "admin"): Promise<{ question: string; answer: string; keywords: string[] }[]> {
  const { data, error } = await supabase.from("faq_entries").select("question, answer, keywords, roles");
  if (error) {
    console.error("Failed to load FAQ entries:", error.message);
    return [];
  }
  return (data || []).filter((entry) => entry.roles.includes(role) || entry.roles.includes("trainer,client"));
}
