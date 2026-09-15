// ═══════════════════════════════════════════════════════════════
// PasteImportDialog (Phase 93) — paste a program from Google Sheets
// or an AI chat straight into the Program Creator's Step 6.
//
// Three surfaces in one portaled overlay (createPortal → document.body:
// GlassCard backdrop-filter traps position:fixed — permanent gotcha):
//   1. PASTE   — textarea + live parse preview grouped by day + honest
//                line-numbered errors (nothing silently dropped).
//   2. REVIEW  — every row matched against the live exercise_library via
//                matchExercise: ≥0.8 auto-matched chip · 0.5–0.8 tap-to-
//                accept "Did you mean?" · <0.5 top-3 picker + inline
//                add-to-library form (inserts the exercise, then the row
//                auto-resolves to it).
//   3. CONFIRM — fires onImport(result, resolutions) so the wizard
//                populates its existing day/exercise state (no parallel
//                program model).
// THEME LOCK: existing tokens + the app's established #22C55E success /
// #F59E0B warn / #EF4444 danger accents only — zero new hex.
// ═══════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ClipboardPaste,
  Copy,
  Loader2,
  Plus,
  TriangleAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  AUTO_MATCH_THRESHOLD,
  SUGGEST_THRESHOLD,
  matchExercise,
} from "@/lib/exerciseMatch";
import { parseProgramPaste } from "@/lib/programImport";
import type { ParseResult, ParsedRow } from "@/lib/programImport";
import { GBC_DAY_PROMPT, PROGRAM_FORMAT_TEMPLATE } from "@/lib/promptTemplates";
import {
  clearRejection,
  buildImportSelection,
  importButtonLabel,
  rejectSuggestion,
  reviewCounts,
  skipLine,
  undoSkip,
} from "@/lib/importReview";
import type { LibraryExercise } from "./ExercisePickerDialog";

export type ImportResolutions = Map<number, LibraryExercise>; // keyed by ParsedRow.line

interface PasteImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (result: ParseResult, resolutions: ImportResolutions) => void;
}

type Stage = "paste" | "review";

/* Fallback option sets if the library query fails — the enum + the
   taxonomy's most common muscles/equipment (matches the 52B seed data). */
const FALLBACK_MUSCLES = ["Chest", "Back", "Legs", "Shoulders", "Biceps", "Triceps", "Core", "Glutes", "Hamstrings", "Calves", "Full Body"];
const FALLBACK_EQUIPMENT = ["Barbell", "Dumbbell", "Machine", "Cable", "Bodyweight", "Kettlebell", "Bands"];
const DIFFICULTIES = ["Beginner", "Intermediate", "Advanced"] as const;

export default function PasteImportDialog({
  open,
  onOpenChange,
  onImport,
}: PasteImportDialogProps) {
  const [stage, setStage] = useState<Stage>("paste");
  const [raw, setRaw] = useState("");
  const [library, setLibrary] = useState<LibraryExercise[]>([]);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [resolutions, setResolutions] = useState<ImportResolutions>(new Map());
  const [addOpenFor, setAddOpenFor] = useState<number | null>(null); // row line
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", muscle: "", equipment: "", difficulty: "Intermediate" as (typeof DIFFICULTIES)[number] });
  // Phase 92c-fix Item 3: rejected "Did you mean?" rows drop to the top-3
  // picker; skipped rows are excluded from the import (undoable until the
  // dialog closes).
  const [rejectedLines, setRejectedLines] = useState<Set<number>>(new Set());
  const [skippedLines, setSkippedLines] = useState<Set<number>>(new Set());

  /* Clipboard with an honest fallback: clipboard API → legacy execCommand
     → loud failure toast. Never pretends a copy succeeded. */
  const copyText = useCallback(async (text: string, okMessage: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(okMessage);
      return;
    } catch {
      /* fall through to the legacy path */
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      if (ok) {
        toast.success(okMessage);
        return;
      }
    } catch {
      /* fall through to the failure toast */
    }
    toast.error("Could not copy automatically — select and copy the text manually");
  }, []);

  // Fetch the catalog once per open (same query as ExercisePickerDialog).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const { data, error: err } = await supabase
        .from("exercise_library")
        .select("id, code, name, equipment, primary_muscle, difficulty, exercise_type, safety_notes")
        .eq("is_active", true)
        .order("name");
      if (cancelled) return;
      if (err) setLibraryError(err.message);
      else setLibrary((data as LibraryExercise[] | null) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Reset happens in the exit handlers (close / confirm) — the repo lint
  // rule bans setState-in-effect, and every way out of the dialog goes
  // through one of those two paths.
  const resetState = useCallback(() => {
    setStage("paste");
    setResolutions(new Map());
    setAddOpenFor(null);
    setLibraryError(null);
    setRejectedLines(new Set());
    setSkippedLines(new Set());
  }, []);

  const parsed: ParseResult = useMemo(
    () => (raw.trim() ? parseProgramPaste(raw) : { meta: {}, rows: [], errors: [] }),
    [raw],
  );

  const rowsByDay = useMemo(() => {
    const m = new Map<number, ParsedRow[]>();
    for (const r of parsed.rows) {
      const list = m.get(r.day) ?? [];
      list.push(r);
      m.set(r.day, list);
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [parsed.rows]);

  // Per-row match against the live library (recomputed as library grows
  // after an add-to-library insert).
  const matchByLine = useMemo(() => {
    const m = new Map<number, ReturnType<typeof matchExercise<LibraryExercise>>>();
    for (const r of parsed.rows) m.set(r.line, matchExercise(r.exercise, library));
    return m;
  }, [parsed.rows, library]);

  // Effective resolution per row: an explicit pick (suggestion accepted /
  // picker choice / add-to-library) wins; otherwise a score in the auto band
  // resolves to the best match without needing state (repo lint rule bans
  // setState-in-effect for this kind of prefill). Skipped rows never
  // resolve — they are excluded from the import entirely.
  const resolutionFor = useCallback(
    (line: number) => {
      if (skippedLines.has(line)) return null;
      const explicit = resolutions.get(line);
      if (explicit) return { lib: explicit, auto: false as const };
      const m = matchByLine.get(line);
      if (m?.best) return { lib: m.best, auto: true as const };
      return null;
    },
    [resolutions, matchByLine, skippedLines],
  );

  const resolvedLines = useMemo(
    () => parsed.rows.filter((r) => resolutionFor(r.line) != null).map((r) => r.line),
    [parsed.rows, resolutionFor],
  );
  const counts = reviewCounts(resolvedLines, skippedLines);
  // Item 3 FIX B: import is enabled whenever at least one row imports —
  // it never gates on "remaining" unresolved rows.
  const canImport = counts.importable > 0;

  const muscleOptions = useMemo(() => {
    const fromLib = [...new Set(library.map((l) => l.primary_muscle))].sort();
    return fromLib.length > 0 ? fromLib : FALLBACK_MUSCLES;
  }, [library]);
  const equipmentOptions = useMemo(() => {
    const fromLib = [...new Set(library.map((l) => l.equipment))].sort();
    return fromLib.length > 0 ? fromLib : FALLBACK_EQUIPMENT;
  }, [library]);

  const openAddForm = (row: ParsedRow) => {
    setAddForm({
      name: row.exercise,
      muscle: muscleOptions[0] ?? "Legs",
      equipment: equipmentOptions[0] ?? "Barbell",
      difficulty: "Intermediate",
    });
    setAddOpenFor(row.line);
  };

  /* Add-to-library: insert the exercise with the pasted name, append it
     to the local catalog, and the row auto-resolves to the new entry. */
  const handleAddToLibrary = useCallback(async (row: ParsedRow) => {
    const name = addForm.name.trim();
    if (!name || adding) return;
    setAdding(true);
    const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "exercise";
    const slug = `${base}-${Date.now().toString(36)}`;
    const { data, error } = await supabase
      .from("exercise_library")
      .insert({
        name,
        code: slug,
        exercise_code: slug,
        slug,
        primary_muscle: addForm.muscle,
        equipment: addForm.equipment,
        difficulty: addForm.difficulty,
        exercise_type: "Strength",
        is_active: true,
      })
      .select("id, code, name, equipment, primary_muscle, difficulty, exercise_type, safety_notes")
      .single();
    setAdding(false);
    if (error || !data) {
      // Honest failure — nothing half-created, row stays unresolved.
      window.alert(`Could not add to library: ${error?.message ?? "unknown error"}`);
      return;
    }
    const created = data as LibraryExercise;
    setLibrary((prev) => [...prev, created]);
    setResolutions((prev) => new Map(prev).set(row.line, created));
    setRejectedLines((prev) => clearRejection(prev, row.line));
    setAddOpenFor(null);
  }, [addForm, adding]);

  const handleConfirm = () => {
    if (!canImport) return;
    // Skipped rows AND unresolved rows never enter the program; auto-matches
    // fold in exactly once. Accept-all = the Phase 93 result byte-for-byte.
    const { rows, resolutions: final } = buildImportSelection({
      rows: parsed.rows,
      explicit: resolutions,
      skippedLines,
      autoMatchFor: (line) => matchByLine.get(line)?.best ?? null,
    });
    onImport({ ...parsed, rows }, final);
    resetState();
    onOpenChange(false);
  };

  const close = () => {
    resetState();
    onOpenChange(false);
  };

  const shell =
    "w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] shadow-2xl overflow-hidden";

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={close}
          data-testid="paste-import-dialog"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.15 }}
            className={shell}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Header ─────────────────────────────────────── */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--card-border)] shrink-0">
              {stage === "review" && (
                <button
                  onClick={() => setStage("paste")}
                  className="p-1.5 rounded-lg hover:bg-[var(--page-bg)] text-[var(--page-text)]/60 hover:text-[var(--page-text)] transition-colors"
                  aria-label="Back to paste"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <ClipboardPaste className="w-4 h-4 text-[#00AEEF] shrink-0" />
              <h2 className="text-sm font-semibold text-[var(--page-text)] flex-1 truncate">
                {stage === "paste" ? "Paste Import" : "Review exercises"}
              </h2>
              <button
                onClick={close}
                className="p-1.5 rounded-lg hover:bg-[var(--page-bg)] text-[var(--page-text)]/60 hover:text-[var(--page-text)] transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* ── Body ───────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {stage === "paste" ? (
                <>
                  <p className="text-[11px] text-[var(--page-text)]/60 leading-relaxed">
                    Paste a program table from Google Sheets (TSV/CSV) or an AI
                    chat (markdown). Metadata lines like{" "}
                    <span className="font-mono">**Program Name:** …</span> are
                    picked up automatically.
                  </p>
                  <Textarea
                    value={raw}
                    onChange={(e) => setRaw(e.target.value)}
                    rows={9}
                    placeholder={"**Program Name:** …\n**Weeks:** 4\n| Day | Order | Exercise | Sets | Reps | Tempo | Rest |\n| 1 | A1 | Front Squat (Barbell) | 4 | 12/10/8/6 | 4010 | 45s |"}
                    className="text-xs font-mono bg-[var(--page-bg)] border-[var(--card-border)] text-[var(--page-text)] resize-y"
                    data-testid="paste-import-textarea"
                  />
                  {/* Item 2 — "Need the format?" helper. Hidden once the
                      textarea has content (de-emphasized by absence). */}
                  {!raw.trim() && (
                    <div
                      className="rounded-xl border border-dashed border-[var(--card-border)] px-3 py-2.5 space-y-2"
                      data-testid="paste-import-format-helper"
                    >
                      <p className="text-[11px] font-semibold text-[var(--page-text)]/70">
                        Need the format?
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => void copyText(PROGRAM_FORMAT_TEMPLATE, "Template copied")}
                          className="inline-flex items-center gap-1.5 h-[44px] px-3 rounded-lg border border-[var(--card-border)] text-[11px] font-medium text-[var(--page-text)]/80 hover:text-[#00AEEF] hover:border-[#00AEEF]/50 transition-colors"
                          data-testid="copy-format-template"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          Copy format template
                        </button>
                        <button
                          onClick={() => void copyText(GBC_DAY_PROMPT, "Prompt copied")}
                          className="inline-flex items-center gap-1.5 h-[44px] px-3 rounded-lg border border-[var(--card-border)] text-[11px] font-medium text-[var(--page-text)]/80 hover:text-[#00AEEF] hover:border-[#00AEEF]/50 transition-colors"
                          data-testid="copy-ai-prompt"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          Copy AI prompt
                        </button>
                      </div>
                      <p className="text-[10px] text-[var(--page-text)]/50 leading-relaxed">
                        Paste the prompt into your AI chat, then paste the program table it
                        writes back here — the importer reads exactly this format.
                      </p>
                    </div>
                  )}
                  {raw.trim() && (
                    <div className="space-y-2" data-testid="paste-import-preview">
                      <p className="text-[11px] text-[var(--page-text)]/60">
                        <strong className="text-[var(--page-text)]">{parsed.rows.length}</strong>{" "}
                        exercise{parsed.rows.length === 1 ? "" : "s"} across{" "}
                        <strong className="text-[var(--page-text)]">{rowsByDay.length}</strong> day
                        {rowsByDay.length === 1 ? "" : "s"}
                        {parsed.meta.name ? ` · ${parsed.meta.name}` : ""}
                      </p>
                      {rowsByDay.map(([day, rows]) => (
                        <div key={day} className="rounded-xl border border-[var(--card-border)] overflow-hidden">
                          <div className="px-3 py-1.5 bg-[var(--page-bg)] text-[10px] font-semibold uppercase tracking-wider text-[var(--page-text)]/60">
                            Day {day} · {rows.length} exercise{rows.length === 1 ? "" : "s"}
                          </div>
                          {rows.map((r) => (
                            <div key={r.line} className="flex items-center gap-2 px-3 py-1.5 border-t border-[var(--card-border)] text-xs">
                              <span className="text-[#00AEEF] font-mono font-bold shrink-0">{r.order}</span>
                              <span className="text-[var(--page-text)] truncate flex-1">{r.exercise}</span>
                              <span className="text-[var(--page-text)]/50 shrink-0 font-mono text-[10px]">
                                {r.sets}×{r.reps}
                              </span>
                            </div>
                          ))}
                        </div>
                      ))}
                      {parsed.errors.length > 0 && (
                        <div className="rounded-xl border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-3 py-2 space-y-1">
                          {parsed.errors.map((e) => (
                            <p key={e.line} className="text-[11px] text-[var(--page-text)] flex items-start gap-1.5">
                              <TriangleAlert className="w-3 h-3 mt-0.5 shrink-0 text-[#F59E0B]" />
                              <span>
                                Line {e.line}: {e.reason}
                                {e.content ? <span className="text-[var(--page-text)]/50 font-mono"> — “{e.content}”</span> : null}
                              </span>
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {libraryError && (
                    <p className="text-[11px] text-[#EF4444] flex items-center gap-1.5">
                      <TriangleAlert className="w-3.5 h-3.5 shrink-0" />
                      Exercise library unavailable — matching disabled ({libraryError}).
                    </p>
                  )}
                  <p className="text-[11px] text-[var(--page-text)]/60">
                    Match each pasted exercise to the library — or skip rows
                    you don't want.{" "}
                    <strong className="text-[var(--page-text)]">
                      {counts.importable} of {parsed.rows.length}
                    </strong>{" "}
                    will import
                    {counts.skipped > 0 && (
                      <>
                        {" "}· <strong className="text-[var(--page-text)]">{counts.skipped}</strong> skipped
                      </>
                    )}
                    .
                  </p>
                  <div className="space-y-2">
                    {parsed.rows.map((row) => {
                      const res = resolutionFor(row.line);
                      const m = matchByLine.get(row.line);
                      const skipped = skippedLines.has(row.line);
                      // A rejected suggestion drops the row to the picker
                      // state (top-3 + add-to-library + skip).
                      const rejected = rejectedLines.has(row.line);
                      const suggested =
                        !res && !rejected && m &&
                        m.score >= SUGGEST_THRESHOLD && m.score < AUTO_MATCH_THRESHOLD &&
                        m.suggestions[0];
                      const unmatched = !res && (rejected || !m || m.score < SUGGEST_THRESHOLD);
                      return (
                        <div
                          key={row.line}
                          className={`rounded-xl border border-[var(--card-border)] px-3 py-2 space-y-1.5 ${
                            skipped ? "opacity-60" : ""
                          }`}
                          data-testid={`import-row-${row.line}`}
                        >
                          <div className="flex items-center gap-2 text-xs">
                            <span className="shrink-0 rounded bg-[var(--page-bg)] border border-[var(--card-border)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--page-text)]/60">
                              D{row.day} · {row.order}
                            </span>
                            <span className="text-[var(--page-text)] font-medium truncate flex-1">{row.exercise}</span>
                            {row.alternate && (
                              <span className="shrink-0 text-[9px] text-[var(--page-text)]/50 border border-[var(--card-border)] rounded-full px-1.5 py-0.5 truncate max-w-[120px]" title={`Alternate: ${row.alternate}`}>
                                Alt: {row.alternate}
                              </span>
                            )}
                            {skipped && (
                              <>
                                <span
                                  className="shrink-0 text-[9px] font-semibold uppercase tracking-wide border border-[var(--card-border)] rounded-full px-2 py-0.5 text-[var(--page-text)]/50"
                                  data-testid="import-row-skipped-badge"
                                >
                                  Skipped
                                </span>
                                <button
                                  onClick={() => setSkippedLines((prev) => undoSkip(prev, row.line))}
                                  className="shrink-0 h-[44px] px-2 text-[11px] text-[#00AEEF] hover:underline"
                                  aria-label={`Undo skip for ${row.exercise}`}
                                  data-testid="import-row-undo-skip"
                                >
                                  Undo
                                </button>
                              </>
                            )}
                          </div>
                          {/* Resolution state (skipped rows show only the
                              badge + undo above) */}
                          {!skipped && res ? (
                            <p className="flex items-center gap-1.5 text-[11px] text-[#22C55E]" data-testid="import-row-resolved">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{res.lib.name}</span>
                              {res.auto && (
                                <span className="text-[var(--page-text)]/40 shrink-0">auto-matched</span>
                              )}
                              {!res.auto && (
                                <button
                                  onClick={() => setResolutions((prev) => { const n = new Map(prev); n.delete(row.line); return n; })}
                                  className="ml-auto shrink-0 text-[var(--page-text)]/40 hover:text-[var(--page-text)] underline"
                                >
                                  change
                                </button>
                              )}
                            </p>
                          ) : suggested ? (
                            <div className="flex items-center gap-1.5 text-[11px] flex-wrap">
                              <span className="text-[#F59E0B] shrink-0">Did you mean</span>
                              <button
                                onClick={() => {
                                  setResolutions((prev) => new Map(prev).set(row.line, suggested));
                                  setRejectedLines((prev) => clearRejection(prev, row.line));
                                }}
                                className="px-2 py-1 rounded-lg border border-[#F59E0B]/50 text-[#F59E0B] hover:bg-[#F59E0B]/10 font-medium transition-colors"
                                data-testid="import-accept-suggestion"
                              >
                                {suggested.name}? — tap to accept
                              </button>
                              {/* Item 3 FIX A — a wrong suggestion now has a
                                  reject path into the resolution menu. */}
                              <button
                                onClick={() => setRejectedLines((prev) => rejectSuggestion(prev, row.line))}
                                className="inline-flex items-center gap-1 h-[44px] px-2 rounded-lg text-[var(--page-text)]/50 hover:text-[var(--page-text)] hover:bg-[var(--page-bg)] transition-colors"
                                aria-label="Reject suggestion"
                                data-testid="import-reject-suggestion"
                              >
                                <X className="w-3.5 h-3.5" />
                                Not this
                              </button>
                            </div>
                          ) : unmatched ? (
                            <div className="space-y-1.5">
                              {m && m.suggestions.length > 0 && (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[11px] text-[var(--page-text)]/50 shrink-0">
                                    {rejected ? "Pick a different exercise:" : "No close match — pick one:"}
                                  </span>
                                  {m.suggestions.map((s) => (
                                    <button
                                      key={s.id}
                                      onClick={() => {
                                        setResolutions((prev) => new Map(prev).set(row.line, s));
                                        setRejectedLines((prev) => clearRejection(prev, row.line));
                                      }}
                                      className="px-2 py-1 rounded-lg border border-[var(--card-border)] text-[var(--page-text)]/70 hover:border-[#00AEEF]/50 hover:text-[#00AEEF] text-[11px] font-medium transition-colors"
                                    >
                                      {s.name}
                                    </button>
                                  ))}
                                </div>
                              )}
                              {addOpenFor === row.line ? (
                                <form
                                  className="rounded-lg border border-[var(--card-border)] bg-[var(--page-bg)] p-2 grid grid-cols-2 gap-2"
                                  onSubmit={(e) => {
                                    e.preventDefault();
                                    void handleAddToLibrary(row);
                                  }}
                                >
                                  <div className="col-span-2">
                                    <label className="text-[9px] text-[var(--page-text)]/60">Exercise name</label>
                                    <Input
                                      value={addForm.name}
                                      onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                                      className="h-7 text-xs bg-[var(--card-bg)] border-[var(--card-border)] text-[var(--page-text)]"
                                      required
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[9px] text-[var(--page-text)]/60">Muscle</label>
                                    <select
                                      value={addForm.muscle}
                                      onChange={(e) => setAddForm((f) => ({ ...f, muscle: e.target.value }))}
                                      className="h-7 w-full text-xs rounded-md bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--page-text)]"
                                    >
                                      {muscleOptions.map((mo) => (
                                        <option key={mo} value={mo}>{mo}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="text-[9px] text-[var(--page-text)]/60">Equipment</label>
                                    <select
                                      value={addForm.equipment}
                                      onChange={(e) => setAddForm((f) => ({ ...f, equipment: e.target.value }))}
                                      className="h-7 w-full text-xs rounded-md bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--page-text)]"
                                    >
                                      {equipmentOptions.map((eq) => (
                                        <option key={eq} value={eq}>{eq}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="text-[9px] text-[var(--page-text)]/60">Difficulty</label>
                                    <select
                                      value={addForm.difficulty}
                                      onChange={(e) => setAddForm((f) => ({ ...f, difficulty: e.target.value as (typeof DIFFICULTIES)[number] }))}
                                      className="h-7 w-full text-xs rounded-md bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--page-text)]"
                                    >
                                      {DIFFICULTIES.map((d) => (
                                        <option key={d} value={d}>{d}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="flex items-end gap-1.5">
                                    <Button type="submit" size="sm" disabled={adding} className="h-7 text-xs bg-[#00AEEF] text-white hover:bg-[#00AEEF]/90">
                                      {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
                                      Add to library
                                    </Button>
                                    <Button type="button" variant="outline" size="sm" disabled={adding} onClick={() => setAddOpenFor(null)} className="h-7 text-xs border-[var(--card-border)] text-[var(--page-text)]">
                                      Cancel
                                    </Button>
                                  </div>
                                </form>
                              ) : (
                                <button
                                  onClick={() => openAddForm(row)}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-dashed border-[var(--card-border)] text-[var(--page-text)]/60 hover:text-[#00AEEF] hover:border-[#00AEEF]/50 text-[11px] font-medium transition-colors"
                                  data-testid="import-add-to-library"
                                >
                                  <Plus className="w-3 h-3" /> Add “{row.exercise}” to library
                                </button>
                              )}
                              {/* Item 3 — resolution menu option 3: skip.
                                  Excluded from the import, undoable on the
                                  row until the dialog closes. */}
                              <button
                                onClick={() => {
                                  setSkippedLines((prev) => skipLine(prev, row.line));
                                  setAddOpenFor((prev) => (prev === row.line ? null : prev));
                                }}
                                className="inline-flex items-center gap-1 h-[44px] px-2 rounded-lg text-[11px] font-medium text-[var(--page-text)]/50 hover:text-[var(--page-text)] hover:bg-[var(--page-bg)] transition-colors"
                                aria-label={`Skip ${row.exercise}`}
                                data-testid="import-skip-row"
                              >
                                <X className="w-3.5 h-3.5" />
                                Skip this row
                              </button>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* ── Footer ─────────────────────────────────────── */}
            <div className="flex items-center gap-2 px-4 py-3 border-t border-[var(--card-border)] shrink-0">
              {stage === "paste" ? (
                <>
                  <Button variant="outline" onClick={close} className="border-[var(--card-border)] text-[var(--page-text)] text-xs">
                    Cancel
                  </Button>
                  <Button
                    onClick={() => setStage("review")}
                    disabled={parsed.rows.length === 0}
                    className="ml-auto bg-[#00AEEF] text-white hover:bg-[#00AEEF]/90 text-xs"
                    data-testid="paste-import-review"
                  >
                    Review matches →
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={close} className="border-[var(--card-border)] text-[var(--page-text)] text-xs">
                    Cancel
                  </Button>
                  <Button
                    onClick={handleConfirm}
                    disabled={!canImport}
                    className="ml-auto bg-[#00AEEF] text-white hover:bg-[#00AEEF]/90 text-xs disabled:opacity-40"
                    data-testid="paste-import-confirm"
                  >
                    <Check className="w-3.5 h-3.5 mr-1" />
                    {importButtonLabel(counts)}
                  </Button>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
