import {
  CategoryValueSleepAnalysis,
  isHealthDataAvailableAsync,
  queryCategorySamples,
  queryStatisticsCollectionForQuantity,
  queryWorkoutSamples,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';
import { Linking } from 'react-native';
import { blankDays, dayKey, minutesBetween, sleepByWakeDay, startOfDay, type HealthSource } from './common';
import type { HealthDay } from '../types';

/** Apple Health (HealthKit). Apple Watch, and band apps such as Fitbit, Garmin Connect and Zepp, write into it. */
const READ = [
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKQuantityTypeIdentifierBodyMass',
  'HKCategoryTypeIdentifierSleepAnalysis',
  'HKWorkoutTypeIdentifier',
] as const;

const asleep = new Set<number>([
  CategoryValueSleepAnalysis.asleepUnspecified, CategoryValueSleepAnalysis.asleepCore,
  CategoryValueSleepAnalysis.asleepDeep, CategoryValueSleepAnalysis.asleepREM,
]);

export const health: HealthSource = {
  platform: 'ios',
  name: 'Apple Health',

  async availability() {
    return (await isHealthDataAvailableAsync().catch(() => false)) ? 'available' : 'unavailable';
  },

  async requestAccess() {
    // iOS never says which types were allowed (that is private to the member), only that the sheet was handled.
    return requestAuthorization({ toRead: READ });
  },

  async readDays(count) {
    const days = blankDays(count);
    const from = startOfDay(count - 1);
    const now = new Date();
    const date = { startDate: from, endDate: now };
    const sources = new Set<string>();
    const safe = async <T,>(read: () => Promise<T>) => { try { return await read(); } catch { return null; } };

    const daily = (id: (typeof READ)[number] & `HKQuantity${string}`, stat: 'cumulativeSum' | 'discreteAverage', unit: string) =>
      safe(() => queryStatisticsCollectionForQuantity(id, [stat], from, { day: 1 }, { filter: { date }, unit } as never));

    const [steps, kcal, resting, weight, sleep, workouts] = await Promise.all([
      daily('HKQuantityTypeIdentifierStepCount', 'cumulativeSum', 'count'),
      daily('HKQuantityTypeIdentifierActiveEnergyBurned', 'cumulativeSum', 'kcal'),
      daily('HKQuantityTypeIdentifierRestingHeartRate', 'discreteAverage', 'count/min'),
      daily('HKQuantityTypeIdentifierBodyMass', 'discreteAverage', 'kg'),
      safe(() => queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', { filter: { date: { startDate: new Date(from.getTime() - 12 * 3600_000), endDate: now } }, limit: 0 })),
      safe(() => queryWorkoutSamples({ filter: { date }, limit: 0 })),
    ]);

    const fill = (rows: typeof steps, pick: 'sumQuantity' | 'averageQuantity', set: (day: HealthDay, value: number) => void) => {
      for (const r of rows ?? []) {
        const value = r[pick]?.quantity;
        const day = r.startDate ? days.get(dayKey(new Date(r.startDate))) : undefined;
        if (!day || value === undefined) continue;
        r.sources.forEach(s => sources.add(s.name));
        set(day, value);
      }
    };
    fill(steps, 'sumQuantity', (d, v) => { d.steps = Math.round(v); });
    fill(kcal, 'sumQuantity', (d, v) => { d.activeKcal = Math.round(v); });
    fill(resting, 'averageQuantity', (d, v) => { d.restingHr = Math.round(v); });
    fill(weight, 'averageQuantity', (d, v) => { d.weightKg = Math.round(v * 10) / 10; });

    for (const w of workouts ?? []) {
      const day = days.get(dayKey(new Date(w.startDate)));
      if (!day) continue;
      day.workouts = (day.workouts ?? 0) + 1;
      day.workoutMin = Math.round((day.workoutMin ?? 0) + minutesBetween(new Date(w.startDate), new Date(w.endDate)));
    }
    const nights = sleepByWakeDay((sleep ?? []).filter(s => asleep.has(s.value as number)).map(s => {
      const origin = s.sourceRevision?.source?.name ?? 'unknown';
      if (origin !== 'unknown') sources.add(origin);
      return { end: new Date(s.endDate), minutes: minutesBetween(new Date(s.startDate), new Date(s.endDate)), origin };
    }));
    for (const [key, minutes] of nights) { const day = days.get(key); if (day) day.sleepMin = minutes; }

    sources.delete('RepCount');
    return { days: [...days.values()], sources: [...sources] };
  },

  openSettings() {
    // iOS has no deep link into the Health app's per-app permissions; the Settings app lists them under Health.
    Linking.openSettings();
  },
};
