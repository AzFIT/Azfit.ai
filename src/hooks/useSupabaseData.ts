import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, withRetry } from "@/lib/supabase";
import type { Database } from "@/types/supabase";

// ─── Type Aliases ───
type GoalCategory = Database["public"]["Tables"]["goal_categories"]["Row"];
type Goal = Database["public"]["Tables"]["goals"]["Row"];
type MethodCategory = Database["public"]["Tables"]["method_categories"]["Row"];
type Method = Database["public"]["Tables"]["methods"]["Row"];
type ProgramCategory = Database["public"]["Tables"]["program_categories"]["Row"];
type ProgramTemplate = Database["public"]["Tables"]["program_templates"]["Row"];
type Tag = Database["public"]["Tables"]["tags"]["Row"];
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

// ─── useGoals: Fetch all goals with their categories ───
export interface GoalWithCategory extends Goal {
  category: GoalCategory | null;
}

export function useGoals(): UseSupabaseQueryResult<GoalWithCategory[]> {
  return useSupabaseQuery(async () => {
    const { data, error } = await supabase
      .from("goals")
      .select(`
        *,
        category:goal_categories(*)
      `)
      .order("name");
    return { data: data as GoalWithCategory[] | null, error };
  });
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

// ─── useMethods: Fetch all methods with their categories ───
export interface MethodWithCategory extends Method {
  category: MethodCategory | null;
}

export function useMethods(): UseSupabaseQueryResult<MethodWithCategory[]> {
  return useSupabaseQuery(async () => {
    const { data, error } = await supabase
      .from("methods")
      .select(`
        *,
        category:method_categories(*)
      `)
      .order("name");
    return { data: data as MethodWithCategory[] | null, error };
  });
}

// ─── useMethodCategories: Fetch all method categories with their methods ───
export interface MethodCategoryWithMethods extends MethodCategory {
  methods: Method[];
}

export function useMethodCategories(): UseSupabaseQueryResult<MethodCategoryWithMethods[]> {
  return useSupabaseQuery(async () => {
    const { data, error } = await supabase
      .from("method_categories")
      .select(`
        *,
        methods(*)
      `)
      .order("sort_order");
    return { data: data as MethodCategoryWithMethods[] | null, error };
  });
}

// ─── useProgramTemplates: Fetch all program templates with categories ───
export interface ProgramTemplateWithCategory extends ProgramTemplate {
  category: ProgramCategory | null;
}

export function useProgramTemplates(): UseSupabaseQueryResult<ProgramTemplateWithCategory[]> {
  return useSupabaseQuery(async () => {
    const { data, error } = await supabase
      .from("program_templates")
      .select(`
        *,
        category:program_categories(*)
      `)
      .order("name");
    return { data: data as ProgramTemplateWithCategory[] | null, error };
  });
}

// ─── useProgramCategories: Fetch all program categories with templates ───
export interface ProgramCategoryWithTemplates extends ProgramCategory {
  program_templates: ProgramTemplate[];
}

export function useProgramCategories(): UseSupabaseQueryResult<ProgramCategoryWithTemplates[]> {
  return useSupabaseQuery(async () => {
    const { data, error } = await supabase
      .from("program_categories")
      .select(`
        *,
        program_templates(*)
      `)
      .order("sort_order");
    return { data: data as ProgramCategoryWithTemplates[] | null, error };
  });
}

// ─── useTags: Fetch all tags ───
export function useTags(): UseSupabaseQueryResult<Tag[]> {
  return useSupabaseQuery(async () => {
    const { data, error } = await supabase
      .from("tags")
      .select("*")
      .order("name");
    return { data, error };
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

// ─── useTopPipelines: Fetch top goal→method→program pipelines ───
export interface PipelineResult {
  goal_id: string;
  method_id: string;
  program_template_id: string;
  score: number;
}

export function useTopPipelines(
  goalId: string | null,
  topN = 10
): UseSupabaseQueryResult<PipelineResult[]> {
  return useSupabaseQuery(async () => {
    if (!goalId) return { data: [], error: null };
    const { data, error } = await supabase.rpc("get_top_pipelines", {
      p_goal_id: goalId,
      p_limit: topN,
    });
    return { data: data as PipelineResult[] | null, error };
  }, [goalId, topN]);
}

// ─── useGoalWithTags: Fetch a single goal with its tags ───
export interface GoalWithTags extends Goal {
  tags: Tag[];
}

export function useGoalWithTags(goalId: string | null): UseSupabaseQueryResult<GoalWithTags> {
  return useSupabaseQuery(async () => {
    if (!goalId) return { data: null, error: null };
    const { data, error } = await supabase
      .from("goals")
      .select(`
        *,
        tags:goal_tags(tag:tags(*))
      `)
      .eq("id", goalId)
      .single();
    return { data: data as GoalWithTags | null, error };
  }, [goalId]);
}

// ─── useProgramTemplateWithTags: Fetch a single program template with tags ───
export interface ProgramTemplateWithTags extends ProgramTemplate {
  tags: Tag[];
}

export function useProgramTemplateWithTags(
  programTemplateId: string | null
): UseSupabaseQueryResult<ProgramTemplateWithTags> {
  return useSupabaseQuery(async () => {
    if (!programTemplateId) return { data: null, error: null };
    const { data, error } = await supabase
      .from("program_templates")
      .select(`
        *,
        tags:program_template_tags(tag:tags(*))
      `)
      .eq("id", programTemplateId)
      .single();
    return { data: data as ProgramTemplateWithTags | null, error };
  }, [programTemplateId]);
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
