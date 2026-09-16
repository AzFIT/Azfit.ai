-- Phase 99a — client invitation: stamp when the trainer invited the client.
-- Additive, nullable, no default (NULL = never invited — honest empty state).
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ;
