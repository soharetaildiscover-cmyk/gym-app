import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge, Body, Button, Card, ComingSoon, Eyebrow, List, Row, Title } from '@/components/ui';
import { usePrograms } from '@/lib/programs';
import { colors, fonts, gutter, space } from '@/theme';

/** Coach: the program library. */
export default function Plans() {
  const programs = usePrograms();
  const [refreshing, setRefreshing] = useState(false);
  const list = programs.data ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.black }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: gutter, paddingTop: space.lg, paddingBottom: 48 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.acid}
            onRefresh={async () => {
              setRefreshing(true);
              await programs.refetch();
              setRefreshing(false);
            }}
          />
        }>
        <View style={{ width: '100%', maxWidth: 520, alignSelf: 'center', gap: space.lg }}>
          <View style={{ gap: space.xs }}>
            <Title>Plans</Title>
            <Body>Reusable programs. Each athlete you assign gets their own copy.</Body>
          </View>

          <Button label="New program" onPress={() => router.push({ pathname: '/program/[id]', params: { id: 'new' } })} />

          {programs.isError ? <Body tone="red">Couldn’t load your programs. Pull down to try again.</Body> : null}

          {programs.isSuccess && list.length === 0 ? (
            <Card style={{ gap: space.sm }}>
              <Eyebrow tone="acid">No programs yet</Eyebrow>
              <Body>Build your first program: name it, add sessions, pick exercises and set the weekly schedule.</Body>
            </Card>
          ) : null}

          {list.length ? (
            <List>
              {list.map((p) => {
                const sessions = p.template_days[0]?.count ?? 0;
                const onIt = new Set(p.assignments.filter((a) => a.status === 'active' || a.status === 'scheduled').map((a) => a.athlete_id)).size;
                return (
                  <Row
                    key={p.id}
                    title={p.name}
                    detail={[p.level, p.goal, `${sessions} session${sessions === 1 ? '' : 's'}`, `${p.weeks} weeks`].filter(Boolean).join(' · ')}
                    right={
                      p.status === 'draft' ? (
                        <Badge label="Draft" />
                      ) : onIt ? (
                        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 12, color: colors.gold }}>
                          {onIt} athlete{onIt === 1 ? '' : 's'}
                        </Text>
                      ) : null
                    }
                    onPress={() => router.push({ pathname: '/program/[id]', params: { id: p.id } })}
                  />
                );
              })}
            </List>
          ) : null}

          <ComingSoon phase="Later phases" title="Meal templates and check-in forms" items={['Reusable meal plans', 'Your own weekly check-in questions']} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
