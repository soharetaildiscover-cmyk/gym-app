import { AccountCard } from '@/components/account';
import { Screen, Title } from '@/components/ui';

export default function Me() {
  return (
    <Screen>
      <Title>Me</Title>
      <AccountCard side="athlete" />
    </Screen>
  );
}
