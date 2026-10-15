import { router } from 'expo-router';
import { useState } from 'react';
import { Share, Text, View } from 'react-native';

import { BackHeader, Body, Button, Card, Choice, Eyebrow, Screen } from '@/components/ui';
import { useProfile } from '@/lib/auth';
import { PACKAGES, SCOPES, formatCode, friendlyError, inviteMessage, useCreateInvite, type Invite } from '@/lib/coaching';
import { colors, fonts, space } from '@/theme';

/** Coach: pick a package, get a code, share it. */
export default function InviteAthlete() {
  const { data: profile } = useProfile();
  const create = useCreateInvite();
  const [pkg, setPkg] = useState(PACKAGES[1].name);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function make() {
    setError(null);
    const chosen = PACKAGES.find((p) => p.name === pkg)!;
    try {
      setInvite(await create.mutateAsync({ pkg: chosen.name, scopes: chosen.scopes }));
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  if (invite) {
    const expires = new Date(invite.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
    return (
      <Screen
        footer={
          <>
            <Button
              label="Share code"
              onPress={() => Share.share({ message: inviteMessage(invite.code, profile?.full_name || 'Your coach') })}
            />
            <Button kind="secondary" label="Done" onPress={() => router.back()} />
          </>
        }>
        <BackHeader eyebrow="Invite ready" title="Send this code to your athlete" />
        <Card style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xxxl }}>
          <Eyebrow>Invite code</Eyebrow>
          <Text selectable style={{ fontFamily: fonts.display, fontSize: 40, letterSpacing: 6, color: colors.acid }}>
            {formatCode(invite.code)}
          </Text>
          <Body tone="steel">{invite.package} · works once · until {expires}</Body>
        </Card>
        <Body>
          They open PIVOT, tap <Text style={{ color: colors.bone, fontFamily: fonts.bodyBold }}>Join your coach</Text> and enter
          it. They’ll see your name first, then choose what to share. You’ll find them on your roster as soon as they accept.
        </Body>
      </Screen>
    );
  }

  const chosen = PACKAGES.find((p) => p.name === pkg)!;
  return (
    <Screen footer={<Button label="Create invite code" onPress={make} loading={create.isPending} />}>
      <BackHeader eyebrow="Invite athlete" title="What are you coaching them on?" />
      <Body>The package decides which data we ask them to share. They can still change it.</Body>
      {PACKAGES.map((p) => (
        <Choice key={p.name} label={p.name} hint={p.detail} selected={pkg === p.name} onPress={() => setPkg(p.name)} />
      ))}
      <View style={{ gap: space.xs }}>
        <Eyebrow>We’ll ask them to share</Eyebrow>
        <Body>{SCOPES.filter((s) => chosen.scopes.includes(s.key)).map((s) => s.label).join(' · ')}</Body>
      </View>
      {error ? <Body tone="red">{error}</Body> : null}
    </Screen>
  );
}
