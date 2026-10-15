import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { BackHeader, Body, Button, Eyebrow, Field, List, Loading, PillGroup, Row, Screen, Stepper, confirm } from '@/components/ui';
import { friendlyError } from '@/lib/coaching';
import {
  PROGRAM_GOALS,
  PROGRAM_LEVELS,
  WEEKDAYS,
  WEEK_ORDER,
  emptyProgram,
  emptySession,
  loadProgram,
  sessionOn,
  useArchiveProgram,
  useSaveProgram,
  validateProgram,
} from '@/lib/programs';
import { colors, fonts, radius, space } from '@/theme';

import { useBuilder } from '@/components/builder';

/** "Upper A" -> "UA", "Push" -> "PUS": fits a day cell. */
const short = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words.map((w) => w[0]).join('') : name.trim().slice(0, 3)).toUpperCase().slice(0, 3);
};

/** Coach: program details, weekly schedule and sessions. */
export default function ProgramEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { draft, setDraft, loadedFor, setLoadedFor, dirty, setDirty } = useBuilder();
  const save = useSaveProgram();
  const archive = useArchiveProgram();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'red' | 'acid' } | null>(null);

  useEffect(() => {
    if (loadedFor === id) return;
    if (id === 'new') {
      setDraft(emptyProgram());
      setLoadedFor('new');
      setDirty(false);
      return;
    }
    setLoading(true);
    loadProgram(id)
      .then((p) => {
        setDraft(p);
        setLoadedFor(id);
        setDirty(false);
      })
      .catch((e) => setMessage({ text: friendlyError(e), tone: 'red' }))
      .finally(() => setLoading(false));
  }, [id, loadedFor, setDraft, setLoadedFor, setDirty]);

  if (loading || loadedFor !== id) return <Loading />;

  const edit = (patch: Partial<typeof draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setDirty(true);
    setMessage(null);
  };

  async function onSave() {
    const problem = validateProgram(draft);
    if (problem) {
      setMessage({ text: problem, tone: 'red' });
      return;
    }
    try {
      const newId = await save.mutateAsync(draft);
      setDirty(false);
      setMessage({ text: 'Saved. Athletes already on this program keep their copy until you assign it again.', tone: 'acid' });
      if (draft.id !== newId) {
        setDraft((d) => ({ ...d, id: newId }));
        setLoadedFor(newId);
        router.replace({ pathname: '/program/[id]', params: { id: newId } });
      }
    } catch (e) {
      setMessage({ text: friendlyError(e), tone: 'red' });
    }
  }

  function addSession() {
    const s = emptySession(draft.sessions.length);
    edit({ sessions: [...draft.sessions, s] });
    router.push({ pathname: '/program/session', params: { key: s.key } });
  }

  const leave = () => {
    if (!dirty) return router.back();
    confirm('Leave without saving?', 'Your changes to this program will be lost.', 'Leave', () => {
      setLoadedFor(null);
      router.back();
    });
  };

  const exerciseCount = draft.sessions.reduce((n, s) => n + s.exercises.length, 0);

  return (
    <Screen
      footer={
        <View style={{ gap: space.sm }}>
          {message ? <Body tone={message.tone}>{message.text}</Body> : null}
          <View style={{ flexDirection: 'row', gap: space.md }}>
            {draft.id && !dirty ? (
              <Button
                label="Assign to athletes"
                style={{ flex: 1 }}
                onPress={() => router.push({ pathname: '/assign', params: { program: draft.id! } })}
              />
            ) : (
              <Button label={draft.id ? 'Save changes' : 'Save program'} style={{ flex: 1 }} onPress={onSave} loading={save.isPending} />
            )}
          </View>
        </View>
      }>
      <BackHeader eyebrow="Program builder" title={draft.id ? draft.name || 'Program' : 'New program'} onBack={leave} />

      <Field label="Program name" value={draft.name} onChangeText={(name) => edit({ name })} placeholder="e.g. Upper / Lower Strength" />

      <View style={{ gap: space.sm }}>
        <Eyebrow>Goal</Eyebrow>
        <PillGroup
          options={PROGRAM_GOALS.map((g) => ({ value: g, label: g }))}
          selected={[draft.goal]}
          onToggle={(goal) => edit({ goal })}
        />
      </View>
      <View style={{ gap: space.sm }}>
        <Eyebrow>Level</Eyebrow>
        <PillGroup
          options={PROGRAM_LEVELS.map((l) => ({ value: l, label: l }))}
          selected={[draft.level]}
          onToggle={(level) => edit({ level })}
        />
      </View>
      <View style={{ gap: space.sm }}>
        <Eyebrow>Length</Eyebrow>
        <Stepper value={draft.weeks} min={1} max={52} suffix={draft.weeks === 1 ? 'week' : 'weeks'} onChange={(weeks) => edit({ weeks })} />
      </View>

      <View style={{ gap: space.sm, marginTop: space.sm }}>
        <Eyebrow>Weekly schedule</Eyebrow>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {WEEK_ORDER.map((d) => {
            const s = sessionOn(draft.sessions, d);
            return (
              <Pressable
                key={d}
                accessibilityRole="button"
                accessibilityLabel={`${WEEKDAYS[d]}: ${s ? s.name : 'rest'}`}
                onPress={() => (s ? router.push({ pathname: '/program/session', params: { key: s.key } }) : undefined)}
                style={{
                  flex: 1,
                  minHeight: 64,
                  borderRadius: radius.sm,
                  padding: 6,
                  gap: 4,
                  backgroundColor: s ? 'rgba(214,255,63,0.08)' : colors.carbon,
                  borderWidth: 1,
                  borderColor: s ? colors.acid : colors.line,
                }}>
                <Text style={{ fontFamily: fonts.bodyHeavy, fontSize: 10, letterSpacing: 1, color: colors.steel }}>
                  {WEEKDAYS[d].toUpperCase()}
                </Text>
                <Text numberOfLines={1} style={{ fontFamily: s ? fonts.display : fonts.body, fontSize: s ? 15 : 11, color: s ? colors.bone : colors.steel }}>
                  {s ? short(s.name) : 'Rest'}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Body tone="steel" style={{ fontSize: 13 }}>Letters are session initials. Set the days inside each session.</Body>
      </View>

      <View style={{ gap: space.sm, marginTop: space.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Eyebrow>Sessions</Eyebrow>
          <Body tone="steel" style={{ fontSize: 13 }}>
            {draft.sessions.length} sessions · {exerciseCount} exercises
          </Body>
        </View>
        <List>
          {draft.sessions.map((s) => (
            <Row
              key={s.key}
              title={s.name || 'Untitled session'}
              detail={[
                `${s.exercises.length} exercise${s.exercises.length === 1 ? '' : 's'}`,
                s.est_minutes ? `${s.est_minutes} min` : null,
                s.weekdays.length ? WEEK_ORDER.filter((d) => s.weekdays.includes(d)).map((d) => WEEKDAYS[d]).join(', ') : 'Not scheduled',
              ]
                .filter(Boolean)
                .join(' · ')}
              onPress={() => router.push({ pathname: '/program/session', params: { key: s.key } })}
            />
          ))}
        </List>
        <Button kind="secondary" label="Add session" onPress={addSession} />
      </View>

      {draft.id ? (
        <Button
          kind="ghost"
          label="Archive program"
          onPress={() =>
            confirm('Archive this program?', 'It leaves your library. Athletes already on it keep their copy.', 'Archive', async () => {
              await archive.mutateAsync(draft.id!);
              setLoadedFor(null);
              router.back();
            })
          }
        />
      ) : null}
    </Screen>
  );
}
