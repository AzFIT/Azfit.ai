import { Outlet } from "react-router";
import HistoryNav from "@/components/HistoryNav";
import ViewAsBanner from "@/components/ViewAsBanner";

/* ═══════════════════════════════════════════════════════════════════
   ArrowsShell (Owner Tasks, Task 5) — arrows-only shell for protected
   pages that DON'T use the full Layout (Layout already renders the
   same HistoryNav bar). Mounted once as a nested layout route in
   App.tsx — no per-page edits. Non-sticky by design: several pages
   (Schedule, ClientProfile) ship their own sticky top-0 headers and a
   second sticky bar would cover them. Phase 90e: the view-as banner
   also mounts here (in-flow, between the nav and the page) so it
   rides every screen, including ArrowsShell routes.
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
      <ViewAsBanner />
      <Outlet />
    </>
  );
}
