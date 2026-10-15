/**
 * The small component kit every screen is built from.
 * Visual language follows the PIVOT prototype: dark carbon cards, bone text,
 * an acid accent for the primary action, gold for anything the coach owns.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  Switch,
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

/** A small labelled input for numbers in dense rows (sets, reps, kg, rest). */
export function MiniField({ label, ...input }: TextInputProps & { label: string }) {
  return (
    <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
      <Text style={styles.miniLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.steel}
        selectionColor={colors.acid}
        {...input}
        style={[styles.miniInput, input.style]}
      />
    </View>
  );
}

/** − value + control. */
export function Stepper({ value, onChange, min, max, suffix }: { value: number; onChange: (v: number) => void; min: number; max: number; suffix?: string }) {
  const btn = (label: string, next: number, disabled: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label === '−' ? 'Decrease' : 'Increase'}
      disabled={disabled}
      onPress={() => onChange(next)}
      style={[styles.stepBtn, disabled && { opacity: 0.3 }]}>
      <Text style={{ color: colors.bone, fontFamily: fonts.bodyBold, fontSize: 20 }}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={styles.stepper}>
      {btn('−', value - 1, value <= min)}
      <Text style={{ flex: 1, textAlign: 'center', color: colors.bone, fontFamily: fonts.display, fontSize: 18 }}>
        {value}
        {suffix ? ` ${suffix}` : ''}
      </Text>
      {btn('+', value + 1, value >= max)}
    </View>
  );
}

/** A row of small pills where several can be on. */
export function PillGroup<T extends string | number>({
  options,
  selected,
  onToggle,
  disabled,
}: {
  options: { value: T; label: string }[];
  selected: T[];
  onToggle: (v: T) => void;
  disabled?: T[];
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
      {options.map((o) => {
        const on = selected.includes(o.value);
        const off = !on && (disabled ?? []).includes(o.value);
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: on, disabled: off }}
            disabled={off}
            onPress={() => onToggle(o.value)}
            style={[styles.pill, { minWidth: 0, height: 38 }, on && styles.pillOn, off && { opacity: 0.3 }]}>
            <Text style={[styles.pillText, { fontSize: 14 }, on && { color: colors.black }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Screen title with a back arrow, for screens opened on top of the tabs. */
export function BackHeader({ title, eyebrow, onBack }: { title: string; eyebrow?: string; onBack?: () => void }) {
  return (
    <View style={{ gap: space.sm }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={12}
        onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
        style={{ alignSelf: 'flex-start', paddingVertical: space.xs }}>
        <Ionicons name="chevron-back" size={24} color={colors.bone} />
      </Pressable>
      {eyebrow ? <Eyebrow tone="acid">{eyebrow}</Eyebrow> : null}
      <Title>{title}</Title>
    </View>
  );
}

/** A tappable list row with an optional value and chevron. */
export function Row({
  title,
  detail,
  right,
  onPress,
  tone = 'bone',
}: {
  title: string;
  detail?: string;
  right?: ReactNode;
  onPress?: () => void;
  tone?: 'bone' | 'red' | 'gold';
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && onPress && { opacity: 0.7 }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.rowTitle, { color: colors[tone] }]}>{title}</Text>
        {detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}
      </View>
      {right}
      {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.steel} /> : null}
    </Pressable>
  );
}

/** A labelled on/off switch. */
export function ToggleRow({
  title,
  detail,
  value,
  onChange,
  disabled,
}: {
  title: string;
  detail?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}
      </View>
      <Switch
        accessibilityLabel={title}
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: colors.graphite, true: colors.acid }}
        thumbColor={value ? colors.black : colors.steel}
        ios_backgroundColor={colors.graphite}
        {...(Platform.OS === 'web' ? ({ activeThumbColor: colors.black } as object) : {})}
      />
    </View>
  );
}

/** A group of rows in one card. */
export function List({ children }: { children: ReactNode }) {
  return <View style={styles.list}>{children}</View>;
}

export function Badge({ label, tone = 'steel' }: { label: string; tone?: 'steel' | 'acid' | 'gold' | 'red' }) {
  return (
    <View style={[styles.badge, { borderColor: colors[tone] }]}>
      <Text style={[styles.badgeText, { color: colors[tone] }]}>{label}</Text>
    </View>
  );
}

/** Yes/no confirmation that works on phones and on the web. */
export function confirm(title: string, message: string, action: string, onYes: () => void) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${title}\n\n${message}`)) onYes();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: action, style: 'destructive', onPress: onYes },
  ]);
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

  list: { backgroundColor: colors.carbon, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.lg,
    paddingHorizontal: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    minHeight: 60,
  },
  rowTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.bone },
  rowDetail: { fontFamily: fonts.body, fontSize: 13, color: colors.steel, lineHeight: 18 },
  miniLabel: { fontFamily: fonts.bodyHeavy, fontSize: 10, letterSpacing: 1, color: colors.steel, textTransform: 'uppercase' },
  miniInput: {
    height: 42,
    borderRadius: radius.sm,
    backgroundColor: colors.graphite,
    borderWidth: 1,
    borderColor: colors.line2,
    paddingHorizontal: space.sm,
    color: colors.bone,
    fontFamily: fonts.displayMedium,
    fontSize: 16,
    textAlign: 'center',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.carbon,
    borderWidth: 1,
    borderColor: colors.line2,
  },
  stepBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  badge: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontFamily: fonts.bodyHeavy, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' },
});
