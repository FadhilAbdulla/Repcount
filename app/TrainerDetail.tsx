"use client";

import {useState, useTransition} from "react";
import Link from "next/link";
import {Icon} from "./Media";
import Modal from "./Modal";
import PasswordInput from "./PasswordInput";
import {DeleteAccount} from "./AdminEditors";
import {editTrainer, sendResetLink, setAccountActive} from "./actions/data";
import {PaymentPill, StatusPill} from "./Pills";
import {PAYMENTS_ENABLED} from "@/lib/features";
import type {ClientRow, TrainerStats} from "@/lib/store";

const formatDate = (iso: string | null) => iso ? new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", {day: "numeric", month: "short", year: "numeric", timeZone: "UTC"}) : "—";

/** Admin → Trainers → one trainer: their details and sign-in, this week's numbers, account actions and every client they coach. */
export default function TrainerDetail({trainer: t, clients}: {trainer: TrainerStats; clients: ClientRow[]}) {
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState("");
  const [noticeError, setNoticeError] = useState(false);
  const [editing, setEditing] = useState<{name: string; email: string; title: string; password: string} | null>(null);
  const run = (action: () => Promise<{ok?: string; error?: string}>) => startTransition(async () => {
    const result = await action();
    setNoticeError(!result.ok);
    setNotice(result.ok ?? result.error ?? "");
  });
  const stats: [string, string, string][] = [
    ["Clients", String(t.clients), `${t.scheduled} with a plan this week`],
    ["Workouts this week", t.workoutsPlanned ? `${t.workoutsDone} of ${t.workoutsPlanned}` : "—", t.workoutsPlanned ? `${t.completion}% done` : "None planned yet"],
    ["Active last 7 days", `${t.activeWeek} of ${t.clients}`, "clients who trained"],
    ["Sessions confirmed", String(t.confirmedWeek), "this week"],
    ["Check-ins waiting", String(t.checkinsWaiting), `${t.checkinsReviewed} reviewed in 30 days`],
  ];

  return <>
    <Link className="rc-back-link" href="/admin?tab=trainers">← All trainers</Link>
    <section className="card rc-client-head">
      <div className="rc-detail-identity">
        <span className="large-avatar">{t.initials}</span>
        <div>
          <p className="eyebrow">TRAINER</p>
          <h1 tabIndex={-1}>{t.name}</h1>
          <p className="rc-client-meta"><span>{t.email}</span><span>{t.canUsePassword ? "Password or Google sign-in" : "Google sign-in"}</span><span>Added {formatDate(t.createdAt)}</span></p>
        </div>
      </div>
      <div className="rc-client-head-actions">
        <span className="rc-stage-control rc-stage-static" data-stage={t.active ? "active" : "payment-review"}><span className="rc-stage-dot" aria-hidden="true"/>{t.active ? "Active" : "Deactivated"}</span>
        <button type="button" className="button outline rc-edit-button" onClick={() => {setNotice(""); setEditing({name: t.name, email: t.email, title: t.title, password: ""});}}><Icon name="edit" size={16}/> Edit details</button>
      </div>
    </section>
    {notice && <div className={noticeError ? "notice notice-error" : "notice"} role={noticeError ? "alert" : "status"}>{notice}<button onClick={() => setNotice("")} aria-label="Dismiss notification"><Icon name="close" size={18}/></button></div>}

    <div className="rc-kpis rc-kpis-5">{stats.map(([label, value, sub]) => <section className="card" key={label}><span className="eyebrow">{label}</span><strong>{value}</strong><small>{sub}</small></section>)}</div>

    <section className="card">
      <div className="section-top"><h2>{t.name.split(" ")[0]}’s clients</h2><span className="pill">{clients.length} CLIENT{clients.length === 1 ? "" : "S"}</span></div>
      {clients.length === 0 ? <p className="rc-staff-empty">No clients assigned yet. Assign clients from the Clients page.</p>
        : <div className="table-scroll"><table className="rc-cards"><thead><tr><th>Client</th><th>This week</th><th>Last workout</th><th>{PAYMENTS_ENABLED ? "Payment" : "Status"}</th></tr></thead><tbody>
          {clients.map(c => <tr key={c.id}>
            <td data-label="Client"><Link className="client-name rc-client-link" href={`/admin/clients/${c.id}`}><span className="avatar">{c.initials}</span><span><b>{c.name}</b>{c.email && <small>{c.email}</small>}</span></Link></td>
            <td data-label="This week">{c.weekPlanned ? <><progress max={c.weekPlanned} value={c.weekDone} aria-label={`${c.name}: ${c.weekDone} of ${c.weekPlanned} workouts done this week`}/><small>{c.weekDone} of {c.weekPlanned} workouts</small></> : <small className="rc-muted">No plan this week</small>}</td>
            <td data-label="Last workout">{c.lastWorkout}</td>
            {PAYMENTS_ENABLED ? <td data-label="Payment"><PaymentPill client={c}/></td> : <td data-label="Status"><StatusPill client={c}/></td>}
          </tr>)}
        </tbody></table></div>}
    </section>

    <section className="card rc-account-card">
      <div className="section-top"><h2>Account</h2></div>
      <ul className="rc-account-actions">
        <li><div><b>{t.active ? "Deactivate sign-in" : "Reactivate sign-in"}</b><small>{t.active ? "Blocks sign-in and signs them out everywhere. Their clients stay assigned." : "Lets them sign in again."}</small></div>
          <button type="button" className="button outline" disabled={pending} onClick={() => run(() => setAccountActive(t.id, !t.active))}>{t.active ? "Deactivate" : "Reactivate"}</button></li>
        {t.active && <li><div><b>Send a password reset link</b><small>Emails {t.email} a link to choose a new password.</small></div>
          <button type="button" className="button outline" disabled={pending} onClick={() => run(() => sendResetLink(t.id))}>Send link</button></li>}
        <li><div><b>Delete trainer</b><small>Removes their account permanently. Their clients become unassigned.</small></div>
          <DeleteAccount kind="trainer" id={t.id} name={t.name} pending={pending} run={run}/></li>
      </ul>
    </section>

    <Modal open={editing !== null} eyebrow="TRAINERS" title={`Edit ${t.name.split(" ")[0]}’s details`} onClose={() => setEditing(null)}>
      {editing && <form className="rc-modal-form" onSubmit={e => {e.preventDefault(); run(async () => {const result = await editTrainer(t.id, editing); if (result.ok) setEditing(null); return result;});}}>
        <label className="field">Full name<input value={editing.name} onChange={e => setEditing({...editing, name: e.target.value})} required maxLength={40} autoComplete="off"/></label>
        <label className="field">Email (Google account)<input type="email" value={editing.email} onChange={e => setEditing({...editing, email: e.target.value})} required autoComplete="off"/></label>
        <label className="field">New password (optional)<PasswordInput value={editing.password} onChange={e => setEditing({...editing, password: e.target.value})} isNew placeholder="Leave blank to keep the current one"/></label>
        <p className="small-note">After an email change the trainer signs in with the new email. A new password signs them out everywhere.</p>
        {notice && noticeError && <p className="rc-modal-error" role="alert">{notice}</p>}
        <button className="button dark" type="submit" disabled={pending}>{pending ? "Saving…" : "Save changes"} →</button>
      </form>}
    </Modal>
  </>;
}
