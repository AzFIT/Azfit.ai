import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { X, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  saveReview,
  type FormCheck,
  type TimestampNote,
} from "@/lib/formChecks";

interface FormCheckReviewModalProps {
  item: FormCheck;
  onClose: () => void;
  onSaved: () => void;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function FormCheckReviewModal({ item, onClose, onSaved }: FormCheckReviewModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [notes, setNotes] = useState<TimestampNote[]>(item.timestampNotes);
  const [noteText, setNoteText] = useState("");
  const [positives, setPositives] = useState(item.positives || "");
  const [improvements, setImprovements] = useState(item.improvements || "");
  const [feedback, setFeedback] = useState(item.feedback || "");
  const [saving, setSaving] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => setCurrentTime(v.currentTime);
    v.addEventListener("timeupdate", onTime);
    return () => v.removeEventListener("timeupdate", onTime);
  }, []);

  const tagNote = () => {
    if (!noteText.trim()) {
      toast.info("Write a note first");
      return;
    }
    setNotes((prev) =>
      [...prev, { time_sec: Math.round(currentTime * 10) / 10, note: noteText.trim() }].sort(
        (a, b) => a.time_sec - b.time_sec
      )
    );
    setNoteText("");
  };

  const seekTo = (sec: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = sec;
      videoRef.current.play().catch(() => {});
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveReview(item.id, { feedback, positives, improvements, timestampNotes: notes });
      toast.success("Review saved — client can now see it");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save review");
    } finally {
      setSaving(false);
    }
  };

  const textareaCls =
    "w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00AEEF]";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div>
            <h3 className="text-sm font-bold text-white">{item.exerciseName}</h3>
            <p className="text-[11px] text-slate-400">
              {item.ownerName || item.ownerEmail || "Client"} • {new Date(item.createdAt).toLocaleDateString()}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-slate-800">
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-0 overflow-y-auto lg:grid-cols-2">
          {/* Video + timestamp tagging */}
          <div className="border-r border-slate-800 p-4">
            <div className="overflow-hidden rounded-xl bg-slate-950">
              {item.url ? (
                <video ref={videoRef} src={item.url} controls className="w-full" />
              ) : (
                <div className="flex h-48 items-center justify-center text-xs text-slate-500">
                  Video unavailable
                </div>
              )}
            </div>

            <div className="mt-3">
              <label className="mb-1 block text-[11px] font-medium text-slate-400">
                Tag a note at {formatTime(currentTime)}
              </label>
              <div className="flex gap-2">
                <input
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && tagNote()}
                  placeholder="e.g. knees caving in on the way down"
                  className={textareaCls}
                />
                <button
                  onClick={tagNote}
                  className="flex shrink-0 items-center gap-1 rounded-lg bg-[#00AEEF] px-3 py-1.5 text-xs font-semibold text-[#0B1120] hover:bg-[#0098D1]"
                >
                  <Plus className="h-3.5 w-3.5" /> Tag
                </button>
              </div>

              {notes.length > 0 && (
                <div className="mt-2 space-y-1">
                  {notes.map((n, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 rounded-lg bg-slate-800/60 px-2 py-1.5 text-xs"
                    >
                      <button
                        onClick={() => seekTo(n.time_sec)}
                        className="shrink-0 font-mono font-bold text-[#00AEEF] hover:underline"
                      >
                        {formatTime(n.time_sec)}
                      </button>
                      <span className="flex-1 text-slate-200">{n.note}</span>
                      <button
                        onClick={() => setNotes((prev) => prev.filter((_, j) => j !== i))}
                        className="shrink-0 text-slate-500 hover:text-red-400"
                        aria-label="Delete note"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Review fields */}
          <div className="space-y-3 p-4">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-emerald-400">Positives</label>
              <textarea
                value={positives}
                onChange={(e) => setPositives(e.target.value)}
                rows={3}
                placeholder="What's looking good…"
                className={textareaCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-amber-400">Improvements</label>
              <textarea
                value={improvements}
                onChange={(e) => setImprovements(e.target.value)}
                rows={3}
                placeholder="What to work on…"
                className={textareaCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-400">Overall feedback</label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={3}
                placeholder="Summary for the client…"
                className={textareaCls}
              />
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#00AEEF] to-[#8B5CF6] py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              {saving ? "Saving…" : "Save Review & Mark Reviewed"}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
