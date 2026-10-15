export type Goal = 'build_muscle' | 'lose_fat' | 'get_stronger' | 'general_fitness' | 'performance';
export type Experience = 'beginner' | 'intermediate' | 'advanced';
export type UnitSystem = 'metric' | 'imperial';

export type Profile = {
  id: string;
  full_name: string;
  avatar_path: string | null;
  unit_system: UnitSystem;
  goal: Goal | null;
  experience: Experience | null;
  training_days: number | null;
  height_cm: number | null;
  is_coach: boolean;
  onboarded_at: string | null;
};

export const GOALS: { value: Goal; label: string; hint: string }[] = [
  { value: 'build_muscle', label: 'Build muscle', hint: 'Add size and shape' },
  { value: 'lose_fat', label: 'Lose fat', hint: 'Get leaner, keep strength' },
  { value: 'get_stronger', label: 'Get stronger', hint: 'Move more weight' },
  { value: 'general_fitness', label: 'Feel fitter', hint: 'Energy, health, habit' },
  { value: 'performance', label: 'Perform', hint: 'Train for a sport' },
];

export const EXPERIENCE: { value: Experience; label: string; hint: string }[] = [
  { value: 'beginner', label: 'New to lifting', hint: 'Under a year' },
  { value: 'intermediate', label: 'Some experience', hint: '1–3 years' },
  { value: 'advanced', label: 'Experienced', hint: '3+ years' },
];
