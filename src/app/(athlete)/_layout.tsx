import { TabLayout } from '@/components/tab-layout';

export default function AthleteLayout() {
  return (
    <TabLayout
      tabs={[
        { name: 'today', title: 'Today', icon: 'flash-outline' },
        { name: 'train', title: 'Train', icon: 'barbell-outline' },
        { name: 'food', title: 'Food', icon: 'restaurant-outline' },
        { name: 'progress', title: 'Progress', icon: 'trending-up-outline' },
        { name: 'me', title: 'Me', icon: 'person-outline' },
      ]}
    />
  );
}
