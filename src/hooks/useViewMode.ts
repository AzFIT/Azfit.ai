import { useCallback, useState } from "react";
import {
  readWizardViewMode,
  writeWizardViewMode,
  type ViewMode,
  type WizardViewPage,
} from "@/lib/viewMode";

/** Per-page wizard view mode (65B Item 2) — state + localStorage persistence. */
export function useViewMode(page: WizardViewPage): [ViewMode, (m: ViewMode) => void] {
  const [mode, setMode] = useState<ViewMode>(() => readWizardViewMode(page));
  const set = useCallback(
    (m: ViewMode) => {
      setMode(m);
      writeWizardViewMode(page, m);
    },
    [page],
  );
  return [mode, set];
}
