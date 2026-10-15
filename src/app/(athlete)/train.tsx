import { View } from 'react-native';

import { ProgramHeader, WeekSchedule } from '@/components/program-view';
import { Body, Card, ComingSoon, Eyebrow, Loading, Screen, Title } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useMyCoach } from '@/lib/coaching';
import { useAthletePrograms } from '@/lib/programs';
import { space } from '@/theme';

/** Athlete: the program their coach assigned, week by week. */
export default function Train() {
  const { session } = useAuth();
  const programs = useAthletePrograms(session?.user.id);
  const coach = useMyCoach();

  if (programs.isPending) return <Loading />;
  const { active, scheduled } = programs.data ?? { active: null, scheduled: null };

  return (
    <Screen>
      <Title>Train</Title>
      {active || scheduled ? (
        <>
          <ProgramHeader active={active} scheduled={scheduled} coachName={coach.data?.coachName} />
          {active ? (
            <View style={{ gap: space.sm }}>
              <Eyebrow>This week</Eyebrow>
              <WeekSchedule assignment={active} />
            </View>
          ) : null}
        </>
      ) : (
        <Card style={{ gap: space.sm }}>
          <Eyebrow tone="acid">No program yet</Eyebrow>
          <Body>
            {coach.data
              ? `${coach.data.coachName.split(' ')[0]} hasn’t assigned you a program yet. It will appear here as soon as they do.`
              : 'Join your coach from the Today tab, and the program they assign will appear here.'}
          </Body>
        </Card>
      )}
      <ComingSoon
        phase="Next · Workout logging"
        title="Log today’s session"
        items={['Start the planned session and log each set', 'Rest timer, notes, and partial sessions that are never lost', 'Your history and strength trends']}
      />
    </Screen>
  );
}
