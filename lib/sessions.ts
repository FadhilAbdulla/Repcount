/* Sessions between a member and their trainer. Types, labels and validation, shared by the server and the pages. */
import {istInstant} from "./dates";
import {cleanMeetingUrl} from "./schedule";

export const sessionKinds = ["intro", "weekly", "workout"] as const;
export type SessionKind = (typeof sessionKinds)[number];
export const sessionKindLabels: Record<SessionKind, string> = {intro: "Introduction call", weekly: "Weekly check-in", workout: "Workout session"};

export const sessionStatuses = ["scheduled", "done", "missed", "cancelled"] as const;
export type SessionStatus = (typeof sessionStatuses)[number];
export const sessionStatusLabels: Record<SessionStatus, string> = {scheduled: "Scheduled", done: "Completed", missed: "Missed", cancelled: "Cancelled"};

export type Session = {
  id: number; clientId: string; clientName: string; kind: SessionKind; title: string;
  /** ISO instants. */
  startsAt: string; endsAt: string;
  meetingUrl: string | null; status: SessionStatus; notes: string | null;
};

/** What a trainer fills in: a title, the day and start time (India time) and the meeting link. */
export type SessionInput = {title: string; date: string; start: string; meetingUrl: string};
export type CleanSession = {kind: SessionKind; title: string; startsAt: string; endsAt: string; meetingUrl: string | null; notes: string | null};

/** Sessions have no end time to fill in; calendar invites block out this long. */
export const SESSION_MINUTES = 30;

const isoDay = /^\d{4}-\d{2}-\d{2}$/;
const clock = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Checks a session form. Returns the clean session or a message to show. */
export function validateSession(input: Partial<SessionInput>): CleanSession | {error: string} {
  const title = String(input.title ?? "").trim();
  if (!title) return {error: "Give the session a title, e.g. Weekly check-in."};
  if (title.length > 80) return {error: "Keep the title under 80 characters."};
  const date = String(input.date ?? ""), start = String(input.start ?? "");
  if (!isoDay.test(date)) return {error: "Choose the date."};
  if (!clock.test(start)) return {error: "Choose the start time."};
  const meetingUrl = cleanMeetingUrl(String(input.meetingUrl ?? ""));
  if (meetingUrl === "invalid") return {error: "The meeting link must be a full https:// link, e.g. https://meet.google.com/abc-defg-hij."};
  const startsAt = istInstant(date, start);
  return {kind: "weekly", title, startsAt, endsAt: new Date(Date.parse(startsAt) + SESSION_MINUTES * 60_000).toISOString(), meetingUrl, notes: null};
}

/** A session can be joined from 15 minutes before it starts until it ends. */
export const joinable = (s: Pick<Session, "startsAt" | "endsAt" | "status" | "meetingUrl">, now = Date.now()) =>
  s.status === "scheduled" && !!s.meetingUrl && now >= Date.parse(s.startsAt) - 15 * 60_000 && now <= Date.parse(s.endsAt);

const stamp = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
/** A Google Calendar "add event" link for a session (a one-click alternative to the emailed invite). */
export function googleCalendarLink(s: Pick<Session, "title" | "startsAt" | "endsAt" | "meetingUrl">, withWho: string) {
  const params = new URLSearchParams({action: "TEMPLATE", text: `${s.title} · RepCount`, dates: `${stamp(s.startsAt)}/${stamp(s.endsAt)}`,
    details: `${s.title} ${withWho}.${s.meetingUrl ? `\n\nJoin: ${s.meetingUrl}` : ""}`, ...(s.meetingUrl ? {location: s.meetingUrl} : {})});
  return `https://calendar.google.com/calendar/render?${params}`;
}

/** Calendar colour group for a session (see calendar.css). */
export const sessionTone = (s: Pick<Session, "status">) => s.status === "scheduled" ? "session" : s.status;
