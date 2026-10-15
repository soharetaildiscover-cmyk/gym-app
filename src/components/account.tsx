import { router } from 'expo-router';
import { View } from 'react-native';

import { Body, Button, Card, Eyebrow, Heading } from '@/components/ui';
import { useProfile } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { GOALS } from '@/lib/types';
import { space } from '@/theme';

/** Profile summary, side switch (for coaches) and sign out. */
export function AccountCard({ side }: { side: 'athlete' | 'coach' }) {
  const { data: profile } = useProfile();
  if (!profile) return null;
  const goal = GOALS.find((g) => g.value === profile.goal)?.label;

  return (
    <>
      <Card style={{ gap: space.sm }}>
        <Eyebrow>{profile.is_coach ? 'Coach account' : 'Athlete account'}</Eyebrow>
        <Heading>{profile.full_name || 'No name yet'}</Heading>
        {goal ? <Body>Goal: {goal}</Body> : null}
        <Body tone="steel">Units: {profile.unit_system === 'metric' ? 'kg, cm' : 'lb, in'}</Body>
      </Card>

      {profile.is_coach ? (
        <View style={{ gap: space.sm }}>
          <Button
            kind="secondary"
            label={side === 'coach' ? 'Switch to my own training' : 'Back to coaching'}
            onPress={() => router.replace(side === 'coach' ? '/(athlete)/today' : '/(coach)/dashboard')}
          />
          <Body tone="steel" style={{ fontSize: 12 }}>
            Coaches can train too. Your own logs stay private unless you connect to a coach yourself.
          </Body>
        </View>
      ) : null}

      <Button
        kind="ghost"
        label="Sign out"
        onPress={async () => {
          await supabase.auth.signOut();
          router.replace('/sign-in');
        }}
      />
    </>
  );
}
