import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Ticket, Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { remainingCredits } from "@/lib/creditsAvailability";

/* ═══════════════════════════════════════════════════════════════════
   Session Package card (Phase 50, Item 1) — trainer-side, client
   profile. Credits are DERIVATIVE (no stored counter): remaining =
   Σ total_credits − sessions (scheduled|completed) created since the
   earliest active package. Archive = hard delete (the pre-approved
   table shape has no archived flag — documented).
   ═══════════════════════════════════════════════════════════════════ */

interface PackageRow {
  id: string;
  name: string;
  total_credits: number;
  created_at: string | null;
}

export default function SessionPackageCard({ clientId }: { clientId: string }) {
  const { user } = useAuth();
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [remaining, setRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("12-Session Pack");
  const [total, setTotal] = useState(12);
  const [editId, setEditId] = useState<string | null>(null);
  const [editTotal, setEditTotal] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data: pkgs } = await supabase
      .from("session_packages")
      .select("id, name, total_credits, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: true });
    const rows = (pkgs as PackageRow[]) || [];
    if (rows.length === 0) {
      setPackages([]);
      setRemaining(0);
      setLoading(false);
      return;
    }
    const { data: sessions } = await supabase
      .from("sessions")
      .select("status, created_at")
      .eq("client_record_id", clientId)
      .in("status", ["scheduled", "completed"]);
    setPackages(rows);
    setRemaining(remainingCredits(rows, sessions || []));
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await load();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const createPackage = async () => {
    if (!user?.id || busy) return;
    setBusy(true);
    const { error } = await supabase.from("session_packages").insert({
      client_id: clientId,
      trainer_id: user.id,
      name: name.trim() || `${total}-Session Pack`,
      total_credits: total,
    });
    setBusy(false);
    if (error) {
      toast.error("Couldn't create package: " + error.message);
      return;
    }
    toast.success("Package created");
    setShowForm(false);
    await load();
  };

  const saveTotal = async (id: string) => {
    if (busy || editTotal < 1) return;
    setBusy(true);
    const { error } = await supabase
      .from("session_packages")
      .update({ total_credits: editTotal, updated_at: new Date().toISOString() })
      .eq("id", id);
    setBusy(false);
    if (error) {
      toast.error("Couldn't update: " + error.message);
      return;
    }
    setEditId(null);
    await load();
  };

  const removePackage = async (id: string) => {
    if (!window.confirm("Delete this package? Remaining credits are recomputed without it.")) return;
    setBusy(true);
    const { error } = await supabase.from("session_packages").delete().eq("id", id);
    setBusy(false);
    if (error) {
      toast.error("Couldn't delete: " + error.message);
      return;
    }
    toast.success("Package deleted");
    await load();
  };

  if (loading) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border p-4"
      style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Ticket size={16} style={{ color: "#8B5CF6" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--page-text)" }}>
            Session Packages
          </span>
          {packages.length > 0 && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={{
                backgroundColor: remaining <= 1 ? "rgba(239,68,68,0.15)" : "rgba(139,92,246,0.15)",
                color: remaining <= 1 ? "#EF4444" : "#8B5CF6",
              }}
            >
              {remaining} remaining
            </span>
          )}
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition hover:opacity-80"
          style={{ color: "var(--azfit-primary)" }}
        >
          <Plus size={12} />
          Add package
        </button>
      </div>

      {showForm && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl p-2.5" style={{ backgroundColor: "var(--light-elevated)" }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Package name"
            className="flex-1 min-w-[140px] rounded-lg border px-2 py-1.5 text-xs"
            style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)", color: "var(--page-text)" }}
          />
          <input
            type="number"
            min={1}
            value={total}
            onChange={(e) => setTotal(Math.max(1, Number(e.target.value) || 1))}
            className="w-20 rounded-lg border px-2 py-1.5 text-xs"
            style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)", color: "var(--page-text)" }}
            title="Credits"
          />
          <button
            onClick={createPackage}
            disabled={busy}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #00AEEF, #8B5CF6)" }}
          >
            {busy ? "Saving…" : "Create"}
          </button>
        </div>
      )}

      {packages.length === 0 ? (
        <p className="py-2 text-center text-xs" style={{ color: "var(--light-text-muted)" }}>
          No packages — credits are tracked when you add one.
        </p>
      ) : (
        <div className="space-y-1.5">
          {packages.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-xl px-3 py-2"
              style={{ backgroundColor: "var(--light-elevated)" }}
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-medium" style={{ color: "var(--page-text)" }}>
                  {p.name}
                </p>
                <p className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>
                  {p.total_credits} credits total
                </p>
              </div>
              <span className="flex items-center gap-1 shrink-0">
                {editId === p.id ? (
                  <>
                    <input
                      type="number"
                      min={1}
                      value={editTotal}
                      onChange={(e) => setEditTotal(Math.max(1, Number(e.target.value) || 1))}
                      className="w-16 rounded-lg border px-1.5 py-1 text-xs"
                      style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)", color: "var(--page-text)" }}
                    />
                    <button
                      onClick={() => saveTotal(p.id)}
                      disabled={busy}
                      className="rounded-lg px-2 py-1 text-[10px] font-semibold text-white"
                      style={{ backgroundColor: "var(--azfit-primary)" }}
                    >
                      Save
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setEditId(p.id);
                        setEditTotal(p.total_credits);
                      }}
                      className="rounded p-1 transition hover:opacity-80"
                      title="Edit total"
                    >
                      <Pencil size={11} style={{ color: "var(--light-text-muted)" }} />
                    </button>
                    <button
                      onClick={() => removePackage(p.id)}
                      disabled={busy}
                      className="rounded p-1 transition hover:opacity-80 disabled:opacity-40"
                      title="Delete package"
                    >
                      <Trash2 size={11} style={{ color: "var(--danger)" }} />
                    </button>
                  </>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
