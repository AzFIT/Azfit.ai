import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";

const STACK_KEY = "azfit_history_stack";
const POINTER_KEY = "azfit_history_pointer";

export function HistoryNav() {
  const navigate = useNavigate();
  const location = useLocation();

  // Keep a lightweight history stack in sessionStorage so we can disable the
  // forward/back buttons when there is no history in that direction.
  useEffect(() => {
    try {
      const stack: string[] = JSON.parse(sessionStorage.getItem(STACK_KEY) || "[]");
      let pointer = parseInt(sessionStorage.getItem(POINTER_KEY) || "0", 10);

      if (stack.length === 0) {
        stack.push(location.pathname);
        pointer = 0;
      }

      const current = stack[pointer];
      if (current !== location.pathname) {
        if (stack[pointer - 1] === location.pathname) {
          pointer--;
        } else if (stack[pointer + 1] === location.pathname) {
          pointer++;
        } else {
          // New path: prune forward history and push
          stack.splice(pointer + 1);
          stack.push(location.pathname);
          pointer = stack.length - 1;
        }
        sessionStorage.setItem(STACK_KEY, JSON.stringify(stack.slice(-50)));
        sessionStorage.setItem(POINTER_KEY, String(pointer));
      }
    } catch {
      // sessionStorage unavailable; navigate(-1)/(1) still work
    }
  }, [location.pathname]);

  const [canBack, canForward] = (() => {
    try {
      const stack: string[] = JSON.parse(sessionStorage.getItem(STACK_KEY) || "[]");
      const pointer = parseInt(sessionStorage.getItem(POINTER_KEY) || "0", 10);
      return [pointer > 0, pointer < stack.length - 1] as const;
    } catch {
      return [window.history.length > 1, false] as const;
    }
  })();

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
