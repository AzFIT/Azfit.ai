import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import {
  ArrowLeft, Camera, Upload, Trash2, X, Check, ZoomIn, ZoomOut, RotateCcw, SplitSquareHorizontal,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { withRetry } from '@/lib/supabase';

/* ── Types ─────────────────────────────────────────────── */

interface ProgressPhoto {
  path: string;
  name: string;
  createdAt: string;
  url: string;
}

/* ── Constants ─────────────────────────────────────────── */

const BUCKET = 'progress-photos';
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const SIGNED_URL_TTL = 3600; // 1 hour

/* ── Main Component ────────────────────────────────────── */

export default function ProgressPhotosPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [compareMode, setCompareMode] = useState(false);
  const [zoom, setZoom] = useState(1);

  const listPhotos = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .list(user.id, { sortBy: { column: 'created_at', order: 'desc' } });

      if (error) throw error;

      const files = (data || []).filter((f) => f.name && f.id);
      const photosWithUrls: ProgressPhoto[] = [];

      for (const file of files) {
        const path = `${user.id}/${file.name}`;
        const { data: signedData, error: signedError } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(path, SIGNED_URL_TTL);

        if (signedError || !signedData?.signedUrl) continue;

        photosWithUrls.push({
          path,
          name: file.name,
          createdAt: file.created_at || new Date().toISOString(),
          url: signedData.signedUrl,
        });
      }

      setPhotos(photosWithUrls);
    } catch (err) {
      toast.error('Failed to load photos: ' + (err instanceof Error ? err.message : 'Unknown error'));
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    listPhotos();
  }, [listPhotos]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error('File must be under 10MB');
      return;
    }

    setUploading(true);
    const path = `${user.id}/${Date.now()}-${file.name}`;

    try {
      const { error } = await withRetry(
        () => supabase.storage.from(BUCKET).upload(path, file),
        2,
        500
      );
      if (error) {
        toast.error('Upload failed: ' + error.message);
        return;
      }
      toast.success('Photo uploaded');
      await listPhotos();
    } catch (err) {
      toast.error('Upload failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (path: string) => {
    try {
      const { error } = await withRetry(
        () => supabase.storage.from(BUCKET).remove([path]),
        2,
        500
      );
      if (error) {
        toast.error('Delete failed: ' + error.message);
        return;
      }
      toast.success('Photo deleted');
      setSelectedPaths((prev) => {
        const next = new Set(prev);
        next.delete(path);
        return next;
      });
      await listPhotos();
    } catch (err) {
      toast.error('Delete failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const toggleSelect = (path: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else if (next.size < 2) {
        next.add(path);
      } else {
        toast.info('Select up to 2 photos to compare');
      }
      return next;
    });
  };

  const selectedPhotos = photos.filter((p) => selectedPaths.has(p.path));
  const canCompare = selectedPaths.size === 2;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </button>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <Camera className="w-5 h-5 text-[#00AEEF]" />
              Progress Photos
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setCompareMode((m) => !m);
                if (compareMode) setSelectedPaths(new Set());
              }}
              className={`hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                compareMode
                  ? 'bg-[#00AEEF] text-[#0B1120]'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <SplitSquareHorizontal className="w-3.5 h-3.5" />
              {compareMode ? 'Exit Compare' : 'Compare'}
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#00AEEF] hover:bg-[#0098D1] disabled:opacity-60 text-[#0B1120] text-xs font-bold transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              {uploading ? 'Uploading...' : 'Add Photo'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Compare hint / selection bar */}
        {compareMode && (
          <div className="mb-4 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3">
            <p className="text-sm text-slate-300">
              Select exactly 2 photos to compare side-by-side. ({selectedPaths.size}/2 selected)
            </p>
            {selectedPaths.size > 0 && (
              <button
                onClick={() => setSelectedPaths(new Set())}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" /> Clear
              </button>
            )}
          </div>
        )}

        {/* Compare View */}
        {compareMode && canCompare ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {selectedPhotos.map((photo, idx) => (
              <div
                key={photo.path}
                className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
                  <span className="px-2 py-0.5 rounded-md bg-[#00AEEF]/15 text-[#00AEEF] text-[10px] font-bold uppercase">
                    {idx === 0 ? 'Before' : 'After'}
                  </span>
                  <span className="text-xs text-slate-400">{formatDate(photo.createdAt)}</span>
                </div>
                <div className="relative aspect-[3/4] bg-slate-950 overflow-hidden">
                  <img
                    src={photo.url}
                    alt={`Compare ${idx + 1}`}
                    className="w-full h-full object-contain transition-transform duration-200"
                    style={{ transform: `scale(${zoom})` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Grid View */
          <>
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="aspect-[3/4] rounded-2xl bg-slate-900/50 border border-slate-800 animate-pulse"
                  />
                ))}
              </div>
            ) : photos.length === 0 ? (
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
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {photos.map((photo) => {
                  const isSelected = selectedPaths.has(photo.path);
                  return (
                    <div
                      key={photo.path}
                      className={`group relative aspect-[3/4] rounded-2xl overflow-hidden border-2 transition-all ${
                        isSelected
                          ? 'border-[#00AEEF] ring-2 ring-[#00AEEF]/20'
                          : 'border-slate-800 hover:border-slate-500'
                      }`}
                    >
                      <img
                        src={photo.url}
                        alt={photo.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                      {/* Select checkbox */}
                      {compareMode && (
                        <button
                          onClick={() => toggleSelect(photo.path)}
                          className={`absolute top-2 left-2 w-6 h-6 rounded-md flex items-center justify-center border transition-colors ${
                            isSelected
                              ? 'bg-[#00AEEF] border-[#00AEEF] text-[#0B1120]'
                              : 'bg-black/40 border-white/40 text-white hover:bg-black/60'
                          }`}
                          aria-label={isSelected ? 'Deselect photo' : 'Select photo'}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </button>
                      )}

                      {/* Delete */}
                      <button
                        onClick={() => handleDelete(photo.path)}
                        className="absolute top-2 right-2 p-1.5 rounded-md bg-black/40 border border-white/20 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/20 hover:text-red-400"
                        aria-label="Delete photo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Date overlay */}
                      <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-xs text-white font-medium">{formatDate(photo.createdAt)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Zoom controls (only useful in compare mode) */}
        {compareMode && canCompare && (
          <div className="fixed bottom-6 right-6 flex items-center gap-1 bg-slate-800/90 backdrop-blur rounded-lg p-1 border border-slate-700">
            <button
              onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
              className="p-2 rounded hover:bg-slate-700 text-slate-400"
              aria-label="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs text-slate-400 w-12 text-center">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom((z) => Math.min(2, z + 0.25))}
              className="p-2 rounded hover:bg-slate-700 text-slate-400"
              aria-label="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoom(1)}
              className="p-2 rounded hover:bg-slate-700 text-slate-400"
              aria-label="Reset zoom"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Helpers ───────────────────────────────────────────── */

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
