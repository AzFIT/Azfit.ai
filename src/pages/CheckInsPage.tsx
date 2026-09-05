import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Plus,
  ArrowLeft,
  ChevronRight,
  Save,
  Check,
  Eye,
  X,
  Trash2,
  FileText,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatDateShort } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { isInCurrentWeek } from "@/lib/checkinWeek";
import ArcSlider from "@/components/ui/ArcSlider";
import type { Database } from "@/types/supabase";
import ClientHabits from "@/components/checkins/ClientHabits";
import TrainerHabits from "@/components/checkins/TrainerHabits";
import TrainerCheckInOverview from "@/components/checkins/TrainerCheckInOverview";

/* ── Types ─────────────────────────────────────────────── */

type FieldType = "text" | "number" | "scale" | "yesno";

interface FormField {
  key: string;
  label: string;
  type: FieldType;
}

interface CheckInForm {
  id: string;
  trainer_id: string;
  title: string;
  description: string | null;
  fields: FormField[];
  frequency: string;
  active: boolean;
  created_at: string;
  updated_at: string | null;
  submission_count?: number;
}

interface CheckInSubmission {
  id: string;
  form_id: string;
  client_id: string;
  answers: Record<string, unknown>;
  submitted_at: string;
  reviewed_at: string | null;
  trainer_notes: string | null;
  created_at: string;
  client?: { full_name: string; email: string };
  form?: { title: string };
}

/* ── Main Component ────────────────────────────────────── */

export default function CheckInsPage() {
  const { isTrainer, isClient } = useAuth();

  if (isTrainer) return <TrainerCheckIns />;
  if (isClient) return <ClientCheckIns />;

  return (
    <div className="min-h-[100dvh] p-6" style={{ backgroundColor: "var(--page-bg)" }}>
      <p style={{ color: "var(--text-muted)" }}>Check-ins are available for trainers and clients.</p>
    </div>
  );
}

/* ── Trainer View ──────────────────────────────────────── */

function TrainerCheckIns() {
  const [forms, setForms] = useState<CheckInForm[]>([]);
  const [submissions, setSubmissions] = useState<CheckInSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<CheckInSubmission | null>(null);
  const [trainerNotes, setTrainerNotes] = useState("");

  const { user } = useAuth();

  const loadForms = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("check_in_forms")
      .select("*")
      .eq("trainer_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load forms: " + error.message);
      setLoading(false);
      return;
    }

    const formsWithCounts = await Promise.all(
      (data || []).map(async (form) => {
        const { count, error: countError } = await supabase
          .from("check_in_submissions")
          .select("*", { count: "exact", head: true })
          .eq("form_id", form.id);
        return {
          ...form,
          fields: ((form.fields as unknown) as FormField[]) || [],
          submission_count: countError ? 0 : count || 0,
        };
      })
    );

    setForms(formsWithCounts);
    setLoading(false);
  }, [user]);

  const loadSubmissions = useCallback(async (formId: string) => {
    const { data, error } = await supabase
      .from("check_in_submissions")
      .select("*, client:clients(full_name, email)")
      .eq("form_id", formId)
      .order("submitted_at", { ascending: false });

    if (error) {
      toast.error("Failed to load submissions: " + error.message);
      return;
    }
    setSubmissions((data || []) as unknown as CheckInSubmission[]);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadForms();
  }, [loadForms]);

  const handleToggleActive = async (form: CheckInForm) => {
    const { error } = await supabase
      .from("check_in_forms")
      .update({ active: !form.active })
      .eq("id", form.id);

    if (error) {
      toast.error("Failed to update form: " + error.message);
      return;
    }
    toast.success("Form " + (form.active ? "disabled" : "enabled"));
    await loadForms();
  };

  const openSubmissions = async (formId: string) => {
    setSelectedFormId(formId);
    await loadSubmissions(formId);
  };

  const handleSelectSubmission = (submission: CheckInSubmission | null) => {
    setSelectedSubmission(submission);
    setTrainerNotes(submission?.trainer_notes || "");
  };

  const markReviewed = async (submission: CheckInSubmission) => {
    const { error } = await supabase
      .from("check_in_submissions")
      .update({ reviewed_at: new Date().toISOString() })
      .eq("id", submission.id);

    if (error) {
      toast.error("Failed to mark reviewed: " + error.message);
      return;
    }
    toast.success("Marked reviewed");
    if (selectedFormId) await loadSubmissions(selectedFormId);
    if (selectedSubmission?.id === submission.id) {
      setSelectedSubmission({ ...selectedSubmission, reviewed_at: new Date().toISOString() });
    }
  };

  const updateTrainerNotes = async (submissionId: string, notes: string) => {
    const { error } = await supabase
      .from("check_in_submissions")
      .update({ trainer_notes: notes })
      .eq("id", submissionId);

    if (error) {
      toast.error("Failed to save notes: " + error.message);
      return;
    }
    toast.success("Notes saved");
    if (selectedFormId) await loadSubmissions(selectedFormId);
  };

  const selectedForm = forms.find((f) => f.id === selectedFormId) || null;

  return (
    <div className="min-h-[100dvh]" style={{ backgroundColor: "var(--page-bg)" }}>
      <header className="sticky top-0 z-20 border-b px-4 py-3" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            {selectedFormId ? (
              <button onClick={() => setSelectedFormId(null)} className="p-2 rounded-lg hover:bg-white/5" style={{ color: "var(--light-text-muted)" }}>
                <ArrowLeft size={20} />
              </button>
            ) : null}
            <h1 className="text-lg font-bold" style={{ color: "var(--page-text)" }}>
              {selectedFormId ? `${selectedForm?.title} Submissions` : "Check-in Forms"}
            </h1>
          </div>
          {!selectedFormId && (
            <button
              onClick={() => setShowBuilder(true)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white"
              style={{ background: "linear-gradient(90deg, #00AEEF, #8B5CF6)" }}
            >
              <Plus size={16} />
              Create Form
            </button>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6">
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 rounded-2xl animate-pulse" style={{ backgroundColor: "var(--card-bg)" }} />
            ))}
          </div>
        ) : selectedFormId ? (
          <SubmissionsPanel
            submissions={submissions}
            selectedSubmission={selectedSubmission}
            notes={trainerNotes}
            setNotes={setTrainerNotes}
            onSelectSubmission={handleSelectSubmission}
            onMarkReviewed={markReviewed}
            onUpdateNotes={updateTrainerNotes}
          />
        ) : (
          <>
            {showBuilder && (
              <FormBuilder
                onCancel={() => setShowBuilder(false)}
                onSaved={async () => {
                  setShowBuilder(false);
                  await loadForms();
                }}
              />
            )}
            {/* Phase 44 Item 2: per-client weekly status, most-overdue-first,
                incl. trainer-side entry for account-less clients */}
            <TrainerCheckInOverview forms={forms} />
            {forms.length === 0 ? (
              <div className="rounded-2xl border p-10 text-center" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
                <FileText className="mx-auto mb-4 h-12 w-12" style={{ color: "var(--light-text-muted)" }} />
                <h3 className="text-lg font-bold" style={{ color: "var(--page-text)" }}>No check-in forms yet</h3>
                <p className="mb-6 text-sm" style={{ color: "var(--text-muted)" }}>Create your first form to start collecting client check-ins.</p>
                <button
                  onClick={() => setShowBuilder(true)}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
                  style={{ background: "linear-gradient(90deg, #00AEEF, #8B5CF6)" }}
                >
                  Create Form
                </button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {forms.map((form) => (
                  <div
                    key={form.id}
                    className="rounded-2xl border p-5 transition-all hover:border-[#00AEEF]/50"
                    style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
                  >
                    <div className="mb-3 flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold" style={{ color: "var(--page-text)" }}>{form.title}</h3>
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>{form.frequency} · {form.fields.length} fields</p>
                      </div>
                      <button
                        onClick={() => handleToggleActive(form)}
                        className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${form.active ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-500/20 text-slate-400"}`}
                      >
                        {form.active ? "Active" : "Inactive"}
                      </button>
                    </div>
                    <p className="mb-4 text-sm line-clamp-2" style={{ color: "var(--text-muted)" }}>
                      {form.description || "No description"}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>{form.submission_count} submission{form.submission_count !== 1 ? "s" : ""}</span>
                      <button
                        onClick={() => openSubmissions(form.id)}
                        className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                        style={{ background: "linear-gradient(90deg, #00AEEF, #8B5CF6)" }}
                      >
                        <Eye size={14} />
                        Submissions
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-10">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Client Habits
              </h2>
              <TrainerHabits />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Form Builder ──────────────────────────────────────── */

function FormBuilder({ onCancel, onSaved }: { onCancel: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [frequency, setFrequency] = useState("weekly");
  const [fields, setFields] = useState<FormField[]>([
    { key: "weight", label: "Current weight (kg)", type: "number" },
  ]);
  const [saving, setSaving] = useState(false);

  const addField = () => {
    setFields((prev) => [
      ...prev,
      { key: "field_" + (prev.length + 1), label: "", type: "text" },
    ]);
  };

  const removeField = (index: number) => {
    setFields((prev) => prev.filter((_, i) => i !== index));
  };

  const updateField = (index: number, patch: Partial<FormField>) => {
    setFields((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...patch } : f))
    );
  };

  const handleSave = async () => {
    if (!user) return;
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (fields.length === 0) {
      toast.error("Add at least one field");
      return;
    }
    if (fields.some((f) => !f.label.trim() || !f.key.trim())) {
      toast.error("All fields need a key and label");
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("check_in_forms").insert({
      trainer_id: user.id,
      title: title.trim(),
      description: description.trim() || null,
      frequency,
      fields: fields as unknown as Database["public"]["Tables"]["check_in_forms"]["Insert"]["fields"],
      active: true,
    });
    setSaving(false);

    if (error) {
      toast.error("Failed to create form: " + error.message);
      return;
    }
    toast.success("Form created");
    onSaved();
  };

  return (
    <div className="mb-8 rounded-2xl border p-5" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold" style={{ color: "var(--page-text)" }}>Create Check-in Form</h2>
        <button onClick={onCancel} className="p-1 rounded hover:bg-white/5" style={{ color: "var(--text-muted)" }}>
          <X size={18} />
        </button>
      </div>

      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:border-[#00AEEF]"
            style={{ borderColor: "var(--card-border)", color: "var(--page-text)" }}
            placeholder="e.g. Weekly Check-in"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>Frequency</label>
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:border-[#00AEEF]"
            style={{ borderColor: "var(--card-border)", color: "var(--page-text)" }}
          >
            <option value="weekly">Weekly</option>
            <option value="biweekly">Bi-weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
      </div>

      <div className="mb-4">
        <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:border-[#00AEEF]"
          style={{ borderColor: "var(--card-border)", color: "var(--page-text)" }}
          rows={2}
          placeholder="Optional instructions for the client"
        />
      </div>

      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Fields</label>
          <button onClick={addField} className="flex items-center gap-1 text-xs font-semibold" style={{ color: "#00AEEF" }}>
            <Plus size={14} /> Add Field
          </button>
        </div>
        <div className="space-y-2">
          {fields.map((field, i) => (
            <div key={i} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-12" style={{ borderColor: "var(--card-border)" }}>
              <div className="sm:col-span-4">
                <input
                  value={field.key}
                  onChange={(e) => updateField(i, { key: e.target.value })}
                  className="w-full rounded-lg border bg-transparent px-2 py-1.5 text-xs outline-none"
                  style={{ borderColor: "var(--card-border)", color: "var(--page-text)" }}
                  placeholder="Key"
                />
              </div>
              <div className="sm:col-span-5">
                <input
                  value={field.label}
                  onChange={(e) => updateField(i, { label: e.target.value })}
                  className="w-full rounded-lg border bg-transparent px-2 py-1.5 text-xs outline-none"
                  style={{ borderColor: "var(--card-border)", color: "var(--page-text)" }}
                  placeholder="Label"
                />
              </div>
              <div className="sm:col-span-2">
                <select
                  value={field.type}
                  onChange={(e) => updateField(i, { type: e.target.value as FieldType })}
                  className="w-full rounded-lg border bg-transparent px-2 py-1.5 text-xs outline-none"
                  style={{ borderColor: "var(--card-border)", color: "var(--page-text)" }}
                >
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="scale">Scale 1-10</option>
                  <option value="yesno">Yes/No</option>
                </select>
              </div>
              <div className="flex items-center justify-end sm:col-span-1">
                <button onClick={() => removeField(i)} className="p-1.5 rounded hover:bg-red-500/10" style={{ color: "var(--text-muted)" }}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-lg px-4 py-2 text-sm font-medium" style={{ color: "var(--text-muted)" }}>
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: "linear-gradient(90deg, #00AEEF, #8B5CF6)" }}
        >
          <Save size={16} />
          {saving ? "Saving..." : "Save Form"}
        </button>
      </div>
    </div>
  );
}

/* ── Submissions Panel ─────────────────────────────────── */

function SubmissionsPanel({
  submissions,
  selectedSubmission,
  notes,
  setNotes,
  onSelectSubmission,
  onMarkReviewed,
  onUpdateNotes,
}: {
  submissions: CheckInSubmission[];
  selectedSubmission: CheckInSubmission | null;
  notes: string;
  setNotes: (n: string) => void;
  onSelectSubmission: (s: CheckInSubmission | null) => void;
  onMarkReviewed: (s: CheckInSubmission) => void;
  onUpdateNotes: (id: string, notes: string) => void;
}) {
  if (selectedSubmission) {
    return (
      <div className="rounded-2xl border p-5" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-semibold" style={{ color: "var(--page-text)" }}>
              {selectedSubmission.client?.full_name || selectedSubmission.client?.email || "Submission"}
            </h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {formatDateShort(selectedSubmission.submitted_at)} · {selectedSubmission.reviewed_at ? "Reviewed" : "Pending review"}
            </p>
          </div>
          <button onClick={() => onSelectSubmission(null)} className="p-1 rounded hover:bg-white/5" style={{ color: "var(--text-muted)" }}>
            <X size={18} />
          </button>
        </div>

        <div className="mb-6 space-y-3">
          {Object.entries(selectedSubmission.answers || {}).map(([key, value]) => (
            <div key={key} className="rounded-xl border p-3" style={{ borderColor: "var(--card-border)" }}>
              <p className="text-xs font-medium uppercase" style={{ color: "var(--text-muted)" }}>{key}</p>
              <p className="text-sm" style={{ color: "var(--page-text)" }}>{String(value)}</p>
            </div>
          ))}
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>Coach Feedback (visible to client)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:border-[#00AEEF]"
            style={{ borderColor: "var(--card-border)", color: "var(--page-text)" }}
            rows={3}
          />
          <button
            onClick={() => onUpdateNotes(selectedSubmission.id, notes)}
            className="mt-2 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
            style={{ background: "linear-gradient(90deg, #00AEEF, #8B5CF6)" }}
          >
            Save Notes
          </button>
        </div>

        {!selectedSubmission.reviewed_at && (
          <button
            onClick={() => onMarkReviewed(selectedSubmission)}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ background: "linear-gradient(90deg, #00AEEF, #8B5CF6)" }}
          >
            <Check size={16} />
            Mark Reviewed
          </button>
        )}
      </div>
    );
  }

  if (submissions.length === 0) {
    return (
      <div className="rounded-2xl border p-10 text-center" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
        <p style={{ color: "var(--text-muted)" }}>No submissions yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {submissions.map((sub) => (
        <button
          key={sub.id}
          onClick={() => onSelectSubmission(sub)}
          className="w-full rounded-2xl border p-4 text-left transition-all hover:border-[#00AEEF]/50"
          style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium" style={{ color: "var(--page-text)" }}>
                {sub.client?.full_name || sub.client?.email || "Unknown client"}
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{formatDateShort(sub.submitted_at)}</p>
            </div>
            <div className="flex items-center gap-2">
              {sub.reviewed_at ? (
                <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-400">
                  <CheckCircle2 size={12} /> Reviewed
                </span>
              ) : (
                <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-400">
                  <Circle size={12} /> Pending
                </span>
              )}
              <ChevronRight size={18} style={{ color: "var(--text-muted)" }} />
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

/* ── Client View ───────────────────────────────────────── */

function ClientCheckIns() {
  const { user } = useAuth();
  const [forms, setForms] = useState<CheckInForm[]>([]);
  const [submissions, setSubmissions] = useState<CheckInSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeForm, setActiveForm] = useState<CheckInForm | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  // Phase 44: this week's submission is editable (update, not re-insert)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadForms = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("check_in_forms")
      .select("*")
      .eq("active", true)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load forms: " + error.message);
      setLoading(false);
      return;
    }

    setForms(((data || []) as unknown as CheckInForm[]).map((f) => ({ ...f, fields: ((f.fields as unknown) as FormField[]) || [] })));
    setLoading(false);
  }, [user]);

  const loadSubmissions = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("check_in_submissions")
      .select("*, form:check_in_forms(title)")
      .order("submitted_at", { ascending: false });

    if (error) {
      toast.error("Failed to load submissions: " + error.message);
      return;
    }
    setSubmissions((data || []) as unknown as CheckInSubmission[]);
  }, [user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadForms();
    loadSubmissions();
  }, [loadForms, loadSubmissions]);

  const startForm = (form: CheckInForm, existing?: CheckInSubmission) => {
    setActiveForm(form);
    setAnswers(existing ? ({ ...(existing.answers as Record<string, unknown>) }) : {});
    setEditingId(existing?.id ?? null);
  };

  const submitForm = async () => {
    if (!user || !activeForm || saving) return;

    const missing = activeForm.fields.filter((f) => {
      const v = answers[f.key];
      return v === undefined || v === "" || v === null;
    });
    if (missing.length > 0) {
      toast.error("Please answer all questions");
      return;
    }

    setSaving(true);
    if (editingId) {
      // Phase 44: update this week's entry (clients-update-own policy)
      const { error } = await supabase
        .from("check_in_submissions")
        .update({
          answers: answers as unknown as Database["public"]["Tables"]["check_in_submissions"]["Insert"]["answers"],
        })
        .eq("id", editingId);
      setSaving(false);
      if (error) {
        toast.error("Failed to update: " + error.message);
        return;
      }
      toast.success("Check-in updated");
      setActiveForm(null);
      setEditingId(null);
      await loadSubmissions();
      return;
    }

    const { data: clientRow, error: clientError } = await supabase
      .from("clients")
      .select("id")
      .eq("email", user.email)
      .maybeSingle(); // Phase 43: no clients row → null, not a 406

    if (clientError || !clientRow) {
      setSaving(false);
      toast.error("Could not find your client record");
      return;
    }

    const { error } = await supabase.from("check_in_submissions").insert({
      form_id: activeForm.id,
      client_id: clientRow.id,
      answers: answers as unknown as Database["public"]["Tables"]["check_in_submissions"]["Insert"]["answers"],
    });

    setSaving(false);
    if (error) {
      toast.error("Failed to submit: " + error.message);
      return;
    }

    toast.success("Check-in submitted");
    setActiveForm(null);
    await loadSubmissions();
  };

  if (activeForm) {
    return (
      <div className="min-h-[100dvh]" style={{ backgroundColor: "var(--page-bg)" }}>
        <header className="sticky top-0 z-20 border-b px-4 py-3" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <button onClick={() => setActiveForm(null)} className="p-2 rounded-lg hover:bg-white/5" style={{ color: "var(--light-text-muted)" }}>
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-lg font-bold" style={{ color: "var(--page-text)" }}>
              {editingId ? "Edit this week's check-in" : activeForm.title}
            </h1>
          </div>
        </header>

        <div className="mx-auto max-w-2xl px-4 py-6">
          <div className="mb-6 rounded-2xl border p-5" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
            {activeForm.description && (
              <p className="mb-4 text-sm" style={{ color: "var(--text-muted)" }}>{activeForm.description}</p>
            )}
            <div className="space-y-5">
              {activeForm.fields.map((field) => (
                <div key={field.key}>
                  <label className="mb-2 block text-sm font-medium" style={{ color: "var(--page-text)" }}>{field.label}</label>
                  {field.type === "text" && (
                    <textarea
                      value={String(answers[field.key] || "")}
                      onChange={(e) => setAnswers((a) => ({ ...a, [field.key]: e.target.value }))}
                      className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:border-[#00AEEF]"
                      style={{ borderColor: "var(--card-border)", color: "var(--page-text)" }}
                      rows={3}
                    />
                  )}
                  {field.type === "number" && (
                    <input
                      type="number"
                      value={String(answers[field.key] || "")}
                      onChange={(e) => setAnswers((a) => ({ ...a, [field.key]: e.target.value }))}
                      className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:border-[#00AEEF]"
                      style={{ borderColor: "var(--card-border)", color: "var(--page-text)" }}
                    />
                  )}
                  {field.type === "scale" && (
                    /* Phase 69: the 1-10 rating (energy/recovery) is now the
                       ArcSlider dial — the button grid it replaces was the
                       existing input; the center readout types exact values. */
                    <div className="flex flex-col items-center gap-1">
                      <ArcSlider
                        value={typeof answers[field.key] === "number" ? (answers[field.key] as number) : null}
                        min={1}
                        max={10}
                        step={1}
                        unit="/ 10"
                        onChange={(v) => setAnswers((a) => ({ ...a, [field.key]: v }))}
                        size={170}
                        aria-label={field.label}
                      />
                      {typeof answers[field.key] === "number" && (
                        <button
                          type="button"
                          onClick={() => setAnswers((a) => { const next = { ...a }; delete next[field.key]; return next; })}
                          className="text-[10px] font-medium underline underline-offset-2"
                          style={{ color: "var(--light-text-muted)" }}
                        >
                          Clear rating
                        </button>
                      )}
                    </div>
                  )}
                  {field.type === "yesno" && (
                    <div className="flex gap-3">
                      {["Yes", "No"].map((opt) => {
                        const selected = answers[field.key] === opt.toLowerCase();
                        return (
                          <button
                            key={opt}
                            onClick={() => setAnswers((a) => ({ ...a, [field.key]: opt.toLowerCase() }))}
                            className="flex-1 rounded-lg border py-2 text-sm font-semibold transition-colors"
                            style={{
                              borderColor: selected ? "#00AEEF" : "var(--card-border)",
                              backgroundColor: selected ? "rgba(0,174,239,0.15)" : "transparent",
                              color: selected ? "#00AEEF" : "var(--page-text)",
                            }}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={submitForm}
              disabled={saving}
              className="mt-6 w-full rounded-lg py-3 text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "linear-gradient(90deg, #00AEEF, #8B5CF6)" }}
            >
              {saving ? "Saving…" : editingId ? "Save changes" : "Submit Check-in"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh]" style={{ backgroundColor: "var(--page-bg)" }}>
      <header className="sticky top-0 z-20 border-b px-4 py-3" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
        <div className="mx-auto max-w-5xl">
          <h1 className="text-lg font-bold" style={{ color: "var(--page-text)" }}>Check-ins</h1>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Due Check-ins</h2>
        {loading ? (
          <div className="h-32 rounded-2xl animate-pulse" style={{ backgroundColor: "var(--card-bg)" }} />
        ) : forms.length === 0 ? (
          <p className="mb-8 text-sm" style={{ color: "var(--text-muted)" }}>No active check-ins from your trainer.</p>
        ) : (
          <div className="mb-10 grid gap-4 md:grid-cols-2">
            {forms.map((form) => {
              // Phase 44: this-week awareness — submitted → read-only
              // summary + Edit; otherwise the Complete CTA
              const thisWeek = submissions.find(
                (s) => s.form_id === form.id && isInCurrentWeek(s.submitted_at),
              );
              return (
                <div key={form.id} className="rounded-2xl border p-5" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
                  <h3 className="font-semibold" style={{ color: "var(--page-text)" }}>{form.title}</h3>
                  <p className="mb-4 text-xs" style={{ color: "var(--text-muted)" }}>{form.frequency} · {form.fields.length} questions</p>
                  {thisWeek ? (
                    <>
                      <div className="mb-4 rounded-xl px-3 py-2.5" style={{ backgroundColor: "rgba(34,197,94,0.08)" }}>
                        <p className="mb-1 flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                          <CheckCircle2 size={12} /> Submitted this week
                        </p>
                        {form.fields.map((f) => {
                          const v = (thisWeek.answers as Record<string, unknown>)[f.key];
                          if (v === undefined || v === null || v === "") return null;
                          return (
                            <p key={f.key} className="text-xs" style={{ color: "var(--light-text-muted)" }}>
                              {f.label}:{" "}
                              <span className="font-medium" style={{ color: "var(--page-text)" }}>
                                {String(v)}
                              </span>
                            </p>
                          );
                        })}
                      </div>
                      <button
                        onClick={() => startForm(form, thisWeek)}
                        className="rounded-lg border px-4 py-2 text-sm font-semibold transition hover:opacity-80"
                        style={{ borderColor: "var(--card-border)", color: "var(--azfit-primary)" }}
                      >
                        Edit this week
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => startForm(form)}
                      className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
                      style={{ background: "linear-gradient(90deg, #00AEEF, #8B5CF6)" }}
                    >
                      Complete
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>My Past Check-ins</h2>
        {submissions.filter((s) => !isInCurrentWeek(s.submitted_at)).length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No submissions yet.</p>
        ) : (
          <div className="space-y-3">
            {submissions
              .filter((s) => !isInCurrentWeek(s.submitted_at))
              .map((sub) => (
              <div key={sub.id} className="rounded-2xl border p-4" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium" style={{ color: "var(--page-text)" }}>{sub.form?.title || "Check-in"}</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{formatDateShort(sub.submitted_at)}</p>
                  </div>
                  {sub.reviewed_at ? (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-400">
                      <CheckCircle2 size={12} /> Reviewed
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-400">
                      <Circle size={12} /> Pending review
                    </span>
                  )}
                </div>
                {sub.reviewed_at && sub.trainer_notes && (
                  <div className="mt-3 rounded-xl border-l-4 border-l-[#00AEEF] bg-[#00AEEF]/5 px-3 py-2.5">
                    <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#00AEEF]">Coach Feedback</p>
                    <p className="whitespace-pre-wrap text-sm" style={{ color: "var(--page-text)" }}>{sub.trainer_notes}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <h2 className="mb-4 mt-10 text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          My Habits
        </h2>
        <ClientHabits />
      </div>
    </div>
  );
}
