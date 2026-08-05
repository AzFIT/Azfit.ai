-- Phase 48 — methods.defaults jsonb (additive, nullable, no default).
-- Holds Poliquin prescription defaults per method (goalTag, intensityColor,
-- setsReps, loadPct, rest, tempo, notation, notes, durationWeeks,
-- frequencyPerWeek, idealFor, contraindications, periodizationPairings,
-- preferredCategories). RLS untouched (methods is authenticated-readable).

alter table public.methods add column if not exists defaults jsonb;
