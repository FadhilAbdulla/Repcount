import {
  aggregateGroupByDuration,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
  type Permission,
} from 'react-native-health-connect';
import { blankDays, dayKey, minutesBetween, sleepByWakeDay, startOfDay, type HealthSource } from './common';

/** Health Connect: Android's health store. Mi Fitness, Samsung Health, Fitbit, Garmin Connect, Zepp and others write into it. */
const READ: Permission[] = (['Steps', 'ActiveCaloriesBurned', 'RestingHeartRate', 'SleepSession', 'ExerciseSession', 'Weight'] as const)
  .map(recordType => ({ accessType: 'read', recordType }));

let ready: Promise<boolean> | null = null;
const ensureInitialized = () => (ready ??= initialize().catch(() => { ready = null; return false; }));

/** Friendly names for the apps members usually have; anything else shows its package name. */
const knownApps: Record<string, string> = {
  'com.google.android.apps.fitness': 'Google Fit',
  'com.sec.android.app.shealth': 'Samsung Health',
  'com.mi.health': 'Mi Fitness',
  'com.xiaomi.wearable': 'Mi Fitness',
  'com.huami.watch.hmwatchmanager': 'Zepp',
  'com.fitbit.FitbitMobile': 'Fitbit',
  'com.garmin.android.apps.connectmobile': 'Garmin Connect',
  'com.google.android.apps.healthdata': 'Health Connect',
};

export const health: HealthSource = {
  platform: 'android',
  name: 'Health Connect',

  async availability() {
    const status = await getSdkStatus().catch(() => SdkAvailabilityStatus.SDK_UNAVAILABLE);
    if (status === SdkAvailabilityStatus.SDK_AVAILABLE) return 'available';
    return status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED ? 'needs-update' : 'unavailable';
  },

  async requestAccess() {
    if (!(await ensureInitialized())) return false;
    const granted = await requestPermission(READ);
    return granted.length > 0;
  },

  async readDays(count) {
    if (!(await ensureInitialized())) return { days: [], sources: [] };
    const days = blankDays(count);
    const from = startOfDay(count - 1);
    const range = { operator: 'between' as const, startTime: from.toISOString(), endTime: new Date().toISOString() };
    const slicer = { duration: 'DAYS' as const, length: 1 };
    const origins = new Set<string>();
    // A permission the member declined makes that one read fail; the others still sync.
    const safe = async <T,>(read: () => Promise<T>) => { try { return await read(); } catch { return null; } };

    const [steps, kcal, resting, weight, exercise, sleep, sessions] = await Promise.all([
      safe(() => aggregateGroupByDuration({ recordType: 'Steps', timeRangeFilter: range, timeRangeSlicer: slicer })),
      safe(() => aggregateGroupByDuration({ recordType: 'ActiveCaloriesBurned', timeRangeFilter: range, timeRangeSlicer: slicer })),
      safe(() => aggregateGroupByDuration({ recordType: 'RestingHeartRate', timeRangeFilter: range, timeRangeSlicer: slicer })),
      safe(() => aggregateGroupByDuration({ recordType: 'Weight', timeRangeFilter: range, timeRangeSlicer: slicer })),
      safe(() => aggregateGroupByDuration({ recordType: 'ExerciseSession', timeRangeFilter: range, timeRangeSlicer: slicer })),
      // Sleep that ended in the window, starting from the evening before the first day.
      safe(() => readRecords('SleepSession', { timeRangeFilter: { operator: 'between', startTime: new Date(from.getTime() - 12 * 3600_000).toISOString(), endTime: range.endTime } })),
      safe(() => readRecords('ExerciseSession', { timeRangeFilter: range })),
    ]);

    const fill = <T extends { startTime: string; result: { dataOrigins: string[] } }>(groups: T[] | null, set: (day: NonNullable<ReturnType<typeof days.get>>, g: T) => void) => {
      for (const g of groups ?? []) {
        const day = days.get(dayKey(new Date(g.startTime)));
        if (!day || !g.result.dataOrigins.length) continue; // no data that day (a 0 here would mean "recorded nothing")
        g.result.dataOrigins.forEach(o => origins.add(o));
        set(day, g);
      }
    };
    fill(steps, (d, g) => { d.steps = Math.round(g.result.COUNT_TOTAL); });
    fill(kcal, (d, g) => { d.activeKcal = Math.round(g.result.ACTIVE_CALORIES_TOTAL.inKilocalories); });
    fill(resting, (d, g) => { d.restingHr = Math.round(g.result.BPM_AVG); });
    fill(weight, (d, g) => { d.weightKg = Math.round(g.result.WEIGHT_AVG.inKilograms * 10) / 10; });
    fill(exercise, (d, g) => { d.workoutMin = Math.round(g.result.EXERCISE_DURATION_TOTAL.inSeconds / 60); });

    for (const s of sessions?.records ?? []) {
      const day = days.get(dayKey(new Date(s.startTime)));
      if (day) day.workouts = (day.workouts ?? 0) + 1;
    }
    const nights = sleepByWakeDay((sleep?.records ?? []).map(r => {
      const origin = r.metadata?.dataOrigin ?? 'unknown';
      origins.add(origin);
      return { end: new Date(r.endTime), minutes: minutesBetween(new Date(r.startTime), new Date(r.endTime)), origin };
    }));
    for (const [key, minutes] of nights) { const day = days.get(key); if (day) day.sleepMin = minutes; }

    const sources = [...new Set([...origins].filter(o => o !== 'unknown' && o !== 'com.tryrepcount.app').map(o => knownApps[o] ?? o))];
    return { days: [...days.values()], sources };
  },

  openSettings() {
    openHealthConnectSettings();
  },
};
