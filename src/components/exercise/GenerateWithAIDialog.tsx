// ═══════════════════════════════════════════════════════════════
// GenerateWithAIDialog (Phase 97b) — trainer-side in-app program
// generation: pick a template (src/lib/promptTemplates.ts), edit the
// client context pulled from the clients row, send through the ai-chat
// edge function (97a — the trainer's OWN key, markdown mode), and hand
// the markdown to the Phase 93 paste-import review flow.
//
// Portaled overlay (createPortal → document.body) — the GlassCard
// backdrop-filter position:fixed trap is a permanent gotcha.
//
// HONEST STATES:
//  · ai-chat 404 no_key → "Add your API key in Settings → AI Assistant"
//    (the table is unreadable client-side BY DESIGN — detection is the
//    call's 404, not a pre-check).
//  · 502/provider error → the sanitized message verbatim + Retry.
//  · kimi-k3 is a reasoning model: 10–30s is NORMAL. The thinking
//    indicator shows elapsed seconds and there is NO client timeout —
//    the fetch outlives any impatience.
// THEME LOCK: tokens only; --ai-violet accent (AI surface — permitted).
// ═══════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Settings, Sparkles, TriangleAlert, X } from "lucide-react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GBC_DAY_PROMPT } from "@/lib/promptTemplates";
import { buildGenerationPrompt, type GenerateContext } from "@/lib/aiGenerate";
import { invokeAiChat, AiChatError } from "@/services/aiConfig";

/** Program-generation templates that exist today (promptTemplates.ts).
 *  GBC day generator is the owner's primary; the list is data-driven so
 *  new templates surface here without code changes. */
const TEMPLATES = [
  {
    id: "gbc-day",
    label: "GBC day generator (8 exercises, A1/A2–D1/D2 supersets)",
    prompt: GBC_DAY_PROMPT,
  },
] as const;

type GenState =
  | { kind: "idle" }
  | { kind: "thinking"; startedAt: number }
  | { kind: "no_key" }
  | { kind: "error"; message: string };

interface GenerateWithAIDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Clients-row context, prefilled + editable. */
  initialContext: GenerateContext;
  clientName?: string;
  /** Called with the model's markdown on success — the caller lands it
   *  in the PasteImportDialog via its initialRaw prop. */
  onGenerated: (markdown: string) => void;
}

const fieldCls =
  "w-full rounded-lg border border-[var(--card-border)] bg-[var(--page-bg)] px-2.5 py-1.5 text-xs text-[var(--page-text)] outline-none focus:ring-2 focus:ring-[var(--ai-violet)]/40";
const labelCls = "mb-0.5 block text-[10px] text-[var(--light-text-muted)]";

export default function GenerateWithAIDialog({
  open,
  onOpenChange,
  initialContext,
  clientName,
  onGenerated,
}: GenerateWithAIDialogProps) {
  const navigate = useNavigate();
  const [templateId, setTemplateId] = useState<(typeof TEMPLATES)[number]["id"]>("gbc-day");
  const [goal, setGoal] = useState(initialContext.goal ?? "");
  const [experience, setExperience] = useState(initialContext.experience ?? "");
  const [equipment, setEquipment] = useState((initialContext.equipment ?? []).join(", "));
  const [notes, setNotes] = useState(initialContext.notes ?? "");
  const [state, setState] = useState<GenState>({ kind: "idle" });
  const [elapsed, setElapsed] = useState(0);

  const thinking = state.kind === "thinking";

  // Elapsed-second ticker while thinking (kimi-k3: 10–30s is normal).
  useEffect(() => {
    if (state.kind !== "thinking") return;
    const t = setInterval(() => {
      setElapsed(Math.floor((Date.now() - state.startedAt) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [state]);

  const close = () => {
    if (thinking) return; // never abandon an in-flight generation
    setState({ kind: "idle" });
    onOpenChange(false);
  };

  const handleGenerate = async () => {
    const template = TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[0];
    const prompt = buildGenerationPrompt(template.prompt, {
      goal,
      experience,
      equipment: equipment.split(",").map((s) => s.trim()).filter(Boolean),
      notes,
    });
    setElapsed(0);
    setState({ kind: "thinking", startedAt: Date.now() });
    try {
      const { content } = await invokeAiChat([{ role: "user", content: prompt }]);
      setState({ kind: "idle" });
      onGenerated(content);
      onOpenChange(false);
    } catch (err) {
      if (err instanceof AiChatError && err.code === "no_key") {
        setState({ kind: "no_key" });
      } else if (err instanceof AiChatError) {
        setState({ kind: "error", message: err.message });
      } else {
        setState({ kind: "error", message: err instanceof Error ? err.message : "Unknown error" });
      }
    }
  };

  // Phase 97b: plain conditional render (no AnimatePresence — see index.css
  // note). A CSS keyframe provides the enter animation; close is immediate.
  return createPortal(
    open ? (
      <div
        className="azfit-dialog-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        onClick={close}
        data-testid="generate-ai-dialog"
      >
        <div
          className="azfit-dialog-panel flex w-full max-w-lg max-h-[85vh] flex-col overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
            {/* Header */}
            <div className="flex shrink-0 items-center gap-2 border-b border-[var(--card-border)] px-4 py-3">
              <Sparkles className="w-4 h-4 shrink-0 text-[var(--ai-violet)]" />
              <h2 className="flex-1 truncate text-sm font-semibold text-[var(--page-text)]">
                Generate with AI{clientName ? ` — ${clientName}` : ""}
              </h2>
              <button
                onClick={close}
                className="rounded-lg p-1.5 text-[var(--page-text)]/60 transition-colors hover:bg-[var(--page-bg)] hover:text-[var(--page-text)]"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {state.kind === "no_key" ? (
                <div className="space-y-3 rounded-xl border border-dashed border-[var(--card-border)] px-4 py-6 text-center">
                  <p className="text-xs text-[var(--page-text)]">
                    No AI key on file for your account.
                  </p>
                  <p className="text-[11px] text-[var(--light-text-muted)]">
                    Generation uses your own AI provider key — add it in Settings to enable
                    in-app program generation.
                  </p>
                  <Button
                    onClick={() => {
                      onOpenChange(false);
                      navigate("/settings");
                    }}
                    className="h-11 bg-[var(--ai-violet)] text-xs text-white hover:opacity-90"
                    data-testid="generate-ai-goto-settings"
                  >
                    <Settings className="mr-1.5 w-3.5 h-3.5" />
                    Add your API key in Settings → AI Assistant
                  </Button>
                </div>
              ) : state.kind === "error" ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-[#EF4444]/40 bg-[#EF4444]/10 px-3 py-2">
                    <p className="flex items-start gap-1.5 text-[11px] text-[var(--page-text)]">
                      <TriangleAlert className="mt-0.5 w-3.5 h-3.5 shrink-0 text-[#EF4444]" />
                      <span data-testid="generate-ai-error">{state.message}</span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setState({ kind: "idle" })}
                      className="h-11 flex-1 border-[var(--card-border)] text-xs text-[var(--page-text)]"
                    >
                      Back
                    </Button>
                    <Button
                      onClick={() => void handleGenerate()}
                      className="h-11 flex-1 bg-[var(--ai-violet)] text-xs text-white hover:opacity-90"
                      data-testid="generate-ai-retry"
                    >
                      Retry
                    </Button>
                  </div>
                </div>
              ) : thinking ? (
                <div
                  className="flex flex-col items-center gap-3 rounded-xl border border-[var(--card-border)] px-4 py-8 text-center"
                  data-testid="generate-ai-thinking"
                >
                  <Loader2 className="h-6 w-6 animate-spin text-[var(--ai-violet)]" />
                  <p className="text-xs font-medium text-[var(--page-text)]">
                    Generating — {elapsed}s elapsed
                  </p>
                  <p className="max-w-xs text-[11px] text-[var(--light-text-muted)]">
                    Reasoning models can take 10–30 seconds — this is normal. The result
                    opens straight in the import review.
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <label className={labelCls} htmlFor="gen-template">
                      Template
                    </label>
                    <select
                      id="gen-template"
                      value={templateId}
                      onChange={(e) => setTemplateId(e.target.value as typeof templateId)}
                      className={fieldCls}
                    >
                      {TEMPLATES.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="rounded-lg border border-dashed border-[var(--card-border)] px-3 py-2 text-[10px] leading-relaxed text-[var(--light-text-muted)]">
                    Client context below is prefilled from the client profile — edit it
                    before sending. Missing fields stay empty (nothing is guessed).
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div>
                      <label className={labelCls} htmlFor="gen-goal">
                        Goal/Focus <span className="text-[var(--ai-violet)]">from client profile</span>
                      </label>
                      <Input
                        id="gen-goal"
                        value={goal}
                        onChange={(e) => setGoal(e.target.value)}
                        placeholder="e.g. fat loss, hypertrophy"
                        className={fieldCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls} htmlFor="gen-exp">
                        Level <span className="text-[var(--ai-violet)]">from client profile</span>
                      </label>
                      <Input
                        id="gen-exp"
                        value={experience}
                        onChange={(e) => setExperience(e.target.value)}
                        placeholder="e.g. Beginner-Intermediate"
                        className={fieldCls}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="gen-equipment">
                      Equipment <span className="text-[var(--ai-violet)]">from client profile</span>
                    </label>
                    <Input
                      id="gen-equipment"
                      value={equipment}
                      onChange={(e) => setEquipment(e.target.value)}
                      placeholder="comma-separated, e.g. Barbell, Dumbbell, Cable"
                      className={fieldCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="gen-notes">
                      Injuries / Limitations / Notes <span className="text-[var(--ai-violet)]">from client profile</span>
                    </label>
                    <textarea
                      id="gen-notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      placeholder="None"
                      className={`${fieldCls} resize-y`}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            {state.kind !== "no_key" && state.kind !== "error" && (
              <div className="flex shrink-0 items-center gap-2 border-t border-[var(--card-border)] px-4 py-3">
                <Button
                  variant="outline"
                  onClick={close}
                  className="border-[var(--card-border)] text-xs text-[var(--page-text)]"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => void handleGenerate()}
                  disabled={thinking}
                  className="ml-auto h-11 bg-[var(--ai-violet)] text-xs text-white hover:opacity-90 disabled:opacity-50"
                  data-testid="generate-ai-send"
                >
                  {thinking ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {thinking ? "Generating…" : "Generate"}
                </Button>
              </div>
            )}
        </div>
      </div>
    ) : null,
    document.body,
  );
}
