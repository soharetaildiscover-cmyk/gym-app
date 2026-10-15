/**
 * Programs: coach-built templates, the draft model the builder edits, and
 * assignments (the frozen copy an athlete actually follows).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from './auth';
import { supabase } from './supabase';

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
/** Saturday-first week, as gyms in Egypt plan it. */
export const WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5] as const;

export const PROGRAM_GOALS = ['Build muscle', 'Lose fat', 'Strength', 'Endurance', 'General fitness'] as const;
export const PROGRAM_LEVELS = ['Beginner', 'Intermediate', 'Advanced'] as const;

export type Exercise = {
  id: string;
  name: string;
  muscle_group: string;
  equipment: string;
  level: string;
  secondary_muscles: string;
  owner_id: string | null;
};

// ---------------------------------------------------------------------------
// Draft model: what the builder edits before saving
// ---------------------------------------------------------------------------
export type DraftExercise = {
  key: string;
  exercise_id: string;
  name: string;
  muscle_group: string;
  sets: string;
  reps: string;
  target_load_kg: string;
  rest_seconds: string;
  notes: string;
};

export type DraftSession = {
  key: string;
  name: string;
  focus: string;
  est_minutes: string;
  weekdays: number[];
  exercises: DraftExercise[];
};

export type DraftProgram = {
  id: string | null;
  name: string;
  goal: string;
  level: string;
  weeks: number;
  sessions: DraftSession[];
};

let n = 0;
export const newKey = () => `k${Date.now().toString(36)}${(n++).toString(36)}`;

export const emptySession = (i: number): DraftSession => ({
  key: newKey(),
  name: `Day ${String.fromCharCode(65 + i)}`,
  focus: '',
  est_minutes: '60',
  weekdays: [],
  exercises: [],
});

export const emptyProgram = (): DraftProgram => ({
  id: null,
  name: '',
  goal: PROGRAM_GOALS[0],
  level: PROGRAM_LEVELS[1],
  weeks: 8,
  sessions: [emptySession(0)],
});

export const draftExercise = (x: Exercise): DraftExercise => ({
  key: newKey(),
  exercise_id: x.id,
  name: x.name,
  muscle_group: x.muscle_group,
  sets: '3',
  reps: '8-10',
  target_load_kg: '',
  rest_seconds: '90',
  notes: '',
});

/** Returns the first problem a coach needs to fix, or null when the program can be saved. */
export function validateProgram(p: DraftProgram): string | null {
  if (!p.name.trim()) return 'Give the program a name.';
  if (p.weeks < 1 || p.weeks > 52) return 'Choose a length from 1 to 52 weeks.';
  if (p.sessions.length === 0) return 'Add at least one session.';
  const names = p.sessions.map((s) => s.name.trim().toLowerCase());
  if (new Set(names).size !== names.length) return 'Each session needs a different name.';
  for (const s of p.sessions) {
    if (!s.name.trim()) return 'Every session needs a name.';
    if (s.exercises.length === 0) return `Add at least one exercise to “${s.name.trim()}”.`;
    for (const e of s.exercises) {
      const sets = Number(e.sets);
      if (!Number.isInteger(sets) || sets < 1 || sets > 20) return `${e.name}: sets must be 1–20.`;
      if (!/^\d{1,3}(\s*[-–]\s*\d{1,3})?$/.test(e.reps.trim()) && !/^(amrap|max)$/i.test(e.reps.trim()))
        return `${e.name}: reps should look like 8, 8-10 or AMRAP.`;
      if (e.target_load_kg && !(Number(e.target_load_kg) >= 0)) return `${e.name}: weight must be a number.`;
      if (e.rest_seconds && !(Number(e.rest_seconds) >= 0 && Number(e.rest_seconds) <= 900)) return `${e.name}: rest must be 0–900 seconds.`;
    }
  }
  if (!p.sessions.some((s) => s.weekdays.length > 0)) return 'Put at least one session on the weekly schedule.';
  return null;
}

const toPayload = (p: DraftProgram) => ({
  name: p.name.trim(),
  goal: p.goal,
  level: p.level,
  weeks: p.weeks,
  sessions: p.sessions.map((s) => ({
    name: s.name.trim(),
    focus: s.focus.trim(),
    est_minutes: s.est_minutes ? Number(s.est_minutes) : null,
    weekdays: s.weekdays,
    exercises: s.exercises.map((e) => ({
      exercise_id: e.exercise_id,
      sets: Number(e.sets),
      reps: e.reps.trim().replace(/\s*[–-]\s*/, '-'),
      target_load_kg: e.target_load_kg === '' ? null : Number(e.target_load_kg),
      rest_seconds: e.rest_seconds === '' ? null : Number(e.rest_seconds),
      notes: e.notes.trim(),
    })),
  })),
});

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------
export type ProgramSummary = {
  id: string;
  name: string;
  goal: string | null;
  level: string | null;
  weeks: number;
  status: 'draft' | 'published' | 'archived';
  updated_at: string;
  template_days: { count: number }[];
  assignments: { athlete_id: string; status: string }[];
};

export function usePrograms() {
  const { session } = useAuth();
  const me = session?.user.id;
  return useQuery({
    queryKey: ['programs', me],
    enabled: !!me,
    queryFn: async (): Promise<ProgramSummary[]> => {
      const { data, error } = await supabase
        .from('program_templates')
        .select('id, name, goal, level, weeks, status, updated_at, template_days(count), assignments(athlete_id, status)')
        .eq('owner_id', me!)
        .neq('status', 'archived')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProgramSummary[];
    },
  });
}

type TemplateRow = {
  id: string;
  name: string;
  goal: string | null;
  level: string | null;
  weeks: number;
  template_days: {
    position: number;
    name: string;
    focus: string;
    est_minutes: number | null;
    weekdays: number[];
    template_exercises: {
      position: number;
      exercise_id: string;
      sets: number;
      reps: string;
      target_load_kg: number | null;
      rest_seconds: number | null;
      notes: string;
      exercise: { name: string; muscle_group: string } | null;
    }[];
  }[];
};

export async function loadProgram(id: string): Promise<DraftProgram> {
  const { data, error } = await supabase
    .from('program_templates')
    .select(
      'id, name, goal, level, weeks, template_days(position, name, focus, est_minutes, weekdays, template_exercises(position, exercise_id, sets, reps, target_load_kg, rest_seconds, notes, exercise:exercises(name, muscle_group)))',
    )
    .eq('id', id)
    .single();
  if (error) throw error;
  const t = data as unknown as TemplateRow;
  return {
    id: t.id,
    name: t.name,
    goal: t.goal ?? PROGRAM_GOALS[0],
    level: t.level ?? PROGRAM_LEVELS[1],
    weeks: t.weeks,
    sessions: [...t.template_days]
      .sort((a, b) => a.position - b.position)
      .map((d) => ({
        key: newKey(),
        name: d.name,
        focus: d.focus,
        est_minutes: d.est_minutes ? String(d.est_minutes) : '',
        weekdays: d.weekdays ?? [],
        exercises: [...d.template_exercises]
          .sort((a, b) => a.position - b.position)
          .map((e) => ({
            key: newKey(),
            exercise_id: e.exercise_id,
            name: e.exercise?.name ?? 'Exercise',
            muscle_group: e.exercise?.muscle_group ?? '',
            sets: String(e.sets),
            reps: e.reps,
            target_load_kg: e.target_load_kg == null ? '' : String(Number(e.target_load_kg)),
            rest_seconds: e.rest_seconds == null ? '' : String(e.rest_seconds),
            notes: e.notes,
          })),
      })),
  };
}

export function useSaveProgram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: DraftProgram): Promise<string> => {
      const { data, error } = await supabase.rpc('save_program', { p_template: p.id, p_data: toPayload(p) });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['programs'] }),
  });
}

export function useArchiveProgram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('program_templates').update({ status: 'archived' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['programs'] }),
  });
}

export function useExerciseLibrary() {
  return useQuery({
    queryKey: ['exercises'],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Exercise[]> => {
      const { data, error } = await supabase.from('exercises').select('*').order('name');
      if (error) throw error;
      return (data ?? []) as Exercise[];
    },
  });
}

export function useCreateExercise() {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (x: { name: string; muscle_group: string; equipment: string }): Promise<Exercise> => {
      const { data, error } = await supabase
        .from('exercises')
        .insert({ ...x, owner_id: session!.user.id })
        .select('*')
        .single();
      if (error) throw error;
      return data as Exercise;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exercises'] }),
  });
}

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------
export type SnapshotExercise = {
  exercise_id: string;
  name: string;
  position: number;
  sets: number;
  reps: string;
  target_load_kg: number | null;
  rest_seconds: number | null;
  notes: string;
};
export type SnapshotDay = {
  position: number;
  name: string;
  focus: string;
  est_minutes: number | null;
  weekdays?: number[];
  exercises: SnapshotExercise[];
};
export type Assignment = {
  id: string;
  athlete_id: string;
  assigned_by: string;
  template_id: string | null;
  name: string;
  weeks: number;
  snapshot: { days: SnapshotDay[] };
  start_date: string;
  end_date: string | null;
  status: 'scheduled' | 'active' | 'replaced' | 'completed' | 'cancelled';
};

/** Current and upcoming programs for one athlete (works for the athlete and for their coach). */
export function useAthletePrograms(athleteId: string | undefined) {
  return useQuery({
    queryKey: ['assignments', athleteId],
    enabled: !!athleteId,
    queryFn: async (): Promise<{ active: Assignment | null; scheduled: Assignment | null }> => {
      await supabase.rpc('activate_due_assignments');
      const { data, error } = await supabase
        .from('assignments')
        .select('*')
        .eq('athlete_id', athleteId!)
        .in('status', ['active', 'scheduled'])
        .order('start_date', { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as Assignment[];
      return { active: rows.find((r) => r.status === 'active') ?? null, scheduled: rows.find((r) => r.status === 'scheduled') ?? null };
    },
  });
}

export function useAssignProgram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ templateId, athleteIds, start }: { templateId: string; athleteIds: string[]; start: string }) => {
      const { error } = await supabase.rpc('assign_program', { p_template: templateId, p_athletes: athleteIds, p_start: start });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assignments'] });
      qc.invalidateQueries({ queryKey: ['programs'] });
    },
  });
}

/** Which session (if any) falls on a weekday. */
export const sessionOn = <T extends { weekdays?: number[] }>(days: T[], weekday: number): T | null =>
  days.find((d) => (d.weekdays ?? []).includes(weekday)) ?? null;

/** Week number of a program on a given date (1-based), or null before it starts. */
export function programWeek(a: Pick<Assignment, 'start_date' | 'weeks'>, on = new Date()) {
  const start = new Date(`${a.start_date}T00:00:00`);
  const days = Math.floor((on.getTime() - start.getTime()) / 864e5);
  if (days < 0) return null;
  return Math.min(a.weeks, Math.floor(days / 7) + 1);
}

export const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const prettyDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

export const describeTarget = (e: { sets: number | string; reps: string; target_load_kg: number | string | null }) =>
  `${e.sets} × ${String(e.reps).replace('-', '–')}${e.target_load_kg !== null && e.target_load_kg !== '' && Number(e.target_load_kg) > 0 ? ` · ${Number(e.target_load_kg)} kg` : ''}`;
