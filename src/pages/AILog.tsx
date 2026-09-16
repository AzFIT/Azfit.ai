/* ═══════════════════════════════════════════════════════════════════
   AI Log (Phase 97a) — client quick-log chat.

   Chat in plain language → a structured entry in the REAL tables the
   rest of the app already reads (weight → body_composition, meal →
   foods_cache + nutrition_logs, water/sleep/training → habit_logs).
   Nothing is written until the input parses against the strict quick-
   log contract (src/lib/quickLog.ts); anything ambiguous becomes ONE
   clarifying question — never a guessed number (HONEST DATA).

   Two producers, same contract:
     1. ai-chat edge function (the trainer's own OpenAI-compatible
        key — spend is the trainer's; never committed, never shown
        back). Used when available.
     2. The on-device rule parser — permanent fallback when the edge
        function is undeployed, the trainer has no key, or the
        provider errors. The chat says so honestly.

   Chat history is in-memory only (no persistence requirement this
   phase — documented). The trainer's View As Client override writes
   through the same paths and stamps logged_by where the table has it.
   ═══════════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useEffectiveClientIdentity, useViewAs, type EffectiveClientIdentity } from "@/hooks/useViewAs";
import {
  detectIntent,
  parseQuickLog,
  validateQuickLogJson,
  type MealData,
  type QuickIntent,
  type QuickLogResult,
  type SleepData,
  type TrainingData,
  type WaterData,
  type WeightData,
} from "@/lib/quickLog";
import { invokeAiChat, AiChatError } from "@/services/aiConfig";
import {
  writeMeal,
  writeSleep,
  writeTraining,
  writeWater,
  writeWeight,
} from "@/services/quickLogWrite";

const CHIPS: { intent: QuickIntent; label: string }[] = [
  { intent: "meal", label: "Meal" },
  { intent: "training", label: "Training" },
  { intent: "water", label: "Water" },
  { intent: "sleep", label: "Sleep" },
  { intent: "weight", label: "Weight" },
];

const CONTRACT_HINTS: Record<QuickIntent, string> = {
  meal: '{"status":"ok","intent":"meal","data":{"name":"...","calories":<number>,"protein_g":<number optional>,"carbs_g":<number optional>,"fats_g":<number optional>,"meal_type":"breakfast|lunch|dinner|snacks"}}',
  training: '{"status":"ok","intent":"training","data":{"summary":"...","duration_min":<number optional>}}',
  water: '{"status":"ok","intent":"water","data":{"liters":<number>}}',
  sleep: '{"status":"ok","intent":"sleep","data":{"hours":<number>}}',
  weight: '{"status":"ok","intent":"weight","data":{"kg":<number>}}',
};

interface ChatMsg {
  role: "user" | "assistant" | "note";
  text: string;
}

function systemPromptFor(intent: QuickIntent): string {
  return [
    "You are the AzFIT quick-log assistant inside a fitness coaching app.",
    `The user's message is a ${intent} log. Extract it into STRICT JSON matching this contract:`,
    CONTRACT_HINTS[intent],
    'If any required value is missing or ambiguous, respond with {"status":"clarify","question":"<ONE short clarifying question>"} instead.',
    "Never guess or invent a number. Respond with the JSON object only.",
  ].join("\n");
}

export default function AILog() {
  const { user } = useAuth();
  const { viewAs } = useViewAs();
  const identity = useEffectiveClientIdentity();
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: "assistant",
      text: "Tell me what you ate, drank, or did — I'll log it straight to your plan.",
    },
  ]);
  const [input, setInput] = useState("");
  const [hint, setHint] = useState<QuickIntent | null>(null);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const identityRef = useRef(identity);
  useEffect(() => {
    identityRef.current = identity;
  }, [identity]);

  /** Identity resolution is async (clients-row lookup) — a send can land
   *  before it settles, so poll briefly instead of failing on first use. */
  async function waitForIdentity(timeoutMs = 8000): Promise<EffectiveClientIdentity | null> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const id = identityRef.current;
      if (id.resolved) return id;
      await new Promise((r) => setTimeout(r, 150));
    }
    return null;
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, busy]);

  const push = (role: ChatMsg["role"], text: string) =>
    setMessages((m) => [...m, { role, text }]);

  async function handleSend() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);
    push("user", text);

    try {
      // 1) Try the AI path first (trainer's key via the ai-chat edge
      //    function). Any failure drops to the on-device parser with
      //    an honest note — the chat never dies on a missing function.
      let result: QuickLogResult | null = null;
      let usedLocalNote = false;
      const intent = hint ?? detectIntent(text);
      try {
        const { content } = await invokeAiChat(
          [
            { role: "system", content: systemPromptFor(intent) },
            { role: "user", content: text },
          ],
          { json: true },
        );
        result = validateQuickLogJson(JSON.parse(content));
      } catch (err) {
        if (err instanceof AiChatError && err.code === "no_key") {
          // No trainer key configured — quiet on-device parse, no scare note.
        } else {
          usedLocalNote = true;
        }
        result = parseQuickLog(text, hint);
      }

      if (!result) {
        push("assistant", "I couldn't read that — could you rephrase it?");
        return;
      }
      if (result.status === "clarify") {
        if (usedLocalNote) push("note", "AI provider unavailable — parsed on-device.");
        push("assistant", result.question);
        return;
      }

      if (usedLocalNote) push("note", "AI provider unavailable — parsed on-device.");

      // 2) Resolve identity, then write through the real tables.
      const resolvedIdentity = await waitForIdentity();
      if (!resolvedIdentity || !resolvedIdentity.clientId || !user) {
        push("assistant", "I couldn't find your client record — please try again in a moment.");
        return;
      }
      const id = { clientId: resolvedIdentity.clientId, authUserId: user.id };
      let res: { ok: boolean; message: string };
      switch (result.intent) {
        case "weight":
          res = await writeWeight(id, result.data as WeightData, viewAs);
          break;
        case "water":
          res = await writeWater(id, result.data as WaterData, viewAs, user.id);
          break;
        case "sleep":
          res = await writeSleep(id, result.data as SleepData, viewAs, user.id);
          break;
        case "training":
          res = await writeTraining(id, result.data as TrainingData, viewAs, user.id);
          break;
        default:
          res = await writeMeal(id, result.data as MealData, viewAs);
      }
      push("assistant", res.message);
      if (res.ok) toast.success("Logged");
      else toast.error("Not logged");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-0px)] max-w-3xl flex-col px-4 py-6">
      <h1 className="text-lg font-bold" style={{ color: "var(--page-text)" }}>
        AI Log
      </h1>
      <p className="mt-1 text-sm" style={{ color: "var(--page-text)", opacity: 0.65 }}>
        Chat to log meals, training, water, sleep, or weight — it lands straight in the
        data your coach sees.
      </p>

      {/* Quick chips */}
      <div className="mt-4 flex flex-wrap gap-2">
        {CHIPS.map((c) => {
          const active = hint === c.intent;
          return (
            <button
              key={c.intent}
              type="button"
              onClick={() => setHint(active ? null : c.intent)}
              aria-pressed={active}
              className="min-h-[44px] rounded-full px-4 text-sm font-medium transition-colors"
              style={{
                background: active ? "linear-gradient(90deg, #00AEEF, #8B5CF6)" : "var(--card-bg)",
                border: `1px solid ${active ? "transparent" : "var(--card-border)"}`,
                color: active ? "#fff" : "var(--page-text)",
              }}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="mt-4 flex-1 space-y-3 overflow-y-auto pb-4">
        {messages.map((m, i) =>
          m.role === "note" ? (
            <div key={i} className="text-center text-xs italic" style={{ color: "var(--page-text)", opacity: 0.5 }}>
              {m.text}
            </div>
          ) : (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed"
                style={{
                  background: m.role === "user" ? "var(--card-bg)" : "transparent",
                  border: `1px solid ${m.role === "user" ? "var(--card-border)" : "transparent"}`,
                  color: "var(--page-text)",
                  borderRadius: m.role === "user" ? "20px 20px 8px 20px" : "8px 20px 20px 20px",
                }}
              >
                {m.text}
              </div>
            </div>
          ),
        )}
        {busy && (
          <div className="text-sm italic" style={{ color: "var(--page-text)", opacity: 0.6 }}>
            …
          </div>
        )}
      </div>

      {/* Input row */}
      <form
        className="flex items-end gap-2 pt-2"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSend();
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          rows={Math.min(4, Math.max(1, input.split("\n").length))}
          placeholder={hint ? `Log a ${hint}… (Enter to send)` : "e.g. “chicken rice 550 cal 40p” or “78.5 kg”"}
          className="min-h-[44px] flex-1 resize-none rounded-[14px] px-4 py-3 text-sm outline-none"
          style={{
            background: "var(--card-bg)",
            border: "1px solid var(--card-border)",
            color: "var(--page-text)",
          }}
          aria-label="Message"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="flex h-[44px] min-w-[44px] items-center justify-center rounded-full px-4 text-sm font-semibold disabled:opacity-50"
          style={{
            background: "linear-gradient(90deg, #00AEEF, #8B5CF6)",
            color: "#fff",
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
