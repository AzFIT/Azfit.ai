-- Phase 51 — meal_plans.grocery_state jsonb (additive, nullable).
-- Shape: { "checked": ["<foodKey>", ...], "multiplier": 1|2|4, "days": number|null }
-- Shared state: it belongs to the plan (trainer + owning client both write
-- via the existing meal_plans policies — verified by REST proofs).

alter table public.meal_plans add column if not exists grocery_state jsonb;
