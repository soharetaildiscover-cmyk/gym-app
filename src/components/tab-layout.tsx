import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';

import { Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { colors, fonts } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];
export type TabDef = { name: string; title: string; icon: IconName };

/** Bottom tabs shared by the athlete and coach sides. Signed-out people go to sign in. */
export function TabLayout({ tabs }: { tabs: TabDef[] }) {
  const { session, ready } = useAuth();
  if (!ready) return <Loading />;
  if (!session) return <Redirect href="/sign-in" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.acid,
        tabBarInactiveTintColor: colors.steel,
        tabBarStyle: { backgroundColor: colors.black, borderTopColor: colors.line, height: 64, paddingTop: 6 },
        tabBarLabelStyle: { fontFamily: fonts.bodyBold, fontSize: 11 },
        sceneStyle: { backgroundColor: colors.black },
      }}>
      {tabs.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ color, size }) => <Ionicons name={t.icon} color={color} size={size - 2} />,
          }}
        />
      ))}
    </Tabs>
  );
}
