/**
 * LANDING-A1 — landing "Client Stories" section.
 *
 * HONEST-DATA GATE: while SHOW_TESTIMONIALS is false (default) this renders
 * a single honest "stories coming soon" panel — the marquee engine and card
 * markup ship dormant and only activate once real, consented testimonials
 * exist in src/data/testimonials.ts.
 */
import { Quote } from "lucide-react";
import { SHOW_TESTIMONIALS, TESTIMONIALS } from "@/data/testimonials";
import { LandingMarquee } from "./LandingMarquee";

export default function TestimonialMarquee() {
  return (
    <section
      id="client-stories"
      className="relative overflow-hidden px-6 py-16 lg:py-24"
      style={{ backgroundColor: "var(--landing-navy-from)" }}
    >
      <div className="relative z-10 mx-auto max-w-6xl">
        <div className="flex items-center gap-4">
          <p className="section-label text-xs font-semibold">
            03 — Client Stories
          </p>
          <div className="section-divider flex-1" />
        </div>
        <h2 className="font-display mt-4 text-3xl font-semibold text-white lg:text-[40px]">
          Client Stories
        </h2>
      </div>

      {SHOW_TESTIMONIALS && TESTIMONIALS.length > 0 ? (
        <LandingMarquee
          direction="left"
          duration={60}
          pauseOnHover
          className="mt-12"
        >
          {TESTIMONIALS.map((t) => (
            <figure
              key={t.name}
              className="landing-surface relative w-[320px] shrink-0 rounded-2xl p-6 lg:w-[380px]"
            >
              {/* thin top accent line in landing cyan */}
              <span
                aria-hidden="true"
                className="absolute inset-x-6 top-0 h-0.5 rounded-full"
                style={{ background: "var(--landing-cyan)" }}
              />
              <Quote
                aria-hidden="true"
                className="h-6 w-6"
                style={{ color: "var(--landing-cyan)" }}
              />
              <blockquote className="mt-4 text-sm leading-relaxed text-white/80">
                “{t.quote}”
              </blockquote>
              <figcaption className="mt-5">
                <p className="text-chrome font-display text-base font-semibold">
                  {t.name}
                </p>
                <p className="mt-0.5 text-xs text-white/50">{t.role}</p>
              </figcaption>
            </figure>
          ))}
        </LandingMarquee>
      ) : (
        /* Honest empty state — no fabricated quotes, path to the waitlist. */
        <div className="relative z-10 mx-auto mt-12 max-w-6xl">
          <div className="landing-surface rounded-2xl p-8 lg:p-10">
            <p className="max-w-2xl text-sm leading-relaxed text-white/70 lg:text-base">
              Real client stories land here soon — join the waitlist to hear
              them first.
            </p>
            <a
              href="#waitlist"
              className="font-display mt-5 inline-flex h-11 items-center justify-center rounded-full border-2 border-white/40 px-6 text-sm font-semibold text-white transition-all duration-200 hover:border-white/60 hover:bg-white/10"
            >
              Join the Waitlist
            </a>
          </div>
        </div>
      )}
    </section>
  );
}
