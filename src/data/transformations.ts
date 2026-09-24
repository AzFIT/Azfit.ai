/**
 * LANDING-A2 — landing-page transformation data.
 *
 * REPLACE WITH REAL CLIENT TRANSFORMATIONS — a signed photo release is
 * required for EVERY before/after pair before setting SHOW_TRANSFORMATIONS
 * to true. The photos must be of actual AzFIT clients who gave explicit
 * written permission to publish their images and names.
 *
 * While SHOW_TRANSFORMATIONS is false, the landing page renders one honest
 * "transformations coming soon" panel instead of the compare slider — no
 * stock, synthetic, or scraped photos ever ship to live.
 */
export const SHOW_TRANSFORMATIONS = false;

export interface Transformation {
  /** First name only (or a pseudonym the client approved). */
  name: string;
  /** Programme length shown in the caption, e.g. "12 weeks". */
  weeks: string;
  beforeSrc: string;
  afterSrc: string;
  beforeAlt: string;
  afterAlt: string;
}

/**
 * Empty until signed-release photos are supplied. Do NOT seed with
 * placeholder or stock imagery for demos/screenshots — the slider engine
 * can be verified locally without committing fake data.
 */
export const TRANSFORMATIONS: Transformation[] = [];
