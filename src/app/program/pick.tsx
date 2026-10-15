import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useBuilder } from '@/components/builder';
import { BackHeader, Body, Button, Card, Eyebrow, Field, List, Loading, PillGroup, Screen } from '@/components/ui';
import { friendlyError } from '@/lib/coaching';
import { draftExercise, useCreateExercise, useExerciseLibrary, type Exercise } from '@/lib/programs';
import { colors, fonts, space } from '@/theme';

const GROUPS = ['Chest', 'Back', 'Legs', 'Glutes', 'Shoulders', 'Arms', 'Core', 'Full body', 'Cardio'];

/** Coach: choose exercises from the library (or add a custom one) for a session. */
export default function ExercisePicker() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const { draft, setDraft, setDirty } = useBuilder();
  const library = useExerciseLibrary();
  const create = useCreateExercise();
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<string | null>(null);
  const [picked, setPicked] = useState<Exercise[]>([]);
  const [customGroup, setCustomGroup] = useState('Chest');
  const [error, setError] = useState<string | null>(null);

  const session = draft.sessions.find((s) => s.key === key);
  const already = new Set(session?.exercises.map((e) => e.exercise_id));

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (library.data ?? []).filter(
      (x) => (!group || x.muscle_group === group) && (!q || x.name.toLowerCase().includes(q) || x.muscle_group.toLowerCase().includes(q)),
    );
  }, [library.data, query, group]);

  if (library.isPending) return <Loading />;

  const toggle = (x: Exercise) => setPicked((p) => (p.some((y) => y.id === x.id) ? p.filter((y) => y.id !== x.id) : [...p, x]));

  function addPicked() {
    setDraft((d) => ({
      ...d,
      sessions: d.sessions.map((s) => (s.key === key ? { ...s, exercises: [...s.exercises, ...picked.map(draftExercise)] } : s)),
    }));
    setDirty(true);
    router.back();
  }

  async function addCustom() {
    setError(null);
    try {
      const x = await create.mutateAsync({ name: query.trim(), muscle_group: customGroup, equipment: 'Other' });
      setPicked((p) => [...p, x]);
      setQuery('');
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  return (
    <Screen
      footer={
        <Button
          label={picked.length ? `Add ${picked.length} exercise${picked.length === 1 ? '' : 's'}` : 'Choose exercises'}
          disabled={!picked.length}
          onPress={addPicked}
        />
      }>
      <BackHeader eyebrow={session?.name ?? 'Session'} title="Add exercises" />
      <Field label="Search" value={query} onChangeText={setQuery} placeholder="Bench, squat, row…" autoCorrect={false} />
      <PillGroup
        options={GROUPS.map((g) => ({ value: g, label: g }))}
        selected={group ? [group] : []}
        onToggle={(g) => setGroup((cur) => (cur === g ? null : g))}
      />

      {list.length ? (
        <List>
          {list.map((x) => {
            const on = picked.some((y) => y.id === x.id);
            const inSession = already.has(x.id);
            return (
              <Pressable
                key={x.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                onPress={() => toggle(x)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderBottomWidth: 1, borderBottomColor: colors.line }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.bone }}>
                    {x.name}
                    {x.owner_id ? <Text style={{ color: colors.gold }}>  · yours</Text> : null}
                  </Text>
                  <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.steel }}>
                    {[x.muscle_group, x.equipment, inSession ? 'already in this session' : null].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <Ionicons name={on ? 'checkmark-circle' : 'add-circle-outline'} size={24} color={on ? colors.acid : colors.steel} />
              </Pressable>
            );
          })}
        </List>
      ) : null}

      {query.trim().length > 1 ? (
        <Card style={{ gap: space.md }}>
          <Eyebrow tone="gold">Not in the library?</Eyebrow>
          <Body>Add “{query.trim()}” as your own exercise. Your athletes will see it in their program.</Body>
          <PillGroup options={GROUPS.map((g) => ({ value: g, label: g }))} selected={[customGroup]} onToggle={setCustomGroup} />
          <Button kind="secondary" label={`Create “${query.trim()}”`} onPress={addCustom} loading={create.isPending} />
          {error ? <Body tone="red">{error}</Body> : null}
        </Card>
      ) : null}
    </Screen>
  );
}
