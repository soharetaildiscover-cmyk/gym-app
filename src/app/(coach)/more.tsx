import { AccountCard } from '@/components/account';
import { Screen, Title } from '@/components/ui';

export default function More() {
  return (
    <Screen>
      <Title>More</Title>
      <AccountCard side="coach" />
    </Screen>
  );
}
