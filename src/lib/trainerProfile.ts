// ═══════════════════════════════════════════════════════════════
// trainerProfile (Phase 90b) — trainer public identity document.
//
// Canonical shape lives in profiles.trainer_profile JSONB (see
// supabase/trainer-profile-90b.sql). The whole document is read and
// written as one value; parseTrainerProfile is the single validation
// gate — it NEVER throws and always returns either null (column is
// NULL / not an object) or a fully-defaulted valid TrainerProfile.
//
// HONEST DATA: every nullable field normalizes empty strings to null
// so renderers can treat "absent" uniformly (omit the section/line).
// ═══════════════════════════════════════════════════════════════

import type { Json } from "@/types/supabase";

export const PHOTO_VARIANTS = ["photo", "blur", "initials", "stock"] as const;
export type PhotoVariant = (typeof PHOTO_VARIANTS)[number];

export interface TrainerQualification {
  name: string | null;
  issuer: string | null;
  year: number | null;
}

export interface TrainerPhilosophy {
  approach: string | null;
  mission: string | null;
  values: string | null;
}

export interface TrainerContact {
  whatsapp: string | null;
  email: string | null;
  instagram: string | null;
  website: string | null;
}

export interface TrainerGalleryEntry {
  path: string;
  caption: string | null;
}

export interface TrainerProfile {
  display_name: string;
  title: string;
  years_experience: number | null;
  qualifications: TrainerQualification[];
  specialties: string[];
  languages: string[];
  affiliations: string[];
  philosophy: TrainerPhilosophy;
  contact: TrainerContact;
  photo_path: string | null;
  photo_variant: PhotoVariant;
  background_path: string | null;
  gallery: TrainerGalleryEntry[];
}

export function defaultTrainerProfile(): TrainerProfile {
  return {
    display_name: "",
    title: "",
    years_experience: null,
    qualifications: [],
    specialties: [],
    languages: [],
    affiliations: [],
    philosophy: { approach: null, mission: null, values: null },
    contact: { whatsapp: null, email: null, instagram: null, website: null },
    photo_path: null,
    photo_variant: "initials",
    background_path: null,
    gallery: [],
  };
}

/* ── Sanitizer primitives (never throw) ────────────────────────── */

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v : null;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.round(v)) : null;
}

function strArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const entry of v) {
    if (typeof entry !== "string") continue;
    const t = entry.trim();
    if (t === "" || out.includes(t)) continue;
    out.push(t);
  }
  return out;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Validate raw JSONB into a clean TrainerProfile.
 * null / non-object input → null (the "never set up" signal).
 * Any object → fully-defaulted profile; malformed entries are dropped
 * or coerced, unknown photo_variant → 'initials'.
 */
export function parseTrainerProfile(raw: Json | null): TrainerProfile | null {
  if (raw === null || raw === undefined) return null;
  if (!isRecord(raw)) return null;
  const p = defaultTrainerProfile();

  p.display_name = str(raw.display_name) ?? "";
  p.title = str(raw.title) ?? "";
  p.years_experience = num(raw.years_experience);

  if (Array.isArray(raw.qualifications)) {
    for (const q of raw.qualifications) {
      if (!isRecord(q)) continue;
      const entry: TrainerQualification = { name: str(q.name), issuer: str(q.issuer), year: num(q.year) };
      if (entry.name === null && entry.issuer === null && entry.year === null) continue;
      p.qualifications.push(entry);
    }
  }

  p.specialties = strArray(raw.specialties);
  p.languages = strArray(raw.languages);
  p.affiliations = strArray(raw.affiliations);

  if (isRecord(raw.philosophy)) {
    p.philosophy = {
      approach: str(raw.philosophy.approach),
      mission: str(raw.philosophy.mission),
      values: str(raw.philosophy.values),
    };
  }

  if (isRecord(raw.contact)) {
    p.contact = {
      whatsapp: str(raw.contact.whatsapp),
      email: str(raw.contact.email),
      instagram: str(raw.contact.instagram),
      website: str(raw.contact.website),
    };
  }

  p.photo_path = str(raw.photo_path);
  p.photo_variant = (PHOTO_VARIANTS as readonly string[]).includes(raw.photo_variant as string)
    ? (raw.photo_variant as PhotoVariant)
    : "initials";
  p.background_path = str(raw.background_path);

  if (Array.isArray(raw.gallery)) {
    for (const g of raw.gallery) {
      if (!isRecord(g)) continue;
      const path = str(g.path);
      if (path === null) continue;
      p.gallery.push({ path, caption: str(g.caption) });
    }
  }

  return p;
}

/** TRUE only when display_name AND title (trimmed) are non-empty. */
export function isProfileSetUp(p: TrainerProfile | null): boolean {
  if (p === null) return false;
  return p.display_name.trim() !== "" && p.title.trim() !== "";
}

/** Up to 2 uppercase letters from the first two words ("Alex Zhang Wei" → "AZ"). */
export function deriveInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  return words
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/** digits-only wa.me link, or null when no digits exist. */
export function waMeLink(whatsapp: string): string | null {
  const digits = whatsapp.replace(/\D/g, "");
  return digits === "" ? null : `https://wa.me/${digits}`;
}

/**
 * Contact target for the public QR code. Documented precedence:
 *   1. whatsapp (non-empty → https://wa.me/<digits-only>; formatting
 *      chars stripped, and if no digits remain we fall through)
 *   2. email (non-empty → mailto:<email>)
 *   3. website (non-empty → as-is)
 *   4. null (no QR rendered)
 */
export function qrContactTarget(contact: TrainerContact): string | null {
  if (contact.whatsapp?.trim()) {
    const wa = waMeLink(contact.whatsapp);
    if (wa !== null) return wa;
  }
  if (contact.email?.trim()) return `mailto:${contact.email.trim()}`;
  if (contact.website?.trim()) return contact.website.trim();
  return null;
}
