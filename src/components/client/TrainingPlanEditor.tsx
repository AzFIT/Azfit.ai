/* ═══════════════════════════════════════════════════════════════
   TrainingPlanEditor (Phase 81 Item 2) — trainer-only edit mode for
   the Plan Summary training module. Exercise names come from a
   searchable exercise_library combobox (31B picker pattern);
   setsReps/tempo/rest are inline inputs with inline validation;
   per-session Regenerate (structure-preserving) and pair +/−.
   Pure rendering + callbacks — PlanSummaryTab owns state + saving.
   ═══════════════════════════════════════════════════════════════ */

import { useMemo, useState } from "react";
import { Plus, Minus, RefreshCw, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GbcSession, GbcBlock } from "@/lib/planBlueprint";
import type { TaxonomyExercise } from "@/lib/exerciseTaxonomy";
import {
  insertPair,
  removePair,
  updateRow,
  regenerateSession,
  sessionSupportsPairs,
  validateRowPatch,
  type RowPatch,
} from "@/lib/trainingEditor";

const inputCls =
  "w-full rounded border px-2 py-1 text-[11px] bg-[var(--page-bg)] border-[var(--card-border)] text-[var(--page-text)] focus:outline-none focus:border-[var(--azfit-primary)]";
const errCls = "mt-0.5 text-[9px] font-medium text-[var(--danger)]";

function ExerciseCombobox({
  value,
  options,
  onPick,
}: {
  value: string;
  options: TaxonomyExercise[];
  onPick: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? value;
  const filtered = useMemo(() => {
    const q = shown.trim().toLowerCase();
    const base = q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options;
    return base.slice(0, 8);
  }, [options, shown]);

  return (
    <div className="relative">
      <input
        className={inputCls}
        value={shown}
        placeholder="Search exercises…"
        aria-label="Exercise name"
        onFocus={() => { setText(value); setOpen(true); }}
        onChange={(e) => { setText(e.target.value); setOpen(true); }}
        onBlur={() => {
          // delay so a dropdown tap registers first
          setTimeout(() => {
            setOpen(false);
            if (text !== null) onPick(text.trim());
            setText(null);
          }, 150);
        }}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Toggle exercise list"
        onMouseDown={(e) => { e.preventDefault(); setOpen((o) => !o); if (text === null) setText(value); }}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--light-text-muted)]"
      >
        <ChevronDown size={12} />
      </button>
      {open && filtered.length > 0 && (
        <ul className="absolute z-[70] mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] shadow-xl">
          {filtered.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onPick(o.name); setOpen(false); setText(null); }}
                className="flex w-full items-center justify-between px-2.5 py-1.5 text-left text-[11px] text-[var(--page-text)] hover:bg-[var(--page-bg)]"
              >
                <span>{o.name}</span>
                <span className="text-[9px] text-[var(--light-text-muted)]">{o.primary_muscle}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EditRow({
  block,
  options,
  onPatch,
}: {
  block: GbcBlock;
  options: TaxonomyExercise[];
  onPatch: (patch: RowPatch) => void;
}) {
  const [draft, setDraft] = useState<RowPatch>({});
  const live = validateRowPatch({
    ...(draft.exercises !== undefined ? { exercises: draft.exercises } : {}),
    ...(draft.setsReps !== undefined ? { setsReps: draft.setsReps } : {}),
    ...(draft.tempo !== undefined ? { tempo: draft.tempo } : {}),
    ...(draft.rest !== undefined ? { rest: draft.rest } : {}),
  });
  return (
    <div className="space-y-1 rounded-lg border border-[var(--card-border)] bg-[var(--page-bg)] p-2">
      <div className="flex items-center gap-2">
        <span className="w-6 shrink-0 font-mono text-[11px] font-bold text-[var(--azfit-primary)]">{block.label}</span>
        <div className="min-w-0 flex-1">
          <ExerciseCombobox value={block.exercises} options={options} onPick={(name) => onPatch({ exercises: name })} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1.5 pl-8">
        <input
          className={inputCls}
          defaultValue={block.setsReps}
          aria-label="Sets and reps"
          onChange={(e) => { setDraft((d) => ({ ...d, setsReps: e.target.value })); onPatch({ setsReps: e.target.value }); }}
        />
        <input
          className={cn(inputCls, draft.tempo !== undefined && !validateRowPatch({ tempo: draft.tempo }).valid && "border-[var(--danger)]")}
          defaultValue={block.tempo}
          aria-label="Tempo"
          onChange={(e) => { setDraft((d) => ({ ...d, tempo: e.target.value })); onPatch({ tempo: e.target.value }); }}
        />
        <input
          className={cn(inputCls, draft.rest !== undefined && !validateRowPatch({ rest: draft.rest }).valid && "border-[var(--danger)]")}
          defaultValue={block.rest}
          aria-label="Rest"
          onChange={(e) => { setDraft((d) => ({ ...d, rest: e.target.value })); onPatch({ rest: e.target.value }); }}
        />
      </div>
      {!live.valid && live.errors[0] && <p className={errCls}>{live.errors[0]}</p>}
    </div>
  );
}

export default function TrainingPlanEditor({
  sessions,
  taxonomy,
  onChange,
}: {
  sessions: GbcSession[];
  taxonomy: TaxonomyExercise[];
  onChange: (next: GbcSession[]) => void;
}) {
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [regenNotes, setRegenNotes] = useState<Record<number, string[]>>({});

  const patchSession = (idx: number, next: GbcSession | null) => {
    if (!next) return;
    onChange(sessions.map((s, i) => (i === idx ? next : s)));
  };

  return (
    <div className="space-y-3">
      {sessions.map((s, si) => {
        const pairable = sessionSupportsPairs(s);
        const units: GbcBlock[][] = pairable
          ? s.blocks.reduce<GbcBlock[][]>((acc, b, i) => {
              if (i % 2 === 0) acc.push([b]);
              else acc[acc.length - 1].push(b);
              return acc;
            }, [])
          : s.blocks.map((b) => [b]);

        return (
          <div key={si} className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--light-elevated)" }}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-bold" style={{ color: "var(--page-text)" }}>{s.name}</p>
              <button
                type="button"
                onClick={() => {
                  const r = regenerateSession(s, taxonomy, { seed: Date.now() % 100000 });
                  patchSession(si, r.session);
                  setRegenNotes((prev) => ({ ...prev, [si]: r.notes }));
                }}
                className="flex min-h-[44px] items-center gap-1 rounded-lg border border-[var(--card-border)] px-2.5 text-[10px] font-semibold text-[var(--page-text)] hover:border-[var(--azfit-primary)]/50"
              >
                <RefreshCw size={11} style={{ color: "var(--azfit-primary)" }} />
                Regenerate workout
              </button>
            </div>
            {(regenNotes[si] ?? []).length > 0 && (
              <ul className="mb-2 space-y-0.5">
                {(regenNotes[si] ?? []).map((n) => (
                  <li key={n} className="text-[9px]" style={{ color: "var(--light-text-muted)" }}>{n}</li>
                ))}
              </ul>
            )}

            <div className="space-y-2">
              {units.map((unit) => {
                const first = unit[0];
                const letter = first.label.replace(/\d$/, "");
                return (
                  <div key={first.label} className="relative rounded-lg border border-dashed border-[var(--card-border)] p-1.5">
                    {pairable && (
                      <button
                        type="button"
                        aria-label={`Remove pair ${letter}`}
                        title={confirmRemove === `${si}-${letter}` ? "Tap again to confirm removal" : "Remove this pair"}
                        onClick={() => {
                          if (confirmRemove !== `${si}-${letter}`) {
                            setConfirmRemove(`${si}-${letter}`);
                            return;
                          }
                          setConfirmRemove(null);
                          patchSession(si, removePair(s, letter));
                        }}
                        className={cn(
                          "absolute -right-1.5 -top-1.5 z-10 flex h-11 w-11 items-center justify-center rounded-full border bg-[var(--card-bg)] transition-colors",
                          confirmRemove === `${si}-${letter}`
                            ? "border-[var(--danger)] text-[var(--danger)]"
                            : "border-[var(--card-border)] text-[var(--light-text-muted)] hover:text-[var(--danger)]",
                        )}
                      >
                        <Minus size={13} />
                      </button>
                    )}
                    <div className="space-y-1.5">
                      {unit.map((b) => (
                        // key includes the exercise so relabeled rows remount
                        // (defaultValue inputs can't go stale after pair ops)
                        <EditRow
                          key={`${b.label}:${b.exercises}`}
                          block={b}
                          options={taxonomy}
                          onPatch={(patch) => {
                            const next = updateRow(s, b.label, patch);
                            // invalid patches are rejected by the lib (row keeps its
                            // last valid value; the input stays editable with the error shown)
                            if (next) patchSession(si, next);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {pairable ? (
              <button
                type="button"
                onClick={() => patchSession(si, insertPair(s, s.blocks[s.blocks.length - 1].label))}
                className="mt-2 flex min-h-[44px] w-full items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--card-border)] text-[10px] font-semibold text-[var(--light-text-secondary)] hover:border-[var(--azfit-primary)]/50 hover:text-[var(--azfit-primary)]"
              >
                <Plus size={12} />
                Add superset pair
              </button>
            ) : (
              <p className="mt-2 text-[9px]" style={{ color: "var(--light-text-muted)" }}>
                Solo circuit — rows edit individually (no superset pairs here).
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
