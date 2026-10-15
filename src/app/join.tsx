import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';

import { BackHeader, Body, Button, Card, Eyebrow, Field, List, Loading, Screen, ToggleRow } from '@/components/ui';
import {
  PACKAGES,
  SCOPES,
  formatCode,
  friendlyError,
  previewInvite,
  useMyCoach,
  useRedeemInvite,
  type InvitePreview,
  type Scope,
} from '@/lib/coaching';
import { colors, fonts, space } from '@/theme';

const clean = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);

/** Athlete: enter a coach's code, see who it is, choose what to share, accept. */
export default function Join() {
  const myCoach = useMyCoach();
  const redeem = useRedeemInvite();
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [scopes, setScopes] = useState<Scope[]>([]);

  if (myCoach.isPending) return <Loading />;

  if (myCoach.data) {
    return (
      <Screen>
        <BackHeader title="You already have a coach" />
        <Body>
          You’re coached by {myCoach.data.coachName}. To join a different coach, end that coaching first from My coach.
        </Body>
        <Button label="Go to My coach" onPress={() => router.replace('/my-coach')} />
      </Screen>
    );
  }

  async function check() {
    setChecking(true);
    setError(null);
    try {
      const p = await previewInvite(code);
      if (!p) {
        setError('That code doesn’t work. It may be mistyped, used, cancelled or expired. Ask your coach for a new one.');
        return;
      }
      setPreview(p);
      setScopes(p.suggested_scopes ?? []);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setChecking(false);
    }
  }

  async function accept() {
    setError(null);
    try {
      await redeem.mutateAsync({ code, scopes });
      router.replace('/my-coach');
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  if (!preview) {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Screen footer={<Button label="Continue" onPress={check} disabled={code.length < 8} loading={checking} />}>
          <BackHeader eyebrow="Join your coach" title="Enter your coach’s code" />
          <Body>Your coach can find it in their PIVOT app under Athletes → Invite athlete.</Body>
          <Field
            label="Invite code"
            value={formatCode(code)}
            onChangeText={(t) => setCode(clean(t))}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="K7Q2 M9XA"
            maxLength={9}
            onSubmitEditing={code.length === 8 ? check : undefined}
            style={{ fontFamily: fonts.display, fontSize: 24, letterSpacing: 4, textAlign: 'center' }}
          />
          {error ? <Body tone="red">{error}</Body> : null}
        </Screen>
      </KeyboardAvoidingView>
    );
  }

  const pkg = PACKAGES.find((p) => p.name === preview.package);
  const toggle = (k: Scope, on: boolean) => setScopes((s) => (on ? [...new Set([...s, k])] : s.filter((x) => x !== k)));

  return (
    <Screen
      footer={
        <>
          <Button label={`Start coaching with ${preview.coach_name.split(' ')[0] || 'your coach'}`} onPress={accept} loading={redeem.isPending} />
          <Body tone="steel" style={{ textAlign: 'center', fontSize: 12 }}>
            You can change what you share, pause, or end coaching any time.
          </Body>
        </>
      }>
      <BackHeader eyebrow="Join your coach" title="Check who you’re joining" onBack={() => setPreview(null)} />

      <Card style={{ gap: space.xs }}>
        <Eyebrow tone="gold">Your coach</Eyebrow>
        <Text style={{ fontFamily: fonts.display, fontSize: 22, color: colors.gold }}>{preview.coach_name}</Text>
        {preview.coach_title ? <Body>{preview.coach_title}</Body> : null}
        {preview.package ? (
          <Body tone="steel" style={{ marginTop: space.sm }}>
            {preview.package}
            {pkg ? ` · ${pkg.detail}` : ''}
          </Body>
        ) : null}
      </Card>

      <View style={{ gap: space.sm }}>
        <Eyebrow>What can {preview.coach_name.split(' ')[0] || 'your coach'} see?</Eyebrow>
        <Body>
          {preview.package ? `${preview.package} suggests the ones switched on. ` : ''}Change anything. Whatever you turn off stays private.
        </Body>
      </View>
      <List>
        {SCOPES.map((s) => (
          <ToggleRow key={s.key} title={s.label} detail={s.detail} value={scopes.includes(s.key)} onChange={(v) => toggle(s.key, v)} />
        ))}
      </List>
      {scopes.length === 0 ? (
        <Body tone="gold">You’re sharing nothing yet. Your coach will only be able to message you and send programs.</Body>
      ) : null}
      {error ? <Body tone="red">{error}</Body> : null}
    </Screen>
  );
}
