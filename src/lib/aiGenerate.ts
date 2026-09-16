// ═══════════════════════════════════════════════════════════════
// aiGenerate (Phase 97b) — pure prompt assembly for the trainer's
// in-app "Generate with AI" program flow. No AI calls here — this
// only builds the exact prompt text; the caller sends it through the
// ai-chat edge function (src/services/aiConfig.ts invokeAiChat) and
// lands the markdown in the Phase 93 PasteImportDialog.
//
// HONEST DATA: client-context fields the clients row does NOT have are
// omitted from the prompt — never faked, never a guessed default.
// ═══════════════════════════════════════════════════════════════

/** Client context pulled from the clients row for generation. */
export interface GenerateContext {
  /** clients.fitness_goal (may be null). */
  goal?: string | null;
  /** clients.experience_level (may be null). */
  experience?: string | null;
  /** clients.equipment_access (array; may be null). */
  equipment?: string[] | null;
  /** clients.notes (injuries/limitations often live here; may be null). */
  notes?: string | null;
}

const CONTEXT_HEADER = "Client context (from client profile):";

/** Human-readable context lines — only fields with real values. */
export function contextLines(ctx: GenerateContext): string[] {
  const lines: string[] = [];
  if (ctx.goal?.trim()) lines.push(`- Goal/Focus: ${ctx.goal.trim()}`);
  if (ctx.experience?.trim()) lines.push(`- Level: ${ctx.experience.trim()}`);
  if (ctx.equipment && ctx.equipment.length > 0) {
    lines.push(`- Equipment: ${ctx.equipment.filter(Boolean).join(", ")}`);
  }
  if (ctx.notes?.trim()) lines.push(`- Injuries/Limitations/Notes: ${ctx.notes.trim()}`);
  return lines;
}

/** True when no context field has a value (the dialog shows the honest
 *  empty-context state rather than a fake block). */
export function hasAnyContext(ctx: GenerateContext): boolean {
  return contextLines(ctx).length > 0;
}

/** Output format instruction — the Phase 93 parser's canonical table.
 *  Kept as a constant next to the templates so the two cannot drift. */
export const OUTPUT_FORMAT_INSTRUCTION = `Output the program as a markdown table with EXACTLY these columns (the importer parses nothing else):
| Day | Order | Exercise | Sets | Reps | Tempo | Rest |
Use order codes A1/A2, B1/B2, etc. for supersets. One row per exercise. No prose before or after the table.`;

/**
 * Assemble the generation prompt: the owner-provided template VERBATIM
 * (do not reformat — promptTemplates.ts strings are locked), then the
 * client-context block (marked as coming from the client profile), then
 * the output-format instruction targeting the Phase 93 parser.
 */
export function buildGenerationPrompt(template: string, ctx: GenerateContext): string {
  const lines = contextLines(ctx);
  const contextBlock =
    lines.length > 0 ? `\n\n${CONTEXT_HEADER}\n${lines.join("\n")}` : "";
  return `${template}${contextBlock}\n\n${OUTPUT_FORMAT_INSTRUCTION}`;
}
