/* ═══════════════════════════════════════════════════════════════
   planExportHtml (Phase 99e Item 2) — pure server-side HTML renderer
   for the plan-export edge function. Consumes the SHARED
   planSummaryRender resolver output (never re-implements section
   logic) and produces a self-contained, print-friendly HTML document
   that Google Drive converts natively to an editable Google Doc.

   Pure + unit-tested: no network, no DOM. All user-entered text
   (client names, override edits) is HTML-escaped here — the edge
   function must not add unescaped content after this builder.

   Branding: inline CSS only (brand gradient #00AEEF→#8B5CF6 on
   headings — these are the sanctioned brand hexes, and this file is
   a standalone export document, not app UI, so it cannot use the
   app's CSS variables). The AzFIT logo is passed in as an inlined
   base64 data URL (fetched from the live site by the edge function)
   or omitted when unavailable.
   ═══════════════════════════════════════════════════════════════ */

import type { ResolvedSection } from "./planSummaryRender";
import { displayTitle } from "./planSummaryRender";

export interface PlanExportInput {
  clientName: string;
  trainerName: string;
  businessName: string | null;
  generatedLabel: string;
  sections: ResolvedSection[];
  logoDataUrl: string | null;
  medicalDisclaimer: string;
}

/** Minimal, strict HTML escaper — covers text nodes and attributes. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const e = escapeHtml;

/* ── Per-section body renderers ──────────────────────────────── */

function sectionHtml(s: ResolvedSection): string {
  const title = displayTitle(s);
  const h = title ? `<h2>${e(title)}</h2>` : "";
  switch (s.key) {
    case "welcome":
      return `<section class="cover">
  ${h}
  <p class="welcome-message">${e(s.data.message)}</p>
</section>`;
    case "assessment": {
      const d = s.data;
      const row = (k: string, v: string) => `<tr><td>${e(k)}</td><td class="num">${e(v)}</td></tr>`;
      return `<section>
  ${h}
  <table>
    ${row("Weight", `${d.weightKg} kg`)}
    ${row("Height", `${d.heightCm} cm`)}
    ${row("BMI", String(d.bmi))}
    ${row("Body fat", d.bodyFatPct != null ? `${d.bodyFatPct}%` : "—")}
    ${row("Fat mass", d.fatMassKg != null ? `${d.fatMassKg} kg` : "—")}
    ${row("Lean mass", d.leanMassKg != null ? `${d.leanMassKg} kg` : "—")}
    ${row(`BMR (${d.bmrMethod === "katch-mcardle" ? "Katch-McArdle" : "Mifflin-St Jeor"})`, `${d.bmr.toLocaleString("en-US")} kcal`)}
    ${row("Maintenance calories", `${d.maintenance.toLocaleString("en-US")} kcal`)}
  </table>
  <p class="goal">Goal: ${e(d.goalStatement)}</p>
</section>`;
    }
    case "femaleNote":
      return `<section>${h}<p>${e(s.data.text)}</p></section>`;
    case "calories": {
      const d = s.data;
      const sub = d.isFatLoss
        ? `${Math.round(d.deficitPct * 100)}% deficit${d.weeklyLossKg != null ? ` · ~${d.weeklyLossKg} kg/week` : ""}`
        : "at maintenance";
      return `<section>
  ${h}
  <table>
    <tr><td>Maintenance</td><td class="num">${d.maintenance.toLocaleString("en-US")} kcal / day</td></tr>
    <tr><td><strong>Your target</strong></td><td class="num"><strong>${d.target.toLocaleString("en-US")} kcal / day</strong> (${e(sub)})</td></tr>
  </table>
  ${d.clampedByFloor ? `<p class="note">Note: your target was raised to the safety floor (BMR × 1.05 / 1,200 kcal) — a deeper deficit would cost muscle.</p>` : ""}
</section>`;
    }
    case "macros": {
      const d = s.data;
      const table = (label: string, pick: "atTarget" | "atMaintenance", flags: boolean) => `
  <p class="label">${e(label)}</p>
  <table>
    <tr><th>Style</th><th class="num">Protein</th><th class="num">Carbs</th><th class="num">Fats</th><th>Best for</th></tr>
    ${d.styles
      .map((st) => {
        const g = st[pick];
        const rec = st.key === d.recommended.key;
        return `<tr${rec ? ' class="rec"' : ""}><td>${e(st.name)}${rec ? ' <span class="rec-badge">recommended</span>' : ""}</td><td class="num">${g.proteinG} g${flags && st.atTarget.belowFloor ? " ⚠" : ""}</td><td class="num">${g.carbsG} g</td><td class="num">${g.fatsG} g</td><td>${e(st.bestFor)}</td></tr>`;
      })
      .join("\n    ")}
  </table>`;
      return `<section>
  ${h}
  ${table(`At your target (${d.target.toLocaleString("en-US")} kcal)`, "atTarget", true)}
  ${table(`At maintenance (${d.maintenance.toLocaleString("en-US")} kcal)`, "atMaintenance", false)}
  <p class="note">Protein floor: ${d.proteinFloor.grams} g (${e(d.proteinFloor.basis)}). Recommended: <strong>${e(d.recommended.name)}</strong> — ${e(d.recommended.reason)}.${d.anyBelowFloor ? " ⚠ below the floor — boost protein by trimming carbs." : ""}</p>
</section>`;
    }
    case "weeklyTargets": {
      const d = s.data;
      return `<section>
  ${h}
  <table>
    <tr><td>Starting point</td><td class="num"><strong>${e(d.baselineWeightDisplay)}</strong> — ${e(d.baselineSub)}</td></tr>
    <tr><td>The goal</td><td class="num"><strong>${e(d.goalDisplay)}</strong> — ${e(d.goalSub)}</td></tr>
  </table>
  ${d.weeklyRate ? `<p class="goal">Realistic pace: <strong>${e(d.weeklyRate.label)}</strong> — week to week, never day to day.</p>` : ""}
  ${d.goalDateHonestNote ? `<p class="note">${e(d.goalDateHonestNote)}</p>` : ""}
  <p class="label">What to expect</p>
  <table>
    ${d.expectations.map((x) => `<tr><td class="wk">${e(x.weeks)}</td><td><strong>${e(x.focus)}</strong> — ${e(x.expectation)}</td></tr>`).join("\n    ")}
  </table>
  <p class="label">Wins that aren't the scale</p>
  <ul>${d.nonScaleVictories.map((v) => `<li>${e(v)}</li>`).join("")}</ul>
  ${d.notes.map((n) => `<p class="note">${e(n)}</p>`).join("")}
</section>`;
    }
    case "warmup":
      return `<section>
  ${h}
  <ol>${s.data.steps.map((st) => `<li><strong>${e(st.name)}</strong> — ${e(st.muscle)}</li>`).join("")}</ol>
  ${s.data.note ? `<p class="note">${e(s.data.note)}</p>` : ""}
</section>`;
    case "training": {
      const d = s.data;
      return `<section>
  ${h}
  ${d.sessions
    .map(
      (sess) => `
  <p class="label">${e(sess.name)}</p>
  <table>
    ${sess.blocks
      .map(
        (b) =>
          `<tr><td class="wk">${e(b.label)}</td><td>${e(b.exercises)}</td><td class="num">${e(b.setsReps)}</td><td class="num">${e(b.tempo)}</td><td class="num">rest ${e(b.rest)}</td></tr>`,
      )
      .join("\n    ")}
  </table>
  ${[sess.rounds, sess.finisher].filter(Boolean).length > 0 ? `<p class="note">${[sess.rounds, sess.finisher].filter((x): x is string => Boolean(x)).map(e).join(" · ")}</p>` : ""}`,
    )
    .join("\n  ")}
  <p class="label">Rest rules</p>
  <ul>${d.restRules.map((r) => `<li>${e(r)}</li>`).join("")}</ul>
  ${d.metaNotes.length > 0 ? `<ul class="notes">${d.metaNotes.map((n) => `<li>${e(n)}</li>`).join("")}</ul>` : ""}
</section>`;
    }
    case "cardio":
      return `<section>
  ${h}
  ${s.data.rows
    .map(
      (r) => `
  <table>
    <tr><td colspan="2"><strong>${e(r.machine)}</strong> <span class="difficulty">${e(r.difficulty)}</span></td></tr>
    <tr><td>Protocol</td><td>${e(r.protocol)} · ${e(r.basis)}</td></tr>
    <tr><td>Intensity</td><td>${e(r.intensity)}</td></tr>
    <tr><td>Schedule</td><td>${e(r.schedule)}</td></tr>
    ${r.progression.map((p) => `<tr><td>${e(p.label)}</td><td>${e(p.prescription)}</td></tr>`).join("\n    ")}
  </table>`,
    )
    .join("\n  ")}
  <p class="goal">≈ ${s.data.weeklyMinutes} cardio minutes/week · ${e(s.data.stepNote)}</p>
  ${s.data.notes.map((n) => `<p class="note">${e(n)}</p>`).join("")}
</section>`;
    case "nutritionGuide":
      return `<section>
  ${h}
  <p>${e(s.data.intro)}</p>
  ${s.data.safetyCallout ? `<p class="callout">${e(s.data.safetyCallout)}</p>` : ""}
  ${s.data.blocks
    .map((b) => `<p class="label">${e(b.heading)}</p><ul>${b.points.map((p) => `<li>${e(p)}</li>`).join("")}</ul>`)
    .join("\n  ")}
  <p class="label">Who should NOT be in a deficit</p>
  <ul>${s.data.whoShouldNotCut.map((w) => `<li>${e(w)}</li>`).join("")}</ul>
  ${s.data.notes.map((n) => `<p class="note">${e(n)}</p>`).join("")}
</section>`;
    case "sampleDay":
      return `<section>
  ${h}
  <table>
    ${s.data.meals
      .map(
        (m) =>
          `<tr><td><strong>${e(m.name)}</strong><br><span class="muted">${m.items.map(e).join(" · ")}</span></td><td class="num">${m.macros.kcal} kcal · P${m.macros.p} C${m.macros.c} F${m.macros.f}</td></tr>`,
      )
      .join("\n    ")}
    <tr class="total"><td><strong>Day total</strong></td><td class="num"><strong>${s.data.totals.kcal} kcal · P${s.data.totals.p} C${s.data.totals.c} F${s.data.totals.f}</strong>${s.data.withinTolerance ? " (on target ±5%)" : ""}</td></tr>
  </table>
  <ul>${s.data.foodRules.map((r) => `<li>${e(r)}</li>`).join("")}</ul>
</section>`;
    case "sampleDiet":
      return `<section>
  ${h}
  <table>
    ${s.data.meals
      .map(
        (m) =>
          `<tr><td><strong>${e(m.name)}</strong><br><span class="muted">${m.items.map((i) => `${e(i.food)} ${i.grams} g`).join(" · ")}</span></td><td></td></tr>`,
      )
      .join("\n    ")}
    <tr class="total"><td><strong>Day total</strong></td><td class="num"><strong>${s.data.totals.kcal} kcal · P${s.data.totals.proteinG} C${s.data.totals.carbsG} F${s.data.totals.fatsG}</strong>${s.data.withinTolerance ? " (within ±10% of target)" : ""}</td></tr>
  </table>
  ${s.data.note ? `<p class="note">${e(s.data.note)}</p>` : ""}
</section>`;
    case "supplements":
      return `<section>
  ${h}
  <table>
    ${s.data.items
      .map((it) => `<tr><td>${e(it.name)}</td><td class="num">${e(it.dose)}</td><td>${e(it.note)}</td></tr>`)
      .join("\n    ")}
    <tr><td>Water</td><td class="num">${(s.data.hydration.min / 1000).toFixed(1)}–${(s.data.hydration.max / 1000).toFixed(1)} L/day</td><td>30–35 ml per kg bodyweight</td></tr>
  </table>
  <p class="note">${e(s.data.disclaimer)}</p>
</section>`;
    case "tracking":
      return `<section>
  ${h}
  <table>
    ${s.data.rows
      .map((t) => `<tr><td>${e(t.what)}</td><td class="num">${e(t.frequency)}</td><td>${e(t.note)}</td></tr>`)
      .join("\n    ")}
  </table>
</section>`;
    case "roadmap":
      return `<section>
  ${h}
  <table>
    ${s.data.phases
      .map((p) => `<tr><td class="wk">${e(p.weeks)}</td><td><strong>${e(p.name)}</strong> — ${e(p.note)}</td></tr>`)
      .join("\n    ")}
  </table>
</section>`;
    case "faq":
      return `<section>
  ${h}
  ${s.data.items.map((f) => `<p><strong>${e(f.q)}</strong><br>${e(f.a)}</p>`).join("\n  ")}
</section>`;
    /* Phase 99g Item 2: Coach's Notes — plain paragraphs, line breaks
       preserved, everything escaped (never interpreted as HTML). */
    case "coachNotes":
      return `<section>
  ${h}
  ${s.data.paragraphs.map((p) => `<p class="coach-note">${e(p).replace(/\n/g, "<br>")}</p>`).join("\n  ")}
</section>`;
  }
}

/* ── Document shell ──────────────────────────────────────────── */

export function buildPlanExportHtml(input: PlanExportInput): string {
  const logo = input.logoDataUrl
    ? `<img class="logo" src="${e(input.logoDataUrl)}" alt="AzFIT">`
    : `<p class="logo-text">Az<span>FIT</span></p>`;
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>AzFIT Plan Summary — ${e(input.clientName)}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #1F2937; line-height: 1.45; font-size: 12px; margin: 24px; }
  .logo { display: block; margin: 0 auto 12px; height: 56px; }
  .logo-text { text-align: center; font-size: 24px; font-weight: 900; margin: 0 0 12px; color: #1F2937; }
  .logo-text span { color: #00AEEF; }
  header { border-bottom: 2px solid #111827; padding-bottom: 8px; margin-bottom: 8px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h1 .brand { background: linear-gradient(90deg, #00AEEF, #8B5CF6); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .meta { color: #6B7280; font-size: 11px; margin: 0; }
  section { page-break-inside: avoid; break-inside: avoid; margin-top: 16px; }
  h2 { font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid #D1D5DB; padding-bottom: 4px; margin: 0 0 6px; color: #111827; }
  table { width: 100%; border-collapse: collapse; margin: 4px 0 8px; page-break-inside: avoid; }
  td, th { padding: 4px 6px; border-bottom: 1px solid #E5E7EB; vertical-align: top; text-align: left; }
  th { font-size: 10px; text-transform: uppercase; color: #6B7280; background: #F3F4F6; }
  td.num, th.num { text-align: right; white-space: nowrap; }
  td.wk { font-weight: 700; white-space: nowrap; }
  tr.total td { background: #F3F4F6; font-weight: 700; }
  tr.rec td { background: #EEF7FE; }
  .rec-badge { font-size: 9px; font-weight: 700; text-transform: uppercase; background: #111827; color: #fff; border-radius: 8px; padding: 1px 6px; }
  .label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; margin: 10px 0 2px; color: #111827; }
  .goal { background: #F3F4F6; padding: 6px 8px; font-weight: 600; margin: 6px 0; }
  .callout { border: 1px solid #111827; padding: 6px 8px; font-weight: 700; margin: 6px 0; }
  .note { font-size: 11px; color: #4B5563; font-style: italic; margin: 4px 0; }
  .muted { color: #6B7280; }
  ul { margin: 4px 0; padding-left: 18px; }
  ul.notes { border-top: 1px solid #D1D5DB; padding-top: 4px; color: #6B7280; font-style: italic; }
  .cover { text-align: center; border: 1px solid #D1D5DB; border-radius: 8px; padding: 12px; }
  .welcome-message { max-width: 480px; margin: 6px auto 0; font-size: 11px; color: #4B5563; }
  .coach-note { font-size: 11px; margin: 4px 0; }
  .difficulty { font-size: 9px; font-weight: 700; text-transform: uppercase; background: #111827; color: #fff; border-radius: 8px; padding: 1px 6px; }
  footer { border-top: 1px solid #D1D5DB; margin-top: 20px; padding-top: 8px; font-size: 10px; color: #9CA3AF; }
</style>
</head>
<body>
  ${logo}
  <header>
    <h1><span class="brand">Your Plan Summary</span></h1>
    <p class="meta">Prepared for <strong>${e(input.clientName)}</strong> by ${e(input.trainerName)}${input.businessName ? ` · ${e(input.businessName)}` : ""} — ${e(input.generatedLabel)}</p>
  </header>
  ${input.sections.map(sectionHtml).join("\n  ")}
  <footer>
    <p>${e(input.medicalDisclaimer)}</p>
    <p>Prepared by ${e(input.trainerName)}${input.businessName ? ` · ${e(input.businessName)}` : ""} — generated ${e(input.generatedLabel)}. Reviewed together at your next session.</p>
  </footer>
</body>
</html>`;
}
