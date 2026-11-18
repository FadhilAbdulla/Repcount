/* Dates and times in India Standard Time (the pilot runs on IST). Safe to import from server and client code. */

/** Today and the Monday of this week in India time, as YYYY-MM-DD. */
export function istToday() {
  const now = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const monday = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7)));
  return {day: iso(today), weekStart: iso(monday)};
}

const IST_OFFSET_MS = 5.5 * 3600_000;

/** An instant as its India date and time: {date: "2026-11-23", time: "18:30"}. */
export function istParts(instant: string | Date) {
  const shifted = new Date(new Date(instant).getTime() + IST_OFFSET_MS).toISOString();
  return {date: shifted.slice(0, 10), time: shifted.slice(11, 16)};
}

/** An India date and time ("2026-11-23", "18:30") as an ISO instant. */
export const istInstant = (date: string, time: string) => new Date(`${date}T${time}:00+05:30`).toISOString();

/** "6:30 PM" for an instant, in India time. */
export const formatIstTime = (instant: string | Date) =>
  new Date(instant).toLocaleTimeString("en-IN", {timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true}).replace(/\s?([ap])m$/i, (_, p) => ` ${p.toUpperCase()}M`);

/** "Mon 23 Nov" (or with other options) for an instant or a YYYY-MM-DD day, in India time. */
export const formatIstDate = (instant: string | Date, options: Intl.DateTimeFormatOptions = {weekday: "short", day: "numeric", month: "short"}) =>
  new Date(typeof instant === "string" && /^\d{4}-\d{2}-\d{2}$/.test(instant) ? `${instant}T12:00:00+05:30` : instant).toLocaleDateString("en-GB", {timeZone: "Asia/Kolkata", ...options});

/** YYYY-MM-DD plus or minus whole days. */
export const addDays = (day: string, days: number) => new Date(Date.parse(`${day}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);

/** The 6-week grid (Monday first) that shows a month, as YYYY-MM-DD days, and the month's first and last day. */
export function monthGrid(month: string) {
  const first = `${month}-01`;
  const start = addDays(first, -((new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7));
  const next = new Date(`${first}T00:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const last = addDays(next.toISOString().slice(0, 10), -1);
  return {days: Array.from({length: 42}, (_, i) => addDays(start, i)), first, last};
}

/** "2026-11" shifted by whole months. */
export function shiftMonth(month: string, by: number) {
  const d = new Date(`${month}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + by);
  return d.toISOString().slice(0, 7);
}
