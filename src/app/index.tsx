import { Redirect } from 'expo-router';

import { Loading } from '@/components/ui';
import { useAuth, useProfile } from '@/lib/auth';

/** Sends each person to the right place: sign in, finish setup, or their home. */
export default function Gate() {
  const { session, ready } = useAuth();
  const profile = useProfile();

  if (!ready) return <Loading />;
  if (!session) return <Redirect href="/sign-in" />;
  if (profile.isPending) return <Loading />;
  if (!profile.data?.onboarded_at) return <Redirect href="/onboarding" />;
  return <Redirect href={profile.data.is_coach ? '/(coach)/dashboard' : '/(athlete)/today'} />;
}
