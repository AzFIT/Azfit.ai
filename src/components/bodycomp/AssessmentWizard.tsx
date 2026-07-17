import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ChevronRight,
  ChevronLeft,
  Save,
  Ruler,
  User,
  Weight,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  type SkinfoldProtocol,
  type SkinfoldSite,
  type Gender,
  PROTOCOL_SITES,
  PROTOCOL_DESCRIPTIONS,
  SITE_HINTS,
  calculateBodyFat,
  sumSites,
} from "@/lib/bodyfat";
import { useBodyComposition } from "./useBodyComposition";
import { getOnboardingData, setOnboardingData } from "@/lib/storage";

interface AssessmentWizardProps {
  clientId?: string;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

interface WizardProfile {
  age: number;
  gender: Gender;
  weightKg: number;
}

const PROTOCOL_ORDER: SkinfoldProtocol[] = ["jp3", "jp7", "poliquin12"];

function formatSiteName(site: string): string {
  return site.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

function useResolvedClientId(propClientId?: string) {
  const { user } = useAuth();
  const [clientId, setClientId] = useState<string | null>(propClientId || null);
  const [resolving, setResolving] = useState(!propClientId);

  useEffect(() => {
    if (propClientId) {
      setClientId(propClientId);
      setResolving(false);
      return;
    }
    if (!user?.email) {
      setClientId(null);
      setResolving(false);
      return;
    }

    let cancelled = false;
    setResolving(true);
    supabase
      .from("clients")
      .select("id")
      .eq("email", user.email)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) setClientId(data.id);
        else setClientId(null);
        setResolving(false);
      });

    return () => {
      cancelled = true;
    };
  }, [propClientId, user?.email]);

  return { clientId, resolving };
}

function useClientProfile(clientId: string | null) {
  const [profile, setProfile] = useState<Partial<WizardProfile>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!clientId) return;

    let cancelled = false;
    setLoading(true);

    const load = async () => {
      const { data } = await supabase
        .from("clients")
        .select("date_of_birth, gender, weight_kg")
        .eq("id", clientId)
        .single();

      if (cancelled) return;

      const partial: Partial<WizardProfile> = {};
      if (data?.gender) partial.gender = data.gender as Gender;
      if (data?.weight_kg) partial.weightKg = data.weight_kg;
      if (data?.date_of_birth) {
        const birth = new Date(data.date_of_birth);
        const now = new Date();
        let age = now.getFullYear() - birth.getFullYear();
        if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
        partial.age = age;
      }

      setProfile(partial);
      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  return { profile, loading };
}

export function AssessmentWizard({ clientId: propClientId, isOpen, onClose, onSaved }: AssessmentWizardProps) {
  const { clientId, resolving } = useResolvedClientId(propClientId);
  const { profile: clientProfile, loading: profileLoading } = useClientProfile(clientId);
  const { saveAssessment } = useBodyComposition(clientId || undefined);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [protocol, setProtocol] = useState<SkinfoldProtocol>("jp7");
  const [sites, setSites] = useState<Record<SkinfoldSite, number>>({
    chin: 0,
    cheek: 0,
    pec: 0,
    mid_axillary: 0,
    umbilical: 0,
    supra_iliac: 0,
    subscapular: 0,
    triceps: 0,
    knee: 0,
    medial_calf: 0,
    mid_thigh: 0,
    hamstring: 0,
  });
  const [age, setAge] = useState<string>("");
  const [gender, setGender] = useState<Gender | "">("");
  const [weightKg, setWeightKg] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [saving, setSaving] = useState(false);

  /* ── Load defaults from localStorage onboarding data ─────────────── */
  useEffect(() => {
    if (isOpen) return;

    const stored = getOnboardingData();
    if (stored) {
      if (stored.dateOfBirth) {
        const birth = new Date(stored.dateOfBirth);
        const now = new Date();
        let a = now.getFullYear() - birth.getFullYear();
        if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) a--;
        if (a > 0) setAge(String(a));
      }
      if (stored.gender) setGender(stored.gender as Gender);
      if (stored.weight) setWeightKg(String(stored.weight));
    }
  }, [isOpen]);

  /* ── Merge client profile defaults ───────────────────────────────── */
  useEffect(() => {
    if (clientProfile.age && !age) setAge(String(clientProfile.age));
    if (clientProfile.gender && !gender) setGender(clientProfile.gender);
    if (clientProfile.weightKg && !weightKg) setWeightKg(String(clientProfile.weightKg));
  }, [clientProfile, age, gender, weightKg]);

  const requiredSites = useMemo<SkinfoldSite[]>(() => {
    if (protocol === "jp3" && gender) {
      return gender === "male" ? ["pec", "umbilical", "mid_thigh"] : ["triceps", "supra_iliac", "mid_thigh"];
    }
    return PROTOCOL_SITES[protocol];
  }, [protocol, gender]);

  const canProceedToStep2 = protocol && (protocol !== "jp3" || !!gender);
  const canProceedToStep3 =
    canProceedToStep2 &&
    requiredSites.every((site) => (sites[site] || 0) > 0) &&
    Number(age) > 0 &&
    gender &&
    Number(weightKg) > 0;

  const result = useMemo(() => {
    if (!canProceedToStep3) return null;
    const sum = sumSites(sites, protocol);
    return calculateBodyFat(protocol, sum, Number(age), gender as Gender);
  }, [canProceedToStep3, sites, protocol, age, gender]);

  const handleSiteChange = (site: SkinfoldSite, value: string) => {
    const num = Number(value);
    setSites((prev) => ({ ...prev, [site]: Number.isNaN(num) || num < 0 ? 0 : num }));
  };

  const handleSave = async () => {
    if (!clientId || !result) return;
    setSaving(true);

    try {
      const success = await saveAssessment({
        protocol,
        sites: Object.fromEntries(requiredSites.map((site) => [site, sites[site]])) as Record<SkinfoldSite, number>,
        sum_mm: result.sumMm,
        body_fat_pct: result.bodyFatPct,
        weight_kg: Number(weightKg) || null,
        age_years: Number(age) || null,
        notes: notes || null,
      });

      if (success) {
        // Persist defaults back to onboarding storage
        const stored = getOnboardingData();
        const birthYear = new Date().getFullYear() - Number(age);
        const dateOfBirth = `${birthYear}-01-01`;
        setOnboardingData({
          ...(stored || ({} as Parameters<typeof setOnboardingData>[0])),
          dateOfBirth,
          gender: gender as Gender,
          weight: Number(weightKg),
        });

        onSaved?.();
        onClose();
        reset();
      }
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setStep(1);
    setProtocol("jp7");
    setSites({
      chin: 0,
      cheek: 0,
      pec: 0,
      mid_axillary: 0,
      umbilical: 0,
      supra_iliac: 0,
      subscapular: 0,
      triceps: 0,
      knee: 0,
      medial_calf: 0,
      mid_thigh: 0,
      hamstring: 0,
    });
    setNotes("");
  };

  const handleClose = () => {
    if (!saving) {
      onClose();
      reset();
    }
  };

  if (!isOpen) return null;

  const loading = resolving || profileLoading;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm lg:items-center"
        onClick={handleClose}
      >
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="flex w-full max-w-2xl flex-col rounded-t-2xl lg:max-h-[85vh] lg:rounded-2xl"
          style={{ backgroundColor: "var(--card-bg)" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b p-4" style={{ borderColor: "var(--card-border)" }}>
            <div>
              <h3 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                New Skinfold Assessment
              </h3>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Step {step} of 3
              </p>
            </div>
            <button onClick={handleClose} disabled={saving} className="rounded-lg p-1 hover:bg-slate-800">
              <X className="h-5 w-5" style={{ color: "var(--text-muted)" }} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent" style={{ color: "var(--text-muted)" }} />
              </div>
            ) : (
              <>
                {step === 1 && (
                  <div className="space-y-4">
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                      Choose the caliper protocol you want to use.
                    </p>
                    <div className="grid gap-3">
                      {PROTOCOL_ORDER.map((p) => (
                        <button
                          key={p}
                          onClick={() => setProtocol(p)}
                          className={`rounded-xl border p-4 text-left transition-all ${
                            protocol === p ? "border-[#00AEEF] bg-[rgba(0,174,239,0.08)]" : ""
                          }`}
                          style={{
                            borderColor: "var(--card-border)",
                            backgroundColor: protocol === p ? "rgba(0, 174, 239, 0.08)" : "transparent",
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold" style={{ color: "var(--text-primary)" }}>
                              {p === "jp3" ? "Jackson-Pollock 3-site" : p === "jp7" ? "Jackson-Pollock 7-site" : "Poliquin 12-site"}
                            </span>
                            {protocol === p && (
                              <div className="h-4 w-4 rounded-full" style={{ background: "linear-gradient(135deg, #00AEEF, #8B5CF6)" }} />
                            )}
                          </div>
                          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                            {PROTOCOL_DESCRIPTIONS[p]}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <FieldLabel icon={User}>Gender</FieldLabel>
                        <select
                          value={gender}
                          onChange={(e) => setGender(e.target.value as Gender)}
                          className="w-full rounded-xl border bg-transparent px-2 py-2 text-sm outline-none"
                          style={{ borderColor: "var(--card-border)", color: "var(--text-primary)" }}
                        >
                          <option value="">Select</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                        </select>
                      </div>
                      <div>
                        <FieldLabel icon={Calendar}>Age</FieldLabel>
                        <Input
                          type="number"
                          value={age}
                          onChange={(e) => setAge(e.target.value)}
                          placeholder="30"
                          className="w-full"
                        />
                      </div>
                      <div>
                        <FieldLabel icon={Weight}>Weight (kg)</FieldLabel>
                        <Input
                          type="number"
                          step="0.1"
                          value={weightKg}
                          onChange={(e) => setWeightKg(e.target.value)}
                          placeholder="75"
                          className="w-full"
                        />
                      </div>
                    </div>

                    <div className="rounded-xl border p-3" style={{ borderColor: "var(--card-border)" }}>
                      <h4 className="mb-2 text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                        Skinfold sites (mm)
                      </h4>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {requiredSites.map((site) => (
                          <div key={site}>
                            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                              {formatSiteName(site)}
                            </label>
                            <Input
                              type="number"
                              step="0.5"
                              min="0"
                              value={sites[site] || ""}
                              onChange={(e) => handleSiteChange(site, e.target.value)}
                              placeholder="0.0"
                            />
                            <p className="mt-0.5 text-[10px]" style={{ color: "var(--text-muted)" }}>
                              {SITE_HINTS[site]}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <FieldLabel icon={Ruler}>Notes</FieldLabel>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="min-h-[60px] w-full rounded-xl border bg-transparent px-3 py-2 text-sm outline-none"
                        style={{ borderColor: "var(--card-border)", color: "var(--text-primary)" }}
                        placeholder="Optional notes..."
                      />
                    </div>
                  </div>
                )}

                {step === 3 && result && (
                  <div className="space-y-4">
                    <div
                      className="rounded-xl border p-4 text-center"
                      style={{ borderColor: "var(--card-border)", background: "linear-gradient(135deg, rgba(0, 174, 239, 0.1), rgba(139, 92, 246, 0.1))" }}
                    >
                      <p className="text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                        Sum of skinfolds
                      </p>
                      <p className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
                        {result.sumMm.toFixed(1)} mm
                      </p>
                      {result.bodyFatPct !== null && (
                        <>
                          <p className="mt-2 text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                            Estimated body fat
                          </p>
                          <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                            {result.bodyFatPct.toFixed(1)}%
                          </p>
                          {result.bodyDensity && (
                            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                              Body density: {result.bodyDensity.toFixed(5)}
                            </p>
                          )}
                        </>
                      )}
                      {protocol === "poliquin12" && (
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                          Poliquin 12-site does not estimate body fat % from calipers alone.
                        </p>
                      )}
                    </div>

                    <div className="rounded-xl border p-3 text-sm" style={{ borderColor: "var(--card-border)" }}>
                      <p style={{ color: "var(--text-muted)" }}>
                        <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                          Protocol:
                        </span>{" "}
                        {protocol.toUpperCase()}
                      </p>
                      <p style={{ color: "var(--text-muted)" }}>
                        <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                          Age / Gender / Weight:
                        </span>{" "}
                        {age} yrs / {gender} / {weightKg} kg
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t p-4" style={{ borderColor: "var(--card-border)" }}>
            <Button
              variant="outline"
              onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s))}
              disabled={step === 1 || saving || loading}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>

            {step < 3 ? (
              <Button
                onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
                disabled={step === 1 ? !canProceedToStep2 : !canProceedToStep3}
                className="gap-1"
                style={{ background: "linear-gradient(135deg, #00AEEF, #8B5CF6)" }}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSave}
                disabled={saving || !result}
                className="gap-1"
                style={{ background: "linear-gradient(135deg, #00AEEF, #8B5CF6)" }}
              >
                <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Assessment"}
              </Button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function FieldLabel({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <p className="mb-1 flex items-center gap-1 text-xs font-medium" style={{ color: "var(--text-muted)" }}>
      <Icon className="h-3 w-3" /> {children}
    </p>
  );
}
