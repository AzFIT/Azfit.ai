import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, withRetry } from "@/lib/supabase";
import type { Database } from "@/types/supabase";

// ─── Type Aliases ───
type GoalCategory = Database["public"]["Tables"]["goal_categories"]["Row"];
type Goal = Database["public"]["Tables"]["goals"]["Row"];
type ExerciseLibrary = Database["public"]["Tables"]["exercise_library"]["Row"];
type WeeklyStructure = Database["public"]["Tables"]["weekly_structures"]["Row"];

interface UseSupabaseQueryResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// ─── Generic Hook Factory ───
function useSupabaseQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: { message: string } | null }>,
  deps: readonly unknown[] = []
): UseSupabaseQueryResult<T> {
  const queryRef = useRef(queryFn);
  queryRef.current = queryFn;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await withRetry(() => queryRef.current(), 2, 500);
      if (error) throw new Error(error.message);
      setData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetch, ...deps]);

  return { data, loading, error, refetch: fetch };
}

// ─── useGoalCategories: Fetch all goal categories with their goals ───
export interface GoalCategoryWithGoals extends GoalCategory {
  goals: Goal[];
}

export function useGoalCategories(): UseSupabaseQueryResult<GoalCategoryWithGoals[]> {
  return useSupabaseQuery(async () => {
    const { data, error } = await supabase
      .from("goal_categories")
      .select(`
        *,
        goals(*)
      `)
      .order("sort_order");
    return { data: data as GoalCategoryWithGoals[] | null, error };
  });
}

// ─── useExercises: Fetch all exercises from library ───
export function useExercises(): UseSupabaseQueryResult<ExerciseLibrary[]> {
  return useSupabaseQuery(async () => {
    const { data, error } = await supabase
      .from("exercise_library")
      .select("*")
      .order("name");
    return { data, error };
  });
}

// ─── useWeeklyStructures: Fetch all weekly structures ───
export function useWeeklyStructures(): UseSupabaseQueryResult<WeeklyStructure[]> {
  return useSupabaseQuery(async () => {
    const { data, error } = await supabase
      .from("weekly_structures")
      .select("*")
      .order("goal_name");
    return { data, error };
  });
}

// ─── useWeeklyStructuresByGoal: Fetch weekly structures for a specific goal ───
export function useWeeklyStructuresByGoal(
  goalName: string | null
): UseSupabaseQueryResult<WeeklyStructure[]> {
  return useSupabaseQuery(async () => {
    if (!goalName) return { data: [], error: null };
    const { data, error } = await supabase
      .from("weekly_structures")
      .select("*")
      .eq("goal_name", goalName)
      .order("day_label");
    return { data, error };
  }, [goalName]);
}

// ─── useGoalMethods: Fetch top methods for a goal (uses scoring function) ───
export interface GoalMethodResult {
  method_id: string;
  method_name: string;
  score: number;
}

export function useGoalMethods(
  goalId: string | null,
  topN = 5
): UseSupabaseQueryResult<GoalMethodResult[]> {
  return useSupabaseQuery(async () => {
    if (!goalId) return { data: [], error: null };
    const { data, error } = await supabase.rpc("get_goal_methods", {
      p_goal_id: goalId,
      p_limit: topN,
    });
    return { data: data as GoalMethodResult[] | null, error };
  }, [goalId, topN]);
}

// ─── useMethodPrograms: Fetch top program templates for a method ───
export interface MethodProgramResult {
  program_template_id: string;
  program_name: string;
  score: number;
}

export function useMethodPrograms(
  methodId: string | null,
  topN = 5
): UseSupabaseQueryResult<MethodProgramResult[]> {
  return useSupabaseQuery(async () => {
    if (!methodId) return { data: [], error: null };
    const { data, error } = await supabase.rpc("get_method_program_templates", {
      p_method_id: methodId,
      p_limit: topN,
    });
    return { data: data as MethodProgramResult[] | null, error };
  }, [methodId, topN]);
}

// ─── useTrainerClients: Fetch clients managed by the current trainer ───
type ClientRow = Database["public"]["Tables"]["clients"]["Row"];

export function useTrainerClients(): UseSupabaseQueryResult<ClientRow[]> {
  return useSupabaseQuery(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const trainerId = userData.user?.id;
    if (!trainerId) return { data: [], error: null };

    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("trainer_id", trainerId)
      .order("created_at", { ascending: false });

    return { data: data as ClientRow[] | null, error };
  });
}
