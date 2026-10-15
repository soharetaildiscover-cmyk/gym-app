import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Body, Button, Card, ComingSoon, Eyebrow, Row, Screen, Title, List } from '@/components/ui';
import { useAuth, useProfile } from '@/lib/auth';
import { useMyCoach } from '@/lib/coaching';
import { describeTarget, sessionOn, useAthletePrograms } from '@/lib/programs';
import { colors, fonts, space } from '@/theme';

export default function Today() {
  const { data: profile } = useProfile();
  const coach = useMyCoach();
  const { session } = useAuth();
  const programs = useAthletePrograms(session?.user.id);
  const todays = programs.data?.active ? sessionOn(programs.data.active.snapshot.days, new Date().getDay()) : null;
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

      {programs.data?.active ? (
        <Card style={{ gap: space.sm }}>
          <Eyebrow tone="acid">Today’s session</Eyebrow>
          {todays ? (
            <>
              <Text style={{ fontFamily: fonts.display, fontSize: 22, color: colors.bone }}>{todays.name}</Text>
              <Body tone="steel">
                {[todays.focus, `${todays.exercises.length} exercises`, todays.est_minutes ? `~${todays.est_minutes} min` : null].filter(Boolean).join(' · ')}
              </Body>
              <View style={{ gap: 6, marginTop: space.xs }}>
                {todays.exercises.slice(0, 4).map((e, i) => (
                  <Body key={`${e.exercise_id}-${i}`} tone="bone2" style={{ fontSize: 14 }}>
                    {e.name} · {describeTarget(e)}
                  </Body>
                ))}
                {todays.exercises.length > 4 ? <Body tone="steel" style={{ fontSize: 13 }}>+{todays.exercises.length - 4} more</Body> : null}
              </View>
              <Button kind="secondary" label="See the full week" onPress={() => router.push('/(athlete)/train')} />
            </>
          ) : (
            <>
              <Text style={{ fontFamily: fonts.display, fontSize: 22, color: colors.bone }}>Rest day</Text>
              <Body>Nothing planned today in {programs.data.active.name}. Recover well.</Body>
            </>
          )}
        </Card>
      ) : (
        <ComingSoon
          phase="Training"
          title="Today’s session"
          items={['The workout your coach planned for today', 'Log sets in seconds, even with no signal']}
        />
      )}
    </Screen>
  );
}
