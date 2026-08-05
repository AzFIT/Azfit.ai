import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle, PenLine, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { overdueRank } from "@/lib/checkinWeek";
import type { Database } from "@/types/supabase";

/* ═══════════════════════════════════════════════════════════════════
   Trainer check-in overview (Phase 44, Item 2) — per-client status on
   /check-ins: this-week submitted/due, latest entry (week, weight delta
   vs previous, ratings, notes), sorted most-overdue-first. Includes an
   "Enter" action for trainer-side entry on behalf of account-less
   clients (trainer-insert policy added in Phase 44).
   ═══════════════════════════════════════════════════════════════════ */

interface FormField {
  key: string;
  type: string;
  label: string;
}

interface FormRow {
  id: string;
  title: string;
  fields: FormField[];
}

interface SubRow {
  id: string;
  form_id: string;
  client_id: string;
  answers: Record<string, unknown>;
  submitted_at: string;
}

interface ClientRow {
  id: string;
  full_name: string;
}

interface ClientStatus {
  client: ClientRow;
  latest: SubRow | null;
  previous: SubRow | null;
  rank: number;
}

const shortDate = (ts: string) =>
  new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && v !== "" && v !== null && v !== undefined ? n : null;
}

export default function TrainerCheckInOverview({ forms }: { forms: FormRow[] }) {
  const { user } = useAuth();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [entryClient, setEntryClient] = useState<ClientRow | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  const activeForm = forms.find((f) => f.fields.length > 0) ?? null;

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data: roster } = await supabase
      .from("clients")
      .select("id, full_name")
      .eq("trainer_id", user.id)
      .neq("status", "archived")
      .order("full_name", { ascending: true });
    setClients((roster as ClientRow[]) || []);

    const formIds = forms.map((f) => f.id);
    if (formIds.length > 0) {
      const { data: rows } = await supabase
        .from("check_in_submissions")
        .select("id, form_id, client_id, answers, submitted_at")
        .in("form_id", formIds)
        .order("submitted_at", { ascending: false })
        .limit(500);
      setSubs((rows as unknown as SubRow[]) || []);
    } else {
      setSubs([]);
    }
    setLoading(false);
  }, [user, forms]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const statuses = useMemo<ClientStatus[]>(() => {
    const byClient = new Map<string, SubRow[]>();
    for (const s of subs) {
      const list = byClient.get(s.client_id) ?? [];
      list.push(s);
      byClient.set(s.client_id, list);
    }
    const out = clients.map((client) => {
      const history = byClient.get(client.id) ?? []; // already newest-first
      const latest = history[0] ?? null;
      const previous = history[1] ?? null;
      return {
        client,
        latest,
        previous,
        rank: overdueRank(latest?.submitted_at ?? null),
      };
    });
    // most overdue first (Infinity → largest), then name
    return out.sort((a, b) => b.rank - a.rank || a.client.full_name.localeCompare(b.client.full_name));
  }, [clients, subs]);

  const startEntry = (client: ClientRow) => {
    setEntryClient(client);
    setAnswers({});
  };

  const submitEntry = async () => {
    if (!activeForm || !entryClient || saving) return;
    const missing = activeForm.fields.filter((f) => {
      const v = answers[f.key];
      return v === undefined || v === "" || v === null;
    });
    if (missing.length > 0) {
      toast.error("Please answer all questions");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("check_in_submissions").insert({
      form_id: activeForm.id,
      client_id: entryClient.id,
      answers: answers as unknown as Database["public"]["Tables"]["check_in_submissions"]["Insert"]["answers"],
    });
    setSaving(false);
    if (error) {
      toast.error("Failed to save: " + error.message);
      return;
    }
    toast.success(`Check-in entered for ${entryClient.full_name}`);
    setEntryClient(null);
    await load();
  };

  if (loading) {
    return (
      <div className="mb-8 h-40 animate-pulse rounded-2xl" style={{ backgroundColor: "var(--card-bg)" }} />
    );
  }
  if (clients.length === 0 || !activeForm) return null;

  return (
    <div className="mb-10">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
        Client check-ins this week
      </h2>
      <div className="space-y-2">
        {statuses.map(({ client, latest, previous, rank }) => {
          const submitted = rank === 0;
          const w = latest ? num(latest.answers?.weight) : null;
          const pw = previous ? num(previous.answers?.weight) : null;
          const delta = w !== null && pw !== null ? Math.round((w - pw) * 10) / 10 : null;
          const energy = latest ? num(latest.answers?.energy) : null;
          const sleep = latest ? num(latest.answers?.sleep) : null;
          const notes = latest?.answers?.notes ? String(latest.answers.notes) : null;
          return (
            <div
              key={client.id}
              className="flex flex-col gap-2 rounded-xl border px-3 py-2.5 md:flex-row md:items-center md:justify-between"
              style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                {submitted ? (
                  <CheckCircle2 size={16} className="shrink-0" style={{ color: "#22C55E" }} />
                ) : (
                  <Circle size={16} className="shrink-0" style={{ color: rank === Number.POSITIVE_INFINITY ? "#EF4444" : "#F59E0B" }} />
                )}
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium" style={{ color: "var(--page-text)" }}>
                    {client.full_name}
                  </p>
                  <p className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>
                    {submitted
                      ? `Submitted ${shortDate(latest!.submitted_at)}`
                      : latest
                        ? `Due — last ${shortDate(latest.submitted_at)}`
                        : "Never submitted"}
                    {w !== null && ` · ${w} kg`}
                    {delta !== null && ` (${delta > 0 ? "+" : ""}${delta})`}
                    {energy !== null && ` · E${energy}`}
                    {sleep !== null && ` · S${sleep}`}
                    {notes && ` · “${notes.slice(0, 60)}${notes.length > 60 ? "…" : ""}”`}
                  </p>
                </div>
              </div>
              {!submitted && (
                <button
                  onClick={() => startEntry(client)}
                  className="flex shrink-0 items-center gap-1 self-start rounded-lg px-2.5 py-1 text-[11px] font-semibold transition hover:opacity-80 md:self-auto"
                  style={{ backgroundColor: "rgba(0,174,239,0.12)", color: "var(--azfit-primary)" }}
                  title="Enter this week's check-in on their behalf"
                >
                  <PenLine size={11} />
                  Enter
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Trainer-side entry dialog (account-less capable) */}
      {entryClient && activeForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setEntryClient(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border p-5"
            style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-1 flex items-center gap-2 text-sm font-bold" style={{ color: "var(--page-text)" }}>
              <UserPlus size={15} style={{ color: "var(--azfit-primary)" }} />
              Check-in for {entryClient.full_name}
            </p>
            <p className="mb-4 text-[11px]" style={{ color: "var(--light-text-muted)" }}>
              {activeForm.title} — entered by you on their behalf (this week).
            </p>
            <div className="space-y-4">
              {activeForm.fields.map((field) => (
                <div key={field.key}>
                  <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--page-text)" }}>
                    {field.label}
                  </label>
                  {field.type === "text" && (
                    <textarea
                      value={String(answers[field.key] || "")}
                      onChange={(e) => setAnswers((a) => ({ ...a, [field.key]: e.target.value }))}
                      rows={2}
                      className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                      style={{ borderColor: "var(--card-border)", backgroundColor: "var(--light-elevated)", color: "var(--page-text)" }}
                    />
                  )}
                  {field.type === "number" && (
                    <input
                      type="number"
                      value={String(answers[field.key] || "")}
                      onChange={(e) => setAnswers((a) => ({ ...a, [field.key]: e.target.value }))}
                      className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                      style={{ borderColor: "var(--card-border)", backgroundColor: "var(--light-elevated)", color: "var(--page-text)" }}
                    />
                  )}
                  {field.type === "scale" && (
                    <div className="flex flex-wrap gap-1.5">
                      {Array.from({ length: 10 }).map((_, i) => {
                        const n = i + 1;
                        const selected = answers[field.key] === n;
                        return (
                          <button
                            key={n}
                            onClick={() => setAnswers((a) => ({ ...a, [field.key]: n }))}
                            className="h-8 w-8 rounded-lg border text-xs font-semibold transition-colors"
                            style={{
                              borderColor: selected ? "#00AEEF" : "var(--card-border)",
                              backgroundColor: selected ? "rgba(0,174,239,0.15)" : "transparent",
                              color: selected ? "#00AEEF" : "var(--page-text)",
                            }}
                          >
                            {n}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {field.type === "yesno" && (
                    <div className="flex gap-2">
                      {["Yes", "No"].map((opt) => {
                        const selected = answers[field.key] === opt.toLowerCase();
                        return (
                          <button
                            key={opt}
                            onClick={() => setAnswers((a) => ({ ...a, [field.key]: opt.toLowerCase() }))}
                            className="flex-1 rounded-lg border py-1.5 text-xs font-semibold transition-colors"
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
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setEntryClient(null)}
                className="flex-1 rounded-lg border py-2 text-xs font-medium"
                style={{ borderColor: "var(--card-border)", color: "var(--light-text-muted)" }}
              >
                Cancel
              </button>
              <button
                onClick={submitEntry}
                disabled={saving}
                className="flex-1 rounded-lg py-2 text-xs font-semibold text-white disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #00AEEF, #8B5CF6)" }}
              >
                {saving ? "Saving…" : "Save check-in"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
