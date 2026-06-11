 
import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight, ChevronLeft, User, Scale, Dumbbell,
  Apple, Check, Droplets,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { calculateBMI, calculateBMR, calculateTDEE } from '@/lib/utils';

/* ── Types ─────────────────────────────────────────────── */

interface OnboardingData {
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | '';
  photo?: string;
  weight: number;
  goalWeight: number;
  height: number;
  bodyFatPercentage?: number;
  useNavyMethod: boolean;
  navyNeck: number;
  navyWaist: number;
  navyHip: number;
  measurements: Record<string, number>;
  progressPhoto?: string;
  parqAnswers: boolean[];
  trainingExperience: string;
  trainingFrequency: string;
  activityLevel: string;
  primaryGoal: string;
  injuries: string;
  preferredStyle: string[];
  availableEquipment: string[];
  macroSplit: 'balanced' | 'high_protein' | 'high_carb';
  mealCount: string;
}

const INITIAL_DATA: OnboardingData = {
  fullName: '', email: '', phone: '', dateOfBirth: '', gender: '',
  weight: 0, goalWeight: 0, height: 0, useNavyMethod: false,
  navyNeck: 0, navyWaist: 0, navyHip: 0,
  measurements: {},
  parqAnswers: [false, false, false, false, false, false, false],
  trainingExperience: '', trainingFrequency: '', activityLevel: '',
  primaryGoal: '', injuries: '', preferredStyle: [], availableEquipment: [],
  macroSplit: 'balanced', mealCount: '4',
};

const PARQ_QUESTIONS = [
  'Has your doctor ever said that you have a heart condition and that you should only do physical activity recommended by a doctor?',
  'Do you feel pain in your chest when you do physical activity?',
  'In the past month, have you had chest pain when you were not doing physical activity?',
  'Do you lose your balance because of dizziness or do you ever lose consciousness?',
  'Do you have a bone or joint problem that could be made worse by a change in your physical activity?',
  'Is your doctor currently prescribing drugs for your blood pressure or heart condition?',
  'Do you know of any other reason why you should not do physical activity?',
];

const EXPERIENCE_OPTIONS = [
  { value: 'beginner', label: 'Beginner', sub: '0-1 years' },
  { value: 'intermediate', label: 'Intermediate', sub: '1-3 years' },
  { value: 'advanced', label: 'Advanced', sub: '3+ years' },
];

const FREQUENCY_OPTIONS = ['2', '3', '4', '5', '6'];
const ACTIVITY_OPTIONS = [
  { value: 'sedentary', label: 'Sedentary', sub: 'Little to no exercise' },
  { value: 'light', label: 'Lightly Active', sub: 'Light exercise 1-3 days/week' },
  { value: 'moderate', label: 'Moderately Active', sub: 'Moderate exercise 3-5 days/week' },
  { value: 'very', label: 'Very Active', sub: 'Hard exercise 6-7 days/week' },
  { value: 'extreme', label: 'Extremely Active', sub: 'Very hard exercise + physical job' },
];

const GOAL_OPTIONS = [
  { value: 'lose_fat', label: 'Lose Fat', emoji: '🔥' },
  { value: 'build_muscle', label: 'Build Muscle', emoji: '💪' },
  { value: 'strength', label: 'Strength', emoji: '🏋️' },
  { value: 'recomposition', label: 'Recomposition', emoji: '⚖️' },
  { value: 'performance', label: 'Athletic Performance', emoji: '🏃' },
  { value: 'general_health', label: 'General Health', emoji: '❤️' },
];

const EQUIPMENT_OPTIONS = ['Full Gym', 'Dumbbells Only', 'Home Gym (limited)', 'Bodyweight Only'];

const MACRO_PRESETS = {
  balanced: { protein: 0.30, fats: 0.35, carbs: 0.35, label: 'Balanced Diet', desc: 'General health & sustainability' },
  high_protein: { protein: 0.40, fats: 0.40, carbs: 0.20, label: 'High Protein', desc: 'Muscle building & strength' },
  high_carb: { protein: 0.30, fats: 0.20, carbs: 0.50, label: 'High Carb', desc: 'Endurance & performance' },
};

/* ── Main Component ────────────────────────────────────── */

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<OnboardingData>(INITIAL_DATA);

  const updateData = useCallback((updates: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  }, []);

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

  const canProceed = useMemo(() => {
    switch (step) {
      case 1: return data.fullName && data.email && data.dateOfBirth && data.gender;
      case 2: return data.weight > 0 && data.goalWeight > 0 && data.height > 0;
      case 3: return data.trainingExperience && data.trainingFrequency && data.activityLevel && data.primaryGoal;
      case 4: return true;
      case 5: return true;
      default: return false;
    }
  }, [step, data]);

  const handleComplete = () => {
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
      injuries: data.injuries,
      preferredStyle: data.preferredStyle,
      availableEquipment: data.availableEquipment,
      tdee,
      calorieGoal,
      macroSplit: data.macroSplit,
      proteinGrams: macros.protein,
      fatsGrams: macros.fats,
      carbsGrams: macros.carbs,
      waterGoal,
      mealCount: Number(data.mealCount),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    localStorage.setItem('azfit_client_profile', JSON.stringify(profile));
    localStorage.setItem('azfit_nutrition_plan', JSON.stringify({
      clientId: profile.id, calorieGoal, macroSplit: data.macroSplit,
      proteinGrams: macros.protein, fatsGrams: macros.fats, carbsGrams: macros.carbs,
      waterGoal, mealCount: Number(data.mealCount), createdAt: Date.now(),
    }));
    navigate('/dashboard');
  };

  const stepIcons = [User, Scale, Dumbbell, Apple, Check];
  const StepIcon = stepIcons[step - 1] || User;

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
                  {['Personal Info', 'Body Composition', 'Fitness Background', 'TDEE & Nutrition', 'Review'][step - 1]}
                </h1>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Step {step} of 5</p>
              </div>
            </div>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
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
            {step === 1 && <Step1Personal data={data} updateData={updateData} />}
            {step === 2 && <Step2Body data={data} updateData={updateData} age={age} />}
            {step === 3 && <Step3Fitness data={data} updateData={updateData} />}
            {step === 4 && <Step4TDEE data={data} updateData={updateData} age={age} bmi={bmi} bmr={bmr} tdee={tdee} calorieGoal={calorieGoal} macros={macros} waterGoal={waterGoal} />}
            {step === 5 && <Step5Review data={data} age={age} bmi={bmi} tdee={tdee} calorieGoal={calorieGoal} macros={macros} waterGoal={waterGoal} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer Buttons */}
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
          {step < 5 ? (
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
              className="flex items-center gap-1 rounded-xl px-6 py-2.5 text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #00AEEF, #8B5CF6)' }}
            >
              <Check className="h-4 w-4" /> Complete Setup
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Step 1: Personal Info ─────────────────────────────── */

function Step1Personal({ data, updateData }: { data: OnboardingData; updateData: (u: Partial<OnboardingData>) => void }) {
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

/* ── Step 2: Body Composition ──────────────────────────── */

function Step2Body({ data, updateData }: { data: OnboardingData; updateData: (u: Partial<OnboardingData>) => void; age: number }) {
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
        {['Chest', 'Waist', 'Hips', 'Left Arm', 'Right Arm', 'Left Thigh', 'Right Thigh', 'Left Calf', 'Right Calf'].map((m) => (
          <div key={m}>
            <Label className="text-xs">{m} (cm)</Label>
            <Input type="number" placeholder="0" value={data.measurements[m] || ''} onChange={(e) => updateData({ measurements: { ...data.measurements, [m]: Number(e.target.value) } })} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Step 3: Fitness Background ────────────────────────── */

function Step3Fitness({ data, updateData }: { data: OnboardingData; updateData: (u: Partial<OnboardingData>) => void }) {
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

      {/* Primary Goal */}
      <div>
        <Label>Primary Goal *</Label>
        <div className="grid grid-cols-2 gap-2">
          {GOAL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => updateData({ primaryGoal: opt.value })}
              className="rounded-xl border-2 py-3 text-center text-sm font-medium transition-all"
              style={{
                borderColor: data.primaryGoal === opt.value ? '#00AEEF' : 'var(--card-border)',
                backgroundColor: data.primaryGoal === opt.value ? 'rgba(0,174,239,0.1)' : 'transparent',
                color: data.primaryGoal === opt.value ? '#00AEEF' : 'var(--text-primary)',
              }}
            >
              <span className="mr-1">{opt.emoji}</span>{opt.label}
            </button>
          ))}
        </div>
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

/* ── Step 4: TDEE & Nutrition ──────────────────────────── */

function Step4TDEE({ data, updateData, age, bmi, bmr, tdee, calorieGoal, macros, waterGoal }: {
  data: OnboardingData; updateData: (u: Partial<OnboardingData>) => void;
  age: number; bmi: number; bmr: number; tdee: number; calorieGoal: number;
  macros: { protein: number; fats: number; carbs: number }; waterGoal: number;
}) {
  const goalLabel = useMemo(() => {
    const map: Record<string, string> = {
      lose_fat: 'Fat Loss', build_muscle: 'Muscle Gain', strength: 'Strength',
      recomposition: 'Recomp', performance: 'Performance', general_health: 'Maintenance',
    };
    return map[data.primaryGoal] || 'Maintenance';
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

/* ── Step 5: Review ────────────────────────────────────── */

function Step5Review({ data, age, bmi, tdee, calorieGoal, macros, waterGoal }: {
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
        <ReviewItem label="Goal" value={GOAL_OPTIONS.find((g) => g.value === data.primaryGoal)?.label || data.primaryGoal} />
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
    </div>
  );
}

/* ── Helpers ───────────────────────────────────────────── */

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
