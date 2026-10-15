import { ComingSoon, Screen, Title } from '@/components/ui';

export default function Train() {
  return (
    <Screen>
      <Title>Train</Title>
      <ComingSoon
        phase="Phase 3 · Training"
        title="Your program and workout log"
        items={[
          'The program your coach assigned, week by week',
          'Start a session, log weight, reps and effort per set',
          'Rest timer, notes, and partial sessions that are never lost',
          'Your own routines if you train without a coach',
          'Full workout history',
        ]}
      />
    </Screen>
  );
}
