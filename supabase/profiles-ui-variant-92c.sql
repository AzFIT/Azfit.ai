-- Phase 92c: per-user opt-in card style ("Pulse Metal").
-- NULL / 'default' = classic rendering (byte-identical); 'metal' = metal variant.
-- RLS: own-row read/write via the existing profiles auth.uid() policies.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ui_variant TEXT DEFAULT NULL;
