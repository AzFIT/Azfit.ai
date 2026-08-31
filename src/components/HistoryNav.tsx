import { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { advanceHistory } from "@/lib/historyStack";

const STACK_KEY = "azfit_history_stack";
const POINTER_KEY = "azfit_history_pointer";

function readStored(): { stack: string[]; pointer: number } {
  const stack: string[] = JSON.parse(sessionStorage.getItem(STACK_KEY) || "[]");
  const pointer = parseInt(sessionStorage.getItem(POINTER_KEY) || "0", 10);
  return { stack, pointer };
}

export function HistoryNav() {
  const navigate = useNavigate();
  const location = useLocation();

  // Task 5 rework: derive the CURRENT back/forward availability during render
  // (simulating this navigation against the stored stack — the old render
  // read the persisted pointer, which lagged one navigation behind), and
  // persist the advanced stack in an effect. The pre-Task-5 code only wrote
  // inside the "new path" branch, so the initial push was never saved and
  // Back stayed disabled forever.
  const { canBack, canForward, advanced } = useMemo(() => {
    try {
      const { stack, pointer } = readStored();
      const adv = advanceHistory(stack, pointer, location.pathname);
      return {
        canBack: adv.pointer > 0,
        canForward: adv.pointer < adv.stack.length - 1,
        advanced: adv,
      };
    } catch {
      return {
        canBack: window.history.length > 1,
        canForward: false,
        advanced: null,
      };
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!advanced) return;
    try {
      sessionStorage.setItem(STACK_KEY, JSON.stringify(advanced.stack));
      sessionStorage.setItem(POINTER_KEY, String(advanced.pointer));
    } catch {
      // sessionStorage unavailable; navigate(-1)/(1) still work
    }
  }, [advanced]);

  const buttonBase =
    "flex h-11 w-11 items-center justify-center rounded-lg transition-colors";
  const enabledStyle = {
    backgroundColor: "var(--card-bg)",
    color: "var(--text-primary)",
    border: "1px solid var(--card-border)",
  };
  const disabledStyle = {
    backgroundColor: "transparent",
    color: "var(--text-muted)",
    opacity: 0.4,
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => navigate(-1)}
        disabled={!canBack}
        className={buttonBase}
        style={canBack ? enabledStyle : disabledStyle}
        title="Back"
        aria-label="Back"
      >
        <ArrowLeft size={18} />
      </button>
      <button
        onClick={() => navigate(1)}
        disabled={!canForward}
        className={buttonBase}
        style={canForward ? enabledStyle : disabledStyle}
        title="Forward"
        aria-label="Forward"
      >
        <ArrowRight size={18} />
      </button>
    </div>
  );
}

export default HistoryNav;
