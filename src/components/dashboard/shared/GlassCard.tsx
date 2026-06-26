import { motion, type Variants } from "framer-motion";
import { cn } from "@/lib/utils";

export interface GlassCardProps {
  /** Card content */
  children: React.ReactNode;
  /** Optional title rendered as a header inside the card */
  title?: string;
  /** Optional icon rendered next to the title */
  titleIcon?: React.ReactNode;
  /** Optional action element (e.g. a button) rendered in the header */
  headerAction?: React.ReactNode;
  /** Whether to apply the glassmorphic backdrop-blur effect */
  glass?: boolean;
  /** Whether to add a subtle neon border glow */
  glow?: boolean;
  /** Border color accent — applied as a top border or full border tint */
  accentColor?: string;
  /** Whether the card is hover-elevated */
  hover?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Optional click handler */
  onClick?: () => void;
  /** Framer Motion layoutId for shared layout animations */
  layoutId?: string;
  /** Optional padding override (defaults to p-5) */
  padding?: string;
  /** Whether the card should have a fixed height or grow */
  grow?: boolean;
}

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" },
  },
};

/**
 * GlassCard
 * ───────────────────────────────────────────
 * A reusable card primitive with:
 *   • Glassmorphic backdrop-blur (optional)
 *   • Subtle translucent background for dark mode
 *   • Optional neon border glow on hover
 *   • Accent-colored top border strip
 *   • Framer Motion entry animation
 *   • Responsive padding and typography
 *
 * Used as the foundational container for all dashboard widgets,
 * wizard step cards, and collapsible sections.
 */
export function GlassCard({
  children,
  title,
  titleIcon,
  headerAction,
  glass = true,
  glow = false,
  accentColor,
  hover = true,
  className,
  onClick,
  layoutId,
  padding = "p-5",
  grow = false,
}: GlassCardProps) {
  const accentStyle = accentColor
    ? { borderTopColor: accentColor }
    : undefined;

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      layoutId={layoutId}
      className={cn(
        // Base shape
        "rounded-xl overflow-hidden relative",
        // Background — translucent in dark mode, solid in light
        glass
          ? "bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-white/20 dark:border-white/10"
          : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700",
        // Glow on hover
        glow &&
          "hover:shadow-[0_0_24px_rgba(13,148,136,0.15)] dark:hover:shadow-[0_0_24px_rgba(13,148,136,0.25)]",
        // Elevation on hover
        hover && "transition-shadow duration-300 hover:shadow-lg",
        // Cursor
        onClick && "cursor-pointer",
        // Flex grow
        grow && "flex flex-col flex-1",
        padding,
        className
      )}
      style={accentStyle}
      onClick={onClick}
    >
      {/* Accent top border strip */}
      {accentColor && (
        <div
          className="absolute top-0 left-0 right-0 h-[3px]"
          style={{ backgroundColor: accentColor }}
        />
      )}

      {/* Header */}
      {(title || headerAction) && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {titleIcon && (
              <span className="text-slate-500 dark:text-slate-400">
                {titleIcon}
              </span>
            )}
            {title && (
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 tracking-wide">
                {title}
              </h3>
            )}
          </div>
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}

      {/* Content */}
      <div className={cn(grow && "flex-1")}>{children}</div>
    </motion.div>
  );
}

export default GlassCard;
