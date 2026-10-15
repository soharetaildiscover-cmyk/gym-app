import { router } from 'expo-router';

import { AccountCard } from '@/components/account';
import { List, Row, Screen, Title } from '@/components/ui';
import { useMyCoach } from '@/lib/coaching';

export default function Me() {
  const coach = useMyCoach();
  return (
    <Screen>
      <Title>Me</Title>
      <List>
        <Row
          title="My coach"
          detail={coach.data ? `${coach.data.coachName} · ${coach.data.link.status === 'paused' ? 'sharing paused' : 'active'}` : 'Not connected'}
          onPress={() => router.push(coach.data ? '/my-coach' : '/join')}
        />
      </List>
      <AccountCard side="athlete" />
    </Screen>
  );
}
