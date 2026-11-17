import * as WebBrowser from 'expo-web-browser';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Body, Button, Card, Choice, ErrorNote, Label, Loading, Screen, Stat, Title } from '@/components/ui';
import { Spacing, useTheme } from '@/constants/theme';
import { API_URL } from '@/lib/api';
import { useDashboard, weekdayIndex } from '@/lib/dashboard';
import { health } from '@/lib/health';
import { moods } from '@/lib/types';

const fmt = (n: number | null | undefined) => (n === null || n === undefined ? '—' : n.toLocaleString('en-IN'));
const hours = (min: number | null | undefined) => (min ? `${Math.floor(min / 60)}h ${min % 60}m` : '—');

export default function Today() {
  const t = useTheme();
  const { data, error, loading, reload, update, healthStatus, connectHealth, syncHealth } = useDashboard();
  if (loading && !data) return <Loading />;
  if (!data) return <Screen><ErrorNote message={error ?? 'Couldn’t load your plan.'} onRetry={reload} /></Screen>;

  const { state, schedule, today, coach } = data;
  const planned = schedule?.[weekdayIndex(today)] ?? null;
  const done = state.workout.completedDays.includes(weekdayIndex(today));
  const phone = data.health.days.find(d => d.day === today) ?? null;
  const connected = !!data.health.lastSync;
  const water = state.tracker.water;

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <Title sub={coach ? `Coached by ${coach.name}` : 'Your trainer will be assigned soon'}>Hi {data.user.name.split(' ')[0]}</Title>
      {error ? <ErrorNote message={error} /> : null}

      {data.needsOnboarding ? (
        <Card>
          <Label>Finish setting up</Label>
          <Body>Answer three quick questions so your trainer can plan your weeks.</Body>
          <Button title="Open on the website" onPress={() => WebBrowser.openBrowserAsync(`${API_URL}/onboarding`)} />
        </Card>
      ) : null}

      <Card>
        <Label>Today’s workout</Label>
        {planned ? (
          <>
            <Body style={{ fontWeight: '700', fontSize: 18 }}>{planned.title}</Body>
            <Body muted>{[planned.time, planned.durationMin ? `${planned.durationMin} min` : null, `${planned.exercises.length} exercises`].filter(Boolean).join(' · ')}</Body>
            {done ? <Text style={{ color: t.success, fontWeight: '600' }}>Done — nice work.</Text> : null}
          </>
        ) : <Body muted>Rest day. A walk still counts.</Body>}
      </Card>

      <Card>
        <View style={styles.row}>
          <Label>From your phone</Label>
          {connected ? <Text style={{ color: t.muted, fontSize: 13 }}>{healthStatus === 'syncing' ? 'Syncing…' : `Synced ${new Date(data.health.lastSync!).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}</Text> : null}
        </View>
        {connected ? (
          <>
            <View style={styles.stats}>
              <Stat label="Steps" value={fmt(phone?.steps)} />
              <Stat label="Sleep" value={hours(phone?.sleepMin)} />
              <Stat label="Resting heart rate" value={fmt(phone?.restingHr)} unit="bpm" />
              <Stat label="Active energy" value={fmt(phone?.activeKcal)} unit="kcal" />
            </View>
            <Button kind="secondary" title="Sync now" onPress={syncHealth} busy={healthStatus === 'syncing'} />
          </>
        ) : (
          <>
            <Body>Connect {health.name} to bring in steps, sleep, heart rate and workouts from your phone or fitness band. Your trainer sees your daily totals.</Body>
            <Button title={`Connect ${health.name}`} onPress={connectHealth} busy={healthStatus === 'syncing'} />
          </>
        )}
        {healthStatus === 'needs-update' ? <Body muted>Update the Health Connect app from the Play Store, then try again.</Body> : null}
        {healthStatus === 'unavailable' ? <Body muted>Health data isn’t available on this device.</Body> : null}
      </Card>

      <Card>
        <Label>Daily check</Label>
        <View style={styles.row}>
          <Body>Water</Body>
          <View style={styles.stepper}>
            <Round label="One glass less" text="−" onPress={() => update(s => ({ ...s, tracker: { ...s.tracker, water: Math.max(0, water - 1) } }))} />
            <Text accessibilityLiveRegion="polite" style={{ color: t.text, fontSize: 18, fontWeight: '700', minWidth: 70, textAlign: 'center' }}>{water} glasses</Text>
            <Round label="One glass more" text="+" onPress={() => update(s => ({ ...s, tracker: { ...s.tracker, water: Math.min(30, water + 1) } }))} />
          </View>
        </View>
        <Body style={{ marginTop: Spacing.sm }}>How do you feel?</Body>
        <Choice label="Mood" options={moods} value={(state.tracker.mood as (typeof moods)[number]) ?? null}
          onChange={mood => update(s => ({ ...s, tracker: { ...s.tracker, mood } }))} />
        <Body muted>Steps today: {fmt(state.tracker.steps)}{connected ? ' (from your phone)' : ''}</Body>
      </Card>
    </Screen>
  );
}

function Round({ text, label, onPress }: { text: string; label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6}
      style={({ pressed }) => [styles.round, { borderColor: t.line, opacity: pressed ? 0.6 : 1 }]}>
      <Text style={{ color: t.text, fontSize: 22, fontWeight: '600' }}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  stats: { flexDirection: 'row', flexWrap: 'wrap', rowGap: Spacing.md, columnGap: Spacing.md, marginVertical: Spacing.xs },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  round: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
