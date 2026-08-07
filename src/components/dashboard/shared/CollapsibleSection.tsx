import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CollapsibleSectionProps {
  /** Section title shown in the header */
  title: string;
  /** Optional icon rendered before the title */
  icon?: React.ReactNode;
  /** Content rendered when expanded */
  children: React.ReactNode;
  /** Whether the section is initially expanded */
  defaultExpanded?: boolean;
  /** Controlled expanded state (overrides defaultExpanded) */
  expanded?: boolean;
  /** Callback when expanded state changes */
  onToggle?: (expanded: boolean) => void;
  /** Optional badge shown in the header (e.g. count) */
  badge?: React.ReactNode;
  /** Optional action element in the header */
  headerAction?: React.ReactNode;
  /** Accent color for the left border strip */
  accentColor?: string;
  /** Additional CSS classes for the wrapper */
  className?: string;
  /** Additional CSS classes for the content area */
  contentClassName?: string;
  /** Whether to animate the chevron rotation */
  animateChevron?: boolean;
  /** Whether the section is disabled (non-interactive) */
  disabled?: boolean;
}

/**
 * CollapsibleSection
 * ───────────────────────────────────────────
 * An animated expand/collapse section with:
 *   • Framer Motion height animation (smooth, no layout shift)
 *   • Rotating chevron indicator
 *   • Optional accent-colored left border
 *   • Badge and action slot in the header
 *   • Accessible ARIA attributes
 *
 * Used for dashboard widgets, wizard step cards, and
 * any content that benefits from progressive disclosure.
 */
export function CollapsibleSection({
  title,
  icon,
  children,
  defaultExpanded = true,
  expanded: controlledExpanded,
  onToggle,
  badge,
  headerAction,
  accentColor,
  className,
  contentClassName,
  animateChevron = true,
  disabled = false,
}: CollapsibleSectionProps) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);

  const isExpanded =
    controlledExpanded !== undefined ? controlledExpanded : internalExpanded;

  const handleToggle = () => {
    if (disabled) return;
    const next = !isExpanded;
    if (controlledExpanded === undefined) {
      setInternalExpanded(next);
    }
    onToggle?.(next);
  };

  return (
    <div
      className={cn(
        "rounded-xl border overflow-hidden backdrop-blur-md",
        className
      )}
      style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
    >
      {/* Header — always visible */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={cn(
          "w-full flex items-center justify-between px-5 py-4",
          "text-left transition-colors duration-200",
          "hover:bg-[var(--light-elevated)]/60",
          disabled && "opacity-50 cursor-not-allowed",
          accentColor && "border-l-[3px]",
          accentColor && isExpanded && "border-l-[3px]"
        )}
        style={
          accentColor
            ? { borderLeftColor: isExpanded ? accentColor : "transparent" }
            : undefined
        }
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-3">
          {icon && (
            <span className="flex-shrink-0" style={{ color: "var(--light-text-muted)" }}>
              {icon}
            </span>
          )}
          <span className="text-sm font-semibold" style={{ color: "var(--page-text)" }}>
            {title}
          </span>
          {badge && <div className="flex-shrink-0">{badge}</div>}
        </div>

        <div className="flex items-center gap-2">
          {headerAction && <div className="flex-shrink-0">{headerAction}</div>}
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={
              animateChevron
                ? { duration: 0.25, ease: "easeInOut" }
                : { duration: 0 }
            }
            style={{ color: "var(--light-text-muted)" }}
          >
            <ChevronDown className="h-4 w-4" />
          </motion.div>
        </div>
      </button>

      {/* Collapsible content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className={cn("px-5 pb-5", contentClassName)}>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default CollapsibleSection;
