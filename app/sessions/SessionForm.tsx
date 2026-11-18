"use client";

/* Book or edit a session: kind, title, date, start and end time (India time), meeting link and notes. */
import {useState} from "react";
import {istParts, istToday} from "@/lib/dates";
import {sessionKindLabels, sessionKinds, type Session, type SessionInput} from "@/lib/sessions";
import {Icon} from "../Media";
import {saveSession} from "../actions/sessions";
import type {Run} from "../useAction";

const blank = (): SessionInput => ({kind: "weekly", title: "", date: istToday().day, start: "18:00", end: "18:30", meetingUrl: "", notes: ""});
const fromSession = (s: Session): SessionInput => ({kind: s.kind, title: s.title, date: istParts(s.startsAt).date, start: istParts(s.startsAt).time,
  end: istParts(s.endsAt).time, meetingUrl: s.meetingUrl ?? "", notes: s.notes ?? ""});

export default function SessionForm({clientId, session, firstName, pending, run, onDone}: {
  clientId: string; session?: Session; firstName: string; pending: boolean; run: Run; onDone?: () => void;
}) {
  const [f, setF] = useState<SessionInput>(() => session ? fromSession(session) : blank());
  const set = (change: Partial<SessionInput>) => setF({...f, ...change});
  return <form className="rc-modal-form rc-session-form" onSubmit={e => {
    e.preventDefault();
    run(() => saveSession(clientId, f, session?.id), r => { if (r.ok) { if (!session) setF(blank()); onDone?.(); } });
  }}>
    <label className="field">Kind of session
      <select value={f.kind} onChange={e => set({kind: e.target.value})}>{sessionKinds.map(k => <option key={k} value={k}>{sessionKindLabels[k]}</option>)}</select>
    </label>
    <label className="field">Title (optional)<input value={f.title} onChange={e => set({title: e.target.value})} maxLength={80} placeholder={sessionKindLabels[f.kind as keyof typeof sessionKindLabels]}/></label>
    <div className="rc-day-pair">
      <label className="field">Date<input type="date" required value={f.date} onChange={e => set({date: e.target.value})}/></label>
      <label className="field">Starts (IST)<input type="time" required value={f.start} onChange={e => set({start: e.target.value})}/></label>
      <label className="field">Ends (IST)<input type="time" required value={f.end} onChange={e => set({end: e.target.value})}/></label>
    </div>
    <label className="field">Meeting link
      <input type="url" inputMode="url" value={f.meetingUrl} onChange={e => set({meetingUrl: e.target.value})} placeholder="https://meet.google.com/…"/>
      <small className="small-note"><a href="https://meet.google.com/new" target="_blank" rel="noopener noreferrer">Create a Google Meet link</a> in a new tab, then paste it here.</small>
    </label>
    <label className="field">Notes for {firstName} (optional)<textarea rows={3} maxLength={1000} value={f.notes} onChange={e => set({notes: e.target.value})}/></label>
    <button className="button dark" type="submit" disabled={pending}><Icon name="video" size={16}/> {pending ? "Saving…" : session ? "Save changes" : "Book session"}</button>
    <p className="small-note">{firstName} and their trainer get an email with a calendar invite{session ? " showing the new details" : ""}.</p>
  </form>;
}
