import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';

import { Body, Button, Eyebrow, Field, Screen, Title } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors, fonts, space } from '@/theme';

type Mode = 'sign-in' | 'sign-up';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignIn() {
  const [mode, setMode] = useState<Mode>('sign-in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const valid = EMAIL.test(email.trim()) && password.length >= 8 && (mode === 'sign-in' || name.trim().length > 0);

  async function submit() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === 'sign-up') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: name.trim() } },
        });
        if (error) throw error;
        if (!data.session) {
          setNotice(`We sent a confirmation link to ${email.trim()}. Open it, then come back and sign in.`);
          setMode('sign-in');
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
      router.replace('/');
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen
        footer={
          <>
            <Button label={mode === 'sign-in' ? 'Sign in' : 'Create account'} onPress={submit} disabled={!valid} loading={busy} />
            <Body tone="steel" style={{ textAlign: 'center', fontSize: 12 }}>
              Sign in with Apple and Google arrives before the beta.
            </Body>
          </>
        }>
        <View style={{ gap: space.md, marginTop: space.xxxl }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 18, color: colors.acid, letterSpacing: 3 }}>PIVOT</Text>
          <Title>{mode === 'sign-in' ? 'Welcome back.' : 'Train with your coach, not around them.'}</Title>
          <Body>
            {mode === 'sign-in'
              ? 'Sign in to pick up where you left off.'
              : 'One place for your plan, your logs and your coach.'}
          </Body>
        </View>

        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
          {(['sign-in', 'sign-up'] as const).map((m) => (
            <Pressable
              key={m}
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === m }}
              onPress={() => {
                setMode(m);
                setError(null);
              }}
              style={{
                flex: 1,
                paddingVertical: space.md,
                borderBottomWidth: 2,
                borderBottomColor: mode === m ? colors.acid : colors.line2,
              }}>
              <Text style={{ textAlign: 'center', fontFamily: fonts.bodyBold, color: mode === m ? colors.bone : colors.steel }}>
                {m === 'sign-in' ? 'Sign in' : 'New here'}
              </Text>
            </Pressable>
          ))}
        </View>

        {mode === 'sign-up' && (
          <Field label="Your name" value={name} onChangeText={setName} autoComplete="name" textContentType="name" placeholder="Hassan Tarek" />
        )}
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          placeholder="you@example.com"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
          textContentType={mode === 'sign-in' ? 'password' : 'newPassword'}
          placeholder="At least 8 characters"
          onSubmitEditing={valid ? submit : undefined}
        />

        {error ? <Body tone="red">{error}</Body> : null}
        {notice ? (
          <View style={{ gap: space.xs }}>
            <Eyebrow tone="acid">Check your email</Eyebrow>
            <Body tone="bone">{notice}</Body>
          </View>
        ) : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

function friendly(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/invalid login credentials/i.test(msg)) return 'That email and password don’t match. Try again.';
  if (/email not confirmed/i.test(msg)) return 'Confirm your email first. The link is in your inbox.';
  if (/already registered/i.test(msg)) return 'That email already has an account. Sign in instead.';
  if (/network|fetch/i.test(msg)) return 'No connection. Check your internet and try again.';
  return msg;
}
