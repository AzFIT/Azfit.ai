// ═══════════════════════════════════════════════════════════════
// Program Library (Phase 28F) — live program_templates catalog
// Trainer-only: grid of template cards, search + tag filters,
// detail modal with best-matched methods / best-fit goals.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Library as LibraryIcon, Loader2, ArrowRight, Target, Wrench } from "lucide-react";
import Layout from "@/components/Layout";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { templateTagLabels, parseTemplateTags } from "@/lib/programTemplates";

interface TemplateRow {
  id: string;
  name: string;
  category: string;
  tags: string | null;
}

interface ScoredName {
  name: string;
  score: number;
}

export default function Library() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const [selected, setSelected] = useState<TemplateRow | null>(null);
  const [methods, setMethods] = useState<ScoredName[]>([]);
  const [goals, setGoals] = useState<ScoredName[]>([]);
  const [scoresLoading, setScoresLoading] = useState(false);

  // Fetch the active template catalog once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("program_templates")
        .select("id, name, category, tags")
        .eq("is_active", true)
        .order("name");
      if (cancelled) return;
      setTemplates((data as TemplateRow[] | null) ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Tag universe, most-used first
  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of templates) {
      for (const tag of parseTemplateTags(t.tags)) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([tag]) => tag);
  }, [templates]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates.filter((t) => {
      if (q && !t.name.toLowerCase().includes(q)) return false;
      if (activeTag && !parseTemplateTags(t.tags).includes(activeTag)) return false;
      return true;
    });
  }, [templates, search, activeTag]);

  // Score lookups when a template is opened
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    (async () => {
      setScoresLoading(true);
      setMethods([]);
      setGoals([]);
      const [{ data: ms }, { data: gs }] = await Promise.all([
        supabase
          .from("method_program_template_scores")
          .select("score, methods(name)")
          .eq("program_template_id", selected.id)
          .order("score", { ascending: false })
          .limit(3),
        supabase
          .from("goal_program_template_scores")
          .select("score, goals(name)")
          .eq("program_template_id", selected.id)
          .order("score", { ascending: false })
          .limit(3),
      ]);
      if (cancelled) return;
      const toScored = (rows: unknown): ScoredName[] =>
        ((rows as { score: number; methods?: { name: string } | null; goals?: { name: string } | null }[] | null) ?? [])
          .map((r) => ({ name: r.methods?.name ?? r.goals?.name ?? "", score: r.score }))
          .filter((r) => r.name);
      setMethods(toScored(ms));
      setGoals(toScored(gs));
      setScoresLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  return (
    <Layout>
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <LibraryIcon size={22} style={{ color: "#00AEEF" }} />
            Program Library
          </h2>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {filtered.length} of {templates.length} program templates
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <Input
            type="text"
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-[var(--card-bg)] border-[var(--card-border)] text-[var(--text-primary)]"
          />
        </div>

        {/* Tag filter chips */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag((cur) => (cur === tag ? null : tag))}
                className={cn(
                  "px-2.5 py-1 rounded-full border text-[11px] font-medium transition-all",
                  activeTag === tag
                    ? "border-[#00AEEF] text-[#00AEEF] bg-[#00AEEF]/10"
                    : "border-[var(--card-border)] text-[var(--text-muted)] hover:border-[#00AEEF]/50"
                )}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={22} className="animate-spin" style={{ color: "#00AEEF" }} />
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-16 text-center text-sm text-[var(--text-muted)]">
            No templates match your search.
          </p>
        ) : (
          <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence mode="popLayout">
              {filtered.map((t) => {
                const labels = templateTagLabels(t.tags);
                return (
                  <motion.button
                    key={t.id}
                    layout
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    onClick={() => setSelected(t)}
                    className="text-left bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-4 hover:border-[#00AEEF]/60 transition-colors"
                  >
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] leading-snug">
                      {t.name}
                    </h3>
                    <p className="text-[11px] text-[var(--text-muted)] mt-1">{t.category}</p>
                    <div className="flex flex-wrap gap-1 mt-2.5">
                      {labels.slice(0, 4).map((l) => (
                        <span
                          key={l}
                          className="px-2 py-0.5 rounded-full text-[10px] border border-[var(--card-border)] text-[var(--text-muted)]"
                        >
                          {l}
                        </span>
                      ))}
                      {labels.length > 4 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] text-[#8B5CF6]">
                          +{labels.length - 4}
                        </span>
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Detail modal */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
            onClick={() => setSelected(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl w-full max-w-lg p-5 shadow-2xl max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-[var(--text-primary)]">{selected.name}</h3>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">{selected.category}</p>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="p-1.5 rounded-lg hover:bg-[var(--page-bg)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Full tag list */}
              <div className="flex flex-wrap gap-1.5 mt-3">
                {templateTagLabels(selected.tags).map((l) => (
                  <span
                    key={l}
                    className="px-2 py-0.5 rounded-full text-[10px] border border-[var(--card-border)] text-[var(--text-muted)]"
                  >
                    {l}
                  </span>
                ))}
              </div>

              {scoresLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 size={18} className="animate-spin" style={{ color: "#00AEEF" }} />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  {/* Best-matched methods */}
                  <div className="rounded-xl border border-[var(--card-border)] p-3">
                    <h4 className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5 mb-2">
                      <Wrench size={13} style={{ color: "#8B5CF6" }} />
                      Best-matched methods
                    </h4>
                    {methods.length === 0 ? (
                      <p className="text-[11px] text-[var(--text-muted)]">
                        No method scores computed for this template.
                      </p>
                    ) : (
                      <ul className="space-y-1.5">
                        {methods.map((m) => (
                          <li key={m.name} className="flex items-center justify-between text-xs">
                            <span className="text-[var(--text-primary)]">{m.name}</span>
                            <span className="font-mono text-[#8B5CF6]">{m.score.toFixed(1)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {/* Best-fit goals */}
                  <div className="rounded-xl border border-[var(--card-border)] p-3">
                    <h4 className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5 mb-2">
                      <Target size={13} style={{ color: "#00AEEF" }} />
                      Best-fit goals
                    </h4>
                    {goals.length === 0 ? (
                      <p className="text-[11px] text-[var(--text-muted)]">
                        No goal scores computed for this template.
                      </p>
                    ) : (
                      <ul className="space-y-1.5">
                        {goals.map((g) => (
                          <li key={g.name} className="flex items-center justify-between text-xs">
                            <span className="text-[var(--text-primary)]">{g.name}</span>
                            <span className="font-mono text-[#00AEEF]">{g.score.toFixed(1)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              <button
                onClick={() => navigate(`/ai-program-builder?template=${selected.id}`)}
                className="mt-5 w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #00AEEF, #8B5CF6)" }}
              >
                Use in Program Builder
                <ArrowRight size={15} />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
