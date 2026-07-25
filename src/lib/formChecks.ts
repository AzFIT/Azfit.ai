// ═══════════════════════════════════════════════════════════════════════
// Form-check videos — storage + form_checks helpers
// Review fields (feedback/positives/improvements/timestamp_notes) are shared
// with the client once saved — no trainer-private fields here.
// ═══════════════════════════════════════════════════════════════════════

import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/supabase";

const BUCKET = "form-checks";
const SIGNED_URL_TTL = 3600;
const MAX_SIZE = 45 * 1024 * 1024; // 45MB (Supabase free plan limit is 50MB)

type FormCheckRow = Database["public"]["Tables"]["form_checks"]["Row"];

export interface TimestampNote {
  time_sec: number;
  note: string;
}

export interface FormCheck {
  id: string;
  ownerId: string;
  path: string;
  url: string | null;
  exerciseName: string;
  status: "pending" | "reviewed";
  feedback: string | null;
  positives: string | null;
  improvements: string | null;
  timestampNotes: TimestampNote[];
  createdAt: string;
  reviewedAt: string | null;
  ownerName?: string;
  ownerEmail?: string;
}

function rowToFormCheck(row: FormCheckRow, url: string | null): FormCheck {
  return {
    id: row.id,
    ownerId: row.owner_id,
    path: row.storage_path,
    url,
    exerciseName: row.exercise_name,
    status: row.status,
    feedback: row.feedback,
    positives: row.positives,
    improvements: row.improvements,
    timestampNotes: Array.isArray(row.timestamp_notes) ? (row.timestamp_notes as unknown as TimestampNote[]) : [],
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
  };
}

async function signUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function uploadFormCheckVideo(
  file: File,
  userId: string,
  exerciseName: string
): Promise<void> {
  if (!file.type.startsWith("video/")) throw new Error("Please select a video file");
  if (file.size > MAX_SIZE) throw new Error("Video must be under 45MB (keep clips under ~60 seconds)");
  if (!exerciseName.trim()) throw new Error("Exercise name is required");

  const path = `${userId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file);
  if (upErr) throw new Error(upErr.message);

  const { error: insErr } = await supabase.from("form_checks").insert({
    owner_id: userId,
    storage_path: path,
    exercise_name: exerciseName.trim(),
    status: "pending",
  });
  if (insErr) throw new Error(insErr.message);
}

export async function getMyFormChecks(userId: string): Promise<FormCheck[]> {
  const { data, error } = await supabase
    .from("form_checks")
    .select("*")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data as FormCheckRow[]) || [];
  const out: FormCheck[] = [];
  for (const row of rows) {
    out.push(rowToFormCheck(row, await signUrl(row.storage_path)));
  }
  return out;
}

export async function getClientFormChecks(ownerId: string): Promise<FormCheck[]> {
  const { data, error } = await supabase
    .from("form_checks")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data as FormCheckRow[]) || [];
  const out: FormCheck[] = [];
  for (const row of rows) {
    out.push(rowToFormCheck(row, await signUrl(row.storage_path)));
  }
  return out;
}

export interface PendingReviewItem {
  id: string;
  exerciseName: string;
  createdAt: string;
  ownerId: string;
  ownerEmail: string;
  ownerName: string;
}

/** Pending reviews across all of the trainer's clients. */
export async function getPendingReviews(): Promise<PendingReviewItem[]> {
  const { data, error } = await supabase
    .from("form_checks")
    .select("id, exercise_name, created_at, owner_id, profiles:owner_id(email, full_name)")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  type Row = {
    id: string;
    exercise_name: string;
    created_at: string;
    owner_id: string;
    profiles: { email: string; full_name: string | null } | { email: string; full_name: string | null }[] | null;
  };
  return ((data as unknown as Row[]) || []).map((r) => {
    const prof = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    return {
      id: r.id,
      exerciseName: r.exercise_name,
      createdAt: r.created_at,
      ownerId: r.owner_id,
      ownerEmail: prof?.email || "",
      ownerName: prof?.full_name || prof?.email || "Client",
    };
  });
}

export interface ReviewInput {
  feedback: string;
  positives: string;
  improvements: string;
  timestampNotes: TimestampNote[];
}

export async function saveReview(id: string, review: ReviewInput): Promise<void> {
  const { error } = await supabase
    .from("form_checks")
    .update({
      feedback: review.feedback || null,
      positives: review.positives || null,
      improvements: review.improvements || null,
      timestamp_notes: review.timestampNotes as unknown as Database["public"]["Tables"]["form_checks"]["Update"]["timestamp_notes"],
      status: "reviewed",
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteFormCheck(item: FormCheck): Promise<void> {
  await supabase.storage.from(BUCKET).remove([item.path]);
  const { error } = await supabase.from("form_checks").delete().eq("id", item.id);
  if (error) throw new Error(error.message);
}
