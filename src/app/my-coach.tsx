import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { BackHeader, Badge, Body, Button, Card, Eyebrow, List, Loading, Screen, ToggleRow, confirm } from '@/components/ui';
import { SCOPES, friendlyError, sinceLabel, useMyCoach, useUpdateLink, type Scope } from '@/lib/coaching';
import { colors, fonts, space } from '@/theme';

/** Athlete: who coaches me, what they can see, pause / resume / end. */
export default function MyCoach() {
  const { data, isPending, error } = useMyCoach();
  const update = useUpdateLink();
  const [message, setMessage] = useState<{ text: string; tone: 'acid' | 'red' } | null>(null);

  if (isPending) return <Loading />;

  if (error) {
    return (
      <Screen>
        <BackHeader title="My coach" />
        <Body tone="red">{friendlyError(error)}</Body>
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen>
        <BackHeader title="My coach" />
        <Body>You’re not connected to a coach. If you have a code from your coach, join them here.</Body>
        <Button label="Join your coach" onPress={() => router.push('/join')} />
      </Screen>
    );
  }

  const { link, coachName, coachTitle } = data;
  const first = coachName.split(' ')[0] || 'Your coach';
  const paused = link.status === 'paused';

  async function save(patch: Parameters<typeof update.mutateAsync>[0]['patch'], done?: string) {
    setMessage(null);
    try {
      await update.mutateAsync({ id: link.id, patch });
      if (done) setMessage({ text: done, tone: 'acid' });
    } catch (e) {
      setMessage({ text: friendlyError(e), tone: 'red' });
    }
  }

  const toggle = (k: Scope, on: boolean) =>
    save({ scopes: on ? [...new Set([...link.scopes, k])] : link.scopes.filter((x) => x !== k) });

  return (
    <Screen>
      <BackHeader title="My coach" />

      <Card style={{ gap: space.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Eyebrow tone="gold">Coach</Eyebrow>
          <Badge label={paused ? 'Paused' : 'Active'} tone={paused ? 'steel' : 'acid'} />
        </View>
        <Text style={{ fontFamily: fonts.display, fontSize: 22, color: colors.gold }}>{coachName}</Text>
        {coachTitle ? <Body>{coachTitle}</Body> : null}
        <Body tone="steel" style={{ marginTop: space.sm }}>
          Since {sinceLabel(link.started_at)}
          {link.package ? ` · ${link.package}` : ''}
        </Body>
      </Card>

      <View style={{ gap: space.sm }}>
        <Eyebrow>What {first} can see</Eyebrow>
        <Body>
          {paused
            ? `Sharing is paused. ${first} can’t see any of it until you resume. Messages still work.`
            : 'Turning one off hides it from every screen your coach has, right away.'}
        </Body>
      </View>
      <List>
        {SCOPES.map((s) => (
          <ToggleRow
            key={s.key}
            title={s.label}
            detail={s.detail}
            value={link.scopes.includes(s.key)}
            onChange={(v) => toggle(s.key, v)}
            disabled={update.isPending}
          />
        ))}
      </List>

      {message ? <Body tone={message.tone}>{message.text}</Body> : null}

      <View style={{ gap: space.md, marginTop: space.sm }}>
        <Button
          kind="secondary"
          label={paused ? 'Resume sharing' : 'Pause all sharing'}
          loading={update.isPending}
          onPress={() =>
            save({ status: paused ? 'active' : 'paused' }, paused ? `${first} can see what you share again.` : `Paused. ${first} sees nothing until you resume.`)
          }
        />
        <Button
          kind="ghost"
          label="End coaching"
          onPress={() =>
            confirm(
              `End coaching with ${first}?`,
              `${first} will lose access to everything right away. You keep all your history. To work together again you’ll need a new invite.`,
              'End coaching',
              async () => {
                await save({ status: 'ended' });
                router.replace('/(athlete)/today');
              },
            )
          }
        />
      </View>
    </Screen>
  );
}
