import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge, Body, Button, Card, Eyebrow, List, Row, Title, confirm } from '@/components/ui';
import { useProfile } from '@/lib/auth';
import { formatCode, inviteMessage, sinceLabel, useInvites, useRevokeInvite, useRoster } from '@/lib/coaching';
import { GOALS } from '@/lib/types';
import { colors, fonts, gutter, space } from '@/theme';

/** Coach: roster of connected athletes, plus invites that haven't been used yet. */
export default function Athletes() {
  const { data: profile } = useProfile();
  const roster = useRoster();
  const invites = useInvites();
  const revoke = useRevokeInvite();
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    await Promise.all([roster.refetch(), invites.refetch()]);
    setRefreshing(false);
  }

  const athletes = roster.data ?? [];
  const pending = invites.data ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.black }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: gutter, paddingTop: space.lg, gap: space.lg, paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.acid} />}>
        <View style={{ width: '100%', maxWidth: 520, alignSelf: 'center', gap: space.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <Title>Athletes</Title>
            <Body tone="steel">{athletes.length} connected</Body>
          </View>

          <Button label="Invite athlete" onPress={() => router.push('/invite')} />

          {roster.isError ? <Body tone="red">Couldn’t load your roster. Pull down to try again.</Body> : null}

          {roster.isSuccess && athletes.length === 0 ? (
            <Card style={{ gap: space.sm }}>
              <Eyebrow tone="acid">No athletes yet</Eyebrow>
              <Body>Create an invite code and send it to your first athlete. They’ll appear here as soon as they accept.</Body>
            </Card>
          ) : null}

          {athletes.length > 0 ? (
            <List>
              {athletes.map((a) => {
                const goal = GOALS.find((g) => g.value === a.athlete?.goal)?.label;
                const paused = a.status === 'paused';
                return (
                  <Row
                    key={a.id}
                    title={a.athlete?.full_name || 'Athlete'}
                    detail={[goal, paused ? 'Sharing paused' : `Shares ${a.scopes.length} of 7`, `since ${sinceLabel(a.started_at)}`]
                      .filter(Boolean)
                      .join(' · ')}
                    right={paused ? <Badge label="Paused" /> : null}
                    onPress={() => router.push({ pathname: '/athlete/[id]', params: { id: a.id } })}
                  />
                );
              })}
            </List>
          ) : null}

          {pending.length > 0 ? (
            <View style={{ gap: space.sm }}>
              <Eyebrow>Waiting to be used</Eyebrow>
              <List>
                {pending.map((inv) => (
                  <View key={inv.id} style={{ padding: space.lg, gap: space.sm, borderBottomWidth: 1, borderBottomColor: colors.line }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontFamily: fonts.display, fontSize: 20, letterSpacing: 3, color: colors.acid }}>
                        {formatCode(inv.code)}
                      </Text>
                      <Body tone="steel" style={{ fontSize: 13 }}>
                        until {new Date(inv.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </Body>
                    </View>
                    <Body tone="steel" style={{ fontSize: 13 }}>{inv.package}</Body>
                    <View style={{ flexDirection: 'row', gap: space.sm }}>
                      <Button
                        kind="secondary"
                        label="Share"
                        style={{ flex: 1, minHeight: 42 }}
                        onPress={() => Share.share({ message: inviteMessage(inv.code, profile?.full_name || 'Your coach') })}
                      />
                      <Button
                        kind="ghost"
                        label="Cancel"
                        style={{ flex: 1, minHeight: 42 }}
                        onPress={() =>
                          confirm('Cancel this invite?', 'The code will stop working.', 'Cancel invite', () => revoke.mutate(inv.id))
                        }
                      />
                    </View>
                  </View>
                ))}
              </List>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
