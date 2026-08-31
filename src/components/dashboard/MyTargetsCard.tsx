/* ═══════════════════════════════════════════════════════════════
   My Targets (Phase 55, Item 2) — client-editable lifestyle targets
   (steps / sleep / water) on the client dashboard. Writes ONLY the
   lifestyle_targets column of the client's OWN clients row (narrow
   Phase 55 UPDATE policy — email-identity, own row only).
   ═══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from "react";
import { Target, Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  parseLifestyleTargets,
  mergeLifestyleTargets,
  lifestyleChips,
  hasLifestyleTargets,
  type LifestyleTargets,
} from "@/lib/lifestyleTargets";
import { GlassCard } from "./shared/GlassCard";
import type { Json } from "@/types/supabase";

const inputCls =
  "w-full rounded-lg border px-3 py-2 text-sm bg-[var(--light-elevated)] border-[var(--card-border)] text-[var(--page-text)] focus:outline-none focus:border-[#00AEEF]";
const labelCls = "block text-[10px] font-medium mb-1 text-[var(--light-text-muted)]";

export default function MyTargetsCard({ clientsId }: { clientsId: string }) {
  const [targets, setTargets] = useState<LifestyleTargets>({});
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [steps, setSteps] = useState("");
  const [sleep, setSleep] = useState("");
  const [water, setWater] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("clients").select("lifestyle_targets").eq("id", clientsId).maybeSingle();
    setTargets(parseLifestyleTargets(data?.lifestyle_targets));
    setLoaded(true);
  }, [clientsId]);

  useEffect(() => {
    load();
  }, [load]);

  const openEditor = () => {
    setSteps(targets.steps?.toString() ?? "");
    setSleep(targets.sleep_hours?.toString() ?? "");
    setWater(targets.water_ml?.toString() ?? "");
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const merged = mergeLifestyleTargets(targets, {
        steps: steps.trim() ? parseFloat(steps) : null,
        sleep_hours: sleep.trim() ? parseFloat(sleep) : null,
        water_ml: water.trim() ? parseFloat(water) : null,
      });
      // Single-column update of the client's OWN row (Phase 55 policy)
      const { error } = await supabase
        .from("clients")
        .update({ lifestyle_targets: (hasLifestyleTargets(merged) ? { ...merged } : null) as Json })
        .eq("id", clientsId);
      if (error) {
        toast.error("Couldn't save targets — please try again");
        return;
      }
      setTargets(merged);
      setEditing(false);
      toast.success("Targets saved");
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return null;
  const chips = lifestyleChips(targets);

  return (
    <GlassCard
      title="My Targets"
      titleIcon={<Target className="h-4 w-4" />}
      glass
      hover
      accentColor="var(--azfit-accent)"
      headerAction={
        !editing ? (
          <button
            onClick={openEditor}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition hover:opacity-80"
            style={{ color: "var(--azfit-primary)" }}
          >
            <Pencil size={11} /> {chips.length ? "Edit" : "Set targets"}
          </button>
        ) : undefined
      }
    >
      {!editing ? (
        <div className="py-2">
          {chips.length === 0 ? (
            <p className="py-2 text-xs" style={{ color: "var(--light-text-muted)" }}>
              No daily targets yet — set your steps, sleep and water goals.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {chips.map((c) => (
                <span
                  key={c}
                  className="rounded-full border px-3 py-1 text-xs font-semibold"
                  style={{ borderColor: "var(--card-border)", color: "var(--page-text)" }}
                >
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={labelCls}>Steps / day</label>
              <input
                type="number"
                min={0}
                className={inputCls}
                value={steps}
                onChange={(e) => setSteps(e.target.value)}
                placeholder="8000"
              />
            </div>
            <div>
              <label className={labelCls}>Sleep (h)</label>
              <input
                type="number"
                min={0}
                step={0.5}
                className={inputCls}
                value={sleep}
                onChange={(e) => setSleep(e.target.value)}
                placeholder="7.5"
              />
            </div>
            <div>
              <label className={labelCls}>Water (ml)</label>
              <input
                type="number"
                min={0}
                step={50}
                className={inputCls}
                value={water}
                onChange={(e) => setWater(e.target.value)}
                placeholder="2500"
              />
            </div>
          </div>
          <p className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>
            Leave a field empty to clear that target.
          </p>
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setEditing(false)}
              className="rounded-lg px-3 py-2 text-xs font-medium"
              style={{ color: "var(--light-text-muted)" }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #00AEEF, #8B5CF6)" }}
            >
              {saving && <Loader2 size={12} className="animate-spin" />}
              {saving ? "Saving…" : "Save targets"}
            </button>
          </div>
        </div>
      )}
    </GlassCard>
  );
}
