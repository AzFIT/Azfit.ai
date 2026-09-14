-- ═══════════════════════════════════════════════════════════════════
-- Phase 90b — Trainer public identity layer (additive only)
-- Applied live: 2026-09-14 via pooler (project gcurvjprfwecbchreieu)
--
-- 1) profiles.trainer_profile: one JSONB column holding the whole
--    trainer identity document. Flat columns were rejected: the shape
--    is a nested marketing document (lists of credentials, gallery
--    entries, contact block, philosophy) — 15+ flat columns would be
--    harder to validate and extend, and the data is read/written as a
--    whole. NEVER mix flat columns with this JSONB.
--
--    Shape (validated client-side in src/lib/trainerProfile.ts):
--    {
--      display_name:        string,
--      title:               string,
--      years_experience:    number,
--      qualifications:      [{ name, issuer, year }],
--      specialties:         string[],
--      languages:           string[],
--      affiliations:        string[],
--      philosophy:          { approach, mission, values },
--      contact:             { whatsapp, email, instagram, website },
--      photo_path:          string,           -- storage path {uid}/profile/...
--      photo_variant:       'photo'|'blur'|'initials'|'stock',
--      background_path:     string,           -- decorative band, trainer dashboard only
--      gallery:             [{ path, caption }]
--    }
--
-- 2) Storage: new PUBLIC bucket `trainer-assets`.
--    - SELECT: any authenticated user (clients must see their trainer's
--      marketing profile). The bucket is PUBLIC, so object GETs need no
--      auth; the SELECT policy governs listing, which only affects
--      supabase-js list calls.
--    - INSERT/UPDATE/DELETE: only objects under the caller's own uid
--      folder ('{auth.uid()}/...').
--    All app uploads use '{uid}/profile/...' paths.
--
-- 3) Visibility model (documented choice): trainer_profile is marketing
--    data, not PII. Authenticated users can SELECT profiles (the table
--    SELECT policy already exists from the 27B pattern — profiles are
--    readable by authenticated users; email is already exposed to any
--    logged-in user elsewhere in the app). Writes stay owner-only via
--    the existing profiles UPDATE policy (auth.uid() = id).
--    No new table-level policy is added; write protection is unchanged.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trainer_profile JSONB DEFAULT NULL;

-- ── Storage bucket ────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'trainer-assets',
  'trainer-assets',
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- ── Storage RLS policies (storage.objects is already RLS-enabled) ──

-- Authenticated users may LIST objects in the bucket (clients see
-- their trainer's profile assets via signed/public URLs anyway; this
-- keeps supabase-js list working for the owner and is harmless for
-- others — object names under {uid}/ reveal only uuids + filenames).
DROP POLICY IF EXISTS "trainer-assets: authenticated read" ON storage.objects;
CREATE POLICY "trainer-assets: authenticated read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'trainer-assets');

-- Owners write only inside their own uid folder.
DROP POLICY IF EXISTS "trainer-assets: owner insert" ON storage.objects;
CREATE POLICY "trainer-assets: owner insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'trainer-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "trainer-assets: owner update" ON storage.objects;
CREATE POLICY "trainer-assets: owner update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'trainer-assets' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'trainer-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "trainer-assets: owner delete" ON storage.objects;
CREATE POLICY "trainer-assets: owner delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'trainer-assets' AND (storage.foldername(name))[1] = auth.uid()::text);
