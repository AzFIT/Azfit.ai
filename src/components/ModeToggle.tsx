import { useRef, useEffect } from "react";

// Phase 90h: the toggle is a Clients-page view switcher (cards vs table) —
// the values are the page's ClientsViewMode, persisted under
// azfit_clients_view by the page itself.
export type ClientsViewMode = "cards" | "table";

interface ModeToggleProps {
  mode: ClientsViewMode;
  onToggle: (mode: ClientsViewMode) => void;
}

export default function ModeToggle({ mode, onToggle }: ModeToggleProps) {
  const indicatorRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLButtonElement>(null);
  const tableRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const activeRef = mode === "cards" ? cardsRef : tableRef;
    if (activeRef.current && indicatorRef.current) {
      indicatorRef.current.style.width = `${activeRef.current.offsetWidth}px`;
      indicatorRef.current.style.transform = `translateX(${activeRef.current.offsetLeft}px)`;
    }
  }, [mode]);

  return (
    <div
      className="relative flex items-center rounded-full p-1"
      style={{ backgroundColor: "var(--light-elevated)" }}
    >
      {/* Sliding indicator — inset-y so it stretches with the 44px buttons */}
      <div
        ref={indicatorRef}
        className="absolute top-1 bottom-1 rounded-full"
        style={{
          backgroundColor: "var(--azfit-primary)",
          transition:
            "transform 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94), width 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        }}
      />

      {/* Cards button (Phase 70 Item 2: user-language labels) */}
      <button
        ref={cardsRef}
        onClick={() => onToggle("cards")}
        className="relative z-10 min-h-[44px] px-3 py-1 text-[13px] font-semibold transition-colors duration-200 lg:px-4"
        style={{
          color:
            mode === "cards" ? "#FFFFFF" : "var(--light-text-secondary)",
        }}
      >
        Cards
      </button>

      {/* Table button */}
      <button
        ref={tableRef}
        onClick={() => onToggle("table")}
        className="relative z-10 min-h-[44px] px-3 py-1 text-[13px] font-semibold transition-colors duration-200 lg:px-4"
        style={{
          color: mode === "table" ? "#FFFFFF" : "var(--light-text-secondary)",
        }}
      >
        Table
      </button>
    </div>
  );
}
