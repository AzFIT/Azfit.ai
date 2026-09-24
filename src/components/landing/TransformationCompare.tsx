/**
 * LANDING-A2 — landing "Transformations" section.
 *
 * HONEST-DATA GATE: while SHOW_TRANSFORMATIONS is false (default) this
 * renders a single honest "transformations coming soon" panel — the
 * compare engine ships dormant and only activates once real, signed-release
 * before/after photos exist in src/data/transformations.ts.
 */
import { SHOW_TRANSFORMATIONS, TRANSFORMATIONS } from "@/data/transformations";
import CompareSlider from "./CompareSlider";

export default function TransformationCompare() {
  const featured = SHOW_TRANSFORMATIONS ? TRANSFORMATIONS[0] : undefined;

  return (
    <section
      id="transformations"
      className="relative overflow-hidden px-6 py-16 lg:py-24"
      style={{ backgroundColor: "var(--landing-navy-from)" }}
    >
      <div className="relative z-10 mx-auto max-w-6xl">
        <div className="flex items-center gap-4">
          <p className="section-label text-xs font-semibold">
            03 — Transformations
          </p>
          <div className="section-divider flex-1" />
        </div>
        <h2 className="text-chrome font-display mt-4 text-3xl font-semibold lg:text-[40px]">
          12-Week Transformations
        </h2>
        <p
          className="mt-4 max-w-[560px] text-base leading-relaxed lg:text-lg"
          style={{ color: "var(--dark-text-secondary)" }}
        >
          Real clients, real data — drag the seam to compare week 1 with
          week 12.
        </p>

        {featured ? (
          <div className="mt-12">
            <CompareSlider
              beforeSrc={featured.beforeSrc}
              afterSrc={featured.afterSrc}
              beforeAlt={featured.beforeAlt}
              afterAlt={featured.afterAlt}
            />
            <p
              className="mt-4 text-sm"
              style={{ color: "var(--dark-text-muted)" }}
            >
              {featured.name} · {featured.weeks} · coached with AzFIT
            </p>
          </div>
        ) : (
          /* Honest empty state — no stock or synthetic photos, path to the
             waitlist, and the release requirement stated plainly. */
          <div className="landing-surface mt-12 rounded-2xl p-8 lg:p-10">
            <p className="max-w-2xl text-sm leading-relaxed text-white/70 lg:text-base">
              Real before/after transformations land here soon — every photo
              is published only with a signed client release. Want yours
              featured? Join the waitlist and train with us.
            </p>
            <a
              href="#waitlist"
              className="font-display mt-5 inline-flex h-11 items-center justify-center rounded-full border-2 border-white/40 px-6 text-sm font-semibold text-white transition-all duration-200 hover:border-white/60 hover:bg-white/10"
            >
              Join the Waitlist
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
