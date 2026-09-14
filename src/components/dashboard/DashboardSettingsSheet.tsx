// Phase 91 — Dashboard Settings sheet (trainer only). Hand-rolled portaled
// sheet (createPortal → document.body — the GlassCard backdrop-filter
// containing-block gotcha never traps it) so the dashboard stays VISIBLE
// behind a light token tint: card reorder/hide previews live as you edit.
// Escape / backdrop tap = Cancel (restores). Save persists in a single
// UPDATE; write failure toasts and reverts.
//
// Section A — Cards: every registered trainer-dashboard card, up/down
// arrows + visibility eye (ONE interaction — arrows, mobile-safe, no
// dnd-kit). Section B — Privacy: master switch + auto-reblur select.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp, Eye, EyeOff, X } from "lucide-react";
import { toast } from "sonner";
import type { DashboardPreferences } from "@/lib/dashboardPrefs";
import { moveId, toggleHiddenId } from "@/lib/dashboardPrefs";
import { DASHBOARD_CARDS, registryLabel } from "@/lib/dashboardRegistry";

const REBLUR_OPTIONS: { value: string; label: string; sec: number | null }[] = [
  { value: "30", label: "30 seconds", sec: 30 },
  { value: "60", label: "1 minute", sec: 60 },
  { value: "300", label: "5 minutes", sec: 300 },
  { value: "never", label: "Never", sec: null },
];

const rowBtn =
  "flex h-11 w-11 items-center justify-center rounded-lg border transition-opacity disabled:opacity-30";

function EyeSwitch({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border"
      style={{
        borderColor: "var(--card-border)",
        backgroundColor: checked
          ? "color-mix(in srgb, var(--azfit-primary) 12%, var(--card-bg))"
          : "var(--card-bg)",
        color: checked ? "var(--azfit-primary)" : "var(--light-text-muted)",
      }}
    >
      {checked ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
    </button>
  );
}

export interface DashboardSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefs: DashboardPreferences;
  /** Live draft preview — parent re-renders the dashboard without saving. */
  onPreview: (draft: DashboardPreferences) => void;
  onSave: (next: DashboardPreferences) => Promise<boolean>;
}

export default function DashboardSettingsSheet({
  open,
  onOpenChange,
  prefs,
  onPreview,
  onSave,
}: DashboardSettingsSheetProps) {
  const [draft, setDraft] = useState<DashboardPreferences>(prefs);
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  // Ref so the Escape listener always sees the latest cancel handler.
  const handleCancelRef = useRef<() => void>(() => {});

  // Reset the draft every time the sheet opens (Cancel = restore).
  useEffect(() => {
    if (open) {
      setDraft(prefs);
      restoreFocusRef.current = document.activeElement as HTMLElement | null;
      // Focus moves into the panel; it returns to the trigger on close.
      setTimeout(() => panelRef.current?.focus(), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleCancelRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const update = (next: DashboardPreferences) => {
    setDraft(next);
    onPreview(next);
  };

  const close = () => {
    onOpenChange(false);
    restoreFocusRef.current?.focus?.();
  };

  const handleCancel = () => {
    onPreview(prefs); // restore last saved behind the sheet
    close();
  };
  handleCancelRef.current = handleCancel;

  const handleSave = async () => {
    const ok = await onSave(draft);
    if (!ok) {
      toast.error("Could not save dashboard settings — keeping your previous layout");
      onPreview(prefs);
      return;
    }
    toast.success("Dashboard settings saved");
    close();
  };

  if (!open) return null;

  const cards = draft.cards;
  const move = (id: string, delta: -1 | 1) =>
    update({ ...draft, cards: moveId(cards, id, delta) });
  const toggle = (id: string) =>
    update({ ...draft, cards: toggleHiddenId(cards, id) });

  const reblurValue =
    REBLUR_OPTIONS.find((o) => o.sec === draft.privacy.autoReblurSec)?.value ?? "never";

  return createPortal(
    <>
      {/* Light token tint — the dashboard stays visible for live preview. */}
      <div
        className="fixed inset-0 z-50"
        style={{ backgroundColor: "color-mix(in srgb, var(--card-bg) 55%, transparent)" }}
        onClick={handleCancel}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Dashboard settings"
        tabIndex={-1}
        data-testid="dashboard-settings-sheet"
        className="fixed top-0 right-0 z-50 flex h-full w-full max-w-md flex-col overflow-hidden border-l outline-none sm:rounded-l-2xl"
        style={{
          backgroundColor: "var(--card-bg)",
          borderColor: "var(--card-border)",
        }}
      >
        <div
          className="flex shrink-0 items-center justify-between border-b px-4 py-3"
          style={{ borderColor: "var(--card-border)" }}
        >
          <h2 className="text-base font-bold" style={{ color: "var(--page-text)" }}>
            Dashboard Settings
          </h2>
          <button
            type="button"
            onClick={handleCancel}
            aria-label="Close settings"
            className="flex h-11 w-11 items-center justify-center rounded-lg border"
            style={{ borderColor: "var(--card-border)", color: "var(--page-text)" }}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-4 py-4">
          {/* ── Section A — Cards ── */}
          <section aria-label="Dashboard cards">
            <h3
              className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em]"
              style={{ color: "var(--light-text-muted)" }}
            >
              Cards
            </h3>
            <ul className="space-y-2">
              {cards.order.map((id, idx) => {
                const hidden = cards.hidden.includes(id);
                const label = registryLabel(DASHBOARD_CARDS, id);
                return (
                  <li
                    key={id}
                    data-testid={`card-row-${id}`}
                    className="flex items-center gap-2 rounded-xl border px-2 py-1.5"
                    style={{
                      borderColor: "var(--card-border)",
                      backgroundColor: "var(--card-bg)",
                      opacity: hidden ? 0.6 : 1,
                    }}
                  >
                    <div className="flex flex-col">
                      <button
                        type="button"
                        className={rowBtn}
                        style={{ borderColor: "var(--card-border)", color: "var(--page-text)" }}
                        aria-label={`Move ${label} up`}
                        disabled={idx === 0}
                        onClick={() => move(id, -1)}
                      >
                        <ArrowUp className="h-4 w-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        className={rowBtn}
                        style={{ borderColor: "var(--card-border)", color: "var(--page-text)" }}
                        aria-label={`Move ${label} down`}
                        disabled={idx === cards.order.length - 1}
                        onClick={() => move(id, 1)}
                      >
                        <ArrowDown className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                    <span
                      className="min-w-0 flex-1 truncate text-sm font-medium"
                      style={{ color: "var(--page-text)" }}
                    >
                      {label}
                    </span>
                    <EyeSwitch
                      checked={hidden}
                      onToggle={() => toggle(id)}
                      label={hidden ? `Show ${label}` : `Hide ${label}`}
                    />
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-xs" style={{ color: "var(--light-text-muted)" }}>
              Hidden cards leave the dashboard; arrows reorder. Changes preview live behind this panel.
            </p>
          </section>

          {/* ── Section B — Privacy ── */}
          <section aria-label="Privacy blur">
            <h3
              className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em]"
              style={{ color: "var(--light-text-muted)" }}
            >
              Privacy
            </h3>
            <div
              className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2"
              style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium" style={{ color: "var(--page-text)" }}>
                  Privacy mode
                </p>
                <p className="text-xs" style={{ color: "var(--light-text-muted)" }}>
                  Blur sensitive cards (names, compliance, attention)
                </p>
              </div>
              <EyeSwitch
                checked={draft.privacy.enabled}
                onToggle={() =>
                  update({
                    ...draft,
                    privacy: { ...draft.privacy, enabled: !draft.privacy.enabled },
                  })
                }
                label={draft.privacy.enabled ? "Disable privacy mode" : "Enable privacy mode"}
              />
            </div>

            <label
              className="mt-3 block text-xs font-medium"
              style={{ color: "var(--light-text-muted)" }}
              htmlFor="auto-reblur"
            >
              Auto re-blur after inactivity
            </label>
            <select
              id="auto-reblur"
              data-testid="auto-reblur-select"
              value={reblurValue}
              disabled={!draft.privacy.enabled}
              onChange={(e) => {
                const opt = REBLUR_OPTIONS.find((o) => o.value === e.target.value);
                update({
                  ...draft,
                  privacy: { ...draft.privacy, autoReblurSec: opt?.sec ?? null },
                });
              }}
              className="mt-1 h-11 w-full rounded-lg border px-3 text-sm"
              style={{
                borderColor: "var(--card-border)",
                backgroundColor: "var(--card-bg)",
                color: "var(--page-text)",
              }}
            >
              {REBLUR_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs" style={{ color: "var(--light-text-muted)" }}>
              The app-bar eye temporarily un-blurs; any pointer or keyboard activity resets the timer.
            </p>
          </section>
        </div>

        {/* Footer actions */}
        <div
          className="flex shrink-0 gap-2 border-t px-4 py-3"
          style={{ borderColor: "var(--card-border)" }}
        >
          <button
            type="button"
            onClick={handleCancel}
            className="h-11 flex-1 rounded-xl border text-sm font-medium"
            style={{ borderColor: "var(--card-border)", color: "var(--page-text)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="settings-save"
            onClick={handleSave}
            className="h-11 flex-1 rounded-xl text-sm font-medium text-white"
            style={{ backgroundColor: "var(--azfit-primary)" }}
          >
            Save
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}
