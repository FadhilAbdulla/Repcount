"use client";

/* Member pages built from the shared session and calendar components: Sessions (with the month calendar), the
 * "next session" card on Home, and the Growth page (locked until the mobile app syncs wearables). */
import {useEffect, useState} from "react";
import {formatIstDate, formatIstTime} from "@/lib/dates";
import {googleCalendarLink, type Session} from "@/lib/sessions";
import type {LogEntry} from "@/lib/calendarLog";
import {Icon} from "../Media";
import MonthCalendar from "../sessions/MonthCalendar";
import SessionList, {JoinButton} from "../sessions/SessionList";
import {calendarLegend} from "../client/ClientTabs";

const nextOf = (sessions: Session[], now: number) =>
  sessions.filter(s => s.status === "scheduled" && Date.parse(s.endsAt) >= now).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0] ?? null;

function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t); }, []);
  return now;
}

/** Home: the next booked session, with one-click Join when it's time. */
export function NextSessionCard({sessions, coachName, onOpen}: {sessions: Session[]; coachName: string; onOpen: () => void}) {
  const now = useNow();
  const next = nextOf(sessions, now);
  return <section className="card rc-next-session" aria-labelledby="rc-next-session">
    <span className="tile-icon peach"><Icon name="video" size={22}/></span>
    <div>
      <span className="eyebrow">NEXT SESSION</span>
      <h2 id="rc-next-session">{next ? next.title : "Nothing booked yet"}</h2>
      <p>{next ? `${formatIstDate(next.startsAt, {weekday: "long", day: "numeric", month: "long"})} · ${formatIstTime(next.startsAt)} IST · with ${coachName}` : `${coachName} will book your sessions here, with a calendar invite by email.`}</p>
    </div>
    <div className="rc-next-actions">
      {next && <JoinButton session={next} now={now} big/>}
      {next && <a className="button outline" href={googleCalendarLink(next, `with ${coachName}`)} target="_blank" rel="noopener noreferrer">Add to calendar</a>}
      <button type="button" className="text-button" onClick={onOpen}>All sessions <Icon name="arrow" size={16}/></button>
    </div>
  </section>;
}

/** Sessions page: what's booked, past sessions, and this month on a calendar (sessions, workouts, meals). */
export function MemberSessions({sessions, coachName, firstName, month, today, entries}: {
  sessions: Session[]; coachName: string; firstName: string; month: string; today: string; entries: LogEntry[];
}) {
  return <>
    <SessionList sessions={sessions} viewer="member" withWho={`with ${coachName}`} firstName={firstName}
      emptyUpcoming={`${coachName} hasn’t booked a session yet. You’ll get an email with a calendar invite when they do.`}/>
    <MonthCalendar month={month} today={today} entries={entries} legend={calendarLegend} emptyNote="Nothing planned this month yet."/>
    <p className="small-note">Sessions are video calls with {coachName}. The Join button opens 15 minutes before the start.</p>
  </>;
}

/** Growth: steps, sleep and heart rate from a phone or fitness band. Locked until the member connects the mobile app. */
export function GrowthLocked() {
  return <section className="card rc-growth-locked">
    <span className="tile-icon purple"><Icon name="lock" size={22}/></span>
    <span className="eyebrow">COMING SOON</span>
    <h2>Your growth, from your phone and band.</h2>
    <p>When the RepCount app is on your phone, this page fills with your daily steps, sleep, resting heart rate and workouts from Health Connect, Apple Health and fitness bands like Mi, Fitbit, Garmin and Apple Watch. Your trainer sees the same numbers to adjust your plan.</p>
    <ul className="rc-growth-list">
      <li><Icon name="move" size={18}/> Steps and active energy, every day</li>
      <li><Icon name="heart" size={18}/> Resting heart rate trend</li>
      <li><Icon name="clock" size={18}/> Sleep each night</li>
    </ul>
    <p className="small-note">We’ll let you know by email as soon as the app is ready to download.</p>
  </section>;
}
