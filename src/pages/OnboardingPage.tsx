import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight, ChevronLeft, User, Scale, Dumbbell,
  Apple, Check, Droplets, Briefcase, PersonStanding,
  Building2, Home, Trees, Dumbbell as DumbbellIcon,
  Watch, PartyPopper,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { calculateBMI, calculateBMR, calculateTDEE } from '@/lib/utils';

import { useGoalCategories } from '@/hooks/useSupabaseData';
import { createClientProfile, getSession } from '@/services/auth';
import { setOnboardingData, clearOnboardingData } from '@/lib/storage';

import {
  type OnboardingData,
  INITIAL_ONBOARDING_DATA,
  PARQ_QUESTIONS,
  EXPERIENCE_OPTIONS,
  FREQUENCY_OPTIONS,
  ACTIVITY_OPTIONS,
  EQUIPMENT_OPTIONS,
  GYM_TYPE_OPTIONS,
  SESSION_LENGTH_OPTIONS,
  DEVICE_OPTIONS,
  MACRO_PRESETS,
  BODY_MEASUREMENTS,
  type ConnectableDevice,
} from '@/types/onboarding';

/* ── Step titles & icons ─────────────────────────────── */

const STEP_TITLES = [
  'Your Role',
  'Personal Info',
  'Body Composition',
  'Fitness Background',
  'Training Setup',
  'TDEE & Nutrition',
  'Device Connect',
  'Review',
  'All Set!',
] as const;

const STEP_ICONS: LucideIcon[] = [
  Briefcase, User, Scale, Dumbbell, DumbbellIcon, Apple, Watch, Check, PartyPopper,
];

/* ── Main Component ────────────────────────────────────── */

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<OnboardingData>(INITIAL_ONBOARDING_DATA);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const updateData = useCallback((updates: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  }, []);

  /* ── Derived values ── */
  const age = useMemo(() => {
    if (!data.dateOfBirth) return 0;
    const birth = new Date(data.dateOfBirth);
    const now = new Date();
    let a = now.getFullYear() - birth.getFullYear();
    if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) a--;
    return a;
  }, [data.dateOfBirth]);

  const bmi = useMemo(() => calculateBMI(data.weight, data.height), [data.weight, data.height]);
  const bmr = useMemo(() => {
    if (!data.weight || !data.height || !age || !data.gender) return 0;
    return calculateBMR(data.weight, data.height, age, data.gender as 'male' | 'female');
  }, [data.weight, data.height, age, data.gender]);
  const tdee = useMemo(() => calculateTDEE(bmr, data.activityLevel), [bmr, data.activityLevel]);

  const calorieGoal = useMemo(() => {
    if (!tdee) return 0;
    switch (data.primaryGoal) {
      case 'lose_fat': return tdee - 500;
      case 'build_muscle': return tdee + 300;
      case 'strength': return tdee + 200;
      case 'performance': return tdee + 400;
      default: return tdee;
    }
  }, [tdee, data.primaryGoal]);

  const macros = useMemo(() => {
    const preset = MACRO_PRESETS[data.macroSplit];
    return {
      protein: Math.round((calorieGoal * preset.protein) / 4),
      fats: Math.round((calorieGoal * preset.fats) / 9),
      carbs: Math.round((calorieGoal * preset.carbs) / 4),
    };
  }, [calorieGoal, data.macroSplit]);

  const waterGoal = useMemo(() => Math.round(data.weight * 35), [data.weight]);

  /* ── Progress gate ── */
  const canProceed = useMemo(() => {
    switch (step) {
      case 1: return data.role !== '';
      case 2: return data.fullName && data.email && data.dateOfBirth && data.gender;
      case 3: return data.weight > 0 && data.goalWeight > 0 && data.height > 0;
      case 4: return data.trainingExperience && data.trainingFrequency && data.activityLevel && data.primaryGoal;
      case 5: return data.gymType !== '' && data.sessionLength > 0;
      case 6: return true;
      case 7: return true;
      case 8: return true;
      case 9: return true;
      default: return false;
    }
  }, [step, data]);

  /* ── Completion handler ── */
  const handleComplete = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    // Build the profile data object
    const profileData = {
      fullName: data.fullName,
      email: data.email,
      phone: data.phone,
      dateOfBirth: data.dateOfBirth,
      gender: data.gender || undefined,
      heightCm: data.height || undefined,
      weightKg: data.weight || undefined,
      bodyFatPercentage: data.bodyFatPercentage,
      fitnessGoal: data.primaryGoal,
      experienceLevel: data.trainingExperience as 'beginner' | 'intermediate' | 'advanced' | undefined,
      trainingFrequency: data.trainingFrequency,
      activityLevel: data.activityLevel,
      injuries: data.injuries,
      availableEquipment: data.availableEquipment,
      gymType: data.gymType,
      sessionLength: data.sessionLength,
      hasCoach: data.hasCoach,
      coachCode: data.coachCode,
      macroSplit: data.macroSplit,
      mealCount: data.mealCount,
      connectedDevices: data.connectedDevices,
    };

    // Try Supabase first
    const session = await getSession();
    if (session) {
      const { clientId, error } = await createClientProfile(profileData);
      if (!error && clientId) {
        // Success — clear localStorage draft and go to celebration
        clearOnboardingData();
        setStep(9);
        setIsSubmitting(false);
        return;
      }
      // Supabase failed — fall back to localStorage
      console.warn('Supabase profile creation failed, falling back to localStorage:', error?.message);
    }

    // Fallback: save to localStorage
    setOnboardingData({
      ...data,
      weight: data.weight,
      goalWeight: data.goalWeight,
      height: data.height,
      bodyFatPercentage: data.bodyFatPercentage,
      primaryGoal: data.primaryGoal,
      primaryGoalId: data.primaryGoalId,
      trainingExperience: data.trainingExperience,
      trainingFrequency: data.trainingFrequency,
      activityLevel: data.activityLevel,
      gymType: data.gymType,
      sessionLength: data.sessionLength,
      hasCoach: data.hasCoach,
      coachCode: data.coachCode,
      macroSplit: data.macroSplit,
      mealCount: data.mealCount,
      connectedDevices: data.connectedDevices,
      injuries: data.injuries,
      availableEquipment: data.availableEquipment,
      parqAnswers: data.parqAnswers,
      useNavyMethod: data.useNavyMethod,
      navyNeck: data.navyNeck,
      navyWaist: data.navyWaist,
      navyHip: data.navyHip,
      measurements: data.measurements,
      progressPhoto: data.progressPhoto,
      photo: data.photo,
      preferredStyle: data.preferredStyle,
    });

    // Also save legacy profile for backward compatibility
    const profile = {
      id: crypto.randomUUID(),
      name: data.fullName,
      email: data.email,
      phone: data.phone,
      dateOfBirth: data.dateOfBirth,
      gender: data.gender,
      photo: data.photo,
      weight: data.weight,
      goalWeight: data.goalWeight,
      height: data.height,
      bodyFatPercentage: data.bodyFatPercentage,
      measurements: data.measurements,
      progressPhoto: data.progressPhoto,
      parqAnswers: data.parqAnswers,
      parqFlagged: data.parqAnswers.some((a) => a),
      trainingExperience: data.trainingExperience,
      trainingFrequency: Number(data.trainingFrequency),
      activityLevel: data.activityLevel,
      primaryGoal: data.primaryGoal,
      primaryGoalId: data.primaryGoalId,
      injuries: data.injuries,
      preferredStyle: data.preferredStyle,
      availableEquipment: data.availableEquipment,
      gymType: data.gymType,
      sessionLength: data.sessionLength,
      hasCoach: data.hasCoach,
      coachCode: data.coachCode,
      connectedDevices: data.connectedDevices,
      tdee,
      calorieGoal,
      macroSplit: data.macroSplit,
      proteinGrams: macros.protein,
      fatsGrams: macros.fats,
      carbsGrams: macros.carbs,
      waterGoal,
      mealCount: Number(data.mealCount),
      role: data.role,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    localStorage.setItem('azfit_client_profile', JSON.stringify(profile));
    localStorage.setItem('azfit_nutrition_plan', JSON.stringify({
      clientId: profile.id, calorieGoal, macroSplit: data.macroSplit,
      proteinGrams: macros.protein, fatsGrams: macros.fats, carbsGrams: macros.carbs,
      waterGoal, mealCount: Number(data.mealCount), createdAt: Date.now(),
    }));

    setStep(9);
    setIsSubmitting(false);
  };

  const StepIcon = STEP_ICONS[step - 1] || User;
  const totalSteps = 9;

  return (
    <div className="min-h-[100dvh] pb-20" style={{ backgroundColor: 'var(--page-bg)' }}>
      {/* Header */}
      <div className="sticky top-0 z-30 border-b backdrop-blur-xl" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
        <div className="mx-auto max-w-2xl px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, #00AEEF, #8B5CF6)' }}>
                <StepIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                  {STEP_TITLES[step - 1]}
                </h1>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Step {step} of {totalSteps}</p>
              </div>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
                <div
                  key={s}
                  className="h-2 w-2 rounded-full"
                  style={{
                    backgroundColor: s <= step ? '#00AEEF' : 'var(--card-border)',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {submitError && (
        <div className="mx-auto max-w-2xl px-4 pt-4">
          <div className="rounded-lg bg-red-500/10 p-3 text-xs text-red-500">
            {submitError}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="mx-auto max-w-2xl px-4 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {step === 1 && <Step1Role data={data} updateData={updateData} />}
            {step === 2 && <Step2Personal data={data} updateData={updateData} />}
            {step === 3 && <Step3Body data={data} updateData={updateData} />}
            {step === 4 && <Step4Fitness data={data} updateData={updateData} />}
            {step === 5 && <Step5TrainingSetup data={data} updateData={updateData} />}
            {step === 6 && <Step6TDEE data={data} updateData={updateData} age={age} bmi={bmi} bmr={bmr} tdee={tdee} calorieGoal={calorieGoal} macros={macros} waterGoal={waterGoal} />}
            {step === 7 && <Step7Devices data={data} updateData={updateData} />}
            {step === 8 && <Step8Review data={data} age={age} bmi={bmi} tdee={tdee} calorieGoal={calorieGoal} macros={macros} waterGoal={waterGoal} />}
            {step === 9 && <Step9Complete data={data} navigate={navigate} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer Buttons */}
      {step < 9 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-white/90 backdrop-blur-xl dark:bg-slate-950/90 lg:left-[280px]">
          <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
            <button
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1}
              className="flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-30"
              style={{ color: 'var(--text-muted)' }}
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
            {step < 8 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canProceed}
                className="flex items-center gap-1 rounded-xl px-6 py-2.5 text-sm font-bold text-white transition-all disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #00AEEF, #8B5CF6)' }}
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={handleComplete}
                disabled={isSubmitting}
                className="flex items-center gap-1 rounded-xl px-6 py-2.5 text-sm font-bold text-white transition-all disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #00AEEF, #8B5CF6)' }}
              >
                {isSubmitting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" /> Complete Setup
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Step 1: Role Selection ─────────────────────────────── */

function Step1Role({ data, updateData }: { data: OnboardingData; updateData: (u: Partial<OnboardingData>) => void }) {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Welcome to AzFIT
        </h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          Let&apos;s get you set up. Which best describes you?
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Coach option */}
        <button
          onClick={() => updateData({ role: 'trainer' })}
          className="flex flex-col items-center gap-3 rounded-2xl border-2 p-6 text-center transition-all"
          style={{
            borderColor: data.role === 'trainer' ? '#00AEEF' : 'var(--card-border)',
            backgroundColor: data.role === 'trainer' ? 'rgba(0,174,239,0.1)' : 'transparent',
          }}
        >
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full"
            style={{ backgroundColor: data.role === 'trainer' ? '#00AEEF' : 'var(--card-border)' }}
          >
            <Briefcase className="h-7 w-7 text-white" />
          </div>
          <div>
            <p
              className="font-bold"
              style={{ color: data.role === 'trainer' ? '#00AEEF' : 'var(--text-primary)' }}
            >
              I&apos;m a Coach / Trainer
            </p>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              I want to manage clients and build programs
            </p>
          </div>
        </button>

        {/* Client option */}
        <button
          onClick={() => updateData({ role: 'client' })}
          className="flex flex-col items-center gap-3 rounded-2xl border-2 p-6 text-center transition-all"
          style={{
            borderColor: data.role === 'client' ? '#00AEEF' : 'var(--card-border)',
            backgroundColor: data.role === 'client' ? 'rgba(0,174,239,0.1)' : 'transparent',
          }}
        >
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full"
            style={{ backgroundColor: data.role === 'client' ? '#00AEEF' : 'var(--card-border)' }}
          >
            <PersonStanding className="h-7 w-7 text-white" />
          </div>
          <div>
            <p
              className="font-bold"
              style={{ color: data.role === 'client' ? '#00AEEF' : 'var(--text-primary)' }}
            >
              I&apos;m Training for Myself
            </p>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              I want to track workouts, nutrition, and progress
            </p>
          </div>
        </button>
      </div>

      <p className="text-center text-xs" style={{ color: 'var(--text-muted)' }}>
        Already have an account?{' '}
        <button
          onClick={() => navigate('/login')}
          className="font-medium underline"
          style={{ color: '#00AEEF' }}
        >
          Log In
        </button>
      </p>
    </div>
  );
}

/* ── Step 2: Personal Info ─────────────────────────────── */

function Step2Personal({ data, updateData }: { data: OnboardingData; updateData: (u: Partial<OnboardingData>) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Full Name *</Label>
        <Input value={data.fullName} onChange={(e) => updateData({ fullName: e.target.value })} placeholder="John Doe" />
      </div>
      <div>
        <Label>Email *</Label>
        <Input type="email" value={data.email} onChange={(e) => updateData({ email: e.target.value })} placeholder="john@example.com" />
      </div>
      <div>
        <Label>Phone</Label>
        <Input value={data.phone} onChange={(e) => updateData({ phone: e.target.value })} placeholder="+852 9123 4567" />
      </div>
      <div>
        <Label>Date of Birth *</Label>
        <Input type="date" value={data.dateOfBirth} onChange={(e) => updateData({ dateOfBirth: e.target.value })} />
      </div>
      <div>
        <Label>Gender *</Label>
        <div className="flex gap-2">
          {(['male', 'female'] as const).map((g) => (
            <button
              key={g}
              onClick={() => updateData({ gender: g })}
              className="flex-1 rounded-xl border-2 py-3 text-sm font-medium capitalize transition-all"
              style={{
                borderColor: data.gender === g ? '#00AEEF' : 'var(--card-border)',
                backgroundColor: data.gender === g ? 'rgba(0,174,239,0.1)' : 'transparent',
                color: data.gender === g ? '#00AEEF' : 'var(--text-primary)',
              }}
            >
              {g}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Step 3: Body Composition ──────────────────────────── */

function Step3Body({ data, updateData }: { data: OnboardingData; updateData: (u: Partial<OnboardingData>) => void }) {
  const calculateNavyBF = () => {
    if (!data.gender || !data.height || !data.navyWaist || !data.navyNeck) return;
    const h = data.height;
    let bf = 0;
    if (data.gender === 'male') {
      bf = 86.01 * Math.log10(data.navyWaist - data.navyNeck) - 70.041 * Math.log10(h) + 36.76;
    } else {
      bf = 163.205 * Math.log10(data.navyWaist + data.navyHip - data.navyNeck) - 97.684 * Math.log10(h) - 78.387;
    }
    updateData({ bodyFatPercentage: Math.max(2, Math.min(60, Math.round(bf * 10) / 10)) });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Current Weight (kg) *</Label>
          <Input type="number" value={data.weight || ''} onChange={(e) => updateData({ weight: Number(e.target.value) })} placeholder="75" />
        </div>
        <div>
          <Label>Goal Weight (kg) *</Label>
          <Input type="number" value={data.goalWeight || ''} onChange={(e) => updateData({ goalWeight: Number(e.target.value) })} placeholder="70" />
        </div>
      </div>
      <div>
        <Label>Height (cm) *</Label>
        <Input type="number" value={data.height || ''} onChange={(e) => updateData({ height: Number(e.target.value) })} placeholder="175" />
      </div>
      <div>
        <Label>Body Fat %</Label>
        <div className="flex gap-2">
          <Input type="number" value={data.bodyFatPercentage || ''} onChange={(e) => updateData({ bodyFatPercentage: Number(e.target.value) })} placeholder="15" />
          <button
            onClick={() => updateData({ useNavyMethod: !data.useNavyMethod })}
            className="whitespace-nowrap rounded-lg px-3 text-xs font-medium"
            style={{ backgroundColor: data.useNavyMethod ? 'rgba(0,174,239,0.1)' : 'var(--light-elevated)', color: data.useNavyMethod ? '#00AEEF' : 'var(--text-muted)' }}
          >
            {data.useNavyMethod ? 'Hide Calculator' : 'Navy Method'}
          </button>
        </div>
      </div>

      {data.useNavyMethod && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="space-y-3 rounded-xl border p-4" style={{ borderColor: 'var(--card-border)' }}>
          <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Navy Body Fat Calculator</p>
          <div className="grid grid-cols-2 gap-2">
            <Input type="number" placeholder="Neck (cm)" value={data.navyNeck || ''} onChange={(e) => updateData({ navyNeck: Number(e.target.value) })} />
            <Input type="number" placeholder="Waist (cm)" value={data.navyWaist || ''} onChange={(e) => updateData({ navyWaist: Number(e.target.value) })} />
            {data.gender === 'female' && (
              <Input type="number" placeholder="Hip (cm)" value={data.navyHip || ''} onChange={(e) => updateData({ navyHip: Number(e.target.value) })} />
            )}
          </div>
          <Button onClick={calculateNavyBF} className="w-full" style={{ background: 'linear-gradient(135deg, #00AEEF, #8B5CF6)' }}>
            Calculate Body Fat %
          </Button>
          {data.bodyFatPercentage !== undefined && data.bodyFatPercentage > 0 && (
            <p className="text-center text-sm font-bold" style={{ color: '#00AEEF' }}>Estimated: {data.bodyFatPercentage}%</p>
          )}
        </motion.div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {BODY_MEASUREMENTS.map((m) => (
          <div key={m}>
            <Label className="text-xs">{m} (cm)</Label>
            <Input type="number" placeholder="0" value={data.measurements[m] || ''} onChange={(e) => updateData({ measurements: { ...data.measurements, [m]: Number(e.target.value) } })} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Step 4: Fitness Background ────────────────────────── */

function Step4Fitness({ data, updateData }: { data: OnboardingData; updateData: (u: Partial<OnboardingData>) => void }) {
  const { data: goalCategories, loading: goalsLoading, error: goalsError } = useGoalCategories();

  const handleGoalSelect = (goalName: string, goalId: string) => {
    updateData({ primaryGoal: goalName, primaryGoalId: goalId });
  };

  return (
    <div className="space-y-5">
      {/* PAR-Q */}
      <div>
        <h3 className="mb-2 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>PAR-Q (Physical Activity Readiness)</h3>
        <div className="space-y-2">
          {PARQ_QUESTIONS.map((q, i) => (
            <label key={i} className="flex items-start gap-2 rounded-lg border p-3" style={{ borderColor: 'var(--card-border)' }}>
              <input
                type="checkbox"
                checked={data.parqAnswers[i]}
                onChange={(e) => {
                  const next = [...data.parqAnswers];
                  next[i] = e.target.checked;
                  updateData({ parqAnswers: next });
                }}
                className="mt-0.5 h-4 w-4 accent-[#00AEEF]"
              />
              <span className="text-xs" style={{ color: 'var(--text-primary)' }}>{q}</span>
            </label>
          ))}
        </div>
        {data.parqAnswers.some((a) => a) && (
          <p className="mt-2 rounded-lg bg-amber-500/10 p-2 text-xs text-amber-500">
            ⚠️ Please consult with your physician before starting this program.
          </p>
        )}
      </div>

      {/* Experience */}
      <div>
        <Label>Training Experience *</Label>
        <div className="grid grid-cols-3 gap-2">
          {EXPERIENCE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => updateData({ trainingExperience: opt.value })}
              className="rounded-xl border-2 py-3 text-center text-xs font-medium transition-all"
              style={{
                borderColor: data.trainingExperience === opt.value ? '#00AEEF' : 'var(--card-border)',
                backgroundColor: data.trainingExperience === opt.value ? 'rgba(0,174,239,0.1)' : 'transparent',
                color: data.trainingExperience === opt.value ? '#00AEEF' : 'var(--text-primary)',
              }}
            >
              <div className="font-bold">{opt.label}</div>
              <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{opt.sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Frequency */}
      <div>
        <Label>Training Frequency (days/week) *</Label>
        <div className="flex gap-2">
          {FREQUENCY_OPTIONS.map((f) => (
            <button
              key={f}
              onClick={() => updateData({ trainingFrequency: f })}
              className="flex-1 rounded-xl border-2 py-2.5 text-sm font-bold transition-all"
              style={{
                borderColor: data.trainingFrequency === f ? '#00AEEF' : 'var(--card-border)',
                backgroundColor: data.trainingFrequency === f ? 'rgba(0,174,239,0.1)' : 'transparent',
                color: data.trainingFrequency === f ? '#00AEEF' : 'var(--text-primary)',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Activity Level */}
      <div>
        <Label>Activity Level *</Label>
        <div className="space-y-2">
          {ACTIVITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => updateData({ activityLevel: opt.value })}
              className="flex w-full items-center justify-between rounded-xl border-2 px-4 py-3 text-left text-sm transition-all"
              style={{
                borderColor: data.activityLevel === opt.value ? '#00AEEF' : 'var(--card-border)',
                backgroundColor: data.activityLevel === opt.value ? 'rgba(0,174,239,0.1)' : 'transparent',
              }}
            >
              <div>
                <div className="font-medium" style={{ color: data.activityLevel === opt.value ? '#00AEEF' : 'var(--text-primary)' }}>{opt.label}</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{opt.sub}</div>
              </div>
              {data.activityLevel === opt.value && <Check className="h-4 w-4" style={{ color: '#00AEEF' }} />}
            </button>
          ))}
        </div>
      </div>

      {/* Primary Goal — Dynamic from Supabase */}
      <div>
        <Label>Primary Goal *</Label>
        {goalsLoading && (
          <div className="flex items-center gap-2 py-4 text-sm" style={{ color: 'var(--text-muted)' }}>
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#00AEEF] border-t-transparent" />
            Loading goals...
          </div>
        )}
        {goalsError && (
          <p className="py-2 text-xs text-red-500">Failed to load goals: {goalsError}</p>
        )}
        {!goalsLoading && goalCategories && (
          <div className="space-y-4">
            {goalCategories.map((category) => (
              <div key={category.id}>
                <h4 className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                  {category.name}
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {category.goals?.map((goal) => (
                    <button
                      key={goal.id}
                      onClick={() => handleGoalSelect(goal.name, goal.id)}
                      className="rounded-xl border-2 py-3 text-center text-sm font-medium transition-all"
                      style={{
                        borderColor: data.primaryGoalId === goal.id ? '#00AEEF' : 'var(--card-border)',
                        backgroundColor: data.primaryGoalId === goal.id ? 'rgba(0,174,239,0.1)' : 'transparent',
                        color: data.primaryGoalId === goal.id ? '#00AEEF' : 'var(--text-primary)',
                      }}
                    >
                      {goal.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Injuries */}
      <div>
        <Label>Injuries / Limitations</Label>
        <textarea
          value={data.injuries}
          onChange={(e) => updateData({ injuries: e.target.value })}
          placeholder="List any current injuries, pain, or movement limitations..."
          className="min-h-[80px] w-full rounded-xl border bg-transparent px-3 py-2 text-sm outline-none"
          style={{ borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}
        />
      </div>

      {/* Equipment */}
      <div>
        <Label>Available Equipment</Label>
        <div className="flex flex-wrap gap-2">
          {EQUIPMENT_OPTIONS.map((eq) => (
            <button
              key={eq}
              onClick={() => {
                const next = data.availableEquipment.includes(eq)
                  ? data.availableEquipment.filter((e) => e !== eq)
                  : [...data.availableEquipment, eq];
                updateData({ availableEquipment: next });
              }}
              className="rounded-full border-2 px-4 py-1.5 text-xs font-medium transition-all"
              style={{
                borderColor: data.availableEquipment.includes(eq) ? '#00AEEF' : 'var(--card-border)',
                backgroundColor: data.availableEquipment.includes(eq) ? 'rgba(0,174,239,0.1)' : 'transparent',
                color: data.availableEquipment.includes(eq) ? '#00AEEF' : 'var(--text-primary)',
              }}
            >
              {eq}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Step 5: Training Setup (NEW) ──────────────────────── */

function Step5TrainingSetup({ data, updateData }: { data: OnboardingData; updateData: (u: Partial<OnboardingData>) => void }) {
  return (
    <div className="space-y-6">
      {/* Gym Type */}
      <div>
        <Label>Where do you train? *</Label>
        <div className="mt-2 grid grid-cols-2 gap-3">
          {GYM_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => updateData({ gymType: opt.value })}
              className="flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all"
              style={{
                borderColor: data.gymType === opt.value ? '#00AEEF' : 'var(--card-border)',
                backgroundColor: data.gymType === opt.value ? 'rgba(0,174,239,0.1)' : 'transparent',
              }}
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full"
                style={{ backgroundColor: data.gymType === opt.value ? '#00AEEF' : 'var(--card-border)' }}
              >
                {opt.value === 'commercial' && <Building2 className="h-5 w-5 text-white" />}
                {opt.value === 'home' && <Home className="h-5 w-5 text-white" />}
                {opt.value === 'outdoor' && <Trees className="h-5 w-5 text-white" />}
                {opt.value === 'mixed' && <DumbbellIcon className="h-5 w-5 text-white" />}
              </div>
              <div>
                <p
                  className="text-sm font-bold"
                  style={{ color: data.gymType === opt.value ? '#00AEEF' : 'var(--text-primary)' }}
                >
                  {opt.label}
                </p>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{opt.sub}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Training Frequency */}
      <div>
        <Label>How many days per week? *</Label>
        <div className="mt-2 flex gap-2">
          {['2', '3', '4', '5', '6', '7'].map((f) => (
            <button
              key={f}
              onClick={() => updateData({ trainingFrequency: f })}
              className="flex-1 rounded-xl border-2 py-2.5 text-sm font-bold transition-all"
              style={{
                borderColor: data.trainingFrequency === f ? '#00AEEF' : 'var(--card-border)',
                backgroundColor: data.trainingFrequency === f ? 'rgba(0,174,239,0.1)' : 'transparent',
                color: data.trainingFrequency === f ? '#00AEEF' : 'var(--text-primary)',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Session Length */}
      <div>
        <Label>Typical session length? *</Label>
        <div className="mt-2 flex gap-2">
          {SESSION_LENGTH_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => updateData({ sessionLength: opt.value })}
              className="flex-1 rounded-xl border-2 py-2.5 text-xs font-bold transition-all"
              style={{
                borderColor: data.sessionLength === opt.value ? '#00AEEF' : 'var(--card-border)',
                backgroundColor: data.sessionLength === opt.value ? 'rgba(0,174,239,0.1)' : 'transparent',
                color: data.sessionLength === opt.value ? '#00AEEF' : 'var(--text-primary)',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Coach Code */}
      <div className="rounded-xl border p-4" style={{ borderColor: 'var(--card-border)' }}>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={data.hasCoach}
            onChange={(e) => updateData({ hasCoach: e.target.checked })}
            className="h-4 w-4 accent-[#00AEEF]"
          />
          <Label className="mb-0">I have a coach who invited me</Label>
        </div>
        {data.hasCoach && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mt-3">
            <Label className="text-xs">Coach Code (optional)</Label>
            <Input
              value={data.coachCode}
              onChange={(e) => updateData({ coachCode: e.target.value })}
              placeholder="Enter your coach's referral code"
            />
            <p className="mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
              Your coach will be able to see your progress and assign programs.
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}

/* ── Step 6: TDEE & Nutrition ──────────────────────────── */

function Step6TDEE({ data, updateData, age, bmi, bmr, tdee, calorieGoal, macros, waterGoal }: {
  data: OnboardingData; updateData: (u: Partial<OnboardingData>) => void;
  age: number; bmi: number; bmr: number; tdee: number; calorieGoal: number;
  macros: { protein: number; fats: number; carbs: number }; waterGoal: number;
}) {
  const goalLabel = useMemo(() => {
    return data.primaryGoal || 'Maintenance';
  }, [data.primaryGoal]);

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Age" value={`${age}`} unit="years" />
        <StatCard label="BMI" value={bmi.toFixed(1)} />
        <StatCard label="BMR" value={`${bmr.toLocaleString()}`} unit="kcal" />
        <StatCard label="TDEE" value={`${tdee.toLocaleString()}`} unit="kcal" />
      </div>

      {/* Calorie Goal */}
      <div className="rounded-2xl border p-4 text-center" style={{ borderColor: 'var(--card-border)' }}>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Daily Calorie Target ({goalLabel})</p>
        <p className="text-3xl font-bold" style={{ color: '#00AEEF' }}>{calorieGoal.toLocaleString()}</p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>kcal / day</p>
      </div>

      {/* Macro Split */}
      <div>
        <Label>Macro Split</Label>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(MACRO_PRESETS) as Array<keyof typeof MACRO_PRESETS>).map((key) => {
            const preset = MACRO_PRESETS[key];
            return (
              <button
                key={key}
                onClick={() => updateData({ macroSplit: key })}
                className="rounded-xl border-2 p-3 text-center text-xs transition-all"
                style={{
                  borderColor: data.macroSplit === key ? '#00AEEF' : 'var(--card-border)',
                  backgroundColor: data.macroSplit === key ? 'rgba(0,174,239,0.1)' : 'transparent',
                }}
              >
                <div className="font-bold" style={{ color: data.macroSplit === key ? '#00AEEF' : 'var(--text-primary)' }}>{preset.label}</div>
                <div className="mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>{preset.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Macro Display */}
      <div className="grid grid-cols-3 gap-3">
        <MacroCard label="Protein" value={macros.protein} color="#0D9488" />
        <MacroCard label="Fats" value={macros.fats} color="#F59E0B" />
        <MacroCard label="Carbs" value={macros.carbs} color="#22C55E" />
      </div>

      {/* Water */}
      <div className="flex items-center gap-3 rounded-xl border p-3" style={{ borderColor: 'var(--card-border)' }}>
        <Droplets className="h-5 w-5" style={{ color: '#00AEEF' }} />
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Water Goal</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>~{(waterGoal / 1000).toFixed(1)}L daily ({waterGoal}ml)</p>
        </div>
      </div>

      {/* Meal Count */}
      <div>
        <Label>Meals Per Day</Label>
        <div className="flex gap-2">
          {['3', '4', '5', '6'].map((m) => (
            <button
              key={m}
              onClick={() => updateData({ mealCount: m })}
              className="flex-1 rounded-xl border-2 py-2.5 text-sm font-bold transition-all"
              style={{
                borderColor: data.mealCount === m ? '#00AEEF' : 'var(--card-border)',
                backgroundColor: data.mealCount === m ? 'rgba(0,174,239,0.1)' : 'transparent',
                color: data.mealCount === m ? '#00AEEF' : 'var(--text-primary)',
              }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Step 7: Device Connect (NEW) ──────────────────────── */

function Step7Devices({ data, updateData }: { data: OnboardingData; updateData: (u: Partial<OnboardingData>) => void }) {
  const toggleDevice = (device: ConnectableDevice) => {
    const next = data.connectedDevices.includes(device)
      ? data.connectedDevices.filter((d) => d !== device)
      : [...data.connectedDevices, device];
    updateData({ connectedDevices: next });
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Connect Your Devices
        </h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          Sync data automatically for smarter coaching (optional)
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {DEVICE_OPTIONS.map((device) => (
          <button
            key={device.value}
            onClick={() => toggleDevice(device.value)}
            className="flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all"
            style={{
              borderColor: data.connectedDevices.includes(device.value) ? '#00AEEF' : 'var(--card-border)',
              backgroundColor: data.connectedDevices.includes(device.value) ? 'rgba(0,174,239,0.1)' : 'transparent',
            }}
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: data.connectedDevices.includes(device.value) ? '#00AEEF' : 'var(--card-border)' }}
            >
              <Watch className="h-5 w-5 text-white" />
            </div>
            <div>
              <p
                className="text-sm font-bold"
                style={{ color: data.connectedDevices.includes(device.value) ? '#00AEEF' : 'var(--text-primary)' }}
              >
                {device.label}
              </p>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                {data.connectedDevices.includes(device.value) ? 'Will connect' : 'Tap to select'}
              </p>
            </div>
            {data.connectedDevices.includes(device.value) && (
              <Check className="ml-auto h-5 w-5 shrink-0" style={{ color: '#00AEEF' }} />
            )}
          </button>
        ))}
      </div>

      <div className="rounded-xl border p-4 text-center" style={{ borderColor: 'var(--card-border)' }}>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          You can skip this step and connect devices later from Settings.
        </p>
      </div>
    </div>
  );
}

/* ── Step 8: Review ────────────────────────────────────── */

function Step8Review({ data, age, bmi, tdee, calorieGoal, macros, waterGoal }: {
  data: OnboardingData; age: number; bmi: number; tdee: number; calorieGoal: number;
  macros: { protein: number; fats: number; carbs: number }; waterGoal: number;
}) {
  const bfBadge = useMemo(() => {
    const bf = data.bodyFatPercentage;
    if (!bf) return null;
    if (bf < 10) return { label: 'Lean', color: '#22C55E' };
    if (bf < 15) return { label: 'Athletic', color: '#0D9488' };
    if (bf < 20) return { label: 'Fit', color: '#00AEEF' };
    if (bf < 25) return { label: 'Average', color: '#F59E0B' };
    return { label: 'Higher', color: '#EF4444' };
  }, [data.bodyFatPercentage]);

  return (
    <div className="space-y-4">
      {/* Profile Card */}
      <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--card-border)' }}>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800">
            <User className="h-6 w-6 text-slate-400" />
          </div>
          <div>
            <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{data.fullName}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{data.email} • {age} years • {data.gender}</p>
          </div>
          <div className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold uppercase" style={{ backgroundColor: 'rgba(0,174,239,0.1)', color: '#00AEEF' }}>
            {data.role}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <ReviewItem label="Weight" value={`${data.weight} → ${data.goalWeight} kg`} />
        <ReviewItem label="Height" value={`${data.height} cm`} />
        <ReviewItem label="BMI" value={bmi.toFixed(1)} />
        <ReviewItem label="TDEE" value={`${tdee.toLocaleString()} kcal`} />
        {data.bodyFatPercentage && (
          <ReviewItem label="Body Fat" value={`${data.bodyFatPercentage}% ${bfBadge ? `(${bfBadge.label})` : ''}`} />
        )}
        <ReviewItem label="Experience" value={data.trainingExperience} />
        <ReviewItem label="Frequency" value={`${data.trainingFrequency} days/week`} />
        <ReviewItem label="Goal" value={data.primaryGoal || 'Not selected'} />
        <ReviewItem label="Gym" value={data.gymType || 'Not selected'} />
        <ReviewItem label="Session" value={`${data.sessionLength} min`} />
      </div>

      {/* Nutrition Summary */}
      <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--card-border)' }}>
        <p className="mb-2 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Nutrition Plan</p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <span style={{ color: 'var(--text-muted)' }}>Calories:</span>
          <span className="font-bold" style={{ color: '#00AEEF' }}>{calorieGoal.toLocaleString()} kcal</span>
          <span style={{ color: 'var(--text-muted)' }}>Protein:</span>
          <span className="font-bold" style={{ color: '#0D9488' }}>{macros.protein}g</span>
          <span style={{ color: 'var(--text-muted)' }}>Fats:</span>
          <span className="font-bold" style={{ color: '#F59E0B' }}>{macros.fats}g</span>
          <span style={{ color: 'var(--text-muted)' }}>Carbs:</span>
          <span className="font-bold" style={{ color: '#22C55E' }}>{macros.carbs}g</span>
          <span style={{ color: 'var(--text-muted)' }}>Water:</span>
          <span className="font-bold" style={{ color: '#00AEEF' }}>{(waterGoal / 1000).toFixed(1)}L</span>
        </div>
      </div>

      {/* Devices */}
      {data.connectedDevices.length > 0 && (
        <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--card-border)' }}>
          <p className="mb-2 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Connected Devices</p>
          <div className="flex flex-wrap gap-2">
            {data.connectedDevices.map((d) => (
              <span key={d} className="rounded-full px-2 py-1 text-[10px] font-medium" style={{ backgroundColor: 'rgba(0,174,239,0.1)', color: '#00AEEF' }}>
                {d.replace('_', ' ')}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Step 9: Setup Complete (NEW) ──────────────────────── */

function Step9Complete({ data, navigate }: { data: OnboardingData; navigate: (path: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center space-y-6 py-8 text-center">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className="flex h-20 w-20 items-center justify-center rounded-full"
        style={{ background: 'linear-gradient(135deg, #00AEEF, #8B5CF6)' }}
      >
        <Check className="h-10 w-10 text-white" />
      </motion.div>

      <div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Setup Complete!
        </h2>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          Your personalized dashboard is ready.
        </p>
      </div>

      <div className="w-full rounded-2xl border p-4 text-left" style={{ borderColor: 'var(--card-border)' }}>
        <p className="mb-3 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Based on your profile:</p>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-muted)' }}>Role:</span>
            <span className="font-medium capitalize" style={{ color: 'var(--text-primary)' }}>{data.role}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-muted)' }}>Goal:</span>
            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{data.primaryGoal || 'Not selected'}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-muted)' }}>Experience:</span>
            <span className="font-medium capitalize" style={{ color: 'var(--text-primary)' }}>{data.trainingExperience}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-muted)' }}>Training:</span>
            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{data.trainingFrequency} days/week at {data.gymType}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-muted)' }}>Session:</span>
            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{data.sessionLength} min</span>
          </div>
        </div>
      </div>

      <div className="flex w-full flex-col gap-3">
        <button
          onClick={() => navigate('/dashboard')}
          className="w-full rounded-xl py-3 text-sm font-bold text-white transition-all"
          style={{ background: 'linear-gradient(135deg, #00AEEF, #8B5CF6)' }}
        >
          Explore Dashboard
        </button>
        <button
          onClick={() => navigate('/ai-program-builder')}
          className="w-full rounded-xl border-2 py-3 text-sm font-bold transition-all"
          style={{ borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}
        >
          View My Program
        </button>
        <button
          onClick={() => navigate('/bioprint')}
          className="w-full rounded-xl py-3 text-sm font-medium transition-all"
          style={{ color: 'var(--text-muted)' }}
        >
          Take a Tour
        </button>
      </div>
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────── */

function StatCard({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-xl border p-3 text-center" style={{ borderColor: 'var(--card-border)' }}>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
      {unit && <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{unit}</p>}
    </div>
  );
}

function MacroCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border p-3 text-center" style={{ borderColor: 'var(--card-border)' }}>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-xl font-bold" style={{ color }}>{value}g</p>
    </div>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-2.5" style={{ borderColor: 'var(--card-border)' }}>
      <p className="text-[10px] uppercase" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{value}</p>
    </div>
  );
}
