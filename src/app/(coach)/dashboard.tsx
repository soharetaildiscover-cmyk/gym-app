import { View } from 'react-native';

import { Body, ComingSoon, Eyebrow, Screen, Title } from '@/components/ui';
import { useProfile } from '@/lib/auth';
import { space } from '@/theme';

export default function Dashboard() {
  const { data: profile } = useProfile();
  const first = profile?.full_name.split(' ')[0];

  return (
    <Screen>
      <View style={{ gap: space.sm, marginTop: space.md }}>
        <Eyebrow tone="gold">Coach</Eyebrow>
        <Title>{first ? `Hi, Coach ${first}.` : 'Dashboard'}</Title>
        <Body>Who needs you today, in one list.</Body>
      </View>
      <ComingSoon
        phase="Phase 5 · Attention queue"
        title="Needs attention"
        items={['Pain reports, first', 'Check-ins waiting for review', 'Missed sessions and off-target nutrition']}
      />
    </Screen>
  );
}
