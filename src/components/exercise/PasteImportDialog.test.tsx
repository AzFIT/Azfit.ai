/* Phase 97b regression — PasteImportDialog opened with initialRaw (AI path)
   must fire onImport AND onOpenChange(false) on confirm. Regression cover
   for the portal-leak fix: dialogs are now mount-on-open in
   AIProgramBuilder (close = unmount = guaranteed portal-DOM removal). */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import PasteImportDialog from "@/components/exercise/PasteImportDialog";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () =>
            Promise.resolve({
              data: [
                { id: "1", code: "SQ", name: "Goblet Squat", equipment: "Dumbbell", primary_muscle: "Legs", difficulty: "Beginner", exercise_type: "strength", safety_notes: null },
              ],
              error: null,
            }),
        }),
      }),
    }),
  },
}));

const MARKDOWN = `| Day | Order | Exercise | Sets | Reps | Tempo | Rest |
| 1 | A1 | Goblet Squat | 3 | 10 | 3010 | 60s |`;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  document.body.innerHTML = "";
  container = document.createElement("div");
  document.body.appendChild(container);
});

describe("PasteImportDialog initialRaw close-after-confirm", () => {
  it("calls onOpenChange(false) and onImport after confirm", async () => {
    const onOpenChange = vi.fn();
    const onImport = vi.fn();
    root = createRoot(container);
    await act(async () => {
      root.render(
        <PasteImportDialog
          open={true}
          onOpenChange={onOpenChange}
          onImport={onImport}
          initialRaw={MARKDOWN}
        />,
      );
    });
    // dialog mounted at review stage?
    expect(document.body.textContent).toContain("Review exercises");
    const confirm = document.querySelector(
      '[data-testid="paste-import-confirm"]',
    ) as HTMLButtonElement | null;
    expect(confirm).toBeTruthy();
    expect(confirm!.disabled).toBe(false);
    await act(async () => {
      confirm!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onImport).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    await act(async () => root.unmount());
  });
});
