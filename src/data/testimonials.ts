/**
 * LANDING-A1 — landing-page testimonial data.
 *
 * REPLACE WITH REAL CLIENT TESTIMONIALS — written consent required before
 * setting SHOW_TESTIMONIALS to true. Every quote must come from an actual
 * AzFIT client who has given explicit written permission to publish their
 * name and words. Never invent or paraphrase a testimonial.
 *
 * While SHOW_TESTIMONIALS is false, the landing page renders one honest
 * "stories coming soon" panel instead of the marquee — no fabricated
 * quotes ever ship to live.
 */
export const SHOW_TESTIMONIALS = false;

export interface Testimonial {
  name: string;
  role: string;
  quote: string;
}

/**
 * Empty until consented real testimonials are supplied. Do NOT seed with
 * placeholder or synthetic quotes for demos/screenshots — the marquee
 * engine can be verified locally without committing fake data.
 */
export const TESTIMONIALS: Testimonial[] = [];
