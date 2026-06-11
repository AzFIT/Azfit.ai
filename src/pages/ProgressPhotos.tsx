import { useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Camera, Upload, ChevronLeft, ChevronRight,
  SplitSquareHorizontal, SplitSquareVertical, Calendar, Target,
  ZoomIn, ZoomOut, RotateCcw, Trash2,
} from 'lucide-react';

/* ── Types ─────────────────────────────────────────────── */

interface ProgressPhoto {
  id: string;
  date: string; // ISO date
  front?: string; // base64
  side?: string;
  back?: string;
  notes?: string;
  weight?: number;
  bodyFatPercentage?: number;
}

/* ── Storage ───────────────────────────────────────────── */

const STORAGE_KEY = 'azfit_progress_photos';
const PROFILE_KEY = 'azfit_client_profile';
const BIO_KEY = 'azfit_bio_history';

function loadPhotos(): ProgressPhoto[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

function savePhotos(photos: ProgressPhoto[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(photos));
}

function loadProfile() {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null'); } catch { return null; }
}

function loadBioHistory() {
  try { return JSON.parse(localStorage.getItem(BIO_KEY) || '[]'); } catch { return []; }
}

/* ── Main Component ────────────────────────────────────── */

type CompareMode = 'first-vs-latest' | 'first-vs-goal' | 'latest-vs-goal' | 'timeline';
type ViewAngle = 'front' | 'side' | 'back';

export default function ProgressPhotosPage() {
  const navigate = useNavigate();
  const [photos, setPhotos] = useState<ProgressPhoto[]>(loadPhotos);
  const [compareMode, setCompareMode] = useState<CompareMode>('first-vs-latest');
  const [viewAngle, setViewAngle] = useState<ViewAngle>('front');
  const [timelineIndex, setTimelineIndex] = useState(0);
  const [, setShowUpload] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [showOverlay, setShowOverlay] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const profile = loadProfile();
  const bioHistory = loadBioHistory();

  // Merge bio history photos into progress photos
  const allPhotos = useMemo(() => {
    const bioPhotos: ProgressPhoto[] = bioHistory
      .filter((entry: { photo?: string; date: string; weight?: number; bodyFatPercentage?: number }) => entry.photo)
      .map((entry: { photo?: string; date: string; weight?: number; bodyFatPercentage?: number }) => ({
        id: `bio-${entry.date}`,
        date: entry.date,
        front: entry.photo,
        weight: entry.weight,
        bodyFatPercentage: entry.bodyFatPercentage,
      }));

    const merged = [...photos, ...bioPhotos];
    // Deduplicate by date
    const seen = new Set<string>();
    return merged
      .filter((p) => { if (seen.has(p.date)) return false; seen.add(p.date); return true; })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [photos, bioHistory]);

  const firstPhoto = allPhotos[0] || null;
  const latestPhoto = allPhotos[allPhotos.length - 1] || null;
  const timelinePhoto = allPhotos[timelineIndex] || null;

  const getPhotoForAngle = (photo: ProgressPhoto | null, angle: ViewAngle): string | undefined => {
    if (!photo) return undefined;
    if (angle === 'front') return photo.front;
    if (angle === 'side') return photo.side;
    if (angle === 'back') return photo.back;
    return photo.front;
  };

  const getComparePhotos = (): { left: ProgressPhoto | null; right: ProgressPhoto | null; leftLabel: string; rightLabel: string } => {
    switch (compareMode) {
      case 'first-vs-latest':
        return { left: firstPhoto, right: latestPhoto, leftLabel: 'Start', rightLabel: 'Current' };
      case 'first-vs-goal':
        return { left: firstPhoto, right: null, leftLabel: 'Start', rightLabel: 'Goal' };
      case 'latest-vs-goal':
        return { left: latestPhoto, right: null, leftLabel: 'Current', rightLabel: 'Goal' };
      case 'timeline':
        return { left: timelinePhoto, right: null, leftLabel: formatDate(timelinePhoto?.date || ''), rightLabel: '' };
    }
  };

  const { left, right, leftLabel, rightLabel } = getComparePhotos();
  const leftImage = getPhotoForAngle(left, viewAngle);
  const rightImage = getPhotoForAngle(right, viewAngle);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      const newPhoto: ProgressPhoto = {
        id: crypto.randomUUID(),
        date: new Date().toISOString().split('T')[0],
        [viewAngle]: base64,
        weight: latestPhoto?.weight,
      };
      setPhotos((prev) => {
        const updated = [...prev, newPhoto].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        savePhotos(updated);
        return updated;
      });
      setShowUpload(false);
    };
    reader.readAsDataURL(file);
  }, [viewAngle, latestPhoto]);

  const handleDelete = (id: string) => {
    setPhotos((prev) => {
      const updated = prev.filter((p) => p.id !== id);
      savePhotos(updated);
      return updated;
    });
  };

  const handleTimelinePrev = () => setTimelineIndex((i) => Math.max(0, i - 1));
  const handleTimelineNext = () => setTimelineIndex((i) => Math.min(allPhotos.length - 1, i + 1));

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/dashboard')} className="p-2 rounded-lg hover:bg-slate-800 transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </button>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <Camera className="w-5 h-5 text-[#00AEEF]" />
              Progress Photos
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowOverlay(!showOverlay)}
              className={`hidden md:flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                showOverlay ? 'bg-[#00AEEF]/20 text-[#00AEEF]' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <SplitSquareVertical className="w-3.5 h-3.5" />
              Body Overlay
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#00AEEF] hover:bg-[#0098D1] text-[#0B1120] text-xs font-bold transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              Add Photo
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Controls Bar */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {/* Compare Mode */}
          <div className="flex items-center bg-slate-800/50 rounded-lg p-0.5">
            {([
              { value: 'first-vs-latest', label: 'Start vs Now', icon: SplitSquareHorizontal },
              { value: 'first-vs-goal', label: 'Start vs Goal', icon: Target },
              { value: 'latest-vs-goal', label: 'Now vs Goal', icon: Target },
              { value: 'timeline', label: 'Timeline', icon: Calendar },
            ] as const).map((mode) => (
              <button
                key={mode.value}
                onClick={() => setCompareMode(mode.value)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded text-xs font-medium transition-colors ${
                  compareMode === mode.value
                    ? 'bg-[#00AEEF] text-[#0B1120]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <mode.icon className="w-3.5 h-3.5" />
                {mode.label}
              </button>
            ))}
          </div>

          {/* View Angle */}
          <div className="flex items-center bg-slate-800/50 rounded-lg p-0.5">
            {(['front', 'side', 'back'] as const).map((angle) => (
              <button
                key={angle}
                onClick={() => setViewAngle(angle)}
                className={`px-3 py-2 rounded text-xs font-medium capitalize transition-colors ${
                  viewAngle === angle
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {angle}
              </button>
            ))}
          </div>

          {/* Zoom */}
          <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-0.5">
            <button onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} className="p-1.5 rounded hover:bg-slate-700 text-slate-400">
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs text-slate-400 w-10 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((z) => Math.min(2, z + 0.25))} className="p-1.5 rounded hover:bg-slate-700 text-slate-400">
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setZoom(1)} className="p-1.5 rounded hover:bg-slate-700 text-slate-400">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Timeline Slider */}
        {compareMode === 'timeline' && allPhotos.length > 1 && (
          <div className="mb-6 bg-slate-900/50 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center gap-4">
              <button onClick={handleTimelinePrev} disabled={timelineIndex === 0} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-400">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400">{timelineIndex + 1} of {allPhotos.length}</span>
                  <span className="text-xs text-slate-400">{formatDate(timelinePhoto?.date || '')}</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-[#00AEEF] rounded-full"
                    animate={{ width: `${((timelineIndex + 1) / allPhotos.length) * 100}%` }}
                  />
                </div>
              </div>
              <button onClick={handleTimelineNext} disabled={timelineIndex >= allPhotos.length - 1} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-400">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Photo Comparison Area */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left Photo */}
          <PhotoCard
            label={leftLabel}
            image={leftImage}
            photo={left}
            profile={profile}
            zoom={zoom}
            showOverlay={showOverlay}
            onDelete={left?.id && !left.id.startsWith('bio-') ? () => handleDelete(left.id) : undefined}
          />

          {/* Right Photo (if comparing) */}
          {compareMode !== 'timeline' && (
            <PhotoCard
              label={rightLabel}
              image={rightImage}
              photo={right}
              profile={profile}
              zoom={zoom}
              showOverlay={showOverlay}
              onDelete={right?.id && !right.id.startsWith('bio-') ? () => handleDelete(right.id) : undefined}
              isGoal={compareMode.includes('goal')}
            />
          )}
        </div>

        {/* Photo Strip / Gallery */}
        {allPhotos.length > 0 && (
          <div className="mt-8">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">Photo History</h3>
            <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-thin scrollbar-thumb-slate-700">
              {allPhotos.map((photo, i) => (
                <button
                  key={photo.id}
                  onClick={() => { setCompareMode('timeline'); setTimelineIndex(i); }}
                  className={`relative shrink-0 w-24 h-32 rounded-xl overflow-hidden border-2 transition-all ${
                    compareMode === 'timeline' && timelineIndex === i
                      ? 'border-[#00AEEF] ring-2 ring-[#00AEEF]/20'
                      : 'border-slate-700 hover:border-slate-500'
                  }`}
                >
                  {photo.front ? (
                    <img src={photo.front} alt={`Progress ${i + 1}`} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                      <Camera className="w-6 h-6 text-slate-600" />
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-1">
                    <p className="text-[10px] text-white font-medium">{formatDate(photo.date)}</p>
                    {photo.weight && <p className="text-[9px] text-slate-300">{photo.weight}kg</p>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {allPhotos.length === 0 && (
          <div className="text-center py-20">
            <Camera className="w-16 h-16 text-slate-700 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">No Progress Photos Yet</h3>
            <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto">
              Take front, side, and back photos in consistent lighting to track your transformation over time.
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-3 rounded-xl bg-[#00AEEF] hover:bg-[#0098D1] text-[#0B1120] font-bold text-sm transition-colors"
            >
              Upload First Photo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Photo Card Component ──────────────────────────────── */

function PhotoCard({
  label,
  image,
  photo,
  profile,
  zoom,
  showOverlay,
  onDelete,
  isGoal,
}: {
  label: string;
  image?: string;
  photo: ProgressPhoto | null;
  profile: { goalWeight?: number; weight?: number } | null;
  zoom: number;
  showOverlay: boolean;
  onDelete?: () => void;
  isGoal?: boolean;
}) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
      {/* Label Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-md bg-[#00AEEF]/15 text-[#00AEEF] text-[10px] font-bold uppercase">
            {label}
          </span>
          {photo?.date && <span className="text-xs text-slate-400">{formatDate(photo.date)}</span>}
        </div>
        <div className="flex items-center gap-2">
          {photo?.weight && <span className="text-xs text-slate-400">{photo.weight}kg</span>}
          {onDelete && (
            <button onClick={onDelete} className="p-1 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Image */}
      <div className="relative aspect-[3/4] bg-slate-950 overflow-hidden">
        {image ? (
          <img
            src={image}
            alt={label}
            className="w-full h-full object-contain transition-transform duration-200"
            style={{ transform: `scale(${zoom})` }}
          />
        ) : isGoal ? (
          <div className="w-full h-full flex flex-col items-center justify-center">
            <Target className="w-16 h-16 text-slate-700 mb-3" />
            <p className="text-sm text-slate-500 mb-1">Goal Visualization</p>
            <p className="text-xs text-slate-600">
              {profile?.goalWeight ? `Target: ${profile.goalWeight}kg` : 'Set your goal weight in onboarding'}
            </p>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center">
            <Camera className="w-16 h-16 text-slate-700 mb-3" />
            <p className="text-sm text-slate-500">No photo available</p>
          </div>
        )}

        {/* Body Overlay Lines */}
        {showOverlay && image && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
            {/* Shoulder line */}
            <line x1="20" y1="15" x2="80" y2="15" stroke="#00AEEF" strokeWidth="0.3" strokeDasharray="2 2" opacity="0.5" />
            {/* Chest line */}
            <line x1="25" y1="25" x2="75" y2="25" stroke="#00AEEF" strokeWidth="0.3" strokeDasharray="2 2" opacity="0.5" />
            {/* Waist line */}
            <line x1="30" y1="45" x2="70" y2="45" stroke="#00AEEF" strokeWidth="0.3" strokeDasharray="2 2" opacity="0.5" />
            {/* Hip line */}
            <line x1="28" y1="55" x2="72" y2="55" stroke="#00AEEF" strokeWidth="0.3" strokeDasharray="2 2" opacity="0.5" />
            {/* Knee line */}
            <line x1="35" y1="75" x2="65" y2="75" stroke="#00AEEF" strokeWidth="0.3" strokeDasharray="2 2" opacity="0.5" />
            {/* Center vertical */}
            <line x1="50" y1="5" x2="50" y2="95" stroke="#00AEEF" strokeWidth="0.2" strokeDasharray="1 1" opacity="0.3" />
          </svg>
        )}
      </div>

      {/* Stats Footer */}
      {photo && (
        <div className="px-4 py-3 border-t border-slate-800 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-[10px] text-slate-500 uppercase">Weight</p>
            <p className="text-sm font-bold text-white">{photo.weight || '-'}kg</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase">Body Fat</p>
            <p className="text-sm font-bold text-white">{photo.bodyFatPercentage ? `${photo.bodyFatPercentage}%` : '-'}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase">Change</p>
            <p className="text-sm font-bold text-emerald-400">
              {profile?.weight && photo.weight ? `${(photo.weight - profile.weight).toFixed(1)}kg` : '-'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Helpers ───────────────────────────────────────────── */

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
