"use client";

import {useState} from "react";
import type {Message} from "@/lib/store";
import {deleteClientMessage, replyToMember} from "./actions/data";
import "./conversation.css";

type Result = {ok?: string; error?: string};
const when = (at: string) => new Date(at.replace(" ", "T") + "Z").toLocaleString("en-GB", {day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata"}) + " IST";

/** The member ↔ trainer conversation, oldest first. Members' own messages sit on the right in their view, trainers' in staff view. */
export function MessageList({messages, viewer, empty, onDelete}: {messages: Message[]; viewer: "member" | "staff"; empty: string; onDelete?: (id: number) => void}) {
  if (messages.length === 0) return <p className="rc-staff-empty">{empty}</p>;
  return <ol className="rc-thread">{messages.map((m, i) => {
    const mine = viewer === "member" ? m.fromMember : !m.fromMember;
    return <li key={i} className={mine ? "mine" : undefined}><b>{m.author}</b><p>{m.body}</p><time dateTime={m.at.replace(" ", "T") + "Z"}>{when(m.at)}</time>{onDelete && <button type="button" className="rc-thread-delete" onClick={() => onDelete(m.id)}>Remove</button>}</li>;
  })}</ol>;
}

/** Staff view: the conversation plus a reply box. */
export function StaffConversation({clientId, firstName, messages, canReply, canDelete = false, pending, run}: {clientId: string; firstName: string; messages: Message[]; canReply: boolean; canDelete?: boolean; pending: boolean; run: (action: () => Promise<Result>) => void}) {
  const [reply, setReply] = useState("");
  return <section className="card"><div className="section-top"><h2>Messages with {firstName}</h2><span className="pill">{messages.length} MESSAGE{messages.length === 1 ? "" : "S"}</span></div>
    <MessageList messages={messages} viewer="staff" empty={`No questions from ${firstName} yet.`}
      onDelete={canDelete ? id => { if (window.confirm("Remove this message for everyone?")) run(() => deleteClientMessage(clientId, id)); } : undefined}/>
    {canReply && <form className="rc-thread-reply" onSubmit={e => {e.preventDefault(); run(async () => {const result = await replyToMember(clientId, reply); if (result.ok) setReply(""); return result;});}}>
      <label className="field">Reply to {firstName}<textarea value={reply} onChange={e => setReply(e.target.value)} rows={3} minLength={2} maxLength={1000} required placeholder={`${firstName} sees this on their Profile`}/></label>
      <button className="button dark" type="submit" disabled={pending || reply.trim().length < 2}>{pending ? "Sending…" : "Send reply"} →</button>
    </form>}
  </section>;
}
