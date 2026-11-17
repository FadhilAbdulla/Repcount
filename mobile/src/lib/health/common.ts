import type { HealthDay } from '../types';

/*
 * Shared by the Health Connect (Android) and HealthKit (iOS) readers. Both send the server one row per calendar day
 * (phone's local time) using the platform's own de-duplicated totals, so a band and the phone are never double-counted.
 */

export type Availability = 'available' | 'needs-update' | 'unavailable';
export type HealthReading = { days: HealthDay[]; sources: string[] };

export interface HealthSource {
  /** Which platform this phone syncs from, or null where there is none (web). */
  platform: 'android' | 'ios' | null;
  /** Name shown to the member, e.g. "Health Connect". */
  name: string;
  availability(): Promise<Availability>;
  /** Shows the system permission sheet. Resolves true when the sheet was shown and at least something may be read. */
  requestAccess(): Promise<boolean>;
  /** Daily totals for the last `count` days, oldest first. */
  readDays(count: number): Promise<HealthReading>;
  /** Opens the system screen where the member manages what RepCount may read. */
  openSettings(): void;
}

/** How many days each sync reads. The server keeps 30; two weeks covers a phone that was offline for a while. */
export const SYNC_DAYS = 14;

export const pad = (n: number) => String(n).padStart(2, '0');
/** YYYY-MM-DD in the phone's local time. */
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Local midnight `daysAgo` days before today. */
export function startOfDay(daysAgo = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d;
}

export const emptyDay = (day: string): HealthDay => ({
  day, steps: null, activeKcal: null, restingHr: null, sleepMin: null, workouts: null, workoutMin: null, weightKg: null,
});

/** One empty row per day, oldest first, keyed for filling in. */
export function blankDays(count: number) {
  const map = new Map<string, HealthDay>();
  for (let i = count - 1; i >= 0; i--) map.set(dayKey(startOfDay(i)), emptyDay(dayKey(startOfDay(i))));
  return map;
}

/**
 * Sleep is filed under the day the member woke up. When two apps (say the phone and a band) both record a night,
 * the app with the most sleep that day wins instead of adding them together.
 */
export function sleepByWakeDay(sessions: { end: Date; minutes: number; origin: string }[]) {
  const perDay = new Map<string, Map<string, number>>();
  for (const s of sessions) {
    const key = dayKey(s.end);
    const origins = perDay.get(key) ?? new Map<string, number>();
    origins.set(s.origin, (origins.get(s.origin) ?? 0) + s.minutes);
    perDay.set(key, origins);
  }
  return new Map([...perDay].map(([day, origins]) => [day, Math.round(Math.max(...origins.values()))]));
}

export const minutesBetween = (start: Date, end: Date) => Math.max(0, (end.getTime() - start.getTime()) / 60000);
