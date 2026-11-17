import "server-only";
import {db} from "./db";
import {istToday} from "./dates";
import {shiftDay} from "./streak";

/** One day of phone health data. Missing metrics are null (not shared, or nothing recorded). */
export type HealthDay = {
  day: string; steps: number | null; activeKcal: number | null; restingHr: number | null; sleepMin: number | null;
  workouts: number | null; workoutMin: number | null; weightKg: number | null;
};
export type Platform = "android" | "ios";

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isoDay = /^\d{4}-\d{2}-\d{2}$/;
/** A whole number in range, or null. Out-of-range values are dropped rather than clamped: they are almost always bad data. */
const metric = (v: unknown, max: number) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max ? Math.round(v) : null;
const weight = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 20 && v <= 400 ? Math.round(v * 10) / 10 : null;

/** Days the phone may report: the last 30 days up to today (India time), so a wrong phone clock can't write the future. */
export const HEALTH_WINDOW_DAYS = 30;

/** Coerces the phone's upload into at most 31 valid days. */
export function sanitizeHealthDays(input: unknown): HealthDay[] {
  if (!Array.isArray(input)) return [];
  const today = istToday().day;
  const oldest = shiftDay(today, -HEALTH_WINDOW_DAYS);
  const days = new Map<string, HealthDay>();
  for (const raw of input.slice(0, 62)) {
    if (!isObject(raw) || typeof raw.day !== "string" || !isoDay.test(raw.day) || raw.day < oldest || raw.day > today) continue;
    days.set(raw.day, {
      day: raw.day,
      steps: metric(raw.steps, 100_000),
      activeKcal: metric(raw.activeKcal, 10_000),
      restingHr: metric(raw.restingHr, 220),
      sleepMin: metric(raw.sleepMin, 24 * 60),
      workouts: metric(raw.workouts, 20),
      workoutMin: metric(raw.workoutMin, 24 * 60),
      weightKg: weight(raw.weightKg),
    });
  }
  return [...days.values()].slice(0, HEALTH_WINDOW_DAYS + 1);
}

/** Source app names reported by the phone (e.g. "Mi Fitness", "Garmin Connect"), for staff to see where data came from. */
export function sanitizeSources(input: unknown): string[] {
  return Array.isArray(input) ? [...new Set(input.filter((s): s is string => typeof s === "string").map(s => s.trim().slice(0, 60)).filter(Boolean))].slice(0, 10) : [];
}

/** Upserts the phone's daily totals. A later sync of the same day replaces it (the day's totals only grow as data arrives). */
export async function saveHealthDays(userId: string, platform: Platform, days: HealthDay[], sources: string[]) {
  if (!days.length) return 0;
  const sql = await db();
  await sql.begin(async tx => {
    for (const d of days) {
      await tx`insert into health_daily (user_id, day, platform, steps, active_kcal, resting_hr, sleep_min, workouts, workout_min, weight_kg, sources, updated_at)
        values (${userId}, ${d.day}, ${platform}, ${d.steps}, ${d.activeKcal}, ${d.restingHr}, ${d.sleepMin}, ${d.workouts}, ${d.workoutMin}, ${d.weightKg}, ${sources}, now())
        on conflict (user_id, day) do update set platform = excluded.platform, steps = excluded.steps, active_kcal = excluded.active_kcal,
          resting_hr = excluded.resting_hr, sleep_min = excluded.sleep_min, workouts = excluded.workouts, workout_min = excluded.workout_min,
          weight_kg = excluded.weight_kg, sources = excluded.sources, updated_at = excluded.updated_at`;
    }
  });
  return days.length;
}

/** A client's synced phone data for their trainer or the admin; null when the client has no member login. */
export async function healthForClient(clientId: string, since: string): Promise<HealthSummary | null> {
  const sql = await db();
  const [row] = await sql<{user_id: string | null}[]>`select user_id from clients where id = ${clientId}`;
  return row?.user_id ? getHealthDays(row.user_id, since) : null;
}

/** A member's synced days, plus where the latest sync came from (for staff). */
export type HealthSummary = {days: HealthDay[]; lastSync: string | null; platform: Platform | null; sources: string[]};

/** The member's synced days since the given date, oldest first, and when the phone last synced. */
export async function getHealthDays(userId: string, since: string): Promise<HealthSummary> {
  const sql = await db();
  const rows = await sql<{day: string; steps: number | null; active_kcal: number | null; resting_hr: number | null; sleep_min: number | null;
    workouts: number | null; workout_min: number | null; weight_kg: string | null; platform: Platform; sources: string[]; updated_at: Date}[]>`
    select day::text as day, steps, active_kcal, resting_hr, sleep_min, workouts, workout_min, weight_kg, platform, sources, updated_at
    from health_daily where user_id = ${userId} and day >= ${since} order by day`;
  const last = rows.reduce<(typeof rows)[number] | null>((a, r) => !a || r.updated_at > a.updated_at ? r : a, null);
  return {
    days: rows.map(r => ({day: r.day, steps: r.steps, activeKcal: r.active_kcal, restingHr: r.resting_hr, sleepMin: r.sleep_min,
      workouts: r.workouts, workoutMin: r.workout_min, weightKg: r.weight_kg === null ? null : Number(r.weight_kg)})),
    lastSync: last?.updated_at.toISOString() ?? null,
    platform: last?.platform ?? null,
    sources: last?.sources ?? [],
  };
}
