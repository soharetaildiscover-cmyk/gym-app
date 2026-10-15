import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { useBuilder } from '@/components/builder';
import { BackHeader, Body, Button, Card, Eyebrow, Field, MiniField, PillGroup, Screen, confirm } from '@/components/ui';
import { WEEKDAYS, WEEK_ORDER, type DraftExercise, type DraftSession } from '@/lib/programs';
import { colors, fonts, space } from '@/theme';

/** Coach: one session — name, days, and its exercises with targets. */
export default function SessionEditor() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const { draft, setDraft, setDirty } = useBuilder();
  const index = draft.sessions.findIndex((s) => s.key === key);
  const session = draft.sessions[index];

  if (!session) {
    return (
      <Screen>
        <BackHeader title="Session" />
        <Body>This session is no longer in the program.</Body>
      </Screen>
    );
  }

  const update = (fn: (s: DraftSession) => DraftSession) => {
    setDraft((d) => ({ ...d, sessions: d.sessions.map((s) => (s.key === key ? fn(s) : s)) }));
    setDirty(true);
  };
  const editEx = (exKey: string, patch: Partial<DraftExercise>) =>
    update((s) => ({ ...s, exercises: s.exercises.map((e) => (e.key === exKey ? { ...e, ...patch } : e)) }));
  const move = (i: number, dir: -1 | 1) =>
    update((s) => {
      const ex = [...s.exercises];
      const j = i + dir;
      if (j < 0 || j >= ex.length) return s;
      [ex[i], ex[j]] = [ex[j], ex[i]];
      return { ...s, exercises: ex };
    });

  const takenElsewhere = draft.sessions.filter((s) => s.key !== key).flatMap((s) => s.weekdays);

  return (
    <Screen
      footer={
        <Button label="Add exercises" onPress={() => router.push({ pathname: '/program/pick', params: { key } })} />
      }>
      <BackHeader eyebrow={`Session ${index + 1} of ${draft.sessions.length}`} title={session.name || 'Untitled session'} />

      <Field label="Session name" value={session.name} onChangeText={(name) => update((s) => ({ ...s, name }))} placeholder="Upper A" />
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <View style={{ flex: 2 }}>
          <Field label="Focus" value={session.focus} onChangeText={(focus) => update((s) => ({ ...s, focus }))} placeholder="Chest, back, shoulders" />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label="Minutes"
            value={session.est_minutes}
            onChangeText={(t) => update((s) => ({ ...s, est_minutes: t.replace(/\D/g, '').slice(0, 3) }))}
            keyboardType="number-pad"
            placeholder="60"
          />
        </View>
      </View>

      <View style={{ gap: space.sm }}>
        <Eyebrow>Train on</Eyebrow>
        <PillGroup
          options={WEEK_ORDER.map((d) => ({ value: d, label: WEEKDAYS[d] }))}
          selected={session.weekdays}
          disabled={takenElsewhere}
          onToggle={(d) =>
            update((s) => ({ ...s, weekdays: s.weekdays.includes(d) ? s.weekdays.filter((x) => x !== d) : [...s.weekdays, d] }))
          }
        />
        {takenElsewhere.length ? <Body tone="steel" style={{ fontSize: 13 }}>Faded days already have another session.</Body> : null}
      </View>

      <View style={{ gap: space.sm, marginTop: space.sm }}>
        <Eyebrow>Exercises</Eyebrow>
        {session.exercises.length === 0 ? (
          <Card style={{ gap: space.sm }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 18, color: colors.bone }}>Build this session</Text>
            <Body>Pick exercises from the library, then set the target sets, reps, weight and rest for each one.</Body>
          </Card>
        ) : null}
        {session.exercises.map((e, i) => (
          <Card key={e.key} style={{ gap: space.md, padding: space.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 15, color: colors.acid, width: 22 }}>{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: colors.bone }}>{e.name}</Text>
                <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.steel }}>{e.muscle_group}</Text>
              </View>
              <IconBtn name="chevron-up" label="Move up" onPress={() => move(i, -1)} disabled={i === 0} />
              <IconBtn name="chevron-down" label="Move down" onPress={() => move(i, 1)} disabled={i === session.exercises.length - 1} />
              <IconBtn
                name="close"
                label={`Remove ${e.name}`}
                onPress={() => update((s) => ({ ...s, exercises: s.exercises.filter((x) => x.key !== e.key) }))}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <MiniField label="Sets" value={e.sets} keyboardType="number-pad" onChangeText={(t) => editEx(e.key, { sets: t.replace(/\D/g, '').slice(0, 2) })} />
              <MiniField label="Reps" value={e.reps} onChangeText={(t) => editEx(e.key, { reps: t.slice(0, 7) })} placeholder="8-10" />
              <MiniField
                label="kg"
                value={e.target_load_kg}
                keyboardType="decimal-pad"
                placeholder="—"
                onChangeText={(t) => editEx(e.key, { target_load_kg: t.replace(',', '.').replace(/[^\d.]/g, '').slice(0, 6) })}
              />
              <MiniField
                label="Rest s"
                value={e.rest_seconds}
                keyboardType="number-pad"
                placeholder="90"
                onChangeText={(t) => editEx(e.key, { rest_seconds: t.replace(/\D/g, '').slice(0, 3) })}
              />
            </View>
            <Field
              label="Coach note"
              value={e.notes}
              onChangeText={(notes) => editEx(e.key, { notes })}
              placeholder="Optional, e.g. pause 1s at the bottom"
              style={{ minHeight: 42, fontSize: 14 }}
            />
          </Card>
        ))}
      </View>

      {draft.sessions.length > 1 ? (
        <Button
          kind="ghost"
          label="Delete this session"
          onPress={() =>
            confirm(`Delete “${session.name}”?`, 'Its exercises are removed from this program.', 'Delete', () => {
              setDraft((d) => ({ ...d, sessions: d.sessions.filter((s) => s.key !== key) }));
              setDirty(true);
              router.back();
            })
          }
        />
      ) : null}
    </Screen>
  );
}

function IconBtn({ name, label, onPress, disabled }: { name: 'chevron-up' | 'chevron-down' | 'close'; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      disabled={disabled}
      onPress={onPress}
      style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.25 : 1 }}>
      <Ionicons name={name} size={18} color={name === 'close' ? colors.steel : colors.bone} />
    </Pressable>
  );
}
