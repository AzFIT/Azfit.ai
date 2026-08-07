// ═══════════════════════════════════════════════════════════════
// Privacy Policy (Phase 57) — plain-language, public route.
// ═══════════════════════════════════════════════════════════════

import { useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "What we collect",
    body: [
      "AzFIT stores the information you and your coach enter: account details (name, email), training programs and workout logs, body-composition measurements (weight, body-fat, skinfold assessments), nutrition logs and targets, progress photos and form-check videos you choose to upload, check-in responses, and messages between you and your coach.",
      "Some of this is health-related data. We treat it as private by default and never sell it.",
    ],
  },
  {
    title: "How it's used",
    body: [
      "Your data powers your coaching: program delivery, progress tracking, nutrition targets, and communication with your trainer. Trainers see only their own clients' data. Clients see only their own.",
      "We do not use your data for advertising, and we do not share it with third parties for their own marketing.",
    ],
  },
  {
    title: "Where it's stored",
    body: [
      "Data is hosted on Supabase (PostgreSQL with row-level security) in a secured cloud region. Photos and videos are stored in Supabase Storage with per-user access rules. Access is governed by row-level security policies enforced by the database itself.",
    ],
  },
  {
    title: "Your choices",
    body: [
      "You can ask your coach to correct or export your training data at any time. To delete your account and associated data, contact your coach or us directly — deletion removes your profile, logs, and uploaded media.",
    ],
  },
  {
    title: "Contact",
    body: [
      "Questions about privacy? Email privacy@azfit.ai and we'll answer plainly.",
    ],
  },
];

export default function Privacy() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--page-bg)", color: "var(--page-text)" }}>
      <div className="mx-auto max-w-2xl px-6 py-10">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center gap-1.5 text-xs font-medium transition hover:opacity-80"
          style={{ color: "var(--light-text-muted)" }}
        >
          <ArrowLeft size={14} /> Back
        </button>
        <h1 className="text-2xl font-bold">Privacy Policy</h1>
        <p className="mt-1 text-xs" style={{ color: "var(--light-text-muted)" }}>
          AzFIT — last updated August 2026
        </p>
        <div className="mt-6 space-y-6">
          {SECTIONS.map((s) => (
            <section key={s.title}>
              <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: "var(--azfit-primary)" }}>
                {s.title}
              </h2>
              {s.body.map((p, i) => (
                <p key={i} className="mt-2 text-sm leading-relaxed" style={{ color: "var(--page-text)" }}>
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
