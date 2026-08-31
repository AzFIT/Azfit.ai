/* ═══════════════════════════════════════════════════════════════
   DraftBanner (Owner Tasks, Task 6) — non-blocking "unsaved changes"
   restore prompt. Newest wins only when the user chooses Resume.
   ═══════════════════════════════════════════════════════════════ */

import { History, X } from "lucide-react";
import { formatDraftTime } from "@/lib/draftStore";

interface DraftBannerProps {
  savedAt: number;
  onResume: () => void;
  onDiscard: () => void;
}

export default function DraftBanner({ savedAt, onResume, onDiscard }: DraftBannerProps) {
  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3"
      style={{
        borderColor: "var(--warning)",
        backgroundColor: "color-mix(in srgb, var(--warning) 10%, var(--card-bg))",
      }}
      role="status"
    >
      <History size={16} style={{ color: "var(--warning)" }} className="shrink-0" />
      <p className="flex-1 min-w-[200px] text-xs font-medium" style={{ color: "var(--page-text)" }}>
        You have unsaved changes from {formatDraftTime(savedAt)}.
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={onResume}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
          style={{ backgroundColor: "var(--azfit-primary)" }}
        >
          Resume
        </button>
        <button
          onClick={onDiscard}
          className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:opacity-80"
          style={{ borderColor: "var(--card-border)", color: "var(--light-text-muted)" }}
        >
          <X size={12} />
          Discard
        </button>
      </div>
    </div>
  );
}
