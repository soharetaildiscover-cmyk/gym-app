import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { Body, Button, Choice, Eyebrow, Field, Loading, Pill, Screen, Steps, Title } from '@/components/ui';
import { useAuth, useProfile } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { EXPERIENCE, GOALS, type Experience, type Goal, type UnitSystem } from '@/lib/types';
import { space } from '@/theme';

type Role = 'athlete' | 'coach';
type StepId = 'role' | 'name' | 'goal' | 'experience' | 'coach' | 'units';

export default function Onboarding() {
  const { session } = useAuth();
  const profile = useProfile();
  const queryClient = useQueryClient();

  const [role, setRole] = useState<Role | null>(null);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState<Goal | null>(null);
  const [experience, setExperience] = useState<Experience | null>(null);
  const [days, setDays] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [bio, setBio] = useState('');
  const [units, setUnits] = useState<UnitSystem>('metric');
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile.data && !name) setName(profile.data.full_name);
  }, [profile.data, name]);

  const steps: StepId[] = useMemo(
    () => (role === 'coach' ? ['role', 'name', 'coach', 'units'] : ['role', 'name', 'goal', 'experience', 'units']),
    [role],
  );
  const current = steps[step];

  if (!session) return <Loading />;

  const canContinue =
    (current === 'role' && role !== null) ||
    (current === 'name' && name.trim().length > 0) ||
    (current === 'goal' && goal !== null) ||
    (current === 'experience' && experience !== null && days !== null) ||
    (current === 'coach' && title.trim().length > 0) ||
    current === 'units';

  async function finish() {
    setSaving(true);
    setError(null);
    const userId = session!.user.id;
    try {
      const { error: pErr } = await supabase
        .from('profiles')
        .update({
          full_name: name.trim(),
          is_coach: role === 'coach',
          goal: role === 'athlete' ? goal : null,
          experience: role === 'athlete' ? experience : null,
          training_days: role === 'athlete' ? days : null,
          unit_system: units,
          onboarded_at: new Date().toISOString(),
        })
        .eq('id', userId);
      if (pErr) throw pErr;
      if (role === 'coach') {
        const { error: cErr } = await supabase
          .from('coach_profiles')
          .upsert({ user_id: userId, title: title.trim(), bio: bio.trim() }, { onConflict: 'user_id' });
        if (cErr) throw cErr;
      }
      await queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setSaving(false);
    }
  }

  const last = step === steps.length - 1;

  return (
    <Screen
      footer={
        <View style={{ flexDirection: 'row', gap: space.md }}>
          {step > 0 && <Button label="Back" kind="secondary" onPress={() => setStep(step - 1)} style={{ flex: 1 }} />}
          <Button
            label={last ? 'Start' : 'Continue'}
            onPress={last ? finish : () => setStep(step + 1)}
            disabled={!canContinue}
            loading={saving}
            style={{ flex: 2 }}
          />
        </View>
      }>
      <Steps count={steps.length} current={step} />

      {current === 'role' && (
        <>
          <Header eyebrow="Welcome" title="How will you use PIVOT?" body="You can coach and train from the same account later." />
          <Choice label="I train" hint="Follow a plan, log workouts and food, work with a coach" selected={role === 'athlete'} onPress={() => setRole('athlete')} />
          <Choice label="I coach" hint="Build programs, manage athletes, review check-ins" selected={role === 'coach'} onPress={() => setRole('coach')} />
        </>
      )}

      {current === 'name' && (
        <>
          <Header eyebrow="About you" title="What should we call you?" body={role === 'coach' ? 'Your athletes will see this name.' : 'Your coach will see this name.'} />
          <Field label="Full name" value={name} onChangeText={setName} autoComplete="name" placeholder="Your name" />
        </>
      )}

      {current === 'goal' && (
        <>
          <Header eyebrow="Your goal" title="What are you training for?" body="This shapes your targets. You can change it any time." />
          {GOALS.map((g) => (
            <Choice key={g.value} label={g.label} hint={g.hint} selected={goal === g.value} onPress={() => setGoal(g.value)} />
          ))}
        </>
      )}

      {current === 'experience' && (
        <>
          <Header eyebrow="Your training" title="Where are you starting from?" />
          {EXPERIENCE.map((x) => (
            <Choice key={x.value} label={x.label} hint={x.hint} selected={experience === x.value} onPress={() => setExperience(x.value)} />
          ))}
          <Eyebrow>Days a week you can train</Eyebrow>
          <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
            {[2, 3, 4, 5, 6].map((d) => (
              <Pill key={d} label={String(d)} selected={days === d} onPress={() => setDays(d)} />
            ))}
          </View>
        </>
      )}

      {current === 'coach' && (
        <>
          <Header eyebrow="Your coaching" title="Tell athletes who you are" body="This is what an athlete sees before accepting your invite." />
          <Field label="Title" value={title} onChangeText={setTitle} placeholder="Strength & conditioning coach" />
          <Field label="Short bio" value={bio} onChangeText={setBio} placeholder="What you specialise in, and how you coach" multiline style={{ minHeight: 110, paddingTop: 14, textAlignVertical: 'top' }} hint="Optional. You can edit it later." />
        </>
      )}

      {current === 'units' && (
        <>
          <Header eyebrow="Units" title="How do you measure?" />
          <Choice label="Kilograms and centimetres" selected={units === 'metric'} onPress={() => setUnits('metric')} />
          <Choice label="Pounds and inches" selected={units === 'imperial'} onPress={() => setUnits('imperial')} />
          {error ? <Body tone="red">{error}</Body> : null}
        </>
      )}
    </Screen>
  );
}

function Header({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) {
  return (
    <View style={{ gap: space.sm, marginTop: space.lg, marginBottom: space.sm }}>
      <Eyebrow tone="acid">{eyebrow}</Eyebrow>
      <Title>{title}</Title>
      {body ? <Body>{body}</Body> : null}
    </View>
  );
}
