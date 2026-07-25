import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  Star,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  SplitSquareHorizontal,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import {
  PHOTO_CATEGORIES,
  type ProgressPhoto,
  type PhotoCategory,
} from "@/lib/photoMetadata";

type SortKey = "date-desc" | "date-asc" | "category";

interface PhotoGalleryProps {
  photos: ProgressPhoto[];
  loading?: boolean;
  /** trainer view enables trainer-notes editor + milestone toggle */
  isTrainer?: boolean;
  onDelete?: (photo: ProgressPhoto) => Promise<void>;
  onUpdateNote?: (id: string, notes: string) => Promise<void>;
  onUpdateTrainerNotes?: (id: string, notes: string) => Promise<void>;
  onSetMilestone?: (id: string, value: boolean) => Promise<void>;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function PhotoGallery({
  photos,
  loading,
  isTrainer,
  onDelete,
  onUpdateNote,
  onUpdateTrainerNotes,
  onSetMilestone,
}: PhotoGalleryProps) {
  const [category, setCategory] = useState<PhotoCategory | "All">("All");
  const [sort, setSort] = useState<SortKey>("date-desc");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    let list = photos;
    if (category !== "All") list = list.filter((p) => p.category === category);
    const sorted = [...list];
    if (sort === "date-asc") {
      sorted.sort((a, b) => (a.takenOn || "").localeCompare(b.takenOn || ""));
    } else if (sort === "category") {
      sorted.sort((a, b) => a.category.localeCompare(b.category) || (b.takenOn || "").localeCompare(a.takenOn || ""));
    } else {
      sorted.sort((a, b) => (b.takenOn || "").localeCompare(a.takenOn || ""));
    }
    return sorted;
  }, [photos, category, sort]);

  const toggleSelect = (path: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else if (next.size < 2) next.add(path);
      else toast.info("Select up to 2 photos to compare");
      return next;
    });
  };

  const comparePhotos = filtered.filter((p) => selected.has(p.path));

  return (
    <div>
      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setCategory("All")}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
            category === "All" ? "bg-[#00AEEF] text-[#0B1120]" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          All
        </button>
        {PHOTO_CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              category === c ? "bg-[#00AEEF] text-[#0B1120]" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {c}
          </button>
        ))}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="ml-auto rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-300"
        >
          <option value="date-desc">Newest first</option>
          <option value="date-asc">Oldest first</option>
          <option value="category">By category</option>
        </select>
        <button
          onClick={() => {
            setCompareMode((m) => !m);
            setSelected(new Set());
          }}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            compareMode ? "bg-[#00AEEF] text-[#0B1120]" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          <SplitSquareHorizontal className="h-3.5 w-3.5" />
          {compareMode ? "Exit" : "Compare"}
        </button>
      </div>

      {compareMode && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3">
          <p className="text-sm text-slate-300">Select 2 photos to compare. ({selected.size}/2)</p>
          {selected.size > 0 && (
            <button onClick={() => setSelected(new Set())} className="flex items-center gap-1 text-xs text-slate-400 hover:text-white">
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          )}
        </div>
      )}

      {/* Compare view */}
      {compareMode && selected.size === 2 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {comparePhotos.map((photo) => (
            <div key={photo.path} className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50">
              <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
                <span className="rounded-md bg-[#00AEEF]/15 px-2 py-0.5 text-[10px] font-bold uppercase text-[#00AEEF]">
                  {photo.category}
                </span>
                <span className="text-xs text-slate-400">{formatDate(photo.takenOn)}</span>
              </div>
              <div className="relative aspect-[3/4] overflow-hidden bg-slate-950">
                <img src={photo.url} alt={photo.category} className="h-full w-full object-contain" />
              </div>
              <div className="px-4 py-2 text-[11px] text-slate-400">
                {photo.weightKg != null && <span>{photo.weightKg} kg</span>}
                {photo.bodyFatPct != null && <span className="ml-2">{photo.bodyFatPct}% BF</span>}
              </div>
            </div>
          ))}
        </div>
      ) : loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl border border-slate-800 bg-slate-900/50" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <Camera className="mx-auto mb-3 h-12 w-12 text-slate-700" />
          <p className="text-sm text-slate-400">No photos{category !== "All" ? ` in ${category}` : ""} yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {filtered.map((photo, i) => {
            const isSel = selected.has(photo.path);
            return (
              <button
                key={photo.path}
                onClick={() => (compareMode ? toggleSelect(photo.path) : setLightboxIndex(i))}
                className={`group relative aspect-[3/4] overflow-hidden rounded-2xl border-2 text-left transition ${
                  isSel ? "border-[#00AEEF] ring-2 ring-[#00AEEF]/20" : "border-slate-800 hover:border-slate-500"
                }`}
              >
                <img src={photo.url} alt={photo.category} className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

                {/* Category badge + milestone */}
                <div className="absolute left-2 top-2 flex items-center gap-1.5">
                  <span className="rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-bold uppercase text-[#00AEEF]">
                    {photo.category}
                  </span>
                  {photo.isMilestone && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
                </div>

                {compareMode && (
                  <span
                    className={`absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md border transition ${
                      isSel ? "border-[#00AEEF] bg-[#00AEEF] text-[#0B1120]" : "border-white/40 bg-black/40 text-white"
                    }`}
                  >
                    {isSel && <Check className="h-3.5 w-3.5" />}
                  </span>
                )}

                {/* Meta overlay */}
                <div className="absolute inset-x-0 bottom-0 bg-black/60 px-3 py-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <p className="text-xs font-medium text-white">{formatDate(photo.takenOn)}</p>
                  {(photo.weightKg != null || photo.bodyFatPct != null) && (
                    <p className="text-[10px] text-slate-300">
                      {photo.weightKg != null && `${photo.weightKg} kg`}
                      {photo.weightKg != null && photo.bodyFatPct != null && " • "}
                      {photo.bodyFatPct != null && `${photo.bodyFatPct}% BF`}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxIndex !== null && filtered[lightboxIndex] && (
          <Lightbox
            photo={filtered[lightboxIndex]}
            isTrainer={isTrainer}
            onClose={() => setLightboxIndex(null)}
            onPrev={() => setLightboxIndex((i) => (i === null ? null : (i - 1 + filtered.length) % filtered.length))}
            onNext={() => setLightboxIndex((i) => (i === null ? null : (i + 1) % filtered.length))}
            onDelete={onDelete}
            onUpdateNote={onUpdateNote}
            onUpdateTrainerNotes={onUpdateTrainerNotes}
            onSetMilestone={onSetMilestone}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Lightbox ────────────────────────────────────────────── */

function Lightbox({
  photo,
  isTrainer,
  onClose,
  onPrev,
  onNext,
  onDelete,
  onUpdateNote,
  onUpdateTrainerNotes,
  onSetMilestone,
}: {
  photo: ProgressPhoto;
  isTrainer?: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onDelete?: (p: ProgressPhoto) => Promise<void>;
  onUpdateNote?: (id: string, notes: string) => Promise<void>;
  onUpdateTrainerNotes?: (id: string, notes: string) => Promise<void>;
  onSetMilestone?: (id: string, value: boolean) => Promise<void>;
}) {
  const [note, setNote] = useState(photo.notes || "");
  const [trainerNote, setTrainerNote] = useState(photo.trainerNotes || "");
  const [saving, setSaving] = useState(false);

  const save = async (fn: () => Promise<void>) => {
    setSaving(true);
    try {
      await fn();
      toast.success("Saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-[#00AEEF]/15 px-2 py-0.5 text-[10px] font-bold uppercase text-[#00AEEF]">
              {photo.category}
            </span>
            {photo.isMilestone && <Star className="h-4 w-4 fill-amber-400 text-amber-400" />}
            <span className="text-xs text-slate-400">{formatDate(photo.takenOn)}</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={onPrev} className="rounded-lg p-2 hover:bg-slate-800" aria-label="Previous">
              <ChevronLeft className="h-5 w-5 text-slate-300" />
            </button>
            <button onClick={onNext} className="rounded-lg p-2 hover:bg-slate-800" aria-label="Next">
              <ChevronRight className="h-5 w-5 text-slate-300" />
            </button>
            <button onClick={onClose} className="rounded-lg p-2 hover:bg-slate-800" aria-label="Close">
              <X className="h-5 w-5 text-slate-300" />
            </button>
          </div>
        </div>

        <div className="grid flex-1 grid-cols-1 overflow-y-auto md:grid-cols-2">
          <div className="flex items-center justify-center bg-slate-950 p-4">
            <img src={photo.url} alt={photo.category} className="max-h-[60vh] w-full object-contain" />
          </div>
          <div className="space-y-3 p-4 text-sm">
            <div className="flex gap-3 text-xs text-slate-300">
              {photo.weightKg != null && <span>Weight: <strong className="text-white">{photo.weightKg} kg</strong></span>}
              {photo.bodyFatPct != null && <span>Body fat: <strong className="text-white">{photo.bodyFatPct}%</strong></span>}
            </div>

            {isTrainer && onSetMilestone && (
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={photo.isMilestone}
                  onChange={(e) => onSetMilestone(photo.id, e.target.checked)}
                  className="h-4 w-4 accent-amber-400"
                />
                Mark as milestone
              </label>
            )}

            {/* Owner note */}
            {onUpdateNote && (
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-400">Note</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-white"
                />
                <button
                  onClick={() => save(() => onUpdateNote(photo.id, note))}
                  disabled={saving}
                  className="mt-1.5 rounded-lg bg-[#00AEEF] px-3 py-1.5 text-xs font-semibold text-[#0B1120] disabled:opacity-50"
                >
                  Save note
                </button>
              </div>
            )}

            {/* Trainer-only notes */}
            {isTrainer && onUpdateTrainerNotes && (
              <div>
                <label className="mb-1 block text-[11px] font-medium text-amber-400">
                  Trainer notes (private — client can't see)
                </label>
                <textarea
                  value={trainerNote}
                  onChange={(e) => setTrainerNote(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-amber-500/30 bg-slate-800 px-2 py-1.5 text-xs text-white"
                />
                <button
                  onClick={() => save(() => onUpdateTrainerNotes(photo.id, trainerNote))}
                  disabled={saving}
                  className="mt-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 disabled:opacity-50"
                >
                  Save trainer note
                </button>
              </div>
            )}

            {onDelete && (
              <button
                onClick={async () => {
                  await onDelete(photo);
                  onClose();
                }}
                className="flex items-center gap-1.5 rounded-lg border border-red-500/40 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete photo
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
