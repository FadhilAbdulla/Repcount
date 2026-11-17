import * as WebBrowser from 'expo-web-browser';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Body, Button, Card, Choice, ErrorNote, Label, Loading, Screen, Title } from '@/components/ui';
import { Spacing, useTheme } from '@/constants/theme';
import { useDashboard, weekdayIndex } from '@/lib/dashboard';
import { feedbacks } from '@/lib/types';

const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
/** The website tracks ticks for the first five exercises of the day. */
const TRACKED = 5;

export default function Workout() {
  const t = useTheme();
  const { data, error, loading, reload, update } = useDashboard();
  if (loading && !data) return <Loading />;
  if (!data) return <Screen><ErrorNote message={error ?? 'Couldn’t load your plan.'} onRetry={reload} /></Screen>;

  const todayIndex = weekdayIndex(data.today);
  const plan = data.schedule;
  const planned = plan?.[todayIndex] ?? null;
  const { workout } = data.state;
  const finished = workout.completedDays.includes(todayIndex);

  const toggle = (i: number) => update(s => {
    const done = s.workout.done.includes(i) ? s.workout.done.filter(x => x !== i) : [...s.workout.done, i];
    return { ...s, workout: { ...s.workout, done } };
  });
  const finish = (value: boolean) => update(s => ({
    ...s,
    tracker: { ...s.tracker, trained: value || s.tracker.trained },
    workout: {
      ...s.workout,
      finished: value,
      completedDays: value ? [...new Set([...s.workout.completedDays, todayIndex])] : s.workout.completedDays.filter(d => d !== todayIndex),
    },
  }));

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <Title sub="This week’s plan from your trainer">Workout</Title>

      <View style={styles.week} accessibilityLabel="This week">
        {dayNames.map((name, i) => {
          const has = !!plan?.[i];
          const done = workout.completedDays.includes(i);
          const isToday = i === todayIndex;
          return (
            <View key={name} accessible accessibilityLabel={`${name}: ${done ? 'done' : has ? 'workout' : 'rest'}${isToday ? ', today' : ''}`}
              style={[styles.day, { borderColor: isToday ? t.brand : t.line, backgroundColor: done ? t.success : t.card }]}>
              <Text style={{ color: done ? '#fff' : t.muted, fontSize: 12 }}>{name}</Text>
              <Text style={{ color: done ? '#fff' : t.text, fontWeight: '700' }}>{done ? '✓' : has ? '●' : '–'}</Text>
            </View>
          );
        })}
      </View>

      {!plan ? <Card><Body>Your trainer hasn’t planned this week yet. You’ll get an email when it’s ready.</Body></Card> : null}

      {planned ? (
        <Card>
          <Label>Today</Label>
          <Body style={{ fontWeight: '700', fontSize: 20 }}>{planned.title}</Body>
          {planned.time || planned.durationMin ? <Body muted>{[planned.time, planned.durationMin ? `${planned.durationMin} min` : null].filter(Boolean).join(' · ')}</Body> : null}
          <View style={{ gap: Spacing.xs, marginTop: Spacing.sm }}>
            {planned.exercises.map((exercise, i) => {
              const tracked = i < TRACKED;
              const on = workout.done.includes(i);
              return (
                <Pressable key={`${i}-${exercise}`} disabled={!tracked} onPress={() => toggle(i)}
                  accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled: !tracked }}
                  style={[styles.exercise, { borderColor: t.line }]}>
                  <View style={[styles.box, { borderColor: on ? t.success : t.line, backgroundColor: on ? t.success : 'transparent' }]}>
                    {on ? <Text style={{ color: '#fff', fontWeight: '800' }}>✓</Text> : null}
                  </View>
                  <Text style={{ color: t.text, fontSize: 16, flex: 1 }}>{exercise}</Text>
                </Pressable>
              );
            })}
          </View>
          {planned.meetingUrl ? <Button kind="secondary" title="Join the live session" onPress={() => WebBrowser.openBrowserAsync(planned.meetingUrl!)} /> : null}
          <Button title={finished ? 'Marked as done — undo' : 'Mark workout done'} kind={finished ? 'secondary' : 'primary'} onPress={() => finish(!finished)} />
          {finished ? (
            <>
              <Body style={{ marginTop: Spacing.sm }}>How did it feel?</Body>
              <Choice label="Workout feedback" options={feedbacks} value={(workout.feedback || null) as (typeof feedbacks)[number] | null}
                onChange={feedback => update(s => ({ ...s, workout: { ...s.workout, feedback } }))} />
            </>
          ) : null}
        </Card>
      ) : plan ? <Card><Body>Rest day today. Recovery is part of the plan.</Body></Card> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  week: { flexDirection: 'row', gap: 6 },
  day: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 12, borderWidth: 1, gap: 2 },
  exercise: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: 48, borderBottomWidth: StyleSheet.hairlineWidth },
  box: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
