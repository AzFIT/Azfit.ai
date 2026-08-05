import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════
   PresetInput (Phase 41, Item 2) — free-text input with a quick-pick
   dropdown. Picking fills the field; typing still works and overrides.
   Theme-native popover (CSS vars); reused by the inline prescription
   editor now and the manual program builder later.
   ═══════════════════════════════════════════════════════════════════ */

interface PresetInputProps {
  value: string;
  onChange: (value: string) => void;
  presets: string[];
  placeholder?: string;
  type?: "text" | "number";
  min?: number;
  max?: number;
  /** extra classes for the input element */
  className?: string;
  ariaLabel?: string;
}

export default function PresetInput({
  value,
  onChange,
  presets,
  placeholder,
  type = "text",
  min,
  max,
  className = "",
  ariaLabel,
}: PresetInputProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Click-away closes the popover
  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <div className="flex items-center">
        <input
          type={type}
          min={min}
          max={max}
          value={value}
          aria-label={ariaLabel}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setOpen(false)}
          placeholder={placeholder}
          className="w-full rounded-md border px-2 py-1 text-xs"
          style={{
            backgroundColor: "var(--card-bg)",
            borderColor: "var(--card-border)",
            color: "var(--page-text)",
          }}
        />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="-ml-6 rounded p-0.5 transition hover:opacity-80"
          title="Quick picks"
          aria-label={`${ariaLabel ?? "field"} quick picks`}
          tabIndex={-1}
        >
          <ChevronDown size={12} style={{ color: "var(--light-text-muted)" }} />
        </button>
      </div>

      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1 max-h-44 w-max min-w-full overflow-y-auto rounded-lg border shadow-xl"
          style={{
            backgroundColor: "var(--card-bg)",
            borderColor: "var(--card-border)",
          }}
          role="listbox"
        >
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              role="option"
              aria-selected={p === value}
              onClick={() => {
                onChange(p);
                setOpen(false);
              }}
              className="block w-full whitespace-nowrap px-2.5 py-1.5 text-left text-xs transition hover:opacity-80"
              style={{
                color: p === value ? "var(--azfit-primary)" : "var(--page-text)",
                fontWeight: p === value ? 700 : 400,
                backgroundColor:
                  p === value ? "var(--light-elevated)" : "transparent",
              }}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
