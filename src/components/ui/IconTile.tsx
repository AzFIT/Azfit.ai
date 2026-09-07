// ═══════════════════════════════════════════════════════════════
// IconTile (Phase 75 Item 1) — consistent squircle tile for lucide
// glyphs: brand-tinted gradient surface, 1px token border, and the
// .icon-tile-depth layered highlight + shadow ("subtly 3D, not too
// much"). Theme tokens only; depth lives in index.css utilities.
//
// Tone rules: 'ai' (violet) is for AI surfaces ONLY (Phase 58 lock).
// Bare line icons stay bare on nav/sidebar/text buttons — tiles are
// for stat tiles, quick actions, wizard tiles, empty states, and
// settings/device rows.
// ═══════════════════════════════════════════════════════════════

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type IconTileTone =
  | "brand"
  | "accent"
  | "success"
  | "warn"
  | "danger"
  | "muted"
  | "ai";

export type IconTileSize = "sm" | "md" | "lg";

interface ToneStyle {
  background: string;
  border: string;
  color: string;
}

const toneStyles = (tone: IconTileTone, active: boolean): ToneStyle => {
  const alpha = active ? 22 : 12;
  switch (tone) {
    case "brand":
      return {
        background: `linear-gradient(135deg, color-mix(in srgb, var(--azfit-primary) ${alpha}%, var(--card-bg)), var(--card-bg))`,
        border: "color-mix(in srgb, var(--azfit-primary) 30%, var(--card-border))",
        color: "var(--azfit-primary)",
      };
    case "accent":
      return {
        background: `linear-gradient(135deg, color-mix(in srgb, var(--azfit-accent) ${alpha}%, var(--card-bg)), var(--card-bg))`,
        border: "color-mix(in srgb, var(--azfit-accent) 30%, var(--card-border))",
        color: "var(--azfit-accent)",
      };
    case "success":
      return {
        background: `linear-gradient(135deg, color-mix(in srgb, var(--success) ${alpha}%, var(--card-bg)), var(--card-bg))`,
        border: "color-mix(in srgb, var(--success) 30%, var(--card-border))",
        color: "var(--success)",
      };
    case "warn":
      return {
        background: `linear-gradient(135deg, color-mix(in srgb, var(--warning) ${alpha}%, var(--card-bg)), var(--card-bg))`,
        border: "color-mix(in srgb, var(--warning) 30%, var(--card-border))",
        color: "var(--warning)",
      };
    case "danger":
      return {
        background: `linear-gradient(135deg, color-mix(in srgb, var(--danger) ${alpha}%, var(--card-bg)), var(--card-bg))`,
        border: "color-mix(in srgb, var(--danger) 30%, var(--card-border))",
        color: "var(--danger)",
      };
    case "ai":
      return {
        background: `linear-gradient(135deg, color-mix(in srgb, var(--ai-violet) ${alpha}%, var(--card-bg)), var(--card-bg))`,
        border: "color-mix(in srgb, var(--ai-violet) 30%, var(--card-border))",
        color: "var(--ai-violet)",
      };
    case "muted":
    default:
      return {
        background: "var(--light-elevated)",
        border: "var(--card-border)",
        color: "var(--light-text-muted)",
      };
  }
};

const sizeCls: Record<IconTileSize, { box: string; glyph: string }> = {
  sm: { box: "h-8 w-8 rounded-[var(--radius-control)]", glyph: "h-4 w-4" },
  md: { box: "h-10 w-10 rounded-[var(--radius-card)]", glyph: "h-5 w-5" },
  lg: { box: "h-12 w-12 rounded-[var(--radius-panel)]", glyph: "h-6 w-6" },
};

interface IconTileProps {
  icon: LucideIcon;
  size?: IconTileSize;
  tone?: IconTileTone;
  /** Selected/active state — raises the tint alpha (wizard selection). */
  active?: boolean;
  /** Optional explicit tint (any CSS color) — overrides the tone palette.
   *  Used by wizard goal tiles with their pre-existing accent colors. */
  tint?: string;
  className?: string;
  /** Accessible label when the tile itself is meaningful (rare — the
   *  surrounding text usually labels it; tile is aria-hidden by default). */
  label?: string;
}

export default function IconTile({
  icon: Icon,
  size = "md",
  tone = "brand",
  active = false,
  tint,
  className,
  label,
}: IconTileProps) {
  const style = tint
    ? {
        background: `linear-gradient(135deg, color-mix(in srgb, ${tint} ${active ? 26 : 14}%, var(--card-bg)), var(--card-bg))`,
        border: `color-mix(in srgb, ${tint} 35%, var(--card-border))`,
        color: tint,
      }
    : toneStyles(tone, active);
  return (
    <span
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
      className={cn(
        "icon-tile-depth flex shrink-0 items-center justify-center",
        sizeCls[size].box,
        className,
      )}
      style={{ background: style.background, border: `1px solid ${style.border}` }}
    >
      <Icon className={sizeCls[size].glyph} style={{ color: style.color }} />
    </span>
  );
}
