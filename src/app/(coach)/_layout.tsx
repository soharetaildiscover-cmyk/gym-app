import { TabLayout } from '@/components/tab-layout';

export default function CoachLayout() {
  return (
    <TabLayout
      tabs={[
        { name: 'dashboard', title: 'Dashboard', icon: 'grid-outline' },
        { name: 'athletes', title: 'Athletes', icon: 'people-outline' },
        { name: 'plans', title: 'Plans', icon: 'clipboard-outline' },
        { name: 'messages', title: 'Messages', icon: 'chatbubble-outline' },
        { name: 'more', title: 'More', icon: 'ellipsis-horizontal' },
      ]}
    />
  );
}
