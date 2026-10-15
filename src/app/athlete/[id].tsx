import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { BackHeader, Badge, Body, Button, Card, ComingSoon, Eyebrow, List, Loading, Screen, confirm } from '@/components/ui';
import { SCOPES, sinceLabel, useRoster, useUpdateLink } from '@/lib/coaching';
import { GOALS } from '@/lib/types';
import { colors, fonts, space } from '@/theme';

/** Coach: one athlete — what they share, and ending coaching. */
export default function AthleteDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const roster = useRoster();
  const update = useUpdateLink();

  if (roster.isPending) return <Loading />;
  const a = roster.data?.find((r) => r.id === id);

  if (!a) {
    return (
      <Screen>
        <BackHeader title="Athlete" />
        <Body>This athlete is no longer connected to you.</Body>
      </Screen>
    );
  }

  const name = a.athlete?.full_name || 'Athlete';
  const first = name.split(' ')[0];
  const goal = GOALS.find((g) => g.value === a.athlete?.goal)?.label;
  const paused = a.status === 'paused';

  return (
    <Screen>
      <BackHeader title={name} />

      <Card style={{ gap: space.xs }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Eyebrow>{goal ?? 'Athlete'}</Eyebrow>
          <Badge label={paused ? 'Paused' : 'Active'} tone={paused ? 'steel' : 'acid'} />
        </View>
        <Body>
          Coaching since {sinceLabel(a.started_at)}
          {a.package ? ` · ${a.package}` : ''}
        </Body>
        {paused ? (
          <Body tone="gold" style={{ marginTop: space.sm }}>
            {first} paused sharing. You can’t see their data until they resume. Messages still work.
          </Body>
        ) : null}
      </Card>

      <View style={{ gap: space.sm }}>
        <Eyebrow>What {first} shares with you</Eyebrow>
        <Body>Only {first} can change this.</Body>
      </View>
      <List>
        {SCOPES.map((s) => {
          const on = !paused && a.scopes.includes(s.key);
          return (
            <View
              key={s.key}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderBottomWidth: 1, borderBottomColor: colors.line }}>
              <Ionicons name={on ? 'eye-outline' : 'eye-off-outline'} size={20} color={on ? colors.acid : colors.steel} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: on ? colors.bone : colors.steel }}>{s.label}</Text>
              </View>
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 12, color: on ? colors.acid : colors.steel }}>
                {on ? 'Visible' : 'Hidden'}
              </Text>
            </View>
          );
        })}
      </List>

      <ComingSoon
        phase="Phases 3–5"
        title={`${first}’s training, food and check-ins`}
        items={['Program, workouts and progress', 'Nutrition against target', 'Weekly check-ins to review']}
      />

      <Button
        kind="ghost"
        label="End coaching"
        onPress={() =>
          confirm(
            `End coaching with ${first}?`,
            `You’ll lose access to ${first}’s data and conversation right away. ${first} keeps their history.`,
            'End coaching',
            async () => {
              await update.mutateAsync({ id: a.id, patch: { status: 'ended' } });
              router.back();
            },
          )
        }
      />
    </Screen>
  );
}
