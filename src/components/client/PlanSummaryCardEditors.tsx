/* ═══════════════════════════════════════════════════════════════
   Plan Summary card editors (Phase 99d Item 1) — controlled inline
   editors for the per-card override system. Each editor edits the
   FULL editable subset of its card; drafts are initialized from the
   EFFECTIVE card (generated base + existing override) via
   buildDraft, and overrideFromDraft converts a draft back into the
   stored override shape. Textareas that map to string arrays use
   one item per line. Token-only styling.
   ═══════════════════════════════════════════════════════════════ */

import type { CardioRow } from "@/lib/blueprintCardio";
import type {
  CardioDraft,
  FaqDraft,
  NutritionGuideDraft,
  RoadmapDraft,
  SampleDayDraft,
  TrackingDraft,
  WeeklyTargetsDraft,
  WelcomeDraft,
} from "@/lib/planSummaryCardDrafts";

const inputCls =
  "w-full rounded-lg border px-2.5 py-1.5 text-xs bg-[var(--light-elevated)] border-[var(--card-border)] text-[var(--page-text)] focus:outline-none focus:border-[#00AEEF]";
const labelCls = "block text-[10px] font-medium mb-1 text-[var(--light-text-muted)]";
const addBtnCls =
  "mt-2 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--card-border)] px-3 py-2 text-[11px] font-semibold text-[var(--light-text-muted)] transition hover:border-[var(--azfit-primary)]/50 hover:text-[var(--azfit-primary)]";
const removeBtnCls = "min-h-[44px] shrink-0 rounded-lg border border-[var(--card-border)] px-3 py-2 text-[10px] font-medium text-[var(--light-text-muted)] transition hover:opacity-70";

/* ── Shared field primitives ─────────────────────────────────── */

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <input className={inputCls} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function TextArea({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <textarea className={inputCls} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function NumField({ label, value, onChange, step }: { label: string; value: number | null; onChange: (v: number | null) => void; step?: number }) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <input
        type="number"
        step={step}
        className={inputCls}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      />
    </label>
  );
}

/** One-item-per-line textarea bound to a string array. */
function LinesField({ label, value, onChange, rows = 3 }: { label: string; value: string[]; onChange: (v: string[]) => void; rows?: number }) {
  return (
    <label className="block">
      <span className={labelCls}>{label} (one per line)</span>
      <textarea
        className={inputCls}
        rows={rows}
        value={value.join("\n")}
        onChange={(e) => onChange(e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))}
      />
    </label>
  );
}

function AddRowButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={addBtnCls}>
      + {label}
    </button>
  );
}

/* ── Welcome ─────────────────────────────────────────────────── */

export function WelcomeEditor({ value, onChange }: { value: WelcomeDraft; onChange: (v: WelcomeDraft) => void }) {
  return (
    <div className="space-y-3">
      <TextField label="Title" value={value.title} onChange={(title) => onChange({ ...value, title })} />
      <TextArea label="Welcome message" rows={5} value={value.message} onChange={(message) => onChange({ ...value, message })} />
    </div>
  );
}

/* ── Weekly targets ──────────────────────────────────────────── */

export function WeeklyTargetsEditor({ value, onChange }: { value: WeeklyTargetsDraft; onChange: (v: WeeklyTargetsDraft) => void }) {
  const set = (patch: Partial<WeeklyTargetsDraft>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <NumField label="Starting weight (kg)" value={value.baseline.weightKg} onChange={(weightKg) => set({ baseline: { ...value.baseline, weightKg } })} />
        <NumField label="Starting body fat (%)" step={0.1} value={value.baseline.bodyFatPct} onChange={(bodyFatPct) => set({ baseline: { ...value.baseline, bodyFatPct } })} />
        <NumField label="Target weight (kg)" value={value.goal.targetWeightKg} onChange={(targetWeightKg) => set({ goal: { ...value.goal, targetWeightKg } })} />
        <NumField label="Target body fat (%)" step={0.1} value={value.goal.targetBodyFatPct} onChange={(targetBodyFatPct) => set({ goal: { ...value.goal, targetBodyFatPct } })} />
      </div>
      <label className="block">
        <span className={labelCls}>Target date (optional)</span>
        <input
          type="date"
          className={inputCls}
          value={value.goal.targetDate ?? ""}
          onChange={(e) => set({ goal: { ...value.goal, targetDate: e.target.value || null } })}
        />
      </label>
      <TextField
        label="Realistic weekly rate label"
        value={value.weeklyRate?.label ?? ""}
        onChange={(label) => set({ weeklyRate: label ? { label } : null })}
      />
      <div>
        <label className={labelCls}>What to expect (per phase)</label>
        {value.expectations.map((e, i) => (
          <div key={i} className="mb-2 flex items-start gap-2">
            <div className="grid flex-1 grid-cols-3 gap-2">
              <input className={inputCls} placeholder="Weeks (e.g. 1–2)" aria-label={`Expectation ${i + 1} weeks`} value={e.weeks} onChange={(ev) => set({ expectations: value.expectations.map((x, j) => (j === i ? { ...x, weeks: ev.target.value } : x)) })} />
              <input className={inputCls} placeholder="Focus" aria-label={`Expectation ${i + 1} focus`} value={e.focus} onChange={(ev) => set({ expectations: value.expectations.map((x, j) => (j === i ? { ...x, focus: ev.target.value } : x)) })} />
              <input className={inputCls} placeholder="Expectation" aria-label={`Expectation ${i + 1} expectation`} value={e.expectation} onChange={(ev) => set({ expectations: value.expectations.map((x, j) => (j === i ? { ...x, expectation: ev.target.value } : x)) })} />
            </div>
            <button type="button" aria-label="Remove expectation row" className={removeBtnCls} onClick={() => set({ expectations: value.expectations.filter((_, j) => j !== i) })}>
              ✕
            </button>
          </div>
        ))}
        <AddRowButton label="Add phase expectation" onClick={() => set({ expectations: [...value.expectations, { weeks: "", focus: "", expectation: "" }] })} />
      </div>
      <LinesField label="Wins that aren't the scale" value={value.nonScaleVictories} onChange={(nonScaleVictories) => set({ nonScaleVictories })} />
    </div>
  );
}

/* ── Cardio ──────────────────────────────────────────────────── */

export function CardioEditor({ value, onChange }: { value: CardioDraft; onChange: (v: CardioDraft) => void }) {
  const setRow = (i: number, patch: Partial<CardioRow>) =>
    onChange({ rows: value.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  return (
    <div>
      {value.rows.map((r, i) => (
        <div key={i} className="mb-3 rounded-lg border p-3 last:mb-0" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--light-elevated)" }}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--light-text-muted)" }}>
              Machine {i + 1}
            </p>
            <button type="button" aria-label="Remove cardio row" className={removeBtnCls} onClick={() => onChange({ rows: value.rows.filter((_, j) => j !== i) })}>
              ✕
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <TextField label="Machine" value={r.machine} onChange={(machine) => setRow(i, { machine })} />
            <div>
              <span className={labelCls}>Difficulty</span>
              <select aria-label={`Difficulty (machine ${i + 1})`} className={inputCls} value={r.difficulty} onChange={(e) => setRow(i, { difficulty: e.target.value as CardioRow["difficulty"] })}>
                <option>Beginner</option>
                <option>Intermediate</option>
                <option>Advanced</option>
              </select>
            </div>
            <TextField label="Protocol" value={r.protocol} onChange={(protocol) => setRow(i, { protocol })} />
            <TextField label="Time / distance basis" value={r.basis} onChange={(basis) => setRow(i, { basis })} />
            <TextField label="Intensity" value={r.intensity} onChange={(intensity) => setRow(i, { intensity })} />
            <TextField label="Schedule" value={r.schedule} onChange={(schedule) => setRow(i, { schedule })} />
          </div>
          <label className="mt-2 block">
            <span className={labelCls}>Progression (one per line, “Label: prescription”)</span>
            <textarea
              className={inputCls}
              rows={3}
              value={r.progression.map((p) => `${p.label}: ${p.prescription}`).join("\n")}
              onChange={(e) =>
                setRow(i, {
                  progression: e.target.value
                    .split("\n")
                    .map((line) => line.trim())
                    .filter(Boolean)
                    .map((line) => {
                      const idx = line.indexOf(":");
                      return idx === -1
                        ? { label: line, prescription: "" }
                        : { label: line.slice(0, idx).trim(), prescription: line.slice(idx + 1).trim() };
                    }),
                })
              }
            />
          </label>
        </div>
      ))}
      <AddRowButton
        label="Add cardio machine"
        onClick={() =>
          onChange({
            rows: [
              ...value.rows,
              { machine: "", protocol: "", difficulty: "Beginner", intensity: "", basis: "", schedule: "", progression: [] },
            ],
          })
        }
      />
    </div>
  );
}

/* ── Nutrition guide ─────────────────────────────────────────── */

export function NutritionGuideEditor({ value, onChange }: { value: NutritionGuideDraft; onChange: (v: NutritionGuideDraft) => void }) {
  const set = (patch: Partial<NutritionGuideDraft>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-3">
      <TextField label="Title" value={value.title} onChange={(title) => set({ title })} />
      <TextArea label="Intro" rows={4} value={value.intro} onChange={(intro) => set({ intro })} />
      <div>
        <label className={labelCls}>Guide blocks</label>
        {value.blocks.map((b, i) => (
          <div key={i} className="mb-2 rounded-lg border p-3" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--light-elevated)" }}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <input
                className={inputCls}
                placeholder="Block heading"
                aria-label={`Block heading ${i + 1}`}
                value={b.heading}
                onChange={(e) => set({ blocks: value.blocks.map((x, j) => (j === i ? { ...x, heading: e.target.value } : x)) })}
              />
              <button type="button" aria-label="Remove guide block" className={removeBtnCls} onClick={() => set({ blocks: value.blocks.filter((_, j) => j !== i) })}>
                ✕
              </button>
            </div>
            <LinesField label="Points" value={b.points} onChange={(points) => set({ blocks: value.blocks.map((x, j) => (j === i ? { ...x, points } : x)) })} />
          </div>
        ))}
        <AddRowButton label="Add guide block" onClick={() => set({ blocks: [...value.blocks, { heading: "", points: [] }] })} />
      </div>
      <LinesField label="Who should NOT be in a deficit" value={value.whoShouldNotCut} onChange={(whoShouldNotCut) => set({ whoShouldNotCut })} />
    </div>
  );
}

/* ── Sample day ──────────────────────────────────────────────── */

export function SampleDayEditor({ value, onChange }: { value: SampleDayDraft; onChange: (v: SampleDayDraft) => void }) {
  const setMeal = (i: number, patch: Partial<SampleDayDraft["meals"][number]>) =>
    onChange({ meals: value.meals.map((m, j) => (j === i ? { ...m, ...patch } : m)) });
  return (
    <div>
      {value.meals.map((m, i) => (
        <div key={i} className="mb-3 rounded-lg border p-3 last:mb-0" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--light-elevated)" }}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <input className={inputCls} placeholder="Meal name" aria-label={`Meal ${i + 1} name`} value={m.name} onChange={(e) => setMeal(i, { name: e.target.value })} />
            <button type="button" aria-label="Remove meal" className={removeBtnCls} onClick={() => onChange({ meals: value.meals.filter((_, j) => j !== i) })}>
              ✕
            </button>
          </div>
          <LinesField label="Items" value={m.items} onChange={(items) => setMeal(i, { items })} />
          <div className="mt-2 grid grid-cols-4 gap-2">
            <NumField label="kcal" value={m.macros.kcal} onChange={(kcal) => setMeal(i, { macros: { ...m.macros, kcal: kcal ?? 0 } })} />
            <NumField label="Protein g" value={m.macros.p} onChange={(p) => setMeal(i, { macros: { ...m.macros, p: p ?? 0 } })} />
            <NumField label="Carbs g" value={m.macros.c} onChange={(c) => setMeal(i, { macros: { ...m.macros, c: c ?? 0 } })} />
            <NumField label="Fat g" value={m.macros.f} onChange={(f) => setMeal(i, { macros: { ...m.macros, f: f ?? 0 } })} />
          </div>
        </div>
      ))}
      <AddRowButton label="Add meal" onClick={() => onChange({ meals: [...value.meals, { name: "", items: [], macros: { kcal: 0, p: 0, c: 0, f: 0 } }] })} />
    </div>
  );
}

/* ── Tracking / FAQ / Roadmap (generic row editors) ─────────── */

export function TrackingEditor({ value, onChange }: { value: TrackingDraft; onChange: (v: TrackingDraft) => void }) {
  const setRow = (i: number, patch: Partial<TrackingDraft["rows"][number]>) =>
    onChange({ rows: value.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  return (
    <div>
      {value.rows.map((r, i) => (
        <div key={i} className="mb-2 flex items-start gap-2">
          <div className="grid flex-1 grid-cols-3 gap-2">
            <input className={inputCls} placeholder="What" aria-label={`Tracking ${i + 1} what`} value={r.what} onChange={(e) => setRow(i, { what: e.target.value })} />
            <input className={inputCls} placeholder="Frequency" aria-label={`Tracking ${i + 1} frequency`} value={r.frequency} onChange={(e) => setRow(i, { frequency: e.target.value })} />
            <input className={inputCls} placeholder="Note" aria-label={`Tracking ${i + 1} note`} value={r.note} onChange={(e) => setRow(i, { note: e.target.value })} />
          </div>
          <button type="button" aria-label="Remove tracking row" className={removeBtnCls} onClick={() => onChange({ rows: value.rows.filter((_, j) => j !== i) })}>
            ✕
          </button>
        </div>
      ))}
      <AddRowButton label="Add tracking row" onClick={() => onChange({ rows: [...value.rows, { what: "", frequency: "", note: "" }] })} />
    </div>
  );
}

export function FaqEditor({ value, onChange }: { value: FaqDraft; onChange: (v: FaqDraft) => void }) {
  const setItem = (i: number, patch: Partial<FaqDraft["items"][number]>) =>
    onChange({ items: value.items.map((f, j) => (j === i ? { ...f, ...patch } : f)) });
  return (
    <div>
      {value.items.map((f, i) => (
        <div key={i} className="mb-2 rounded-lg border p-3" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--light-elevated)" }}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <input className={inputCls} placeholder="Question" aria-label={`Question ${i + 1}`} value={f.q} onChange={(e) => setItem(i, { q: e.target.value })} />
            <button type="button" aria-label="Remove FAQ item" className={removeBtnCls} onClick={() => onChange({ items: value.items.filter((_, j) => j !== i) })}>
              ✕
            </button>
          </div>
          <TextArea label="Answer" rows={2} value={f.a} onChange={(a) => setItem(i, { a })} />
        </div>
      ))}
      <AddRowButton label="Add FAQ item" onClick={() => onChange({ items: [...value.items, { q: "", a: "" }] })} />
    </div>
  );
}

export function RoadmapEditor({ value, onChange }: { value: RoadmapDraft; onChange: (v: RoadmapDraft) => void }) {
  const setPhase = (i: number, patch: Partial<RoadmapDraft["phases"][number]>) =>
    onChange({ phases: value.phases.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  return (
    <div>
      {value.phases.map((p, i) => (
        <div key={i} className="mb-2 flex items-start gap-2">
          <div className="grid flex-1 grid-cols-3 gap-2">
            <input className={inputCls} placeholder="Weeks (e.g. 1–2)" aria-label={`Phase ${i + 1} weeks`} value={p.weeks} onChange={(e) => setPhase(i, { weeks: e.target.value })} />
            <input className={inputCls} placeholder="Phase name" aria-label={`Phase ${i + 1} name`} value={p.name} onChange={(e) => setPhase(i, { name: e.target.value })} />
            <input className={inputCls} placeholder="Note" aria-label={`Phase ${i + 1} note`} value={p.note} onChange={(e) => setPhase(i, { note: e.target.value })} />
          </div>
          <button type="button" aria-label="Remove roadmap phase" className={removeBtnCls} onClick={() => onChange({ phases: value.phases.filter((_, j) => j !== i) })}>
            ✕
          </button>
        </div>
      ))}
      <AddRowButton label="Add roadmap phase" onClick={() => onChange({ phases: [...value.phases, { weeks: "", name: "", note: "" }] })} />
    </div>
  );
}
