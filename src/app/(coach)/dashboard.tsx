import { router } from 'expo-router';
import { View } from 'react-native';

import { Body, ComingSoon, Eyebrow, List, Row, Screen, Title } from '@/components/ui';
import { useProfile } from '@/lib/auth';
import { useInvites, useRoster } from '@/lib/coaching';
import { space } from '@/theme';

export default function Dashboard() {
  const { data: profile } = useProfile();
  const roster = useRoster();
  const invites = useInvites();
  const first = profile?.full_name.split(' ')[0];
  const athletes = roster.data?.length ?? 0;
  const paused = roster.data?.filter((a) => a.status === 'paused').length ?? 0;
  const pending = invites.data?.length ?? 0;

  return (
    <Screen>
      <View style={{ gap: space.sm, marginTop: space.md }}>
        <Eyebrow tone="gold">Coach</Eyebrow>
        <Title>{first ? `Hi, Coach ${first}.` : 'Dashboard'}</Title>
        <Body>Who needs you today, in one list.</Body>
      </View>
      <List>
        <Row
          title={athletes === 0 ? 'Invite your first athlete' : `${athletes} athlete${athletes === 1 ? '' : 's'}`}
          detail={
            athletes === 0
              ? 'They join with a code and choose what to share'
              : [paused ? `${paused} paused sharing` : null, pending ? `${pending} invite${pending === 1 ? '' : 's'} waiting` : null]
                  .filter(Boolean)
                  .join(' · ') || 'All active'
          }
          onPress={() => router.push(athletes === 0 ? '/invite' : '/(coach)/athletes')}
        />
      </List>
      <ComingSoon
        phase="Phase 5 · Attention queue"
        title="Needs attention"
        items={['Pain reports, first', 'Check-ins waiting for review', 'Missed sessions and off-target nutrition']}
      />
    </Screen>
  );
}
