import { Outlet } from "react-router";
import HistoryNav from "@/components/HistoryNav";

/* ═══════════════════════════════════════════════════════════════════
   ArrowsShell (Owner Tasks, Task 5) — arrows-only shell for protected
   pages that DON'T use the full Layout (Layout already renders the
   same HistoryNav bar). Mounted once as a nested layout route in
   App.tsx — no per-page edits. Non-sticky by design: several pages
   (Schedule, ClientProfile) ship their own sticky top-0 headers and a
   second sticky bar would cover them.
   ═══════════════════════════════════════════════════════════════════ */

export default function ArrowsShell() {
  return (
    <>
      <div
        className="flex items-center gap-2 border-b px-4 py-2"
        style={{
          backgroundColor: "var(--page-bg)",
          borderColor: "var(--card-border)",
        }}
      >
        <HistoryNav />
      </div>
      <Outlet />
    </>
  );
}
