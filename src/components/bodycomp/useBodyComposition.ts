import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import type { Database, Json } from "@/types/supabase";
import type { SkinfoldProtocol, SkinfoldSite } from "@/lib/bodyfat";

export type BodyCompositionRow = Database["public"]["Tables"]["body_composition"]["Row"];
export type SkinfoldAssessmentRow = Database["public"]["Tables"]["skinfold_assessments"]["Row"];

export type HistoryItem =
  | { kind: "body_composition"; id: string; date: string; data: BodyCompositionRow }
  | { kind: "assessment"; id: string; date: string; data: SkinfoldAssessmentRow };

export interface BodyCompositionInput {
  recorded_at?: string;
  weight_kg: number | null;
  body_fat_percentage: number | null;
  muscle_mass_kg?: number | null;
  bmi?: number | null;
  chest_cm?: number | null;
  waist_cm?: number | null;
  hips_cm?: number | null;
  arms_cm?: number | null;
  thighs_cm?: number | null;
  notes?: string | null;
}

export interface SkinfoldAssessmentInput {
  protocol: SkinfoldProtocol;
  sites: Record<SkinfoldSite, number>;
  sum_mm: number;
  body_fat_pct: number | null;
  weight_kg?: number | null;
  age_years?: number | null;
  assessed_by?: string | null;
  notes?: string | null;
  recorded_at?: string;
}

const MIGRATION_FLAG = "azfit_bio_migrated";
const LEGACY_HISTORY_KEY = "azfit_bio_history";

function useResolvedClientId(propClientId?: string) {
  const { user, loading: authLoading } = useAuth();
  const [clientId, setClientId] = useState<string | null>(propClientId || null);
  const [hasRecord, setHasRecord] = useState<boolean>(!!propClientId);
  const [resolving, setResolving] = useState(!propClientId && !authLoading);

  useEffect(() => {
    if (propClientId) {
      setClientId(propClientId);
      setHasRecord(true);
      setResolving(false);
      return;
    }
    if (!user?.email) {
      setClientId(null);
      setHasRecord(false);
      setResolving(false);
      return;
    }

    let cancelled = false;
    setResolving(true);

    const resolve = async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id")
        .eq("email", user.email)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (cancelled) return;
      if (error || !data) {
        setClientId(null);
        setHasRecord(false);
      } else {
        setClientId(data.id);
        setHasRecord(true);
      }
      setResolving(false);
    };

    resolve();
    return () => {
      cancelled = true;
    };
  }, [propClientId, user?.email]);

  return { clientId, hasRecord, resolving: resolving || authLoading };
}

export function useBodyComposition(propClientId?: string) {
  const { user } = useAuth();
  const userId = user?.id || null;
  const { clientId, hasRecord: hasClientRecord, resolving } = useResolvedClientId(propClientId);
  const [loading, setLoading] = useState(false);
  const [bodyComposition, setBodyComposition] = useState<BodyCompositionRow[]>([]);
  const [assessments, setAssessments] = useState<SkinfoldAssessmentRow[]>([]);
  const [migrated, setMigrated] = useState(false);

  const fetchData = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);

    try {
      const [bcResult, saResult] = await Promise.all([
        supabase
          .from("body_composition")
          .select("*")
          .eq("client_id", clientId)
          .order("recorded_at", { ascending: false })
          .limit(200),
        supabase
          .from("skinfold_assessments")
          .select("*")
          .eq("client_id", clientId)
          .order("recorded_at", { ascending: false })
          .limit(200),
      ]);

      if (bcResult.error) throw bcResult.error;
      if (saResult.error) throw saResult.error;

      setBodyComposition((bcResult.data as BodyCompositionRow[]) || []);
      setAssessments((saResult.data as SkinfoldAssessmentRow[]) || []);
    } catch (err) {
      console.error("[useBodyComposition] fetch failed:", err);
      toast.error("Failed to load body composition data");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  /* ── One-time migration from localStorage ──────────────────────────── */
  useEffect(() => {
    if (!clientId || migrated) return;

    const flag = localStorage.getItem(MIGRATION_FLAG);
    if (flag === "1") {
      setMigrated(true);
      return;
    }

    const raw = localStorage.getItem(LEGACY_HISTORY_KEY);
    if (!raw) {
      setMigrated(true);
      return;
    }

    let entries: Array<{ id: string; date: string; weight: number; bodyFatPercentage?: number; notes?: string }> = [];
    try {
      entries = JSON.parse(raw);
      if (!Array.isArray(entries) || entries.length === 0) {
        setMigrated(true);
        return;
      }
    } catch {
      setMigrated(true);
      return;
    }

    let cancelled = false;

    const runMigration = async () => {
      const rows = entries
        .filter((e) => e.weight || e.bodyFatPercentage)
        .map((e) => ({
          client_id: clientId,
          recorded_at: new Date(e.date).toISOString(),
          weight_kg: e.weight || null,
          body_fat_percentage: e.bodyFatPercentage || null,
          notes: e.notes || null,
        }));

      if (rows.length > 0) {
        const { error } = await supabase.from("body_composition").insert(rows as Database["public"]["Tables"]["body_composition"]["Insert"][]);
        if (error) {
          console.error("[useBodyComposition] migration failed:", error);
          toast.error("Could not migrate old BioPrint data");
        } else {
          toast.success("Migrated previous BioPrint entries");
        }
      }

      if (!cancelled) {
        localStorage.setItem(MIGRATION_FLAG, "1");
        setMigrated(true);
        fetchData();
      }
    };

    runMigration();
    return () => {
      cancelled = true;
    };
  }, [clientId, migrated, fetchData]);

  /* ── Initial fetch ───────────────────────────────────────────────── */
  useEffect(() => {
    if (!clientId) return;
    fetchData();
  }, [clientId, fetchData]);

  /* ── Derived state ───────────────────────────────────────────────── */
  const latestBodyComposition = useMemo(() => bodyComposition[0] || null, [bodyComposition]);
  const latestAssessment = useMemo(() => assessments[0] || null, [assessments]);

  const latestBodyFatPct = useMemo(() => {
    if (latestAssessment?.body_fat_pct != null) return latestAssessment.body_fat_pct;
    if (latestBodyComposition?.body_fat_percentage != null) return latestBodyComposition.body_fat_percentage;
    return null;
  }, [latestAssessment, latestBodyComposition]);

  const latestWeightKg = useMemo(() => {
    if (latestBodyComposition?.weight_kg != null) return latestBodyComposition.weight_kg;
    if (latestAssessment?.weight_kg != null) return latestAssessment.weight_kg;
    return null;
  }, [latestBodyComposition, latestAssessment]);

  const history = useMemo<HistoryItem[]>(() => {
    const bc: HistoryItem[] = bodyComposition.map((row) => ({
      kind: "body_composition",
      id: row.id,
      date: row.recorded_at || row.created_at,
      data: row,
    }));
    const sa: HistoryItem[] = assessments.map((row) => ({
      kind: "assessment",
      id: row.id,
      date: row.recorded_at || row.created_at,
      data: row,
    }));
    return [...bc, ...sa].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [bodyComposition, assessments]);

  /* ── Save body composition entry ───────────────────────────────────── */
  const saveBodyComposition = useCallback(
    async (input: BodyCompositionInput, id?: string) => {
      if (!clientId) return false;

      const payload: Database["public"]["Tables"]["body_composition"]["Insert"] = {
        client_id: clientId,
        recorded_at: input.recorded_at || new Date().toISOString(),
        weight_kg: input.weight_kg ?? null,
        body_fat_percentage: input.body_fat_percentage ?? null,
        muscle_mass_kg: input.muscle_mass_kg ?? null,
        bmi: input.bmi ?? null,
        chest_cm: input.chest_cm ?? null,
        waist_cm: input.waist_cm ?? null,
        hips_cm: input.hips_cm ?? null,
        arms_cm: input.arms_cm ?? null,
        thighs_cm: input.thighs_cm ?? null,
        notes: input.notes ?? null,
      };

      try {
        if (id) {
          const { error } = await supabase.from("body_composition").update(payload).eq("id", id);
          if (error) throw error;
          toast.success("Entry updated");
        } else {
          const { error } = await supabase.from("body_composition").insert(payload);
          if (error) throw error;
          toast.success("Entry logged");
        }
        await fetchData();
        return true;
      } catch (err) {
        console.error("[useBodyComposition] save failed:", err);
        toast.error("Failed to save entry");
        return false;
      }
    },
    [clientId, fetchData]
  );

  /* ── Save skinfold assessment ──────────────────────────────────────── */
  const saveAssessment = useCallback(
    async (input: SkinfoldAssessmentInput) => {
      if (!clientId) return false;

      const payload: Database["public"]["Tables"]["skinfold_assessments"]["Insert"] = {
        client_id: clientId,
        assessed_by: userId,
        recorded_at: input.recorded_at || new Date().toISOString(),
        protocol: input.protocol,
        sites: input.sites as unknown as Json,
        sum_mm: input.sum_mm,
        body_fat_pct: input.body_fat_pct ?? null,
        weight_kg: input.weight_kg ?? null,
        age_years: input.age_years ?? null,
        notes: input.notes ?? null,
      };

      try {
        const { error } = await supabase.from("skinfold_assessments").insert(payload);
        if (error) throw error;

        // Also upsert a body_composition row so charts stay current
        if (input.weight_kg != null || input.body_fat_pct != null) {
          const bcPayload: Database["public"]["Tables"]["body_composition"]["Insert"] = {
            client_id: clientId,
            recorded_at: input.recorded_at || new Date().toISOString(),
            weight_kg: input.weight_kg ?? null,
            body_fat_percentage: input.body_fat_pct ?? null,
            notes: input.notes ? `Assessment (${input.protocol})` : null,
          };
          await supabase.from("body_composition").insert(bcPayload);
        }

        toast.success("Assessment saved");
        await fetchData();
        return true;
      } catch (err) {
        console.error("[useBodyComposition] assessment save failed:", err);
        toast.error("Failed to save assessment");
        return false;
      }
    },
    [clientId, userId, fetchData]
  );

  /* ── Delete body composition entry ─────────────────────────────────── */
  const deleteBodyComposition = useCallback(
    async (id: string) => {
      if (!clientId) return false;
      try {
        const { error } = await supabase.from("body_composition").delete().eq("id", id);
        if (error) throw error;
        toast.success("Entry deleted");
        await fetchData();
        return true;
      } catch (err) {
        console.error("[useBodyComposition] delete failed:", err);
        toast.error("Failed to delete entry");
        return false;
      }
    },
    [clientId, fetchData]
  );

  /* ── Delete assessment ─────────────────────────────────────────────── */
  const deleteAssessment = useCallback(
    async (id: string) => {
      if (!clientId) return false;
      try {
        const { error } = await supabase.from("skinfold_assessments").delete().eq("id", id);
        if (error) throw error;
        toast.success("Assessment deleted");
        await fetchData();
        return true;
      } catch (err) {
        console.error("[useBodyComposition] assessment delete failed:", err);
        toast.error("Failed to delete assessment");
        return false;
      }
    },
    [clientId, fetchData]
  );

  return {
    clientId,
    hasClientRecord,
    loading: loading || resolving,
    bodyComposition,
    assessments,
    history,
    latestBodyComposition,
    latestAssessment,
    latestBodyFatPct,
    latestWeightKg,
    fetchData,
    saveBodyComposition,
    saveAssessment,
    deleteBodyComposition,
    deleteAssessment,
  };
}
