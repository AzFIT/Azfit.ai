import { useEffect, useState, useCallback } from "react";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  getPhotos,
  deletePhoto,
  updateTrainerNotes,
  setMilestone,
  type ProgressPhoto,
} from "@/lib/photoMetadata";
import PhotoGallery from "@/components/photos/PhotoGallery";

interface ClientPhotosTabProps {
  clientEmail: string;
}

/** Trainer view of a client's progress photos: gallery + annotate + milestones. */
export default function ClientPhotosTab({ clientEmail }: ClientPhotosTabProps) {
  const [profileId, setProfileId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [loading, setLoading] = useState(true);

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
        .eq("email", clientEmail)
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
  );
}
