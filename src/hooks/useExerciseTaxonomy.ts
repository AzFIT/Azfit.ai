/* ═══════════════════════════════════════════════════════════════
   Phase 65A — wizard-facing exercise taxonomy (52B muscle data).
   ONE public-read query against exercise_library, cached at module
   level so every consumer (Step 6 pattern chips, Change-exercise
   dialog) shares the same fetch. Same table + RLS path the Phase 31B
   ExercisePickerDialog already uses — no schema or type changes.
   ═══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { TaxonomyExercise } from "@/lib/exerciseTaxonomy";

export interface ExerciseTaxonomyState {
  rows: TaxonomyExercise[];
  loading: boolean;
  error: string | null;
}

let cache: TaxonomyExercise[] | null = null;
let inflight: Promise<TaxonomyExercise[]> | null = null;

async function fetchTaxonomy(): Promise<TaxonomyExercise[]> {
  const { data, error } = await supabase
    .from("exercise_library")
    .select("id, name, primary_muscle, secondary_muscle, equipment, exercise_type")
    .eq("is_active", true)
    .order("name");
  if (error) {
    inflight = null; // a failed fetch may be retried by the next mount
    throw new Error(error.message);
  }
  cache = (data as TaxonomyExercise[] | null) ?? [];
  return cache;
}

export function useExerciseTaxonomy(): ExerciseTaxonomyState {
  const [rows, setRows] = useState<TaxonomyExercise[]>(cache ?? []);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cache) return;
    let cancelled = false;
    inflight ??= fetchTaxonomy();
    inflight
      .then((r) => {
        if (cancelled) return;
        setRows(r);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { rows, loading, error };
}
