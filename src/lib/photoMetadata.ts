// ═══════════════════════════════════════════════════════════════════════
// Progress photos — storage + photo_metadata helpers
// Owner queries the photo_metadata_owner view (trainer_notes hidden);
// trainers query the photo_metadata table (trainer_notes visible).
// ═══════════════════════════════════════════════════════════════════════

import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/supabase";

export type PhotoCategory = "Front" | "Back" | "Side" | "Other";
export const PHOTO_CATEGORIES: PhotoCategory[] = ["Front", "Back", "Side", "Other"];

const BUCKET = "progress-photos";
const SIGNED_URL_TTL = 3600;
const MAX_SIZE = 10 * 1024 * 1024;

type MetadataRow = Database["public"]["Tables"]["photo_metadata"]["Row"];
type OwnerRow = Database["public"]["Views"]["photo_metadata_owner"]["Row"];

export interface ProgressPhoto {
  id: string;
  path: string;
  url: string;
  category: PhotoCategory;
  takenOn: string | null;
  weightKg: number | null;
  bodyFatPct: number | null;
  notes: string | null;
  trainerNotes?: string | null; // only present for trainers
  isMilestone: boolean;
  createdAt: string;
}

export interface UploadMeta {
  category: PhotoCategory;
  takenOn: string;
  weightKg?: number | null;
  bodyFatPct?: number | null;
  notes?: string | null;
}

function rowToPhoto(
  row: OwnerRow | MetadataRow,
  url: string,
  trainerNotes?: string | null
): ProgressPhoto {
  return {
    id: row.id,
    path: row.storage_path,
    url,
    category: (row.category as PhotoCategory) || "Other",
    takenOn: row.taken_on,
    weightKg: row.weight_kg,
    bodyFatPct: row.body_fat_pct,
    notes: row.notes,
    trainerNotes: trainerNotes ?? undefined,
    isMilestone: row.is_milestone ?? false,
    createdAt: row.created_at,
  };
}

async function signUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/** Upload a file to storage and insert its metadata row. */
export async function uploadPhoto(
  file: File,
  userId: string,
  meta: UploadMeta
): Promise<void> {
  if (!file.type.startsWith("image/")) throw new Error("Please select an image file");
  if (file.size > MAX_SIZE) throw new Error("File must be under 10MB");

  const path = `${userId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file);
  if (upErr) throw new Error(upErr.message);

  const { error: metaErr } = await supabase.from("photo_metadata").insert({
    storage_path: path,
    owner_id: userId,
    category: meta.category,
    taken_on: meta.takenOn || null,
    weight_kg: meta.weightKg ?? null,
    body_fat_pct: meta.bodyFatPct ?? null,
    notes: meta.notes || null,
  });
  if (metaErr) throw new Error(metaErr.message);
}

/** List photos. Owner (self) uses the view; trainer passes forTrainer + ownerId. */
export async function getPhotos(opts: {
  ownerId: string;
  forTrainer?: boolean;
}): Promise<ProgressPhoto[]> {
  const { ownerId, forTrainer } = opts;

  if (forTrainer) {
    const { data, error } = await supabase
      .from("photo_metadata")
      .select("*")
      .eq("owner_id", ownerId)
      .order("taken_on", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = (data as MetadataRow[]) || [];

    // Trainer-private notes live in photo_trainer_notes (trainer-only table)
    const photoIds = rows.map((r) => r.id);
    const notesByPhotoId = new Map<string, string>();
    if (photoIds.length > 0) {
      const { data: noteRows } = await supabase
        .from("photo_trainer_notes")
        .select("photo_id, notes")
        .in("photo_id", photoIds);
      for (const n of (noteRows as { photo_id: string; notes: string }[]) || []) {
        notesByPhotoId.set(n.photo_id, n.notes);
      }
    }

    const out: ProgressPhoto[] = [];
    for (const row of rows) {
      const url = await signUrl(row.storage_path);
      if (url) out.push(rowToPhoto(row, url, notesByPhotoId.get(row.id) ?? null));
    }
    return out;
  }

  const { data, error } = await supabase
    .from("photo_metadata_owner")
    .select("*")
    .eq("owner_id", ownerId)
    .order("taken_on", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data as OwnerRow[]) || [];
  const out: ProgressPhoto[] = [];
  for (const row of rows) {
    const url = await signUrl(row.storage_path);
    if (url) out.push(rowToPhoto(row, url, null));
  }
  return out;
}

export async function deletePhoto(photo: ProgressPhoto): Promise<void> {
  await supabase.storage.from(BUCKET).remove([photo.path]);
  const { error } = await supabase.from("photo_metadata").delete().eq("id", photo.id);
  if (error) throw new Error(error.message);
}

/** Owner updates their own note. */
export async function updateNote(id: string, notes: string): Promise<void> {
  const { error } = await supabase.from("photo_metadata").update({ notes }).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Trainer upserts a private note on a client's photo (trainer-only table). */
export async function updateTrainerNotes(photoId: string, trainerNotes: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const trainerId = userData.user?.id;
  if (!trainerId) throw new Error("Not authenticated");
  const { error } = await supabase.from("photo_trainer_notes").upsert(
    { photo_id: photoId, trainer_id: trainerId, notes: trainerNotes },
    { onConflict: "photo_id" }
  );
  if (error) throw new Error(error.message);
}

/** Trainer toggles the milestone flag. */
export async function setMilestone(id: string, isMilestone: boolean): Promise<void> {
  const { error } = await supabase.from("photo_metadata").update({ is_milestone: isMilestone }).eq("id", id);
  if (error) throw new Error(error.message);
}
