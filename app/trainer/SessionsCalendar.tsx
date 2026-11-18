"use client";

/*
 * Trainer → Sessions (and Admin → Sessions): every session in a month on one calendar. Drag a session to another day to
 * move it (the time stays the same); tap one to change its time, link or status.
 */
import {useState} from "react";
import {formatIstTime, istParts} from "@/lib/dates";
import {sessionTone, type Session} from "@/lib/sessions";
import Modal from "../Modal";
import {moveSession} from "../actions/sessions";
import MonthCalendar from "../sessions/MonthCalendar";
import SessionForm from "../sessions/SessionForm";
import SessionList from "../sessions/SessionList";
import {useAction} from "../useAction";
import {calendarLegend} from "../client/ClientTabs";

export default function SessionsCalendar({area, month, today, sessions}: {area: "trainer" | "admin"; month: string; today: string; sessions: Session[]}) {
  const {pending, run, notice} = useAction();
  const [open, setOpen] = useState<Session | null>(null);
  const byId = new Map(sessions.map(s => [String(s.id), s]));
  const entries = sessions.map(s => ({id: String(s.id), day: istParts(s.startsAt).date, time: formatIstTime(s.startsAt),
    label: `${s.clientName.split(" ")[0]} · ${s.title}`, tone: sessionTone(s), draggable: s.status === "scheduled", onClick: () => setOpen(s)}));
  const drop = (id: string, day: string) => {
    const s = byId.get(id);
    if (!s || istParts(s.startsAt).date === day) return;
    run(() => moveSession(s.id, day, istParts(s.startsAt).time));
  };
  const first = open?.clientName.split(" ")[0] ?? "";
  return <>
    {notice}
    <MonthCalendar month={month} today={today} entries={entries} onDropEntry={drop} monthHref={m => `/${area}?tab=sessions&month=${m}`}
      legend={calendarLegend.filter(l => ["session", "done", "missed", "cancelled"].includes(l.tone))}
      emptyNote="No sessions this month. Book them from a member’s Sessions tab."/>
    <Modal open={!!open} eyebrow={open?.clientName.toUpperCase()} title={open?.title ?? ""} onClose={() => setOpen(null)}>
      {open && <>
        <SessionList sessions={[open]} viewer="staff" withWho={`with ${open.clientName}`} firstName={first} pending={pending} run={run} emptyUpcoming="" showPast/>
        {open.status === "scheduled" && <><h3>Change it</h3><SessionForm key={open.id} clientId={open.clientId} session={open} firstName={first} pending={pending} run={run} onDone={() => setOpen(null)}/></>}
        <p className="small-note"><a href={`/${area}/clients/${open.clientId}/sessions`}>All of {first}’s sessions →</a></p>
      </>}
    </Modal>
  </>;
}
