/**
 * Coach <-> athlete connection: sharing scopes, coaching packages, and the
 * queries/mutations both sides use. Permission is enforced by the database;
 * these hooks only read and write what RLS already allows.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from './auth';
import { supabase } from './supabase';
import type { Goal } from './types';

export type Scope = 'training' | 'nutrition' | 'progress' | 'checkins' | 'photos' | 'recovery' | 'reminders';
export type LinkStatus = 'active' | 'paused' | 'ended';

export const SCOPES: { key: Scope; label: string; detail: string }[] = [
  { key: 'training', label: 'Training & workout history', detail: 'Workouts, sets and notes' },
  { key: 'nutrition', label: 'Nutrition & meals', detail: 'Meals, macros, water and targets' },
  { key: 'progress', label: 'Progress & measurements', detail: 'Weight, body fat and measurements' },
  { key: 'checkins', label: 'Check-ins', detail: 'Weekly check-in answers' },
  { key: 'photos', label: 'Progress photos', detail: 'Including photos added to check-ins' },
  { key: 'recovery', label: 'Recovery', detail: 'Sleep, energy, soreness, readiness' },
  { key: 'reminders', label: 'Reminder adherence', detail: 'Whether reminders were taken' },
];

/** Coaching packages from the prototype. They only pre-select scopes; the athlete decides. */
export const PACKAGES: { name: string; detail: string; scopes: Scope[] }[] = [
  { name: 'Training Only', detail: 'Program design and form feedback', scopes: ['training'] },
  { name: 'Online Coaching', detail: 'Program, nutrition and weekly check-ins', scopes: ['training', 'nutrition', 'progress', 'checkins'] },
  { name: 'Premium Plus', detail: 'Everything, plus photos, recovery and reminders', scopes: ['training', 'nutrition', 'progress', 'checkins', 'photos', 'recovery', 'reminders'] },
];

export type CoachingLink = {
  id: string;
  coach_id: string;
  athlete_id: string;
  status: LinkStatus;
  package: string | null;
  scopes: Scope[];
  checkin_weekday: number;
  started_at: string;
  paused_at: string | null;
};

export type RosterEntry = CoachingLink & { athlete: { full_name: string; goal: Goal | null } | null };

export type Invite = {
  id: string;
  code: string;
  package: string | null;
  suggested_scopes: Scope[];
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export type InvitePreview = {
  coach_id: string;
  coach_name: string;
  coach_title: string;
  package: string | null;
  suggested_scopes: Scope[];
};

/** Turns database errors into something a person can act on. */
export function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e);
  if (/network|fetch/i.test(msg)) return 'No connection. Check your internet and try again.';
  return msg;
}

// ---------------------------------------------------------------------------
// Athlete side
// ---------------------------------------------------------------------------

/** The athlete's current coach (active or paused), with the coach's name and title. */
export function useMyCoach() {
  const { session } = useAuth();
  const me = session?.user.id;
  return useQuery({
    queryKey: ['my-coach', me],
    enabled: !!me,
    queryFn: async () => {
      const { data: link, error } = await supabase
        .from('coaching_links')
        .select('*')
        .eq('athlete_id', me!)
        .in('status', ['active', 'paused'])
        .maybeSingle();
      if (error) throw error;
      if (!link) return null;
      const [{ data: coach }, { data: coachProfile }] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('id', link.coach_id).maybeSingle(),
        supabase.from('coach_profiles').select('title, bio').eq('user_id', link.coach_id).maybeSingle(),
      ]);
      return {
        link: link as CoachingLink,
        coachName: coach?.full_name ?? 'Your coach',
        coachTitle: coachProfile?.title ?? '',
        coachBio: coachProfile?.bio ?? '',
      };
    },
  });
}

export async function previewInvite(code: string): Promise<InvitePreview | null> {
  const { data, error } = await supabase.rpc('preview_invite', { p_code: code });
  if (error) throw error;
  return ((data as InvitePreview[] | null) ?? [])[0] ?? null;
}

export function useRedeemInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ code, scopes }: { code: string; scopes: Scope[] }) => {
      const { data, error } = await supabase.rpc('redeem_invite', { p_code: code, p_scopes: scopes });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-coach'] }),
  });
}

/** The athlete changes sharing, pauses, resumes or ends. The database guards what each side may change. */
export function useUpdateLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Pick<CoachingLink, 'scopes' | 'status'>> }) => {
      const { error } = await supabase.from('coaching_links').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-coach'] });
      qc.invalidateQueries({ queryKey: ['roster'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Coach side
// ---------------------------------------------------------------------------

export function useRoster() {
  const { session } = useAuth();
  const me = session?.user.id;
  return useQuery({
    queryKey: ['roster', me],
    enabled: !!me,
    queryFn: async (): Promise<RosterEntry[]> => {
      const { data, error } = await supabase
        .from('coaching_links')
        .select('*, athlete:profiles!coaching_links_athlete_id_fkey(full_name, goal)')
        .eq('coach_id', me!)
        .in('status', ['active', 'paused'])
        .order('started_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as RosterEntry[];
    },
  });
}

export function useInvites() {
  const { session } = useAuth();
  const me = session?.user.id;
  return useQuery({
    queryKey: ['invites', me],
    enabled: !!me,
    queryFn: async (): Promise<Invite[]> => {
      const { data, error } = await supabase
        .from('invites')
        .select('*')
        .eq('coach_id', me!)
        .is('used_at', null)
        .is('revoked_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Invite[];
    },
  });
}

export function useCreateInvite() {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ pkg, scopes }: { pkg: string; scopes: Scope[] }): Promise<Invite> => {
      const { data, error } = await supabase
        .from('invites')
        .insert({ coach_id: session!.user.id, package: pkg, suggested_scopes: scopes })
        .select('*')
        .single();
      if (error) throw error;
      return data as Invite;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invites'] }),
  });
}

export function useRevokeInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('invites').update({ revoked_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invites'] }),
  });
}

export const inviteMessage = (code: string, coachName: string) =>
  `${coachName} invited you to train together on PIVOT.\n\nOpen the app, tap "Join your coach" and enter this code: ${code}\n\nThe code works for 14 days.`;

export const formatCode = (code: string) => (code.length === 8 ? `${code.slice(0, 4)} ${code.slice(4)}` : code);

export const sinceLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
