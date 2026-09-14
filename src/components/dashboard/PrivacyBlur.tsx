// Phase 91 — PrivacyBlur wrapper. When privacy mode is on and the card is
// sensitive, the REAL content stays in the DOM (zero layout shift) but is
// blurred with a real CSS filter + a token overlay. Data-leakage guards:
// `inert` (removed from tab order + interaction + assistive tech),
// `select-none` (no text-selection leakage), pointer-events none.

import { Eye } from "lucide-react";

interface PrivacyBlurProps {
  blur: boolean;
  children: React.ReactNode;
}

export default function PrivacyBlur({ blur, children }: PrivacyBlurProps) {
  if (!blur) return <>{children}</>;
  return (
    <div className="relative" data-privacy-blur="true">
      <div
        inert
        aria-hidden="true"
        className="pointer-events-none select-none"
        style={{ filter: "blur(8px)" }}
      >
        {children}
      </div>
      <div
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-2xl"
        style={{ backgroundColor: "color-mix(in srgb, var(--card-bg) 60%, transparent)" }}
      >
        <Eye className="h-5 w-5" style={{ color: "var(--light-text-muted)" }} aria-hidden />
      </div>
    </div>
  );
}
