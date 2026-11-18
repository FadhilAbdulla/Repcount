"use client";

/* Book or edit a session: title, date, start time (India time) and the meeting link. Used inside a modal. */
import {useState} from "react";
import {istParts, istToday} from "@/lib/dates";
import {type Session, type SessionInput} from "@/lib/sessions";
import {Icon} from "../Media";
import {saveSession} from "../actions/sessions";
import type {Run} from "../useAction";

const blank = (): SessionInput => ({title: "", date: istToday().day, start: "18:00", meetingUrl: ""});
const fromSession = (s: Session): SessionInput => ({title: s.title, date: istParts(s.startsAt).date, start: istParts(s.startsAt).time, meetingUrl: s.meetingUrl ?? ""});

export default function SessionForm({clientId, session, firstName, pending, run, onDone}: {
  clientId: string; session?: Session; firstName: string; pending: boolean; run: Run; onDone?: () => void;
}) {
  const [f, setF] = useState<SessionInput>(() => session ? fromSession(session) : blank());
  const set = (change: Partial<SessionInput>) => setF({...f, ...change});
  return <form className="rc-modal-form rc-session-form" onSubmit={e => {
    e.preventDefault();
    run(() => saveSession(clientId, f, session?.id), r => { if (r.ok) { if (!session) setF(blank()); onDone?.(); } });
  }}>
    <label className="field">Title<input required value={f.title} onChange={e => set({title: e.target.value})} maxLength={80} placeholder="e.g. Weekly check-in"/></label>
    <div className="rc-day-pair">
      <label className="field">Date<input type="date" required value={f.date} onChange={e => set({date: e.target.value})}/></label>
      <label className="field">Starts (IST)<input type="time" required value={f.start} onChange={e => set({start: e.target.value})}/></label>
    </div>
    <label className="field">Meeting link
      <input type="url" inputMode="url" value={f.meetingUrl} onChange={e => set({meetingUrl: e.target.value})} placeholder="https://meet.google.com/…"/>
      <small className="small-note"><a href="https://meet.google.com/new" target="_blank" rel="noopener noreferrer">Create a Google Meet link</a> in a new tab, then paste it here.</small>
    </label>
    <button className="button dark" type="submit" disabled={pending}><Icon name="video" size={16}/> {pending ? "Saving…" : session ? "Save changes" : "Book session"}</button>
    <p className="small-note">{firstName} gets an email with a calendar invite{session ? " showing the new details" : ""}.</p>
  </form>;
}
