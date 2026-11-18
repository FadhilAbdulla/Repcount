"use client";

/* The Sessions, Messages and Calendar tabs of a client's page, for their trainer and the admin. */
import type {Message} from "@/lib/store";
import type {Session} from "@/lib/sessions";
import type {LogEntry} from "@/lib/calendarLog";
import {StaffConversation} from "../Conversation";
import MonthCalendar from "../sessions/MonthCalendar";
import SessionForm from "../sessions/SessionForm";
import SessionList from "../sessions/SessionList";
import {useAction} from "../useAction";

export function ClientSessions({clientId, firstName, trainerName, sessions}: {clientId: string; firstName: string; trainerName: string; sessions: Session[]}) {
  const {pending, run, notice} = useAction();
  return <>
    {notice}
    <div className="two-grid rc-detail-grid rc-sessions-layout">
      <div className="rc-sessions-main">
        <SessionList sessions={sessions} viewer="staff" withWho={`with ${trainerName}`} firstName={firstName} pending={pending} run={run}
          emptyUpcoming={`Nothing booked with ${firstName}. Book the introduction call or this week’s check-in.`}/>
      </div>
      <section className="card"><h2>Book a session</h2>
        <p className="small-note">Introduction call, weekly check-in or a live workout. {firstName} sees it on their Sessions page and can join in one click.</p>
        <SessionForm clientId={clientId} firstName={firstName} pending={pending} run={run}/>
      </section>
    </div>
  </>;
}

export function ClientMessages({clientId, firstName, messages, canReply, canDelete}: {clientId: string; firstName: string; messages: Message[]; canReply: boolean; canDelete: boolean}) {
  const {pending, run, notice} = useAction();
  return <>{notice}<StaffConversation clientId={clientId} firstName={firstName} messages={messages} canReply={canReply} canDelete={canDelete} pending={pending} run={run}/></>;
}

export const calendarLegend = [
  {tone: "session", label: "Session booked"}, {tone: "done", label: "Done"}, {tone: "missed", label: "Missed or not done"},
  {tone: "workout", label: "Workout planned"}, {tone: "meal", label: "Nutrition"}, {tone: "cancelled", label: "Cancelled"},
];

export function ClientCalendar({base, month, today, entries, firstName}: {base: string; month: string; today: string; entries: LogEntry[]; firstName: string}) {
  return <MonthCalendar month={month} today={today} monthHref={m => `${base}/calendar?month=${m}`} legend={calendarLegend}
    entries={entries.map(e => ({...e, href: e.sessionId ? `${base}/sessions` : e.tone === "meal" ? `${base}/nutrition` : undefined}))}
    emptyNote={`Nothing planned or logged for ${firstName} this month.`}/>;
}
