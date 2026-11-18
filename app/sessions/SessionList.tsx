"use client";

/*
 * Upcoming and past sessions, shared by the staff Sessions tab and the member's Sessions page.
 * Staff can edit, mark completed or missed, cancel and delete; members can join (from 15 minutes before) and add to their calendar.
 */
import {useEffect, useState} from "react";
import {formatIstDate, formatIstTime} from "@/lib/dates";
import {googleCalendarLink, joinable, sessionKindLabels, sessionStatusLabels, sessionTone, type Session} from "@/lib/sessions";
import {Icon} from "../Media";
import Modal from "../Modal";
import {deleteSession, setSessionStatus} from "../actions/sessions";
import type {Run} from "../useAction";
import SessionForm from "./SessionForm";
import "./calendar.css";

/** Re-renders every minute so "Join" switches on at the right time. */
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t); }, []);
  return now;
}

export function JoinButton({session, now, big = false}: {session: Session; now: number; big?: boolean}) {
  if (session.status !== "scheduled" || !session.meetingUrl || now > Date.parse(session.endsAt)) return null;
  const open = joinable(session, now);
  return open
    ? <a className={`button dark rc-join${big ? "" : " rc-small"}`} href={session.meetingUrl} target="_blank" rel="noopener noreferrer"><Icon name="video" size={16}/> Join now</a>
    : <span className="small-note" title="The link opens 15 minutes before the start">Join opens 15 min before</span>;
}

function SessionItem({s, viewer, withWho, now, firstName, pending, run}: {
  s: Session; viewer: "staff" | "member"; withWho: string; now: number; firstName: string; pending: boolean; run: Run;
}) {
  const [editing, setEditing] = useState(false);
  const start = new Date(s.startsAt);
  const upcoming = s.status === "scheduled" && Date.parse(s.endsAt) >= now;
  const status = (to: Session["status"]) => run(() => setSessionStatus(s.id, to));
  return <li className="rc-session" data-status={s.status}>
    <div className="rc-session-when" aria-hidden="true"><small>{formatIstDate(start, {weekday: "short"})}</small><b>{formatIstDate(start, {day: "numeric"})}</b><small>{formatIstDate(start, {month: "short"})}</small></div>
    <div className="rc-session-body">
      <h3>{s.title}</h3>
      <p>{formatIstDate(start, {weekday: "long", day: "numeric", month: "long"})} · {formatIstTime(s.startsAt)}–{formatIstTime(s.endsAt)} IST · {sessionKindLabels[s.kind]}</p>
      {s.notes && <p>{s.notes}</p>}
      <span className="rc-session-status" data-tone={sessionTone(s)}>{upcoming ? "Upcoming" : sessionStatusLabels[s.status === "scheduled" ? "scheduled" : s.status]}{s.status === "scheduled" && !upcoming ? " · not marked yet" : ""}</span>
    </div>
    <div className="rc-session-actions">
      <JoinButton session={s} now={now}/>
      {upcoming && <a className="small-button" href={googleCalendarLink(s, withWho)} target="_blank" rel="noopener noreferrer">Add to Google Calendar</a>}
      {viewer === "staff" && <>
        {s.status === "scheduled" && <button className="small-button" disabled={pending} onClick={() => setEditing(true)}>Edit</button>}
        {s.status === "scheduled" && Date.parse(s.startsAt) <= now && <>
          <button className="small-button" disabled={pending} onClick={() => status("done")}>Completed</button>
          <button className="small-button" disabled={pending} onClick={() => status("missed")}>Missed</button>
        </>}
        {s.status === "scheduled" && upcoming && <button className="small-button" disabled={pending} onClick={() => { if (confirm(`Cancel this session? ${firstName} will be emailed.`)) status("cancelled"); }}>Cancel</button>}
        {s.status !== "scheduled" && <button className="small-button" disabled={pending} onClick={() => status("scheduled")}>Undo</button>}
        {s.status !== "scheduled" && <button className="small-button" disabled={pending} onClick={() => { if (confirm("Delete this session for good?")) run(() => deleteSession(s.id)); }}>Delete</button>}
      </>}
    </div>
    {viewer === "staff" && <Modal open={editing} eyebrow="SESSIONS" title="Edit session" onClose={() => setEditing(false)}>
      <SessionForm clientId={s.clientId} session={s} firstName={firstName} pending={pending} run={run} onDone={() => setEditing(false)}/>
    </Modal>}
  </li>;
}

/** Upcoming first (soonest at the top), then past (latest first). */
export default function SessionList({sessions, viewer, withWho, firstName, pending = false, run = () => {}, emptyUpcoming, showPast = true}: {
  sessions: Session[]; viewer: "staff" | "member"; withWho: string; firstName: string; pending?: boolean; run?: Run; emptyUpcoming: string; showPast?: boolean;
}) {
  const now = useNow();
  const upcoming = sessions.filter(s => s.status === "scheduled" && Date.parse(s.endsAt) >= now).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const past = sessions.filter(s => !upcoming.includes(s)).sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  const item = (s: Session) => <SessionItem key={s.id} s={s} viewer={viewer} withWho={withWho} now={now} firstName={firstName} pending={pending} run={run}/>;
  return <>
    <section className="card"><div className="section-top"><h2>Upcoming</h2><span className="pill">{upcoming.length} BOOKED</span></div>
      {upcoming.length ? <ol className="rc-session-list">{upcoming.map(item)}</ol> : <p className="rc-staff-empty">{emptyUpcoming}</p>}
    </section>
    {showPast && past.length > 0 && <section className="card"><div className="section-top"><h2>Past sessions</h2><span className="pill">{past.length}</span></div>
      <ol className="rc-session-list">{past.map(item)}</ol>
    </section>}
  </>;
}
