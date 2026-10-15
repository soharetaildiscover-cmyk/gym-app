import { View } from 'react-native';

import { Body, ComingSoon, Eyebrow, Screen, Title } from '@/components/ui';
import { useProfile } from '@/lib/auth';
import { space } from '@/theme';

export default function Today() {
  const { data: profile } = useProfile();
  const first = profile?.full_name.split(' ')[0];
  const now = new Date();
  const date = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const hello = now.getHours() < 12 ? 'Morning' : now.getHours() < 18 ? 'Afternoon' : 'Evening';

  return (
    <Screen>
      <View style={{ gap: space.sm, marginTop: space.md }}>
        <Eyebrow>{date}</Eyebrow>
        <Title>{first ? `${hello}, ${first}.` : 'Today'}</Title>
        <Body>Your session, food and reminders for today will live here.</Body>
      </View>
      <ComingSoon
        phase="Phase 2 · Coach connect"
        title="Join your coach"
        items={['Enter your coach’s invite code', 'Choose exactly what they can see', 'Change or pause sharing any time']}
      />
      <ComingSoon
        phase="Phase 3 · Training"
        title="Today’s session"
        items={['The workout your coach planned for today', 'Log sets in seconds, even with no signal']}
      />
    </Screen>
  );
}
