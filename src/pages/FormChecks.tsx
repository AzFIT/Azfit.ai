import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  ArrowLeft, Video, Upload, X, Play, Trash2, ClipboardCheck,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { formatDateShort } from '@/lib/utils';
import { getAllExercisesFlat } from '@/data/exerciseDatabase';
import {
  uploadFormCheckVideo,
  getMyFormChecks,
  getPendingReviews,
  deleteFormCheck,
  type FormCheck,
  type PendingReviewItem,
} from '@/lib/formChecks';
import { getClientFormChecks } from '@/lib/formChecks';
import FormCheckReviewModal from '@/components/formchecks/FormCheckReviewModal';

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function FormChecksPage() {
  const navigate = useNavigate();
  const { user, isTrainer } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="rounded-lg p-2 transition-colors hover:bg-slate-800"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-5 w-5 text-slate-400" />
          </button>
          <h1 className="flex items-center gap-2 text-lg font-bold text-white">
            <Video className="h-5 w-5 text-[#00AEEF]" />
            Form Checks
          </h1>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6">
        {isTrainer ? <TrainerView /> : user ? <ClientView userId={user.id} /> : null}
      </div>
    </div>
  );
}

/* ═══ CLIENT VIEW ═══ */

function ClientView({ userId }: { userId: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [checks, setChecks] = useState<FormCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [exerciseName, setExerciseName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [active, setActive] = useState<FormCheck | null>(null);

  const exerciseSuggestions = useRef<string[]>(getAllExercisesFlat());

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      setChecks(await getMyFormChecks(userId));
    } catch (err) {
      toast.error('Failed to load: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { refetch(); }, [refetch]);

  const handleUpload = async () => {
    if (!file) { toast.error('Choose a video first'); return; }
    setUploading(true);
    try {
      await uploadFormCheckVideo(file, userId, exerciseName);
      toast.success('Video submitted for review');
      setShowUpload(false);
      setFile(null);
      setExerciseName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await refetch();
    } catch (err) {
      toast.error('Upload failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (item: FormCheck) => {
    try {
      await deleteFormCheck(item);
      toast.success('Deleted');
      setActive(null);
      await refetch();
    } catch (err) {
      toast.error('Delete failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const seekTo = (sec: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = sec;
      videoRef.current.play().catch(() => {});
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-400">Upload a short clip of your lift for your coach to review.</p>
        <button
          onClick={() => setShowUpload((s) => !s)}
          className="flex items-center gap-1.5 rounded-lg bg-[#00AEEF] px-3 py-2 text-xs font-bold text-[#0B1120] hover:bg-[#0098D1]"
        >
          <Upload className="h-3.5 w-3.5" /> Upload Video
        </button>
      </div>

      {showUpload && (
        <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">New form check</h3>
            <button onClick={() => setShowUpload(false)} className="rounded-lg p-1 hover:bg-slate-800">
              <X className="h-4 w-4 text-slate-400" />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] text-slate-400">Exercise *</label>
              <input
                list="fc-exercises"
                value={exerciseName}
                onChange={(e) => setExerciseName(e.target.value)}
                placeholder="e.g. Back Squat"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-white"
              />
              <datalist id="fc-exercises">
                {exerciseSuggestions.current.map((n) => <option key={n} value={n} />)}
              </datalist>
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-slate-400">Video * (max 45MB, keep under ~60s)</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-slate-300 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-xs file:text-slate-200"
              />
            </div>
          </div>
          <button
            onClick={handleUpload}
            disabled={uploading || !file}
            className="mt-4 rounded-lg bg-[#00AEEF] px-4 py-2 text-xs font-bold text-[#0B1120] hover:bg-[#0098D1] disabled:opacity-50"
          >
            {uploading ? 'Uploading…' : 'Submit for review'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="aspect-video animate-pulse rounded-2xl border border-slate-800 bg-slate-900/50" />
          ))}
        </div>
      ) : checks.length === 0 ? (
        <div className="py-16 text-center">
          <Video className="mx-auto mb-3 h-12 w-12 text-slate-700" />
          <p className="text-sm text-slate-400">No form checks yet — upload your first clip.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {checks.map((item) => (
            <button
              key={item.id}
              onClick={() => setActive(item)}
              className="group overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 text-left transition hover:border-slate-500"
            >
              <div className="relative flex aspect-video items-center justify-center bg-slate-950">
                <Play className="h-10 w-10 text-slate-600 transition group-hover:text-[#00AEEF]" />
                <span
                  className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    item.status === 'reviewed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                  }`}
                >
                  {item.status === 'reviewed' ? 'Reviewed' : 'Pending'}
                </span>
              </div>
              <div className="px-3 py-2.5">
                <p className="truncate text-sm font-semibold text-white">{item.exerciseName}</p>
                <p className="text-[11px] text-slate-400">{formatDateShort(item.createdAt)}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Playback / feedback modal */}
      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
            onClick={() => setActive(null)}
          >
            <motion.div
              initial={{ scale: 0.96 }}
              animate={{ scale: 1 }}
              className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
                <div>
                  <h3 className="text-sm font-bold text-white">{active.exerciseName}</h3>
                  <p className="text-[11px] text-slate-400">{formatDateShort(active.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleDelete(active)} className="rounded-lg p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-400" aria-label="Delete">
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <button onClick={() => setActive(null)} className="rounded-lg p-1.5 hover:bg-slate-800">
                    <X className="h-5 w-5 text-slate-400" />
                  </button>
                </div>
              </div>
              <div className="overflow-y-auto p-4">
                <div className="overflow-hidden rounded-xl bg-slate-950">
                  {active.url ? (
                    <video ref={videoRef} src={active.url} controls className="w-full" />
                  ) : (
                    <div className="flex h-48 items-center justify-center text-xs text-slate-500">Video unavailable</div>
                  )}
                </div>

                {active.status === 'reviewed' && (
                  <div className="mt-4 space-y-3">
                    {active.positives && (
                      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
                        <p className="mb-1 text-[11px] font-bold text-emerald-400">Positives</p>
                        <p className="whitespace-pre-wrap text-xs text-slate-200">{active.positives}</p>
                      </div>
                    )}
                    {active.improvements && (
                      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
                        <p className="mb-1 text-[11px] font-bold text-amber-400">Improvements</p>
                        <p className="whitespace-pre-wrap text-xs text-slate-200">{active.improvements}</p>
                      </div>
                    )}
                    {active.feedback && (
                      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-3">
                        <p className="mb-1 text-[11px] font-bold text-slate-300">Overall feedback</p>
                        <p className="whitespace-pre-wrap text-xs text-slate-200">{active.feedback}</p>
                      </div>
                    )}
                    {active.timestampNotes.length > 0 && (
                      <div>
                        <p className="mb-1.5 text-[11px] font-bold text-slate-300">Timestamp notes (tap to jump)</p>
                        <div className="space-y-1">
                          {active.timestampNotes.map((n, i) => (
                            <button
                              key={i}
                              onClick={() => seekTo(n.time_sec)}
                              className="flex w-full items-center gap-2 rounded-lg bg-slate-800/60 px-2 py-1.5 text-left text-xs hover:bg-slate-800"
                            >
                              <span className="shrink-0 font-mono font-bold text-[#00AEEF]">{formatTime(n.time_sec)}</span>
                              <span className="text-slate-200">{n.note}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {active.status === 'pending' && (
                  <p className="mt-3 text-center text-xs text-slate-500">Waiting for your coach to review this clip.</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══ TRAINER VIEW ═══ */

function TrainerView() {
  const [queue, setQueue] = useState<PendingReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<FormCheck | null>(null);
  const [loadingActive, setLoadingActive] = useState(false);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      setQueue(await getPendingReviews());
    } catch (err) {
      toast.error('Failed to load queue: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const openReview = async (item: PendingReviewItem) => {
    setLoadingActive(true);
    try {
      const checks = await getClientFormChecks(item.ownerId);
      const found = checks.find((c) => c.id === item.id);
      if (found) {
        setActive({ ...found, ownerName: item.ownerName, ownerEmail: item.ownerEmail });
      } else {
        toast.error('Submission not found');
      }
    } catch (err) {
      toast.error('Failed to open: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoadingActive(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <ClipboardCheck className="h-4 w-4 text-[#00AEEF]" />
        <h3 className="text-sm font-bold text-white">Pending reviews ({queue.length})</h3>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/50" />
          ))}
        </div>
      ) : queue.length === 0 ? (
        <div className="py-16 text-center">
          <ClipboardCheck className="mx-auto mb-3 h-12 w-12 text-slate-700" />
          <p className="text-sm text-slate-400">All caught up — no videos waiting for review.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {queue.map((item) => (
            <button
              key={item.id}
              onClick={() => openReview(item)}
              disabled={loadingActive}
              className="flex w-full items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-left transition hover:border-slate-500"
            >
              <div>
                <p className="text-sm font-semibold text-white">{item.exerciseName}</p>
                <p className="text-[11px] text-slate-400">{item.ownerName} • {formatDateShort(item.createdAt)}</p>
              </div>
              <span className="rounded-full bg-amber-500/20 px-2.5 py-1 text-[10px] font-bold text-amber-400">
                Review
              </span>
            </button>
          ))}
        </div>
      )}

      <AnimatePresence>
        {active && (
          <FormCheckReviewModal
            item={active}
            onClose={() => setActive(null)}
            onSaved={refetch}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
