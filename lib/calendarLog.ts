import "server-only";
import {db} from "./db";
import {addDays, formatIstTime, istParts, istToday, monthGrid} from "./dates";
import {listSessions} from "./sessionStore";
import {sanitizeMemberState} from "./memberState";
import {sessionTone} from "./sessions";

/** One thing on a client's calendar. Mirrors app/sessions/MonthCalendar's entries, without the page-only fields. */
export type LogEntry = {id: string; day: string; label: string; tone: string; time?: string; sessionId?: number};

/**
 * Everything that happened (or is planned) for a client in a month, for the staff Calendar tab and the member's calendar:
 * sessions, planned workouts (done or not), meals the member logged, and when the nutrition plan was set.
 */
export async function clientMonth(clientId: string, month: string): Promise<{entries: LogEntry[]; today: string}> {
  const sql = await db();
  const {days} = monthGrid(month);
  const from = days[0], to = days[days.length - 1];
  const {day: today} = istToday();
  const [client] = await sql<{user_id: string | null}[]>`select user_id from clients where id = ${clientId}`;
  const [sessions, plans, confirmed, states, nutrition] = await Promise.all([
    listSessions({clientId, from: `${from}T00:00:00+05:30`, to: `${addDays(to, 1)}T00:00:00+05:30`}),
    sql<{week_start: string; day: number; title: string}[]>`select week_start::text as week_start, day, title from workout_plans
      where client_id = ${clientId} and week_start between ${addDays(from, -6)} and ${to}`,
    sql<{day: string}[]>`select day::text as day from session_confirmations where client_id = ${clientId} and day between ${from} and ${to}`,
    client?.user_id ? sql<{week_start: string; data: unknown}[]>`
      select period_start::text as week_start, data from member_history where user_id = ${client.user_id} and period = 'week' and period_start between ${addDays(from, -6)} and ${to}
      union all select (data->>'weekStart') as week_start, data from member_state where user_id = ${client.user_id}` : [],
    sql<{updated_at: Date}[]>`select updated_at from nutrition_plans where client_id = ${clientId}`,
  ]);

  // Per week: which weekdays the member marked done and how many meals they logged each day (0 = Monday).
  const weeks = new Map<string, {done: Set<number>; meals: Map<number, number>}>();
  for (const row of states) {
    if (!row.week_start) continue;
    const s = sanitizeMemberState(row.data, row.week_start, row.week_start);
    const meals = new Map<number, number>();
    for (const key of s.nutrition.logged) { const d = Number(key.split("-")[0]); if (d >= 0 && d < 7) meals.set(d, (meals.get(d) ?? 0) + 1); }
    weeks.set(row.week_start, {done: new Set(s.workout.completedDays), meals});
  }
  const confirmedDays = new Set(confirmed.map(c => c.day));
  const inRange = (d: string) => d >= from && d <= to;
  const entries: LogEntry[] = [];

  for (const s of sessions) {
    const {date} = istParts(s.startsAt);
    entries.push({id: `s${s.id}`, sessionId: s.id, day: date, time: formatIstTime(s.startsAt), label: s.title, tone: sessionTone(s)});
  }
  for (const p of plans) {
    const day = addDays(p.week_start, p.day);
    if (!inRange(day)) continue;
    const done = weeks.get(p.week_start)?.done.has(p.day) || confirmedDays.has(day);
    entries.push({id: `w${day}`, day, label: `${done ? "✓ " : ""}${p.title}`, tone: done ? "done" : day < today ? "missed" : "workout"});
  }
  for (const [weekStart, w] of weeks) for (const [d, count] of w.meals) {
    const day = addDays(weekStart, d);
    if (inRange(day)) entries.push({id: `m${day}`, day, label: `${count} meal${count === 1 ? "" : "s"} logged`, tone: "meal"});
  }
  if (nutrition[0]) {
    const day = istParts(nutrition[0].updated_at).date;
    if (inRange(day)) entries.push({id: "n", day, label: "Nutrition plan set", tone: "meal"});
  }
  return {entries, today};
}
