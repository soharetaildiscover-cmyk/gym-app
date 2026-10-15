/**
 * The small component kit every screen is built from.
 * Visual language follows the PIVOT prototype: dark carbon cards, bone text,
 * an acid accent for the primary action, gold for anything the coach owns.
 */
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, gutter, radius, space } from '@/theme';

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------
export function Screen({
  children,
  scroll = true,
  footer,
  edges = ['top'],
}: {
  children: ReactNode;
  scroll?: boolean;
  footer?: ReactNode;
  edges?: ('top' | 'bottom')[];
}) {
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.column}>{children}</View>
        </ScrollView>
      ) : (
        <View style={[styles.scroll, styles.column, { flex: 1 }]}>{children}</View>
      )}
      {footer ? <View style={[styles.footer, styles.column]}>{footer}</View> : null}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Type
// ---------------------------------------------------------------------------
export function Eyebrow({ children, tone = 'steel' }: { children: ReactNode; tone?: 'steel' | 'acid' | 'gold' }) {
  return <Text style={[styles.eyebrow, { color: colors[tone] }]}>{children}</Text>;
}

export function Title({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.title, style]}>{children}</Text>;
}

export function Heading({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.heading, style]}>{children}</Text>;
}

export function Body({
  children,
  tone = 'bone2',
  style,
}: {
  children: ReactNode;
  tone?: 'bone' | 'bone2' | 'steel' | 'red' | 'gold' | 'acid';
  style?: StyleProp<TextStyle>;
}) {
  return <Text style={[styles.body, { color: colors[tone] }, style]}>{children}</Text>;
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------
export function Button({
  label,
  onPress,
  kind = 'primary',
  disabled,
  loading,
  style,
}: {
  label: string;
  onPress?: () => void;
  kind?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [
        styles.btn,
        kind === 'primary' && styles.btnPrimary,
        kind === 'secondary' && styles.btnSecondary,
        kind === 'ghost' && styles.btnGhost,
        off && { opacity: 0.4 },
        pressed && !off && { opacity: 0.8 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={kind === 'primary' ? colors.black : colors.bone} />
      ) : (
        <Text style={[styles.btnText, kind === 'primary' ? { color: colors.black } : { color: colors.bone }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Field({ label, hint, error, ...input }: TextInputProps & { label: string; hint?: string; error?: string }) {
  return (
    <View style={{ gap: space.sm }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.steel}
        selectionColor={colors.acid}
        {...input}
        style={[styles.input, error ? { borderColor: colors.red } : null, input.style]}
      />
      {error ? <Body tone="red">{error}</Body> : hint ? <Body tone="steel" style={styles.small}>{hint}</Body> : null}
    </View>
  );
}

/** A large, tappable choice: used for single-select questions in onboarding. */
export function Choice({
  label,
  hint,
  selected,
  onPress,
}: {
  label: string;
  hint?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.choice, selected && styles.choiceOn, pressed && { opacity: 0.85 }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.choiceLabel}>{label}</Text>
        {hint ? <Text style={styles.choiceHint}>{hint}</Text> : null}
      </View>
      <View style={[styles.radio, selected && styles.radioOn]} />
    </Pressable>
  );
}

export function Pill({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.pill, selected && styles.pillOn]}>
      <Text style={[styles.pillText, selected && { color: colors.black }]}>{label}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** An honest placeholder for a part of the app that a later phase builds. */
export function ComingSoon({ phase, title, items }: { phase: string; title: string; items: string[] }) {
  return (
    <Card style={{ gap: space.md }}>
      <Eyebrow tone="acid">{phase}</Eyebrow>
      <Heading>{title}</Heading>
      <View style={{ gap: space.sm }}>
        {items.map((it) => (
          <View key={it} style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
            <View style={styles.diamond} />
            <Body style={{ flex: 1 }}>{it}</Body>
          </View>
        ))}
      </View>
    </Card>
  );
}

export function Steps({ count, current }: { count: number; current: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }} accessibilityLabel={`Step ${current + 1} of ${count}`}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.step, i <= current && { backgroundColor: colors.acid }]} />
      ))}
    </View>
  );
}

export function Loading() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={colors.acid} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.black },
  scroll: { paddingHorizontal: gutter, paddingTop: space.lg, paddingBottom: 48, flexGrow: 1 },
  column: { width: '100%', maxWidth: 520, alignSelf: 'center', gap: space.lg },
  footer: { paddingHorizontal: gutter, paddingBottom: space.xxl, paddingTop: space.md, gap: space.md },

  eyebrow: { fontFamily: fonts.bodyHeavy, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase' },
  title: { fontFamily: fonts.display, fontSize: 32, lineHeight: 36, letterSpacing: -0.6, color: colors.bone },
  heading: { fontFamily: fonts.display, fontSize: 20, lineHeight: 26, letterSpacing: -0.3, color: colors.bone },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  small: { fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.bone2 },

  btn: { minHeight: 54, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  btnPrimary: { backgroundColor: colors.acid },
  btnSecondary: { backgroundColor: colors.graphite, borderWidth: 1, borderColor: colors.line2 },
  btnGhost: { backgroundColor: 'transparent' },
  btnText: { fontFamily: fonts.bodyHeavy, fontSize: 15, letterSpacing: 0.2 },

  input: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.carbon,
    borderWidth: 1,
    borderColor: colors.line2,
    paddingHorizontal: space.lg,
    color: colors.bone,
    fontFamily: fonts.body,
    fontSize: 16,
  },

  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.md,
    backgroundColor: colors.carbon,
    borderWidth: 1,
    borderColor: colors.line,
  },
  choiceOn: { borderColor: colors.acid, backgroundColor: 'rgba(214,255,63,0.06)' },
  choiceLabel: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.bone },
  choiceHint: { fontFamily: fonts.body, fontSize: 13, color: colors.steel },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.line2 },
  radioOn: { borderColor: colors.acid, backgroundColor: colors.acid },

  pill: {
    minWidth: 44,
    height: 44,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.carbon,
    borderWidth: 1,
    borderColor: colors.line2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillOn: { backgroundColor: colors.acid, borderColor: colors.acid },
  pillText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.bone },

  card: { backgroundColor: colors.carbon, borderRadius: radius.lg, padding: space.xl, borderWidth: 1, borderColor: colors.line },
  diamond: { width: 6, height: 6, backgroundColor: colors.acid, transform: [{ rotate: '45deg' }], marginTop: 8 },
  step: { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.line2 },
});
