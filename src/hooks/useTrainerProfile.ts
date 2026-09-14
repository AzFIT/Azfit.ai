// ═══════════════════════════════════════════════════════════════
// useTrainerProfile (Phase 90b) — the signed-in trainer's own
// public identity document (profiles.trainer_profile JSONB) plus
// trainer-assets storage uploads.
//
// HONEST-FAILURE rules:
//  • save() never half-saves: local state is only updated AFTER the
//    write succeeds; on error the previous state stays and the error
//    message is returned so the caller can toast.
//  • uploadImage validates BEFORE touching storage and throws with an
//    honest message; a failed upload never mutates the in-memory
//    profile (callers apply paths only on success).
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Json } from "@/types/supabase";
import {
  parseTrainerProfile,
  isProfileSetUp,
  type TrainerProfile,
} from "@/lib/trainerProfile";

const BUCKET = "trainer-assets";
const MAX_BYTES = 10 * 1024 * 1024; // matches the bucket file_size_limit
const ALLOWED_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export type TrainerImageKind = "profile" | "background" | "gallery";

export interface UploadedAsset {
  path: string;
  url: string;
}

/** Public URL for a trainer-assets storage path. */
export function trainerAssetUrl(path: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Keep only [a-zA-Z0-9._-]; strips path separators and spaces. */
function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "");
  return cleaned === "" ? "image" : cleaned;
}

// Module-level cache keyed by user id — re-mounts (route changes
// re-render the shell) render instantly without a fetch flicker,
// mirroring useTrainerNav. A cached null means "fetched, not set up".
const cache = new Map<string, TrainerProfile | null>();

export function clearTrainerProfileCacheForTests() {
  cache.clear();
}

export function useTrainerProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<TrainerProfile | null>(() =>
    userId ? (cache.get(userId) ?? null) : null,
  );
  const [loading, setLoading] = useState(() => (userId ? !cache.has(userId) : false));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Cache hit (or no user): state was seeded by the lazy initializers —
    // nothing to do (no synchronous setState here).
    if (!userId || cache.has(userId)) return;
    let cancelled = false;
    (async () => {
      const { data, error: err } = await supabase
        .from("profiles")
        .select("trainer_profile")
        .eq("id", userId)
        .single();
      if (cancelled) return;
      if (err) {
        setError(err.message);
        cache.set(userId, null);
        setProfile(null);
      } else {
        const parsed = parseTrainerProfile(data?.trainer_profile ?? null);
        cache.set(userId, parsed);
        setProfile(parsed);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  /**
   * Persist the whole document. On failure the local profile is left
   * untouched (implicit revert) and the error message is returned.
   * Returns null on success.
   */
  const save = useCallback(
    async (next: TrainerProfile): Promise<string | null> => {
      if (!userId) return "Not signed in";
      const { error: err } = await supabase
        .from("profiles")
        .update({ trainer_profile: next as unknown as Json })
        .eq("id", userId);
      if (err) return err.message;
      cache.set(userId, next);
      setProfile(next);
      return null;
    },
    [userId],
  );

  const uploadImage = useCallback(
    async (file: File, kind: TrainerImageKind): Promise<UploadedAsset> => {
      if (!userId) throw new Error("Not signed in");
      if (!ALLOWED_MIMES.has(file.type)) {
        throw new Error("Only JPEG, PNG, WebP or GIF images are allowed");
      }
      if (file.size > MAX_BYTES) {
        throw new Error("Image is larger than 10 MB");
      }
      const path = `${userId}/profile/${kind}-${Date.now()}-${sanitizeFilename(file.name)}`;
      const { error: err } = await supabase.storage.from(BUCKET).upload(path, file);
      if (err) throw new Error(err.message);
      return { path, url: trainerAssetUrl(path) };
    },
    [userId],
  );

  const removeImage = useCallback(async (path: string): Promise<void> => {
    const { error: err } = await supabase.storage.from(BUCKET).remove([path]);
    if (err) throw new Error(err.message);
  }, []);

  // Signed out: never leak a previously cached profile.
  if (!userId) {
    return { profile: null, setUp: false, loading: false, error, save, uploadImage, removeImage };
  }

  const setUp = profile !== null && isProfileSetUp(profile);

  return { profile, setUp, loading, error, save, uploadImage, removeImage };
}
