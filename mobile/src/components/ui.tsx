import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type TextProps, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Radius, Spacing, useTheme } from '@/constants/theme';

/** Small set of building blocks so every screen looks the same. */

export function Screen({ children, refreshing, onRefresh }: { children: ReactNode; refreshing?: boolean; onRefresh?: () => void }) {
  const t = useTheme();
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.background }}>
      <ScrollView
        contentContainerStyle={styles.screen}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={t.brand} /> : undefined}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Title({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ gap: Spacing.xs, marginBottom: Spacing.sm }}>
      <Text accessibilityRole="header" style={[styles.title, { color: t.text }]}>{children}</Text>
      {sub ? <Text style={{ color: t.muted, fontSize: 15 }}>{sub}</Text> : null}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return <View style={[styles.card, { backgroundColor: t.card, borderColor: t.line }, style]}>{children}</View>;
}

export function Label({ children, style, ...rest }: TextProps & { children: ReactNode }) {
  const t = useTheme();
  return <Text style={[styles.label, { color: t.muted }, style]} {...rest}>{children}</Text>;
}

export function Body({ children, style, muted, ...rest }: TextProps & { children: ReactNode; muted?: boolean }) {
  const t = useTheme();
  return <Text style={[{ color: muted ? t.muted : t.text, fontSize: 16, lineHeight: 22 }, style]} {...rest}>{children}</Text>;
}

export function Button({ title, onPress, kind = 'primary', disabled, busy }: {
  title: string; onPress: () => void; kind?: 'primary' | 'secondary'; disabled?: boolean; busy?: boolean;
}) {
  const t = useTheme();
  const primary = kind === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [styles.button, {
        backgroundColor: primary ? t.brand : 'transparent',
        borderColor: primary ? t.brand : t.line,
        opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
      }]}>
      {busy ? <ActivityIndicator color={primary ? t.onBrand : t.brand} /> :
        <Text style={{ color: primary ? t.onBrand : t.text, fontWeight: '600', fontSize: 16 }}>{title}</Text>}
    </Pressable>
  );
}

/** A row of choices where one is selected (mood, workout feedback). */
export function Choice<T extends string>({ options, value, onChange, label }: { options: readonly T[]; value: T | null; onChange: (v: T) => void; label: string }) {
  const t = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.choices}>
      {options.map(o => {
        const on = o === value;
        return (
          <Pressable key={o} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => onChange(o)}
            style={[styles.chip, { borderColor: on ? t.brand : t.line, backgroundColor: on ? t.brand : 'transparent' }]}>
            <Text style={{ color: on ? t.onBrand : t.text, fontWeight: '500' }}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  const t = useTheme();
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}${unit ? ` ${unit}` : ''}`}>
      <Text style={{ color: t.text, fontSize: 24, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
        {value}{unit ? <Text style={{ fontSize: 14, fontWeight: '500', color: t.muted }}> {unit}</Text> : null}
      </Text>
      <Text style={{ color: t.muted, fontSize: 13 }}>{label}</Text>
    </View>
  );
}

export function Loading() {
  const t = useTheme();
  return <View style={[styles.center, { backgroundColor: t.background }]}><ActivityIndicator color={t.brand} size="large" /></View>;
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const t = useTheme();
  return (
    <Card style={{ borderColor: t.brand }}>
      <Body accessibilityRole="alert">{message}</Body>
      {onRetry ? <Button kind="secondary" title="Try again" onPress={onRetry} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl * 2 },
  title: { fontSize: 30, fontWeight: '700', letterSpacing: -0.5 },
  card: { borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.md, gap: Spacing.sm },
  label: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },
  button: { minHeight: 48, borderRadius: Radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.md },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { minHeight: 40, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stat: { flexBasis: '45%', flexGrow: 1, gap: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
