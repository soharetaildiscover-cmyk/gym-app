import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Body, Button, Card, ComingSoon, Eyebrow, Row, Screen, Title, List } from '@/components/ui';
import { useProfile } from '@/lib/auth';
import { useMyCoach } from '@/lib/coaching';
import { colors, fonts, space } from '@/theme';

export default function Today() {
  const { data: profile } = useProfile();
  const coach = useMyCoach();
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

      {coach.data ? (
        <List>
          <Row
            title={`Coached by ${coach.data.coachName}`}
            tone="gold"
            detail={
              coach.data.link.status === 'paused'
                ? 'Sharing paused'
                : `Sharing ${coach.data.link.scopes.length} of 7 · tap to change`
            }
            onPress={() => router.push('/my-coach')}
          />
        </List>
      ) : coach.isSuccess ? (
        <Card style={{ gap: space.md }}>
          <Eyebrow tone="acid">Got a coach?</Eyebrow>
          <Text style={{ fontFamily: fonts.display, fontSize: 20, color: colors.bone }}>Join your coach</Text>
          <Body>Enter the code they gave you. You choose exactly what they can see.</Body>
          <Button label="Enter invite code" onPress={() => router.push('/join')} />
        </Card>
      ) : null}

      <ComingSoon
        phase="Phase 3 · Training"
        title="Today’s session"
        items={['The workout your coach planned for today', 'Log sets in seconds, even with no signal']}
      />
    </Screen>
  );
}
