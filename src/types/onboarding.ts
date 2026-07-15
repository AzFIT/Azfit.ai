/**
 * Onboarding data types for the AzFIT onboarding flow
 * Extracted from OnboardingPage.tsx for reuse across the app
 */

export type UserRole = 'trainer' | 'client';

export type GymType = 'commercial' | 'home' | 'outdoor' | 'mixed';

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

export type MacroSplit = 'balanced' | 'high_protein' | 'high_carb';

export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'very'
  | 'extreme';

export type Gender = 'male' | 'female' | 'other' | '';

/** Device types that can be connected during onboarding */
export type ConnectableDevice =
  | 'apple_health'
  | 'google_fit'
  | 'garmin'
  | 'fitbit'
  | 'whoop'
  | 'myfitnesspal';

/** Main data shape collected during onboarding */
export interface OnboardingData {
  /* ── Step 0: Role Selection ── */
  role: UserRole | '';

  /* ── Step 1: Personal Info ── */
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: Gender;
  photo?: string;

  /* ── Step 2: Body Composition ── */
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

  /* ── Step 3: Fitness Background ── */
  parqAnswers: boolean[];
  trainingExperience: string;
  trainingFrequency: string;
  activityLevel: string;
  primaryGoal: string;
  primaryGoalId: string;
  injuries: string;
  preferredStyle: string[];
  availableEquipment: string[];

  /* ── Step 3.5: Training Setup (NEW) ── */
  gymType: GymType | '';
  sessionLength: number; // minutes: 30, 45, 60, 75, 90
  hasCoach: boolean;
  coachCode: string;

  /* ── Step 4: TDEE & Nutrition ── */
  macroSplit: MacroSplit;
  mealCount: string;

  /* ── Step 5: Device Connect (NEW) ── */
  connectedDevices: ConnectableDevice[];
}

/** Initial empty state for the onboarding form */
export const INITIAL_ONBOARDING_DATA: OnboardingData = {
  role: '',
  fullName: '',
  email: '',
  phone: '',
  dateOfBirth: '',
  gender: '',
  weight: 0,
  goalWeight: 0,
  height: 0,
  useNavyMethod: false,
  navyNeck: 0,
  navyWaist: 0,
  navyHip: 0,
  measurements: {},
  parqAnswers: [false, false, false, false, false, false, false],
  trainingExperience: '',
  trainingFrequency: '',
  activityLevel: '',
  primaryGoal: '',
  primaryGoalId: '',
  injuries: '',
  preferredStyle: [],
  availableEquipment: [],
  gymType: '',
  sessionLength: 60,
  hasCoach: false,
  coachCode: '',
  macroSplit: 'balanced',
  mealCount: '4',
  connectedDevices: [],
};

/** PAR-Q questionnaire questions */
export const PARQ_QUESTIONS = [
  'Has your doctor ever said that you have a heart condition and that you should only do physical activity recommended by a doctor?',
  'Do you feel pain in your chest when you do physical activity?',
  'In the past month, have you had chest pain when you were not doing physical activity?',
  'Do you lose your balance because of dizziness or do you ever lose consciousness?',
  'Do you have a bone or joint problem that could be made worse by a change in your physical activity?',
  'Is your doctor currently prescribing drugs for your blood pressure or heart condition?',
  'Do you know of any other reason why you should not do physical activity?',
] as const;

/** Training experience options */
export const EXPERIENCE_OPTIONS = [
  { value: 'beginner', label: 'Beginner', sub: '0-1 years' },
  { value: 'intermediate', label: 'Intermediate', sub: '1-3 years' },
  { value: 'advanced', label: 'Advanced', sub: '3+ years' },
] as const;

/** Training frequency options (days per week) */
export const FREQUENCY_OPTIONS = ['2', '3', '4', '5', '6'] as const;

/** Activity level options */
export const ACTIVITY_OPTIONS = [
  { value: 'sedentary', label: 'Sedentary', sub: 'Little to no exercise' },
  { value: 'light', label: 'Lightly Active', sub: 'Light exercise 1-3 days/week' },
  { value: 'moderate', label: 'Moderately Active', sub: 'Moderate exercise 3-5 days/week' },
  { value: 'very', label: 'Very Active', sub: 'Hard exercise 6-7 days/week' },
  { value: 'extreme', label: 'Extremely Active', sub: 'Very hard exercise + physical job' },
] as const;

/** Equipment availability options */
export const EQUIPMENT_OPTIONS = [
  'Full Gym',
  'Dumbbells Only',
  'Home Gym (limited)',
  'Bodyweight Only',
] as const;

/** Gym type options for training setup step */
export const GYM_TYPE_OPTIONS = [
  { value: 'commercial', label: 'Commercial Gym', sub: 'Pure, Fitness First, etc.' },
  { value: 'home', label: 'Home Gym', sub: 'Your own equipment' },
  { value: 'outdoor', label: 'Outdoor / Calisthenics', sub: 'Parks, pull-up bars' },
  { value: 'mixed', label: 'Mixed', sub: 'Combination of above' },
] as const;

/** Session length options (minutes) */
export const SESSION_LENGTH_OPTIONS = [
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '60 min' },
  { value: 75, label: '75 min' },
  { value: 90, label: '90 min+' },
] as const;

/** Device connection options for onboarding */
export const DEVICE_OPTIONS = [
  { value: 'apple_health' as ConnectableDevice, label: 'Apple Health', icon: 'apple' },
  { value: 'google_fit' as ConnectableDevice, label: 'Google Fit', icon: 'google' },
  { value: 'garmin' as ConnectableDevice, label: 'Garmin', icon: 'watch' },
  { value: 'fitbit' as ConnectableDevice, label: 'Fitbit', icon: 'watch' },
  { value: 'whoop' as ConnectableDevice, label: 'Whoop', icon: 'watch' },
  { value: 'myfitnesspal' as ConnectableDevice, label: 'MyFitnessPal', icon: 'utensils' },
] as const;

/** Macro split presets */
export const MACRO_PRESETS = {
  balanced: {
    protein: 0.30,
    fats: 0.35,
    carbs: 0.35,
    label: 'Balanced Diet',
    desc: 'General health & sustainability',
  },
  high_protein: {
    protein: 0.40,
    fats: 0.40,
    carbs: 0.20,
    label: 'High Protein',
    desc: 'Muscle building & strength',
  },
  high_carb: {
    protein: 0.30,
    fats: 0.20,
    carbs: 0.50,
    label: 'High Carb',
    desc: 'Endurance & performance',
  },
} as const;

/** Body measurement labels */
export const BODY_MEASUREMENTS = [
  'Chest',
  'Waist',
  'Hips',
  'Left Arm',
  'Right Arm',
  'Left Thigh',
  'Right Thigh',
  'Left Calf',
  'Right Calf',
] as const;
