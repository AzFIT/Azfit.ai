import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ArrowLeft, Camera, Upload, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import {
  uploadPhoto,
  getPhotos,
  deletePhoto,
  updateNote,
  PHOTO_CATEGORIES,
  type ProgressPhoto,
  type PhotoCategory,
} from '@/lib/photoMetadata';
import PhotoGallery from '@/components/photos/PhotoGallery';

export default function ProgressPhotosPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Upload form state
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<PhotoCategory>('Front');
  const [takenOn, setTakenOn] = useState(new Date().toISOString().split('T')[0]);
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [notes, setNotes] = useState('');

  const refetch = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      setPhotos(await getPhotos({ ownerId: user.id }));
    } catch (err) {
      toast.error('Failed to load photos: ' + (err instanceof Error ? err.message : 'Unknown error'));
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const handleUpload = async () => {
    if (!user || !file) {
      toast.error('Choose a photo first');
      return;
    }
    setUploading(true);
    try {
      await uploadPhoto(file, user.id, {
        category,
        takenOn,
        weightKg: weight ? Number(weight) : null,
        bodyFatPct: bodyFat ? Number(bodyFat) : null,
        notes: notes || null,
      });
      toast.success('Photo uploaded');
      setShowUpload(false);
      setFile(null);
      setNotes('');
      setWeight('');
      setBodyFat('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await refetch();
    } catch (err) {
      toast.error('Upload failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (photo: ProgressPhoto) => {
    try {
      await deletePhoto(photo);
      toast.success('Photo deleted');
      await refetch();
    } catch (err) {
      toast.error('Delete failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="rounded-lg p-2 transition-colors hover:bg-slate-800"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="h-5 w-5 text-slate-400" />
            </button>
            <h1 className="flex items-center gap-2 text-lg font-bold text-white">
              <Camera className="h-5 w-5 text-[#00AEEF]" />
              Progress Photos
            </h1>
          </div>
          <button
            onClick={() => setShowUpload((s) => !s)}
            className="flex items-center gap-1.5 rounded-lg bg-[#00AEEF] px-3 py-2 text-xs font-bold text-[#0B1120] transition-colors hover:bg-[#0098D1]"
          >
            <Upload className="h-3.5 w-3.5" />
            Add Photo
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Upload form */}
        {showUpload && (
          <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Add a progress photo</h3>
              <button onClick={() => setShowUpload(false)} className="rounded-lg p-1 hover:bg-slate-800">
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="sm:col-span-2 lg:col-span-1">
                <label className="mb-1 block text-[11px] text-slate-400">Photo *</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-300 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-xs file:text-slate-200"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">Category *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as PhotoCategory)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-white"
                >
                  {PHOTO_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">Taken on</label>
                <input
                  type="date"
                  value={takenOn}
                  onChange={(e) => setTakenOn(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">Weight (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">Body fat (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={bodyFat}
                  onChange={(e) => setBodyFat(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-white"
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-1">
                <label className="mb-1 block text-[11px] text-slate-400">Note</label>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-white"
                />
              </div>
            </div>
            <button
              onClick={handleUpload}
              disabled={uploading || !file}
              className="mt-4 rounded-lg bg-[#00AEEF] px-4 py-2 text-xs font-bold text-[#0B1120] transition-colors hover:bg-[#0098D1] disabled:opacity-50"
            >
              {uploading ? 'Uploading…' : 'Upload photo'}
            </button>
          </div>
        )}

        <PhotoGallery
          photos={photos}
          loading={loading}
          onDelete={handleDelete}
          onUpdateNote={async (id, n) => { await updateNote(id, n); await refetch(); }}
        />
      </div>
    </div>
  );
}
