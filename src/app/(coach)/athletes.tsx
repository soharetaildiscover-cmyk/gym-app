import { ComingSoon, Screen, Title } from '@/components/ui';

export default function Athletes() {
  return (
    <Screen>
      <Title>Athletes</Title>
      <ComingSoon
        phase="Phase 2 · Coach connect"
        title="Your roster"
        items={[
          'Create an invite code or link for a new athlete',
          'See each athlete’s goal, program week and status',
          'Open an athlete and see only what they share with you',
        ]}
      />
    </Screen>
  );
}
