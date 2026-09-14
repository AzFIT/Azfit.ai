/* ═══════════════════════════════════════════════════════════════
   Phase 92 — CollapsiblePanel: the ONE framework every dashboard
   section uses (spec: "this framework is the mount point future
   dashboard sections must use"). WRAP an existing section's content;
   never restructure it — the wrapped tiles keep their own internal
   card headers, so this component is a transparent wrapper: a slim
   header bar (title + live badge + chevron) above the content, no
   own card chrome.

   Contract:
   • Header = single 44px+ tap target: title + optional icon + live
     summary badge + chevron. aria-expanded / aria-controls wired;
     the header is a real <button> so Enter/Space work natively.
   • Height animation via Framer Motion (the app-wide animation lib).
     prefers-reduced-motion → instant toggle, no animation.
   • Content mounts LAZILY on first expand and STAYS mounted after
     (heavy queries inside a collapsed panel never run until the
     trainer opens it).
   • Controlled or uncontrolled: pass `expanded`/`onToggle` to drive
     state from persisted prefs (Phase 92), omit for local state.
   • Badge tones map to theme tokens only (neutral/warning/danger) —
     no hex. A null/undefined badge renders nothing (honest data:
     no badge is better than a zero badge).
   • `pulseKey` re-triggers the one-shot at-risk pulse (2 cycles,
     token color, suppressed under reduced motion). Bump the key when
     the underlying count rises — the component plays it once.
   ═══════════════════════════════════════════════════════════════ */

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PanelBadge, PanelBadgeTone } from "@/lib/panelBadges";

const TONE_COLOR: Record<PanelBadgeTone, string> = {
  neutral: "var(--light-text-muted)",
  warning: "var(--warning)",
  danger: "var(--danger)",
};

export interface CollapsiblePanelProps {
  /** Stable registry id — persisted collapsed-state key + test hook. */
  id: string;
  title: string;
  icon?: React.ReactNode;
  /** Live summary badge; null/undefined = no badge (honest data). */
  badge?: PanelBadge | null;
  /** Bump to replay the one-shot pulse (Phase 92 at-risk alert). */
  pulseKey?: number | string;
  /** Expanded on first render; default true (NULL prefs = all expanded). */
  defaultExpanded?: boolean;
  /** Controlled expanded state (overrides defaultExpanded). */
  expanded?: boolean;
  /** Controlled toggle callback. */
  onToggle?: (expanded: boolean) => void;
  className?: string;
  children: React.ReactNode;
}

export function CollapsiblePanel({
  id,
  title,
  icon,
  badge,
  pulseKey,
  defaultExpanded = true,
  expanded: controlledExpanded,
  onToggle,
  className,
  children,
}: CollapsiblePanelProps) {
  const reduceMotion = useReducedMotion();
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  // Lazy mount: content renders on first expand and stays mounted.
  // Initially-collapsed controlled panels have NOTHING in the DOM yet.
  const [everExpanded, setEverExpanded] = useState(
    () => defaultExpanded || controlledExpanded === true
  );
  const expanded =
    controlledExpanded !== undefined ? controlledExpanded : internalExpanded;
  const contentId = `${id}-panel-content`;

  // React-endorsed "adjust state during render" (mirrors useDashboardPrefs):
  // flip everExpanded the moment the panel first opens, no effect needed.
  if (expanded && !everExpanded) setEverExpanded(true);

  const toggle = () => {
    const next = !expanded;
    if (controlledExpanded === undefined) setInternalExpanded(next);
    onToggle?.(next);
  };

  return (
    <div data-panel-id={id} className={className}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={expanded}
        aria-controls={contentId}
        className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[var(--light-elevated)]/50"
      >
        <span className="flex min-w-0 items-center gap-2">
          {icon && (
            <span className="shrink-0" style={{ color: "var(--light-text-muted)" }}>
              {icon}
            </span>
          )}
          <span
            className="truncate text-sm font-semibold"
            style={{ color: "var(--page-text)" }}
          >
            {title}
          </span>
          {badge && (
            <span
              key={pulseKey ?? "static"}
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold",
                pulseKey !== undefined && "panel-badge-pulse"
              )}
              style={{
                color: TONE_COLOR[badge.tone],
                backgroundColor: "var(--light-elevated)",
              }}
            >
              {badge.text}
            </span>
          )}
        </span>
        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={
            reduceMotion ? { duration: 0 } : { duration: 0.25, ease: "easeInOut" }
          }
          className="shrink-0"
          style={{ color: "var(--light-text-muted)" }}
        >
          <ChevronDown className="h-4 w-4" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && everExpanded && (
          <motion.div
            id={contentId}
            role="region"
            aria-label={title}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { duration: 0.3, ease: [0.4, 0, 0.2, 1] }
            }
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default CollapsiblePanel;
