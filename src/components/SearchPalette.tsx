/* ═══════════════════════════════════════════════════════════════
   SearchPalette (Phase 90d) — global search palette (⌘K / Ctrl+K,
   or the Search pill in the app bar). Centered overlay portaled to
   document.body (Phase 90c gotcha: a glass card's backdrop-filter
   traps position:fixed — NEVER mount overlays inside one without a
   portal).

   SURFACE (v1, role-aware — honest data only):
   · TRAINER: the 8 curated nav pages (trainerNav), roster clients
     (full_name → /client/:id), client programs (name → the same
     /ai-program-builder?load= screen ProgramsTab uses) and program
     templates (name → /ai-program-builder?template=, the Library
     open path). Clients/programs/templates are fetched LAZILY the
     first time the palette opens — never on render.
   · CLIENT: their nav pages only.

   EMPTY QUERY: real suggestions — the user's most-visited pages
   (localStorage visit counts, bumped by Layout) and, for trainers,
   their active clients. No-results state is honest text.

   KEYBOARD: ↑/↓ move, ↵ navigates, ESC closes + returns focus to
   the trigger, Tab is trapped inside the overlay.
   ═══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router";
import { Search, X, CornerDownLeft, ArrowUp, ArrowDown } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { TRAINER_NAV_ITEMS } from "@/lib/trainerNav";
import { rankMatches, topVisited } from "@/lib/searchRank";

export const PAGE_VISITS_KEY = "azfit:page-visits";

type EntryKind = "page" | "client" | "program" | "template";

interface PaletteEntry {
  id: string;
  kind: EntryKind;
  label: string;
  hint: string;
  path: string;
}

/** Client-role page set — their nav items (sidebar + More sheet). */
const CLIENT_PAGES: { label: string; path: string }[] = [
  { label: "Dashboard", path: "/dashboard" },
  { label: "Check-ins", path: "/check-ins" },
  { label: "Schedule", path: "/schedule" },
  { label: "Workouts", path: "/workouts" },
  { label: "Nutrition", path: "/nutrition" },
  { label: "Analytics", path: "/analytics" },
  { label: "Form Checks", path: "/form-checks" },
  { label: "Messages", path: "/messages" },
  { label: "Settings", path: "/settings" },
];

const KIND_BADGE: Record<EntryKind, { text: string; color: string }> = {
  page: { text: "PAGE", color: "var(--azfit-primary)" },
  client: { text: "CLIENT", color: "var(--success)" },
  program: { text: "PROGRAM", color: "var(--azfit-accent)" },
  template: { text: "TEMPLATE", color: "var(--azfit-accent)" },
};

const MAX_RESULTS = 12;

function readVisits(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(PAGE_VISITS_KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

export default function SearchPalette({
  open,
  onOpenChange,
  triggerRef,
}: {
  /** controlled open state — Layout owns it (⌘K + app-bar pill) */
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** the app-bar Search pill — focus returns here on close */
  triggerRef: RefObject<HTMLButtonElement | null>;
}) {
  const { user, isTrainer } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  /** null = not yet fetched (trainer lazy-load on first open) */
  const [roster, setRoster] = useState<PaletteEntry[] | null>(null);
  const [rosterError, setRosterError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const pages: PaletteEntry[] = useMemo(
    () =>
      (isTrainer ? TRAINER_NAV_ITEMS : CLIENT_PAGES).map((p) => ({
        id: `page:${p.path}`,
        kind: "page",
        label: p.label,
        hint: p.path,
        path: p.path,
      })),
    [isTrainer],
  );

  const close = useCallback(() => {
    onOpenChange(false);
    setQuery("");
    setActive(0);
    triggerRef.current?.focus();
  }, [onOpenChange, triggerRef]);

  /* Lazy trainer fetch — fires ONCE on first open, never on render. */
  useEffect(() => {
    if (!open || !isTrainer || roster !== null || !user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const [clientsRes, programsRes, templatesRes] = await Promise.all([
          supabase
            .from("clients")
            .select("id, full_name")
            .eq("trainer_id", user.id)
            .neq("status", "archived")
            .order("full_name"),
          supabase
            .from("programs")
            .select("id, name")
            .eq("trainer_id", user.id)
            .neq("status", "archived")
            .order("name"),
          supabase.from("program_templates").select("id, name").order("name"),
        ]);
        if (cancelled) return;
        const entries: PaletteEntry[] = [
          ...(((clientsRes.data as { id: string; full_name: string }[] | null) ?? []).map((c) => ({
            id: `client:${c.id}`,
            kind: "client" as const,
            label: c.full_name,
            hint: "/client/:id",
            path: `/client/${c.id}`,
          }))),
          ...(((programsRes.data as { id: string; name: string }[] | null) ?? []).map((p) => ({
            id: `program:${p.id}`,
            kind: "program" as const,
            label: p.name,
            hint: "Program builder",
            path: `/ai-program-builder?load=${p.id}`,
          }))),
          ...(((templatesRes.data as { id: string; name: string }[] | null) ?? []).map((t) => ({
            id: `template:${t.id}`,
            kind: "template" as const,
            label: t.name,
            hint: "Library template",
            path: `/ai-program-builder?template=${t.id}`,
          }))),
        ];
        setRoster(entries);
      } catch {
        if (!cancelled) setRosterError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, isTrainer, roster, user?.id]);

  /* ⌘K / Ctrl+K anywhere. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  /* Focus the input on open. */
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open]);

  const results = useMemo<PaletteEntry[]>(() => {
    const q = query.trim();
    if (q) {
      const pool = isTrainer && roster ? [...pages, ...roster] : pages;
      return rankMatches(
        q,
        pool.map((e) => ({ item: e, label: e.label })),
      )
        .slice(0, MAX_RESULTS)
        .map((r) => r.item);
    }
    // Empty query — real suggestions: most-visited pages + (trainer)
    // first active clients, capped. Never fabricated.
    const visits = readVisits();
    const recentPaths = topVisited(visits, pages.map((p) => p.path), 4);
    const recent = recentPaths
      .map((path) => pages.find((p) => p.path === path))
      .filter((p): p is PaletteEntry => !!p);
    const fallback = pages.slice(0, 4);
    const base = recent.length > 0 ? recent : fallback;
    const clientSuggestions =
      isTrainer && roster
        ? roster.filter((e) => e.kind === "client").slice(0, 4)
        : [];
    return [...base, ...clientSuggestions].slice(0, MAX_RESULTS);
  }, [query, pages, roster, isTrainer]);

  const clampedActive = Math.min(active, Math.max(0, results.length - 1));

  const go = useCallback(
    (entry: PaletteEntry) => {
      navigate(entry.path);
      close();
    },
    [navigate, close],
  );

  /* Tab trap: cycle focus between the input and the close button. */
  const onPanelKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === "Tab") {
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'input, button:not([disabled])',
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      const entry = results[clampedActive];
      if (entry) {
        e.preventDefault();
        go(entry);
      }
    }
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-start justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-sm"
          onClick={close}
        >
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={onPanelKeyDown}
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Search"
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] shadow-2xl"
          >
            {/* Input row */}
            <div className="flex items-center gap-2 border-b border-[var(--card-border)] px-4">
              <Search size={16} className="shrink-0 text-[var(--light-text-muted)]" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onInputKeyDown}
                role="combobox"
                aria-expanded="true"
                aria-controls="search-palette-listbox"
                aria-activedescendant={
                  results[clampedActive] ? `palette-opt-${clampedActive}` : undefined
                }
                aria-label="Search pages, clients and programs"
                placeholder={isTrainer ? "Search pages, clients, programs…" : "Search pages…"}
                className="min-h-[44px] flex-1 bg-transparent text-sm text-[var(--page-text)] outline-none placeholder:text-[var(--light-text-muted)]"
              />
              <button
                type="button"
                onClick={close}
                aria-label="Close search"
                className="rounded-lg p-1.5 text-[var(--light-text-muted)] transition-colors hover:bg-[var(--page-bg)] hover:text-[var(--page-text)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Results */}
            <div className="max-h-[46vh] overflow-y-auto p-2">
              {results.length === 0 ? (
                <p className="px-3 py-8 text-center text-xs text-[var(--light-text-muted)]">
                  No matches for &lsquo;{query.trim()}&rsquo;
                </p>
              ) : (
                <ul role="listbox" id="search-palette-listbox" aria-label="Search results">
                  {results.map((entry, i) => {
                    const badge = KIND_BADGE[entry.kind];
                    return (
                      <li key={entry.id} role="option" id={`palette-opt-${i}`} aria-selected={i === clampedActive}>
                        <button
                          type="button"
                          onClick={() => go(entry)}
                          onMouseEnter={() => setActive(i)}
                          className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-left transition-colors motion-reduce:transition-none"
                          style={{
                            backgroundColor:
                              i === clampedActive ? "var(--light-elevated)" : undefined,
                          }}
                        >
                          <span
                            className="shrink-0 rounded-md border px-1.5 py-0.5 text-[8px] font-bold tracking-wider"
                            style={{ color: badge.color, borderColor: badge.color }}
                          >
                            {badge.text}
                          </span>
                          <span className="flex-1 truncate text-xs font-semibold text-[var(--page-text)]">
                            {entry.label}
                          </span>
                          <span className="shrink-0 text-[10px] text-[var(--light-text-muted)]">
                            {entry.hint}
                          </span>
                          {i === clampedActive && (
                            <CornerDownLeft size={12} className="shrink-0 text-[var(--light-text-muted)]" />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {isTrainer && roster === null && !rosterError && (
                <p className="px-3 py-2 text-[10px] text-[var(--light-text-muted)]">Loading clients & programs…</p>
              )}
              {rosterError && (
                <p className="px-3 py-2 text-[10px] text-[var(--light-text-muted)]">
                  Couldn&apos;t load clients or programs — page search still works.
                </p>
              )}
            </div>

            {/* Footer hints */}
            <div className="flex items-center gap-4 border-t border-[var(--card-border)] px-4 py-2">
              <span className="flex items-center gap-1 text-[9px] text-[var(--light-text-muted)]">
                <ArrowUp size={10} /> <ArrowDown size={10} /> navigate
              </span>
              <span className="flex items-center gap-1 text-[9px] text-[var(--light-text-muted)]">
                <CornerDownLeft size={10} /> open
              </span>
              <span className="ml-auto rounded border border-[var(--card-border)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--light-text-muted)]">
                esc
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
