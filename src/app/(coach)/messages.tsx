import { ComingSoon, Screen, Title } from '@/components/ui';

export default function Messages() {
  return (
    <Screen>
      <Title>Messages</Title>
      <ComingSoon
        phase="Phase 5 · Communication"
        title="One conversation per athlete"
        items={['Text and photos', 'Feedback tied to a check-in, workout or meal', 'Push notifications for new messages']}
      />
    </Screen>
  );
}
