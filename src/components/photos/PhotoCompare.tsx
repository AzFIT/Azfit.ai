// ═══════════════════════════════════════════════════════════════════════
// Phase 98b — Photo Compare & Align.
// Before/After selectors + side-by-side / draggable-slider views +
// per-photo pan/zoom/reset alignment. Transforms persist per photo
// (photo_metadata.transform JSONB) via the onTransformSaved callback.
// Reused by the owner page (ProgressPhotos) and the trainer client view
// (ClientPhotosTab) — photos-in, no fork.
// ═══════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { GitCompareArrows, RotateCcw } from "lucide-react";
import { formatDateShort } from "@/lib/utils";
import {
  PHOTO_CATEGORIES,
  IDENTITY_TRANSFORM,
  type PhotoCategory,
  type PhotoTransform,
  type ProgressPhoto,
} from "@/lib/photoMetadata";

type ViewMode = "side" | "slider";
type CategoryFilter = PhotoCategory | "All";
type Slot = "before" | "after";

interface PhotoCompareProps {
  photos: ProgressPhoto[];
  /** Persist a transform for one photo (null = reset). Debounced by this component. */
  onTransformSaved?: (id: string, transform: PhotoTransform | null) => Promise<void> | void;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Unique picker label: "Category · date", disambiguated by time when a date repeats. */
function buildLabels(list: ProgressPhoto[]): Map<string, string> {
  const counts = new Map<string, number>();
  for (const p of list) {
    const key = `${p.category} · ${formatDateShort(p.takenOn)}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  const labels = new Map<string, string>();
  for (const p of list) {
    const base = `${p.category} · ${formatDateShort(p.takenOn)}`;
    if ((counts.get(base) ?? 0) > 1) {
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      labels.set(p.id, `${base} · ${p.createdAt.slice(11, 16)}`);
    } else {
      labels.set(p.id, base);
    }
  }
  return labels;
}

function isIdentity(t: PhotoTransform): boolean {
  return t.x === 0 && t.y === 0 && t.scale === 1;
}

export default function PhotoCompare({ photos, onTransformSaved }: PhotoCompareProps) {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("All");
  const [beforeId, setBeforeId] = useState<string | null>(null);
  const [afterId, setAfterId] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("slider");
  const [divider, setDivider] = useState(50);
  // Per-photo transforms; lazily seeded from photo.transform (server value).
  const [transforms, setTransforms] = useState<Record<string, PhotoTransform>>({});

  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pendingSaves = useRef<Map<string, PhotoTransform | null>>(new Map());

  const persist = useCallback(
    (id: string, t: PhotoTransform | null) => {
      if (!onTransformSaved) return;
      pendingSaves.current.set(id, t);
      const existing = saveTimers.current.get(id);
      if (existing) clearTimeout(existing);
      saveTimers.current.set(
        id,
        setTimeout(() => {
          const latest = pendingSaves.current.get(id) ?? null;
          saveTimers.current.delete(id);
          pendingSaves.current.delete(id);
          void onTransformSaved(id, latest);
        }, 500)
      );
    },
    [onTransformSaved]
  );

  // Flush pending saves on unmount so a drag-end always lands.
  useEffect(() => {
    const timers = saveTimers.current;
    const pending = pendingSaves.current;
    const saved = onTransformSaved;
    return () => {
      for (const t of timers.values()) clearTimeout(t);
      if (saved) {
        for (const [id, t] of pending) void saved(id, t);
      }
    };
  }, [onTransformSaved]);

  const filtered = useMemo(() => {
    const list = categoryFilter === "All" ? photos : photos.filter((p) => p.category === categoryFilter);
    // Newest first (same convention as the gallery listing).
    return [...list].sort((a, b) => {
      const da = a.takenOn ?? a.createdAt;
      const db = b.takenOn ?? b.createdAt;
      return db.localeCompare(da);
    });
  }, [photos, categoryFilter]);

  const labels = useMemo(() => buildLabels(filtered), [filtered]);

  // Default + validity: oldest vs newest of the filtered set. Keep a manual
  // selection while it is still present in the filtered list.
  useEffect(() => {
    if (filtered.length < 2) {
      setBeforeId(filtered[0]?.id ?? null);
      setAfterId(filtered[0]?.id ?? null);
      return;
    }
    const oldest = filtered[filtered.length - 1];
    const newest = filtered[0];
    setBeforeId((cur) => (cur && filtered.some((p) => p.id === cur) ? cur : oldest.id));
    setAfterId((cur) => (cur && filtered.some((p) => p.id === cur) && cur !== (beforeId ?? cur) ? cur : newest.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered]);

  const before = filtered.find((p) => p.id === beforeId) ?? null;
  const after = filtered.find((p) => p.id === afterId) ?? null;

  const getTransform = useCallback(
    (id: string): PhotoTransform => transforms[id] ?? photos.find((p) => p.id === id)?.transform ?? IDENTITY_TRANSFORM,
    [transforms, photos]
  );

  const setTransform = useCallback(
    (id: string, t: PhotoTransform) => {
      setTransforms((m) => ({ ...m, [id]: t }));
      persist(id, isIdentity(t) ? null : t);
    },
    [persist]
  );

  // ── Pan ────────────────────────────────────────────────────────────────
  const startPan = useCallback(
    (e: React.PointerEvent, id: string) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startY = e.clientY;
      const base = getTransform(id);
      let latest = base;
      const onMove = (ev: PointerEvent) => {
        latest = { ...base, x: base.x + (ev.clientX - startX), y: base.y + (ev.clientY - startY) };
        setTransforms((m) => ({ ...m, [id]: latest }));
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        persist(id, isIdentity(latest) ? null : latest);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [getTransform, persist]
  );

  // ── Slider frame width (Before layer must be sized to the FRAME, not the clip) ──
  // Re-run whenever the frame (re)mounts: on first render the Before/After ids
  // are still null, so the frame doesn't exist yet — a [view]-only dep would
  // never measure it (this was the "before layer frame-sized" smoke failure).
  const frameRef = useRef<HTMLDivElement>(null);
  const [frameW, setFrameW] = useState(0);
  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const update = () => setFrameW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [view, beforeId, afterId]);

  const startDividerDrag = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const el = frameRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const update = (clientX: number) => setDivider(clamp(((clientX - rect.left) / rect.width) * 100, 0, 100));
      update(e.clientX);
      const onMove = (ev: PointerEvent) => update(ev.clientX);
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    []
  );

  const onDividerKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      setDivider((d) => clamp(d - 2, 0, 100));
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      setDivider((d) => clamp(d + 2, 0, 100));
    }
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────

  if (photos.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/50 py-16 text-center">
        <GitCompareArrows className="h-8 w-8 text-[#00AEEF]" />
        <p className="mt-3 text-sm font-semibold text-white">Compare needs two photos</p>
        <p className="mt-1 max-w-xs text-xs text-slate-400">
          Upload at least two progress photos and they can be compared side-by-side or with a slider.
        </p>
      </div>
    );
  }

  const renderChips = (p: ProgressPhoto) => (
    <span className="flex flex-wrap items-center gap-1.5">
      <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
        {formatDateShort(p.takenOn)}
      </span>
      {p.weightKg != null && (
        <span className="rounded-md bg-[#00AEEF]/15 px-2 py-0.5 text-[10px] font-bold text-[#00AEEF]">
          {p.weightKg} kg
        </span>
      )}
      {p.bodyFatPct != null && (
        <span className="rounded-md bg-[#00AEEF]/15 px-2 py-0.5 text-[10px] font-bold text-[#00AEEF]">
          {p.bodyFatPct}% BF
        </span>
      )}
    </span>
  );

  const renderPicker = (slot: Slot, value: string | null, onChange: (id: string) => void) => (
    <label className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {slot === "before" ? "Before" : "After"}
      </span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        aria-label={slot === "before" ? "Before photo" : "After photo"}
        className="h-11 w-full rounded-lg border border-slate-700 bg-slate-800 px-2 text-xs text-white"
      >
        {filtered.map((p) => (
          <option key={p.id} value={p.id}>
            {labels.get(p.id)}
          </option>
        ))}
      </select>
    </label>
  );

  const renderAlignControls = (p: ProgressPhoto, compact: boolean) => {
    const t = getTransform(p.id);
    return (
      <div className={`flex items-center gap-2 ${compact ? "flex-1" : ""}`}>
        <input
          type="range"
          min={50}
          max={200}
          step={5}
          value={t.scale * 100}
          aria-label={`Zoom ${labels.get(p.id) ?? p.id}`}
          onChange={(e) => setTransform(p.id, { ...t, scale: Number(e.target.value) / 100 })}
          className="h-11 min-w-0 flex-1 accent-[#00AEEF]"
        />
        <span className="w-11 text-right text-[11px] tabular-nums text-slate-400">{Math.round(t.scale * 100)}%</span>
        <button
          type="button"
          onClick={() => setTransform(p.id, IDENTITY_TRANSFORM)}
          disabled={isIdentity(t)}
          aria-label={`Reset alignment for ${labels.get(p.id) ?? "photo"}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-700 text-slate-300 transition hover:bg-slate-800 disabled:opacity-40"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>
    );
  };

  const imgTransformStyle = (id: string): React.CSSProperties => {
    const t = getTransform(id);
    return {
      transform: `translate(${t.x}px, ${t.y}px) scale(${t.scale})`,
      transformOrigin: "center",
      touchAction: "none",
    };
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-3 sm:p-4">
      {/* Category filter chips */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {(["All", ...PHOTO_CATEGORIES] as CategoryFilter[]).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategoryFilter(c)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              categoryFilter === c ? "bg-[#00AEEF] text-[#0B1120]" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Selectors + view toggle */}
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end">
        {renderPicker("before", before?.id ?? null, setBeforeId)}
        {renderPicker("after", after?.id ?? null, setAfterId)}
        <div className="flex gap-1.5 sm:pb-0" role="group" aria-label="Compare view">
          {(
            [
              ["side", "Side-by-side"],
              ["slider", "Slider"],
            ] as [ViewMode, string][]
          ).map(([mode, text]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setView(mode)}
              aria-pressed={view === mode}
              className={`h-11 rounded-lg px-3 text-xs font-semibold transition ${
                view === mode ? "bg-[#00AEEF] text-[#0B1120]" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {text}
            </button>
          ))}
        </div>
      </div>

      {before && after && (
        <>
          {view === "side" ? (
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  ["Before", before],
                  ["After", after],
                ] as [string, ProgressPhoto][]
              ).map(([label, p]) => (
                <figure key={label} className="min-w-0">
                  <figcaption className="mb-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-md bg-[#00AEEF]/15 px-2 py-0.5 text-[10px] font-bold uppercase text-[#00AEEF]">
                      {label}
                    </span>
                    {renderChips(p)}
                  </figcaption>
                  <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
                    <img
                      src={p.url}
                      alt={`${label}: ${labels.get(p.id)}`}
                      draggable={false}
                      onPointerDown={(e) => startPan(e, p.id)}
                      style={imgTransformStyle(p.id)}
                      className="absolute inset-0 h-full w-full cursor-grab object-cover active:cursor-grabbing"
                    />
                  </div>
                  <div className="mt-1.5">{renderAlignControls(p, false)}</div>
                </figure>
              ))}
            </div>
          ) : (
            <>
              {/* Per-photo align controls (compact rows above the frame) */}
              <div className="mb-2 flex flex-col gap-1.5">
                {(
                  [
                    ["Before", before],
                    ["After", after],
                  ] as [string, ProgressPhoto][]
                ).map(([label, p]) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className="w-12 shrink-0 text-[10px] font-bold uppercase text-[#00AEEF]">{label}</span>
                    {renderAlignControls(p, true)}
                  </div>
                ))}
              </div>
              {/* Slider frame: After fills the frame; Before is clipped at the divider.
                  Both layers are sized to the FRAME width so they stay aligned. */}
              <div
                ref={frameRef}
                onPointerDown={startDividerDrag}
                className="relative aspect-[3/4] w-full touch-none select-none overflow-hidden rounded-xl border border-slate-800 bg-slate-950"
              >
                <img
                  src={after.url}
                  alt={`After: ${labels.get(after.id)}`}
                  draggable={false}
                  onPointerDown={(e) => startPan(e, after.id)}
                  style={imgTransformStyle(after.id)}
                  className="absolute inset-0 h-full w-full cursor-grab object-cover active:cursor-grabbing"
                />
                <div className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${divider}%` }}>
                  <img
                    src={before.url}
                    alt={`Before: ${labels.get(before.id)}`}
                    draggable={false}
                    onPointerDown={(e) => startPan(e, before.id)}
                    style={{ ...imgTransformStyle(before.id), width: frameW || undefined }}
                    className="absolute inset-y-0 left-0 h-full max-w-none cursor-grab object-cover active:cursor-grabbing"
                  />
                </div>
                {/* Divider line + 44px handle */}
                <div className="absolute inset-y-0" style={{ left: `${divider}%` }}>
                  <div className="absolute inset-y-0 -left-px w-0.5 bg-[#00AEEF]" />
                  <button
                    type="button"
                    role="slider"
                    aria-label="Comparison divider"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(divider)}
                    onKeyDown={onDividerKeyDown}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      startDividerDrag(e);
                    }}
                    className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-[#00AEEF] bg-[#0B1120]/80 text-[#00AEEF] shadow-lg"
                  >
                    <GitCompareArrows className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
