import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { BackHeader, Body, Button, Card, Choice, Eyebrow, List, Loading, Pill, Screen } from '@/components/ui';
import { friendlyError, useRoster } from '@/lib/coaching';
import {
  WEEKDAYS_LONG,
  WEEK_ORDER,
  isoDate,
  loadProgram,
  prettyDate,
  sessionOn,
  useAssignProgram,
  usePrograms,
  type Assignment,
} from '@/lib/programs';
import { supabase } from '@/lib/supabase';
import { colors, fonts, space } from '@/theme';

type Step = 'choose' | 'review';

/** Coach: give a program to one or more athletes from a start date. */
export default function Assign() {
  const params = useLocalSearchParams<{ program?: string; athlete?: string }>();
  const programs = usePrograms();
  const roster = useRoster();
  const assign = useAssignProgram();

  const [programId, setProgramId] = useState<string | undefined>(params.program);
  const [athletes, setAthletes] = useState<string[]>(params.athlete ? [params.athlete] : []);
  const [startKey, setStartKey] = useState<'today' | 'tomorrow' | 'saturday'>('today');
  const [step, setStep] = useState<Step>('choose');
  const [error, setError] = useState<string | null>(null);

  const starts = useMemo(() => {
    const today = new Date();
    const tomorrow = new Date(today.getTime() + 864e5);
    const sat = new Date(today);
    sat.setDate(today.getDate() + (((6 - today.getDay()) + 7) % 7 || 7));
    return { today: isoDate(today), tomorrow: isoDate(tomorrow), saturday: isoDate(sat) };
  }, []);
  const start = starts[startKey];

  const program = useQuery({
    queryKey: ['program-detail', programId],
    enabled: !!programId,
    queryFn: () => loadProgram(programId!),
  });

  const current = useQuery({
    queryKey: ['current-assignments', athletes.join(',')],
    enabled: step === 'review' && athletes.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('assignments').select('athlete_id, name, status').in('athlete_id', athletes).in('status', ['active', 'scheduled']);
      if (error) throw error;
      return (data ?? []) as Pick<Assignment, 'athlete_id' | 'name' | 'status'>[];
    },
  });

  if (programs.isPending || roster.isPending) return <Loading />;

  const published = (programs.data ?? []).filter((p) => p.template_days[0]?.count);
  const people = roster.data ?? [];
  const eligible = (id: string) => {
    const a = people.find((p) => p.athlete_id === id);
    return !!a && a.status === 'active' && a.scopes.includes('training');
  };
  const nameOf = (id: string) => people.find((p) => p.athlete_id === id)?.athlete?.full_name ?? 'Athlete';

  async function confirmAssign() {
    setError(null);
    try {
      await assign.mutateAsync({ templateId: programId!, athleteIds: athletes, start });
      if (params.athlete) router.back();
      else router.replace('/(coach)/plans');
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  // ---------------------------------------------------------------- review
  if (step === 'review' && program.data) {
    const p = program.data;
    return (
      <Screen
        footer={
          <>
            {error ? <Body tone="red">{error}</Body> : null}
            <Button label={start === starts.today ? 'Assign now' : `Schedule for ${prettyDate(start)}`} onPress={confirmAssign} loading={assign.isPending} />
            <Button kind="secondary" label="Change selection" onPress={() => setStep('choose')} />
          </>
        }>
        <BackHeader eyebrow="Review" title="Check before you assign" onBack={() => setStep('choose')} />
        <Card style={{ gap: space.sm }}>
          <Eyebrow tone="acid">
            {athletes.length} athlete{athletes.length === 1 ? '' : 's'} · starts {start === starts.today ? 'today' : prettyDate(start)}
          </Eyebrow>
          <Text style={{ fontFamily: fonts.display, fontSize: 22, color: colors.bone }}>{p.name}</Text>
          <Body>
            {p.weeks} weeks · {p.sessions.length} sessions. Each athlete gets their own copy, so later edits to this program won’t change it.
          </Body>
        </Card>

        <View style={{ gap: space.sm }}>
          <Eyebrow>Athletes</Eyebrow>
          <List>
            {athletes.map((id) => {
              const now = current.data?.filter((c) => c.athlete_id === id) ?? [];
              const active = now.find((c) => c.status === 'active');
              const waiting = now.find((c) => c.status === 'scheduled');
              const detail =
                start === starts.today
                  ? active
                    ? `Replaces ${active.name} today`
                    : 'No current program'
                  : [active ? `Keeps ${active.name} until then` : null, waiting ? `replaces scheduled ${waiting.name}` : null].filter(Boolean).join(' · ') ||
                    'No current program';
              return (
                <View key={id} style={{ padding: space.lg, borderBottomWidth: 1, borderBottomColor: colors.line, gap: 2 }}>
                  <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.bone }}>{nameOf(id)}</Text>
                  <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.steel }}>{current.isPending ? 'Checking…' : detail}</Text>
                </View>
              );
            })}
          </List>
        </View>

        <View style={{ gap: space.sm }}>
          <Eyebrow>Weekly schedule</Eyebrow>
          <List>
            {WEEK_ORDER.map((d) => {
              const s = sessionOn(p.sessions, d);
              return (
                <View key={d} style={{ flexDirection: 'row', padding: space.md, paddingHorizontal: space.lg, borderBottomWidth: 1, borderBottomColor: colors.line }}>
                  <Text style={{ width: 110, fontFamily: fonts.bodyBold, fontSize: 14, color: colors.bone2 }}>{WEEKDAYS_LONG[d]}</Text>
                  <Text style={{ flex: 1, fontFamily: s ? fonts.bodyBold : fonts.body, fontSize: 14, color: s ? colors.bone : colors.steel }}>
                    {s ? `${s.name} · ${s.exercises.length} exercises` : 'Rest'}
                  </Text>
                </View>
              );
            })}
          </List>
        </View>
      </Screen>
    );
  }

  // ---------------------------------------------------------------- choose
  const canReview = !!programId && athletes.length > 0;
  return (
    <Screen footer={<Button label="Review" disabled={!canReview} onPress={() => setStep('review')} loading={!!programId && program.isPending} />}>
      <BackHeader eyebrow="Assign program" title="Who gets which program?" />

      <View style={{ gap: space.sm }}>
        <Eyebrow>1 · Program</Eyebrow>
        {published.length === 0 ? (
          <Card style={{ gap: space.sm }}>
            <Body>You don’t have a saved program with sessions yet.</Body>
            <Button kind="secondary" label="Build a program" onPress={() => router.push({ pathname: '/program/[id]', params: { id: 'new' } })} />
          </Card>
        ) : (
          published.map((p) => (
            <Choice
              key={p.id}
              label={p.name}
              hint={[p.level, `${p.template_days[0]?.count ?? 0} sessions`, `${p.weeks} weeks`].filter(Boolean).join(' · ')}
              selected={programId === p.id}
              onPress={() => setProgramId(p.id)}
            />
          ))
        )}
      </View>

      <View style={{ gap: space.sm }}>
        <Eyebrow>2 · Athletes</Eyebrow>
        {people.length === 0 ? <Body>No athletes yet. Invite one from the Athletes tab.</Body> : null}
        <List>
          {people.map((a) => {
            const ok = eligible(a.athlete_id);
            const on = athletes.includes(a.athlete_id);
            const why = a.status === 'paused' ? 'Paused sharing' : !a.scopes.includes('training') ? 'Not sharing Training' : null;
            return (
              <Pressable
                key={a.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on, disabled: !ok }}
                disabled={!ok}
                onPress={() => setAthletes((s) => (on ? s.filter((x) => x !== a.athlete_id) : [...s, a.athlete_id]))}
                style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderBottomWidth: 1, borderBottomColor: colors.line, opacity: ok ? 1 : 0.5 }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.bone }}>{a.athlete?.full_name || 'Athlete'}</Text>
                  {why ? <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.steel }}>{why} · can’t assign</Text> : null}
                </View>
                <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={on ? colors.acid : colors.steel} />
              </Pressable>
            );
          })}
        </List>
      </View>

      <View style={{ gap: space.sm }}>
        <Eyebrow>3 · Start</Eyebrow>
        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
          <Pill label="Today" selected={startKey === 'today'} onPress={() => setStartKey('today')} />
          <Pill label="Tomorrow" selected={startKey === 'tomorrow'} onPress={() => setStartKey('tomorrow')} />
          <Pill label={`Sat ${prettyDate(starts.saturday).split(' ').slice(1).join(' ')}`} selected={startKey === 'saturday'} onPress={() => setStartKey('saturday')} />
        </View>
        <Body tone="steel" style={{ fontSize: 13 }}>
          {startKey === 'today' ? 'Replaces their current program today.' : 'Their current program keeps running until then.'}
        </Body>
      </View>
    </Screen>
  );
}
