/**
 * LANDING-A1 — single-row trusted-claims marquee directly under the hero.
 * Shares the LandingMarquee engine with TestimonialMarquee but stays
 * minimal on purpose: no cards, no hover pause, one continuous row.
 *
 * HONEST DATA: the claims below are the verified live numbers (StatsSection
 * shows the same 270+ / 3 / 116+ / 1/5 values, plus the product's home
 * market). Do not add numbers that the app or the business cannot back.
 */
import { Triangle } from "lucide-react";
import { LandingMarquee } from "./LandingMarquee";

const CLAIMS = [
  "270+ Exercise Movements",
  "3 Simple Tiers",
  "116+ Clients Coached",
  "5/5 Built for Coaches",
  "Hong Kong",
] as const;

export default function TrustedStrip() {
  return (
    /* token-driven hairline borders + navy background — no new hex */
    <div
      id="trusted-strip"
      className="border-y py-4"
      style={{
        borderColor: "var(--landing-panel-border)",
        backgroundColor: "var(--landing-navy-from)",
      }}
    >
      <LandingMarquee direction="left" duration={45}>
        {CLAIMS.map((claim) => (
          <span key={claim} className="flex items-center gap-6">
            <span className="text-chrome font-display text-sm font-semibold lg:text-base">
              {claim}
            </span>
            <Triangle
              aria-hidden="true"
              className="h-2 w-2 rotate-90"
              style={{
                color: "var(--landing-cyan)",
                fill: "var(--landing-cyan)",
              }}
            />
          </span>
        ))}
      </LandingMarquee>
    </div>
  );
}
