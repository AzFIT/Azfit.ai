// ═══════════════════════════════════════════════════════════════
// ExercisePickerDialog (Phase 31B) — search/filter/pick from the
// live exercise_library catalog. Shared by the wizard (Step 6 add
// + manual swap). Safety-aware: surfaces safety_notes and warns on
// client-limitation contraindications (warn, never block).
// ═══════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { findContraindications } from "@/data/exerciseSafety";

export interface LibraryExercise {
  id: string;
  code: string;
  name: string;
  equipment: string;
  primary_muscle: string;
  difficulty: string;
  exercise_type: string;
  safety_notes: string | null;
}

interface ExercisePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (exercise: LibraryExercise) => void;
  /** Doc-vocabulary limitations (collectClientLimitations) — amber warn on hits. */
  limitations?: string[];
}

const RESULT_CAP = 50;

export default function ExercisePickerDialog({
  open,
  onOpenChange,
  onSelect,
  limitations = [],
}: ExercisePickerDialogProps) {
  const [rows, setRows] = useState<LibraryExercise[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [muscle, setMuscle] = useState("All");
  const [equipment, setEquipment] = useState("All");
  const [difficulty, setDifficulty] = useState("All");

  // Debounce the search box (200ms)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(t);
  }, [search]);

  // Fetch the catalog once per open
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error: err } = await supabase
        .from("exercise_library")
        .select("id, code, name, equipment, primary_muscle, difficulty, exercise_type, safety_notes")
        .eq("is_active", true)
        .order("name");
      if (cancelled) return;
      if (err) setError(err.message);
      else setRows((data as LibraryExercise[] | null) ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Live value sets for the filters
  const muscleOptions = useMemo(() => [...new Set(rows.map((r) => r.primary_muscle))].sort(), [rows]);
  const equipmentOptions = useMemo(() => [...new Set(rows.map((r) => r.equipment))].sort(), [rows]);
  const difficultyOptions = useMemo(() => [...new Set(rows.map((r) => r.difficulty))].sort(), [rows]);

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q)) return false;
      if (muscle !== "All" && r.primary_muscle !== muscle) return false;
      if (equipment !== "All" && r.equipment !== equipment) return false;
      if (difficulty !== "All" && r.difficulty !== difficulty) return false;
      return true;
    });
  }, [rows, debouncedSearch, muscle, equipment, difficulty]);

  const capped = filtered.slice(0, RESULT_CAP);

  const selectCls =
    "bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--page-text)] text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#00AEEF]";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => onOpenChange(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--card-border)]">
              <h3 className="text-[var(--page-text)] text-base font-bold">Exercise Library</h3>
              <button
                onClick={() => onOpenChange(false)}
                className="p-1.5 rounded-lg hover:bg-[var(--page-bg)] text-[var(--page-text)]/60 hover:text-[var(--page-text)] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search + filters */}
            <div className="px-4 py-3 space-y-2 border-b border-[var(--card-border)]">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--page-text)]/40" />
                <Input
                  autoFocus
                  placeholder="Search exercises..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 bg-[var(--page-bg)] border-[var(--card-border)] text-[var(--page-text)]"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <select value={muscle} onChange={(e) => setMuscle(e.target.value)} className={selectCls}>
                  <option value="All">All muscles</option>
                  {muscleOptions.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
                <select value={equipment} onChange={(e) => setEquipment(e.target.value)} className={selectCls}>
                  <option value="All">All equipment</option>
                  {equipmentOptions.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
                <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className={selectCls}>
                  <option value="All">All levels</option>
                  {difficultyOptions.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto px-4 py-2">
              {loading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-5 h-5 animate-spin text-[#00AEEF]" />
                </div>
              ) : error ? (
                <p className="py-10 text-center text-xs text-[#EF4444]">Couldn't load the library ({error}).</p>
              ) : capped.length === 0 ? (
                <p className="py-10 text-center text-xs text-[var(--page-text)]/50">No exercises match your search.</p>
              ) : (
                <ul className="divide-y divide-[var(--card-border)]">
                  {capped.map((ex) => {
                    const contra = limitations.length > 0 ? findContraindications(ex.name, limitations) : [];
                    return (
                      <li key={ex.code}>
                        <button
                          onClick={() => {
                            onSelect(ex);
                            onOpenChange(false);
                          }}
                          className="w-full text-left py-2.5 px-1 hover:bg-[var(--page-bg)] rounded-lg transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-[var(--page-text)] truncate">{ex.name}</span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-[var(--card-border)] text-[var(--page-text)]/60 shrink-0">
                              {ex.difficulty}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-[10px] text-[var(--page-text)]/50">
                            <span>{ex.primary_muscle}</span>
                            <span>{ex.equipment}</span>
                            <span>{ex.exercise_type}</span>
                          </div>
                          {ex.safety_notes && (
                            <p className="mt-1 text-[10px] text-[#F59E0B] flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              {ex.safety_notes}
                            </p>
                          )}
                          {contra.length > 0 && (
                            <p className="mt-1 text-[10px] text-[#F59E0B] flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              Caution for this client: {contra.map((c) => c.limitation).join(" + ")} ({contra[0].note})
                            </p>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {!loading && !error && filtered.length > RESULT_CAP && (
                <p className="py-3 text-center text-[10px] text-[var(--page-text)]/50">
                  Showing first {RESULT_CAP} of {filtered.length} — refine your search.
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
