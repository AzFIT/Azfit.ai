// ═══════════════════════════════════════════════════════════════
// ViewModeSwitch (Phase 65B Item 2) — Windows-Explorer-style view
// switcher for the wizard's tile/card pages. Compact icon-button
// group, theme-native, reachable on mobile without covering content.
// ═══════════════════════════════════════════════════════════════

import { LayoutGrid, Grid2x2, Square, List, Rows3, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { VIEW_MODES, VIEW_MODE_LABEL, type ViewMode } from "@/lib/viewMode";

const ICONS: Record<ViewMode, LucideIcon> = {
  large: LayoutGrid,
  medium: Grid2x2,
  small: Square,
  list: List,
  details: Rows3,
};

export default function ViewModeSwitch({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (m: ViewMode) => void;
}) {
  return (
    <div
      role="group"
      aria-label="View mode"
      className="inline-flex items-center gap-0.5 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-0.5 shrink-0"
    >
      {VIEW_MODES.map((m) => {
        const Icon = ICONS[m];
        const active = m === mode;
        return (
          <button
            key={m}
            type="button"
            title={`${VIEW_MODE_LABEL[m]} view`}
            aria-label={`${VIEW_MODE_LABEL[m]} view`}
            aria-pressed={active}
            onClick={() => onChange(m)}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              active
                ? "bg-[#00AEEF]/15 text-[#00AEEF]"
                : "text-[var(--page-text)]/50 hover:text-[var(--page-text)] hover:bg-[var(--page-bg)]",
            )}
          >
            <Icon className="w-3.5 h-3.5" />
          </button>
        );
      })}
    </div>
  );
}
