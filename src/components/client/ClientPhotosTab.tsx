import { useEffect, useState, useCallback } from "react";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  getPhotos,
  deletePhoto,
  updateTrainerNotes,
  updateTransform,
  setMilestone,
  type ProgressPhoto,
} from "@/lib/photoMetadata";
import PhotoGallery from "@/components/photos/PhotoGallery";
import PhotoCompare from "@/components/photos/PhotoCompare";

type PhotosMode = "gallery" | "compare";

interface ClientPhotosTabProps {
  clientEmail: string;
}

/** Trainer view of a client's progress photos: gallery + annotate + milestones. */
export default function ClientPhotosTab({ clientEmail }: ClientPhotosTabProps) {
  const [profileId, setProfileId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  // Phase 98b: Gallery | Compare segmented toggle
  const [mode, setMode] = useState<PhotosMode>("gallery");

  const refetch = useCallback(
    async (pid: string) => {
      setLoading(true);
      try {
        setPhotos(await getPhotos({ ownerId: pid, forTrainer: true }));
      } catch (err) {
        toast.error("Failed to load photos: " + (err instanceof Error ? err.message : "Unknown error"));
        setPhotos([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: prof } = await supabase
        .from("profiles")
        .select("id")
        .ilike("email", clientEmail)
        .maybeSingle();
      if (cancelled || !prof) {
        if (!cancelled) setLoading(false);
        return;
      }
      setProfileId(prof.id);
      await refetch(prof.id);
    })();
    return () => {
      cancelled = true;
    };
  }, [clientEmail, refetch]);

  if (loading && !profileId) {
    return (
      <div
        className="flex items-center justify-center rounded-2xl border py-12"
        style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
      >
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "var(--azfit-primary)" }} />
      </div>
    );
  }

  if (!profileId) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-2xl border py-12"
        style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
      >
        <Camera size={32} style={{ color: "var(--light-text-muted)" }} />
        <p className="mt-2 text-sm font-medium" style={{ color: "var(--light-text-muted)" }}>
          No linked app account for this client yet
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Phase 98b: Gallery | Compare toggle */}
      <div className="mb-4 inline-flex rounded-xl border p-1" role="group" aria-label="Photos view" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
        {(["gallery", "compare"] as PhotosMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            className={`h-11 rounded-lg px-4 text-xs font-semibold capitalize transition ${
              mode === m ? "bg-[#00AEEF] text-[#0B1120]" : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            {m === "gallery" ? "Gallery" : "Compare"}
          </button>
        ))}
      </div>

      {mode === "gallery" ? (
        <PhotoGallery
          photos={photos}
          loading={loading}
          isTrainer
          onDelete={async (p) => {
            await deletePhoto(p);
            if (profileId) await refetch(profileId);
          }}
          onUpdateTrainerNotes={async (id, notes) => {
            await updateTrainerNotes(id, notes);
            if (profileId) await refetch(profileId);
          }}
          onSetMilestone={async (id, value) => {
            await setMilestone(id, value);
            if (profileId) await refetch(profileId);
          }}
        />
      ) : (
        <PhotoCompare
          photos={photos}
          onTransformSaved={async (id, t) => {
            await updateTransform(id, t);
            setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, transform: t } : p)));
          }}
        />
      )}
    </div>
  );
}
