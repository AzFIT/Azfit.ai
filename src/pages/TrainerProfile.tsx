// ═══════════════════════════════════════════════════════════════
// TrainerProfilePage (Phase 90b) — /trainer-profile (trainer-only).
//
// STRUCTURE CHOICE: a read-only profile VIEW with an in-page EDIT FORM
// toggled by "Edit profile" (no modal/sheet — GlassCard backdrop-filter
// traps position:fixed descendants, and the form is long-form content
// that belongs in the page flow). Cancel discards edits; the form is
// re-initialised from the last saved profile every time edit mode
// opens. A failed save reverts the form and toasts the error — the
// profile never half-saves.
//
// HONEST DATA: every empty field renders as ABSENT (section/line
// omitted) — no placeholder text anywhere. A NULL profile (fresh
// trainer) renders a setup card with the edit form opening directly.
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, type ReactNode } from "react";
import { useNavigate } from "react-router";
import LogoHomeButton from "@/components/LogoHomeButton";
import { toast } from "sonner";
import QRCode from "qrcode";
import {
  ArrowLeft,
  Pencil,
  Plus,
  Trash2,
  Upload,
  Award,
  Globe,
  Link2,
  MessageCircle,
  Mail,
  Instagram,
  ExternalLink,
  Quote,
  Target,
  HeartHandshake,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { qrColorsForTheme } from "@/lib/qrTheme";
import {
  useTrainerProfile,
  trainerAssetUrl,
  type TrainerImageKind,
} from "@/hooks/useTrainerProfile";
import {
  isProfileSetUp,
  waMeLink,
  qrContactTarget,
  defaultTrainerProfile,
  type TrainerProfile,
} from "@/lib/trainerProfile";
import TrainerAvatar from "@/components/trainer/TrainerAvatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const CARD = "rounded-2xl border p-5";
const cardStyle = { backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" } as const;
const MUTED = { color: "var(--light-text-muted)" } as const;
const TEXT = { color: "var(--page-text)" } as const;

function parseList(text: string): string[] {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1 block text-xs font-semibold uppercase tracking-wide"
      style={MUTED}
    >
      {children}
    </label>
  );
}

export default function TrainerProfilePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    profile,
    setUp,
    loading,
    error: loadError,
    save,
    uploadImage,
    removeImage,
  } = useTrainerProfile(user?.id);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<TrainerProfile>(defaultTrainerProfile());
  const [yearsText, setYearsText] = useState("");
  const [specialtiesText, setSpecialtiesText] = useState("");
  const [languagesText, setLanguagesText] = useState("");
  const [affiliationsText, setAffiliationsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadBusy, setUploadBusy] = useState<TrainerImageKind | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  const profileInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  /* ── QR code (view only; only when a contact target exists) ──
     Phase 90b-fix: module colors come from the ACTIVE theme's
     `--page-text` token (read via getComputedStyle) — dark theme gets
     light modules, light theme dark modules. `--page-text` (not
     `--foreground`) because the qrcode lib only accepts hex and
     `--foreground` is an HSL triplet; see src/lib/qrTheme.ts. `theme` is
     an effect dep so the QR re-renders on theme change. The data-theme
     attribute is mirrored here before reading because child effects run
     before the ThemeProvider's effect on a toggle — without the mirror
     we'd read the previous theme's token. The provider's own write is
     identical and idempotent. */
  const { theme } = useTheme();
  useEffect(() => {
    const target = profile ? qrContactTarget(profile.contact) : null;
    if (!target) {
      setQrUrl(null);
      return;
    }
    document.documentElement.setAttribute("data-theme", theme);
    const colors = qrColorsForTheme(
      theme,
      getComputedStyle(document.documentElement).getPropertyValue("--page-text"),
    );
    if (!colors) {
      setQrUrl(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(target, {
      margin: 1,
      width: 220,
      color: colors,
    })
      .then((url) => {
        if (!cancelled) setQrUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [profile, theme]);

  /* ── Edit-mode lifecycle ── */
  const openEdit = (p: TrainerProfile | null) => {
    const base = p ?? defaultTrainerProfile();
    setForm(base);
    setYearsText(base.years_experience !== null ? String(base.years_experience) : "");
    setSpecialtiesText(base.specialties.join(", "));
    setLanguagesText(base.languages.join(", "));
    setAffiliationsText(base.affiliations.join(", "));
    setFormError(null);
    setEditing(true);
  };

  const closeEdit = () => {
    setEditing(false);
    setFormError(null);
  };

  /* ── Uploads (a failure never mutates the form) ── */
  const handleUpload = async (file: File | undefined, kind: TrainerImageKind) => {
    if (!file) return;
    setUploadBusy(kind);
    setFormError(null);
    try {
      const { path } = await uploadImage(file, kind);
      if (kind === "profile") {
        setForm((f) => ({ ...f, photo_path: path, photo_variant: "photo" }));
      } else if (kind === "background") {
        setForm((f) => ({ ...f, background_path: path }));
      } else {
        setForm((f) => ({ ...f, gallery: [...f.gallery, { path, caption: null }] }));
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadBusy(null);
    }
  };

  const handleRemoveBackground = async () => {
    const path = form.background_path;
    setForm((f) => ({ ...f, background_path: null }));
    if (path) {
      try {
        await removeImage(path);
      } catch {
        /* Object already gone or permission issue — local state stays cleared. */
      }
    }
  };

  const handleRemoveGalleryEntry = async (index: number) => {
    const entry = form.gallery[index];
    setForm((f) => ({ ...f, gallery: f.gallery.filter((_, i) => i !== index) }));
    if (entry) {
      try {
        await removeImage(entry.path);
      } catch {
        /* See handleRemoveBackground. */
      }
    }
  };

  /* ── Save / cancel ── */
  const handleSave = async () => {
    const yearsTrimmed = yearsText.trim();
    let years: number | null = null;
    if (yearsTrimmed !== "") {
      const n = Number(yearsTrimmed);
      if (!Number.isFinite(n) || n < 0) {
        setFormError("Years of experience must be a number of 0 or more");
        return;
      }
      years = Math.round(n);
    }
    const next: TrainerProfile = {
      ...form,
      display_name: form.display_name.trim(),
      title: form.title.trim(),
      years_experience: years,
      specialties: parseList(specialtiesText),
      languages: parseList(languagesText),
      affiliations: parseList(affiliationsText),
    };
    setSaving(true);
    setFormError(null);
    const err = await save(next);
    setSaving(false);
    if (err) {
      toast.error(err);
      // Revert the form to the last saved state — never half-save.
      openEdit(profile);
    } else {
      toast.success("Profile saved");
      setEditing(false);
    }
  };

  /* ─────────────────────────── VIEW ─────────────────────────── */

  const renderView = () => {
    if (!profile || !isProfileSetUp(profile)) {
      // Fresh trainer (NULL profile) or identity never completed.
      return (
        <div className={CARD} style={cardStyle}>
          <h2 className="text-xl font-bold" style={TEXT}>
            Set up your public trainer profile
          </h2>
          <p className="mt-2 text-sm" style={MUTED}>
            Add your name, credentials and contact links — your clients see this
            as your public coaching identity.
          </p>
          <Button className="mt-4 min-h-[44px]" onClick={() => openEdit(profile)}>
            <Pencil /> Set up profile
          </Button>
        </div>
      );
    }

    const c = profile.contact;
    const wa = c.whatsapp?.trim() ? waMeLink(c.whatsapp) : null;
    const igHandle = c.instagram?.trim().replace(/^@/, "");
    const ig = igHandle ? `https://instagram.com/${igHandle}` : null;
    const contactItems: Array<{ href: string; icon: ReactNode; label: string; external?: boolean }> = [];
    if (wa && c.whatsapp) contactItems.push({ href: wa, icon: <MessageCircle className="h-4 w-4" />, label: c.whatsapp.trim() });
    if (c.email?.trim()) contactItems.push({ href: `mailto:${c.email.trim()}`, icon: <Mail className="h-4 w-4" />, label: c.email.trim() });
    if (ig && igHandle) contactItems.push({ href: ig, icon: <Instagram className="h-4 w-4" />, label: `@${igHandle}`, external: true });
    if (c.website?.trim()) contactItems.push({ href: c.website.trim(), icon: <ExternalLink className="h-4 w-4" />, label: c.website.trim(), external: true });

    const philosophySections: Array<{ icon: ReactNode; heading: string; body: string | null }> = [
      { icon: <Quote className="h-4 w-4" />, heading: "Approach", body: profile.philosophy.approach },
      { icon: <Target className="h-4 w-4" />, heading: "Mission", body: profile.philosophy.mission },
      { icon: <HeartHandshake className="h-4 w-4" />, heading: "Values", body: profile.philosophy.values },
    ].filter((s) => s.body !== null && s.body.trim() !== "");

    return (
      <div className="space-y-4">
        {/* Identity */}
        <div className={`${CARD} flex items-center gap-4`} style={cardStyle}>
          <TrainerAvatar profile={profile} nameFallback={user?.full_name ?? "Trainer"} size={80} />
          <div className="min-w-0">
            <h2
              className="truncate text-2xl font-bold uppercase tracking-wide"
              style={TEXT}
            >
              {profile.display_name}
            </h2>
            {(() => {
              const meta = [
                profile.title.trim(),
                profile.years_experience !== null ? `${profile.years_experience} yrs experience` : "",
              ].filter((s) => s !== "");
              return meta.length > 0 ? (
                <p className="mt-1 text-sm" style={MUTED}>
                  {meta.join(" · ")}
                </p>
              ) : null;
            })()}
          </div>
        </div>

        {/* Credentials */}
        {profile.qualifications.length > 0 && (
          <div className={CARD} style={cardStyle}>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide" style={MUTED}>
              <Award className="h-4 w-4" /> Credentials
            </h3>
            <ul className="space-y-3">
              {profile.qualifications.map((q, i) => {
                const meta = [
                  q.name !== null && q.issuer !== null ? q.issuer : null,
                  q.year !== null ? String(q.year) : null,
                ]
                  .filter((s): s is string => s !== null)
                  .join(" · ");
                return (
                  <li key={`${q.name ?? q.issuer ?? "q"}-${i}`}>
                    <p className="font-semibold" style={TEXT}>
                      {q.name ?? q.issuer}
                    </p>
                    {meta !== "" && (
                      <p className="text-sm" style={MUTED}>
                        {meta}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Specialties */}
        {profile.specialties.length > 0 && (
          <div className={CARD} style={cardStyle}>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={MUTED}>
              Specialties
            </h3>
            <div className="flex flex-wrap gap-2">
              {profile.specialties.map((s) => (
                <span
                  key={s}
                  className="rounded-full border px-3 py-1 text-sm"
                  style={{ borderColor: "var(--card-border)", color: "var(--page-text)" }}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Languages + affiliations */}
        {(profile.languages.length > 0 || profile.affiliations.length > 0) && (
          <div className={`${CARD} space-y-2`} style={cardStyle}>
            {profile.languages.length > 0 && (
              <p className="text-sm">
                <span className="font-semibold" style={TEXT}>Languages: </span>
                <span style={MUTED}>{profile.languages.join(", ")}</span>
              </p>
            )}
            {profile.affiliations.length > 0 && (
              <p className="text-sm">
                <span className="font-semibold" style={TEXT}>Affiliations: </span>
                <span style={MUTED}>{profile.affiliations.join(", ")}</span>
              </p>
            )}
          </div>
        )}

        {/* Philosophy */}
        {philosophySections.length > 0 && (
          <div className={`${CARD} space-y-4`} style={cardStyle}>
            <h3 className="text-sm font-semibold uppercase tracking-wide" style={MUTED}>
              Philosophy
            </h3>
            {philosophySections.map((s) => (
              <div key={s.heading}>
                <p className="flex items-center gap-2 text-sm font-semibold" style={TEXT}>
                  {s.icon} {s.heading}
                </p>
                <p className="mt-1 whitespace-pre-line text-sm" style={MUTED}>
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Transformation gallery (absent entirely when empty) */}
        {profile.gallery.length > 0 && (
          <div className={CARD} style={cardStyle}>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={MUTED}>
              Transformation Gallery
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {profile.gallery.map((g, i) => (
                <figure key={`${g.path}-${i}`}>
                  <img
                    src={trainerAssetUrl(g.path)}
                    alt={g.caption ?? `Gallery image ${i + 1}`}
                    className="w-full rounded-xl object-cover"
                    loading="lazy"
                  />
                  {g.caption !== null && g.caption.trim() !== "" && (
                    <figcaption className="mt-1 text-sm" style={MUTED}>
                      {g.caption}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          </div>
        )}

        {/* Contact + QR */}
        {(contactItems.length > 0 || qrUrl !== null) && (
          <div className={CARD} style={cardStyle}>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide" style={MUTED}>
              <Link2 className="h-4 w-4" /> Contact
            </h3>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              {contactItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  target={item.external ? "_blank" : undefined}
                  rel={item.external ? "noreferrer" : undefined}
                  className="flex min-h-[44px] items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-opacity hover:opacity-80"
                  style={{ borderColor: "var(--card-border)", color: "var(--page-text)" }}
                >
                  {item.icon} <span className="truncate">{item.label}</span>
                </a>
              ))}
            </div>
            {qrUrl !== null && (
              <div className="mt-4 flex flex-col items-start gap-2">
                <img src={qrUrl} alt="Contact QR code" className="rounded-xl border" style={{ borderColor: "var(--card-border)" }} />
                <p className="text-sm" style={MUTED}>
                  Scan to contact me
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  /* ─────────────────────────── EDIT ─────────────────────────── */

  const renderEdit = () => (
    <div className="space-y-4">
      {/* Identity */}
      <section className={CARD} style={cardStyle}>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={MUTED}>
          Identity
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="tp-display-name">Display name</FieldLabel>
            <Input
              id="tp-display-name"
              value={form.display_name}
              onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
            />
          </div>
          <div>
            <FieldLabel htmlFor="tp-title">Title</FieldLabel>
            <Input
              id="tp-title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div>
            <FieldLabel htmlFor="tp-years">Years of experience</FieldLabel>
            <Input
              id="tp-years"
              type="number"
              min={0}
              inputMode="numeric"
              value={yearsText}
              onChange={(e) => setYearsText(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Photo */}
      <section className={CARD} style={cardStyle}>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={MUTED}>
          Photo
        </h3>
        <div className="flex items-center gap-4">
          <TrainerAvatar profile={form} nameFallback={user?.full_name ?? "Trainer"} size={64} />
          <input
            ref={profileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              void handleUpload(e.target.files?.[0], "profile");
              e.target.value = "";
            }}
          />
          <Button
            variant="outline"
            className="min-h-[44px]"
            disabled={uploadBusy !== null}
            onClick={() => profileInputRef.current?.click()}
          >
            <Upload /> {uploadBusy === "profile" ? "Uploading…" : "Upload photo"}
          </Button>
        </div>
        {form.photo_path !== null && (
          <div className="mt-3 flex flex-wrap gap-2">
            {(["photo", "blur", "initials"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setForm((f) => ({ ...f, photo_variant: v }))}
                className="min-h-[44px] rounded-lg border px-3 py-2 text-sm font-medium capitalize"
                style={
                  form.photo_variant === v
                    ? { borderColor: "var(--azfit-primary)", color: "var(--azfit-primary)" }
                    : { borderColor: "var(--card-border)", color: "var(--light-text-muted)" }
                }
              >
                {v}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Background band */}
      <section className={CARD} style={cardStyle}>
        <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide" style={MUTED}>
          Dashboard background
        </h3>
        <p className="mb-3 text-xs" style={MUTED}>
          Shown as a subtle decorative band behind your dashboard header.
        </p>
        {form.background_path !== null && (
          <img
            src={trainerAssetUrl(form.background_path)}
            alt="Dashboard background preview"
            className="mb-3 h-24 w-full rounded-xl object-cover"
          />
        )}
        <div className="flex flex-wrap gap-2">
          <input
            ref={backgroundInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              void handleUpload(e.target.files?.[0], "background");
              e.target.value = "";
            }}
          />
          <Button
            variant="outline"
            className="min-h-[44px]"
            disabled={uploadBusy !== null}
            onClick={() => backgroundInputRef.current?.click()}
          >
            <Upload /> {uploadBusy === "background" ? "Uploading…" : "Upload background"}
          </Button>
          {form.background_path !== null && (
            <Button variant="ghost" className="min-h-[44px]" onClick={() => void handleRemoveBackground()}>
              <Trash2 /> Remove
            </Button>
          )}
        </div>
      </section>

      {/* Qualifications */}
      <section className={CARD} style={cardStyle}>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide" style={MUTED}>
          <Award className="h-4 w-4" /> Credentials
        </h3>
        <div className="space-y-3">
          {form.qualifications.map((q, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_110px_auto]">
              <Input
                aria-label={`Qualification ${i + 1} name`}
                placeholder="Name"
                value={q.name ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    qualifications: f.qualifications.map((x, j) => (j === i ? { ...x, name: e.target.value || null } : x)),
                  }))
                }
              />
              <Input
                aria-label={`Qualification ${i + 1} issuer`}
                placeholder="Issuer"
                value={q.issuer ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    qualifications: f.qualifications.map((x, j) => (j === i ? { ...x, issuer: e.target.value || null } : x)),
                  }))
                }
              />
              <Input
                aria-label={`Qualification ${i + 1} year`}
                placeholder="Year"
                type="number"
                min={0}
                inputMode="numeric"
                value={q.year !== null ? String(q.year) : ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    qualifications: f.qualifications.map((x, j) => {
                      if (j !== i) return x;
                      const t = e.target.value.trim();
                      return { ...x, year: t === "" ? null : Math.max(0, Math.round(Number(t) || 0)) };
                    }),
                  }))
                }
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove qualification ${i + 1}`}
                className="min-h-[44px] min-w-[44px]"
                onClick={() =>
                  setForm((f) => ({ ...f, qualifications: f.qualifications.filter((_, j) => j !== i) }))
                }
              >
                <Trash2 />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            className="min-h-[44px]"
            onClick={() =>
              setForm((f) => ({
                ...f,
                qualifications: [...f.qualifications, { name: null, issuer: null, year: null }],
              }))
            }
          >
            <Plus /> Add credential
          </Button>
        </div>
      </section>

      {/* Lists */}
      <section className={`${CARD} space-y-3`} style={cardStyle}>
        <h3 className="text-sm font-semibold uppercase tracking-wide" style={MUTED}>
          Specialties, languages & affiliations
        </h3>
        <div>
          <FieldLabel htmlFor="tp-specialties">Specialties (comma separated)</FieldLabel>
          <Input id="tp-specialties" value={specialtiesText} onChange={(e) => setSpecialtiesText(e.target.value)} />
        </div>
        <div>
          <FieldLabel htmlFor="tp-languages">Languages (comma separated)</FieldLabel>
          <Input id="tp-languages" value={languagesText} onChange={(e) => setLanguagesText(e.target.value)} />
        </div>
        <div>
          <FieldLabel htmlFor="tp-affiliations">Affiliations (comma separated)</FieldLabel>
          <Input id="tp-affiliations" value={affiliationsText} onChange={(e) => setAffiliationsText(e.target.value)} />
        </div>
      </section>

      {/* Philosophy */}
      <section className={`${CARD} space-y-3`} style={cardStyle}>
        <h3 className="text-sm font-semibold uppercase tracking-wide" style={MUTED}>
          Philosophy
        </h3>
        {(
          [
            { key: "approach", label: "Approach", id: "tp-approach" },
            { key: "mission", label: "Mission", id: "tp-mission" },
            { key: "values", label: "Values", id: "tp-values" },
          ] as const
        ).map((row) => (
          <div key={row.key}>
            <FieldLabel htmlFor={row.id}>{row.label}</FieldLabel>
            <Textarea
              id={row.id}
              rows={3}
              value={form.philosophy[row.key] ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  philosophy: { ...f.philosophy, [row.key]: e.target.value || null },
                }))
              }
            />
          </div>
        ))}
      </section>

      {/* Contact */}
      <section className={CARD} style={cardStyle}>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide" style={MUTED}>
          <Globe className="h-4 w-4" /> Contact
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="tp-whatsapp">WhatsApp</FieldLabel>
            <Input
              id="tp-whatsapp"
              inputMode="tel"
              placeholder="+852 9123 4567"
              value={form.contact.whatsapp ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, contact: { ...f.contact, whatsapp: e.target.value || null } }))}
            />
          </div>
          <div>
            <FieldLabel htmlFor="tp-email">Email</FieldLabel>
            <Input
              id="tp-email"
              type="email"
              value={form.contact.email ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, contact: { ...f.contact, email: e.target.value || null } }))}
            />
          </div>
          <div>
            <FieldLabel htmlFor="tp-instagram">Instagram</FieldLabel>
            <Input
              id="tp-instagram"
              placeholder="@handle"
              value={form.contact.instagram ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, contact: { ...f.contact, instagram: e.target.value || null } }))}
            />
          </div>
          <div>
            <FieldLabel htmlFor="tp-website">Website</FieldLabel>
            <Input
              id="tp-website"
              type="url"
              placeholder="https://"
              value={form.contact.website ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, contact: { ...f.contact, website: e.target.value || null } }))}
            />
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section className={CARD} style={cardStyle}>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={MUTED}>
          Transformation gallery
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {form.gallery.map((g, i) => (
            <div key={`${g.path}-${i}`} className="space-y-2">
              <img
                src={trainerAssetUrl(g.path)}
                alt={g.caption ?? `Gallery image ${i + 1}`}
                className="h-40 w-full rounded-xl object-cover"
              />
              <Input
                aria-label={`Caption for gallery image ${i + 1}`}
                placeholder="Caption"
                value={g.caption ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    gallery: f.gallery.map((x, j) => (j === i ? { ...x, caption: e.target.value || null } : x)),
                  }))
                }
              />
              <Button
                variant="ghost"
                className="min-h-[44px]"
                onClick={() => void handleRemoveGalleryEntry(i)}
              >
                <Trash2 /> Remove photo
              </Button>
            </div>
          ))}
        </div>
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            void (async () => {
              for (const file of files) {
                await handleUpload(file, "gallery");
              }
            })();
          }}
        />
        <Button
          variant="outline"
          className="mt-3 min-h-[44px]"
          disabled={uploadBusy !== null}
          onClick={() => galleryInputRef.current?.click()}
        >
          <Upload /> {uploadBusy === "gallery" ? "Uploading…" : "Add photos"}
        </Button>
      </section>
    </div>
  );

  /* ─────────────────────────── PAGE ─────────────────────────── */

  return (
    <div className="mx-auto max-w-3xl px-4 pt-4 pb-20 lg:pb-8">
      {/* Phase 96a: AzFIT logo → dashboard */}
      <div className="flex justify-center pb-2">
        <LogoHomeButton />
      </div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <button
            onClick={() => navigate("/dashboard")}
            aria-label="Back to dashboard"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border"
            style={{ borderColor: "var(--card-border)", color: "var(--page-text)", backgroundColor: "var(--card-bg)" }}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="truncate text-xl font-bold lg:text-2xl" style={TEXT}>
            Trainer Profile
          </h1>
        </div>
        {!editing && setUp && (
          <Button className="min-h-[44px]" onClick={() => openEdit(profile)}>
            <Pencil /> Edit profile
          </Button>
        )}
      </div>

      {loadError && (
        <div className={`${CARD} mb-4 text-sm`} style={{ ...cardStyle, color: "var(--danger)" }}>
          Couldn&apos;t load your profile: {loadError}
        </div>
      )}
      {formError !== null && (
        <div className={`${CARD} mb-4 text-sm`} style={{ ...cardStyle, color: "var(--danger)" }}>
          {formError}
        </div>
      )}

      {loading ? (
        <div className={`${CARD} text-sm`} style={{ ...cardStyle, ...MUTED }}>
          Loading…
        </div>
      ) : editing ? (
        <>
          {renderEdit()}
          <div className="sticky bottom-4 mt-4 flex gap-2">
            <Button className="min-h-[44px] flex-1" disabled={saving || uploadBusy !== null} onClick={() => void handleSave()}>
              {saving ? "Saving…" : "Save profile"}
            </Button>
            <Button
              variant="outline"
              className="min-h-[44px] flex-1"
              disabled={saving || uploadBusy !== null}
              onClick={closeEdit}
            >
              Cancel
            </Button>
          </div>
        </>
      ) : (
        renderView()
      )}
    </div>
  );
}
