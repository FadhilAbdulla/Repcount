"use client";

import {useState} from "react";
import {useRouter} from "next/navigation";
import Modal from "./Modal";
import {Icon} from "./Media";
import {addAdmin, changeMyPassword, deleteClient, saveEmailSettings, sendTestEmail, deleteTrainer, editAdmin, editMemberLog, editMembership, setAccountActive} from "./actions/data";
import type {ClientRow, MemberLog} from "@/lib/store";
import type {AdminAccount} from "@/lib/users";
import type {EmailLogRow, MailStatus} from "@/lib/mail";
import {moods} from "@/lib/memberState";

type Result = {ok?: string; error?: string};
type Run = (action: () => Promise<Result>) => void;

/** Shared modal plumbing: a button that opens a form, shows the action's error inline and closes on success. */
function useEditor() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const submit = (run: Run, action: () => Promise<Result>, after?: () => void) => run(async () => {
    const result = await action();
    if (result.ok) { setOpen(false); after?.(); } else setError(result.error ?? "");
    return result;
  });
  return {open, error, show: () => {setError(""); setOpen(true);}, close: () => setOpen(false), submit};
}

/** Payment status and reference, join date and next check-in. */
export function MembershipEditor({client: c, pending, run}: {client: ClientRow; pending: boolean; run: Run}) {
  const initial = () => ({paid: c.paid, reference: c.reference ?? "", joinedOn: c.joinedOn ?? "", nextCheckIn: c.nextCheckIn === "—" ? "" : c.nextCheckIn});
  const [form, setForm] = useState(initial);
  const e = useEditor();
  return <>
    <button type="button" className="small-button" onClick={() => {setForm(initial()); e.show();}}>Edit membership</button>
    <Modal open={e.open} eyebrow="MEMBERSHIP" title={`${c.name.split(" ")[0]}’s membership`} onClose={e.close}>
      <form className="rc-modal-form" onSubmit={ev => {ev.preventDefault(); e.submit(run, () => editMembership(c.id, form));}}>
        <label className="field">Payment<select value={form.paid ? "yes" : "no"} onChange={ev => setForm({...form, paid: ev.target.value === "yes"})}><option value="yes">Verified</option><option value="no">Not verified (back to payment review)</option></select></label>
        <label className="field">Payment reference<input value={form.reference} onChange={ev => setForm({...form, reference: ev.target.value})} maxLength={60} autoComplete="off"/></label>
        <div className="rc-modal-row">
          <label className="field">Joined on<input type="date" value={form.joinedOn} onChange={ev => setForm({...form, joinedOn: ev.target.value})}/></label>
          <label className="field">Next check-in<input value={form.nextCheckIn} onChange={ev => setForm({...form, nextCheckIn: ev.target.value})} maxLength={60} placeholder="e.g. Fri · 6:00 PM"/></label>
        </div>
        <p className="small-note">The 30-day programme dates follow the join date. The member sees the next check-in on their Profile.</p>
        {e.error && <p className="rc-modal-error" role="alert">{e.error}</p>}
        <button className="button dark" type="submit" disabled={pending}>{pending ? "Saving…" : "Save membership"} →</button>
      </form>
    </Modal>
  </>;
}

type Entry = {label: string; value: string};
const toEntries = (points: {label: string; value: number}[]) => points.map(p => ({label: p.label, value: String(p.value)}));
const fromEntries = (entries: Entry[]) => entries.filter(p => p.label || p.value).map(p => ({label: p.label, value: Number(p.value)}));

function EntryList({legend, unit, entries, setEntries, today}: {legend: string; unit: string; entries: Entry[]; setEntries: (e: Entry[]) => void; today: string}) {
  return <fieldset className="rc-log-entries"><legend>{legend}</legend>
    {entries.length === 0 && <p className="small-note">No entries.</p>}
    {entries.map((p, i) => <div key={i} className="rc-log-entry">
      <input type="date" aria-label={`${legend} ${i + 1} date`} value={p.label} max={today} onChange={ev => setEntries(entries.map((x, j) => j === i ? {...x, label: ev.target.value} : x))} required/>
      <input inputMode="decimal" aria-label={`${legend} ${i + 1} (${unit})`} value={p.value} onChange={ev => setEntries(entries.map((x, j) => j === i ? {...x, value: ev.target.value} : x))} required/>
      <span>{unit}</span>
      <button type="button" className="small-button" aria-label={`Remove ${legend.toLowerCase()} ${i + 1}`} onClick={() => setEntries(entries.filter((_, j) => j !== i))}><Icon name="close" size={14}/></button>
    </div>)}
    <button type="button" className="small-button" onClick={() => setEntries([...entries, {label: today, value: ""}])}>+ Add entry</button>
  </fieldset>;
}

/** Corrects what the member logged: weigh-ins, body fat, today's tracker, and reopens this week's check-in. */
export function MemberLogEditor({clientId, firstName, log, today, pending, run}: {clientId: string; firstName: string; log: MemberLog; today: string; pending: boolean; run: Run}) {
  const initial = () => ({weights: toEntries(log.weights), fats: toEntries(log.fats), water: String(log.water), steps: String(log.steps), sleep: log.sleep === null ? "" : String(log.sleep), mood: log.mood ?? "", checkinSubmitted: log.checkinSubmitted});
  const [form, setForm] = useState(initial);
  const e = useEditor();
  return <>
    <button type="button" className="button outline" onClick={() => {setForm(initial()); e.show();}}>Edit {firstName}’s log</button>
    <Modal open={e.open} eyebrow="MEMBER LOG" title={`Correct ${firstName}’s log`} onClose={e.close}>
      <form className="rc-modal-form" onSubmit={ev => {ev.preventDefault(); e.submit(run, () => editMemberLog(clientId, {
        weights: fromEntries(form.weights), fats: fromEntries(form.fats), water: Number(form.water), steps: Number(form.steps),
        sleep: form.sleep === "" ? null : Number(form.sleep), mood: form.mood || null, checkinSubmitted: form.checkinSubmitted,
      }));}}>
        <EntryList legend="Weigh-ins" unit="kg" entries={form.weights} setEntries={weights => setForm({...form, weights})} today={today}/>
        <EntryList legend="Body fat" unit="%" entries={form.fats} setEntries={fats => setForm({...form, fats})} today={today}/>
        <fieldset className="rc-log-entries"><legend>Today’s tracker</legend>
          <div className="rc-modal-row">
            <label className="field">Water (glasses)<input type="number" min={0} max={30} value={form.water} onChange={ev => setForm({...form, water: ev.target.value})}/></label>
            <label className="field">Steps<input type="number" min={0} max={100000} value={form.steps} onChange={ev => setForm({...form, steps: ev.target.value})}/></label>
            <label className="field">Sleep (hours)<input type="number" min={0} max={24} step={0.5} value={form.sleep} onChange={ev => setForm({...form, sleep: ev.target.value})} placeholder="Not logged"/></label>
            <label className="field">Mood<select value={form.mood} onChange={ev => setForm({...form, mood: ev.target.value})}><option value="">Not logged</option>{moods.map(m => <option key={m}>{m}</option>)}</select></label>
          </div>
        </fieldset>
        {log.checkinSubmitted && <label className="checkbox"><input type="checkbox" checked={!form.checkinSubmitted} onChange={ev => setForm({...form, checkinSubmitted: !ev.target.checked})}/>Reopen this week’s check-in (clears it so {firstName} can submit again)</label>}
        <p className="small-note">If {firstName} has the app open, it reloads with your changes.</p>
        {e.error && <p className="rc-modal-error" role="alert">{e.error}</p>}
        <button className="button dark" type="submit" disabled={pending}>{pending ? "Saving…" : "Save log"} →</button>
      </form>
    </Modal>
  </>;
}

/** Permanent deletion of a client or trainer, confirmed by typing their name. */
export function DeleteAccount({kind, id, name, pending, run}: {kind: "client" | "trainer"; id: string; name: string; pending: boolean; run: Run}) {
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const e = useEditor();
  const what = kind === "client"
    ? "their sign-in, saved progress, history, workout and nutrition plans, messages and payment details"
    : "their sign-in. Their members become unassigned; plans they wrote stay with the members";
  return <>
    <button type="button" className={kind === "client" ? "button outline rc-danger" : "text-button rc-danger"} onClick={() => {setTyped(""); e.show();}}>Delete {kind === "client" ? "client" : "trainer"} permanently</button>
    <Modal open={e.open} eyebrow="PERMANENT" title={`Delete ${name}?`} onClose={e.close}>
      <form className="rc-modal-form" onSubmit={ev => {ev.preventDefault(); e.submit(run, () => (kind === "client" ? deleteClient : deleteTrainer)(id, typed), () => { if (kind === "client") router.push("/admin?tab=clients"); });}}>
        <p>This deletes {what}. It can’t be undone. To deactivate instead, use Deactivate.</p>
        <label className="field">Type <b>{name}</b> to confirm<input value={typed} onChange={ev => setTyped(ev.target.value)} autoComplete="off" required/></label>
        {e.error && <p className="rc-modal-error" role="alert">{e.error}</p>}
        <button className="button dark rc-danger-fill" type="submit" disabled={pending || typed.trim().toLowerCase() !== name.trim().toLowerCase()}>{pending ? "Deleting…" : "Delete permanently"} →</button>
      </form>
    </Modal>
  </>;
}

/** Settings → Admin accounts: every admin (including you) can be edited; others can be deactivated; new admins added. */
export function AdminAccounts({admins, selfEmail, pending, run}: {admins: AdminAccount[]; selfEmail: string; pending: boolean; run: Run}) {
  const empty = {id: "", name: "", email: "", password: ""};
  const [form, setForm] = useState(empty);
  const e = useEditor();
  const adding = form.id === "";
  return <section className="card"><div className="section-top"><h2>Admin accounts</h2><button type="button" className="small-button" onClick={() => {setForm(empty); e.show();}}>+ Add admin</button></div>
    <ul className="rc-admin-list">{admins.map(a => {
      const self = a.email === selfEmail;
      return <li key={a.id}><div><b>{a.name}{self && " (you)"}</b><small>{a.email} · {a.active ? (a.canUsePassword ? "password or Google" : "Google sign-in") : "deactivated"}</small></div>
        <span>
          <button type="button" className="text-button" onClick={() => {setForm({id: a.id, name: a.name, email: a.email, password: ""}); e.show();}}>Edit</button>
          {!self && <button type="button" className="text-button" disabled={pending} onClick={() => run(() => setAccountActive(a.id, !a.active))}>{a.active ? "Deactivate" : "Reactivate"}</button>}
        </span></li>;
    })}</ul>
    <Modal open={e.open} eyebrow="ADMIN ACCOUNTS" title={adding ? "Add an admin" : `Edit ${form.name || "admin"}`} onClose={e.close}>
      <form className="rc-modal-form" onSubmit={ev => {ev.preventDefault(); e.submit(run, () => adding ? addAdmin(form) : editAdmin(form.id, form));}}>
        <label className="field">Full name<input value={form.name} onChange={ev => setForm({...form, name: ev.target.value})} required maxLength={40} autoComplete="off"/></label>
        <label className="field">Email (Google account)<input type="email" value={form.email} onChange={ev => setForm({...form, email: ev.target.value})} required autoComplete="off"/></label>
        <label className="field">{adding ? "Password (optional)" : "New password (optional)"}<input type="password" value={form.password} onChange={ev => setForm({...form, password: ev.target.value})} minLength={10} autoComplete="new-password" placeholder={adding ? "Blank sends an invitation link" : "Leave blank to keep the current one"}/></label>
        {e.error && <p className="rc-modal-error" role="alert">{e.error}</p>}
        <button className="button dark" type="submit" disabled={pending}>{pending ? "Saving…" : adding ? "Add admin" : "Save changes"} →</button>
      </form>
    </Modal>
  </section>;
}

/** Settings → Change my password, for the signed-in admin. */
export function ChangePassword({hasPassword, pending, run}: {hasPassword: boolean; pending: boolean; run: Run}) {
  const empty = {current: "", next: "", confirm: ""};
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");
  const mismatch = form.confirm !== "" && form.confirm !== form.next;
  return <section className="card"><h2>Change my password</h2>
    {!hasPassword && <p className="small-note">You sign in with Google. Set a password to also sign in with your email.</p>}
    <form className="rc-modal-form" onSubmit={ev => {ev.preventDefault(); setError(""); run(async () => {
      const result = await changeMyPassword(form);
      if (result.ok) setForm(empty); else setError(result.error ?? "");
      return result;
    });}}>
      {hasPassword && <label className="field">Current password<input type="password" value={form.current} onChange={ev => setForm({...form, current: ev.target.value})} required autoComplete="current-password"/></label>}
      <div className="rc-modal-row">
        <label className="field">New password<input type="password" value={form.next} onChange={ev => setForm({...form, next: ev.target.value})} required minLength={10} maxLength={200} autoComplete="new-password" placeholder="At least 10 characters"/></label>
        <label className="field">Repeat new password<input type="password" value={form.confirm} onChange={ev => setForm({...form, confirm: ev.target.value})} required minLength={10} maxLength={200} autoComplete="new-password"/></label>
      </div>
      {mismatch && <p className="rc-modal-error" role="alert">The two new passwords don’t match.</p>}
      {error && <p className="rc-modal-error" role="alert">{error}</p>}
      <p className="small-note">Changing it signs you out on your other devices.</p>
      <button className="button dark" type="submit" disabled={pending || mismatch}>{pending ? "Saving…" : "Change password"} →</button>
    </form>
  </section>;
}

const sentAt = (iso: string) => new Date(iso).toLocaleString("en-GB", {day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata"});
const statusLabel = {sent: "Sent", failed: "Failed", skipped: "Not sent"} as const;

/** Settings → Email: the Resend API key and sender, a test email, and the last emails the app tried to send. */
export function EmailSettings({status, recent, selfEmail, pending, run}: {status: MailStatus; recent: EmailLogRow[]; selfEmail: string; pending: boolean; run: Run}) {
  const [form, setForm] = useState({apiKey: "", from: status.from});
  const [error, setError] = useState("");
  const save = (removeKey = false) => { setError(""); run(async () => {
    const result = await saveEmailSettings({...form, removeKey});
    if (result.ok) setForm(f => ({...f, apiKey: ""})); else setError(result.error ?? "");
    return result;
  }); };
  const hasAdminKey = status.source === "admin" || status.keyUnreadable;
  return <section className="card"><div className="section-top"><h2>Email</h2>
    <span className={`pill${status.configured ? "" : " rc-pill-warn"}`}>{status.configured ? `CONNECTED${status.source === "env" ? " · FROM ENVIRONMENT" : ""}` : "NOT SET UP"}</span></div>
    <p className="small-note">RepCount sends sign-up, payment, trainer, plan, check-in, message and password emails through <a href="https://resend.com" target="_blank" rel="noreferrer">Resend</a>. Create an API key under Resend → API Keys, and verify your domain under Domains so you can send from it.</p>
    {status.keyUnreadable && <p className="rc-modal-error" role="alert">The saved API key can’t be read any more (the session secret changed). Enter it again.</p>}
    <form className="rc-modal-form" onSubmit={ev => {ev.preventDefault(); save();}}>
      <div className="rc-modal-row">
        <label className="field">Resend API key<input type="password" value={form.apiKey} onChange={ev => setForm({...form, apiKey: ev.target.value})} autoComplete="off" spellCheck={false}
          placeholder={status.keyHint ? `Saved (${status.keyHint}). Leave blank to keep it` : "re_…"} required={!status.configured}/></label>
        <label className="field">Send from<input value={form.from} onChange={ev => setForm({...form, from: ev.target.value})} required maxLength={120} placeholder="RepCount <hello@yourdomain.com>" autoComplete="off"/></label>
      </div>
      <p className="small-note">The key is stored encrypted and never shown again. The sender must be on a domain verified in Resend.</p>
      {error && <p className="rc-modal-error" role="alert">{error}</p>}
      <div className="rc-schedule-tools">
        <button className="button dark" type="submit" disabled={pending}>{pending ? "Saving…" : "Save email settings"}</button>
        <button className="button outline" type="button" disabled={pending || !status.configured} onClick={() => run(() => sendTestEmail())}>Send test email to {selfEmail}</button>
        {hasAdminKey && <button className="text-button rc-danger" type="button" disabled={pending} onClick={() => { if (window.confirm("Remove the saved API key? Email stops until you add one again.")) save(true); }}>Remove key</button>}
      </div>
    </form>
    <h3 className="rc-email-log-title">Recent emails</h3>
    {recent.length === 0 ? <p className="small-note">Nothing sent yet.</p> : <ul className="rc-admin-list rc-email-log">{recent.map(e => <li key={e.id}>
      <div><b>{e.subject}</b><small>{e.to} · {sentAt(e.at)} IST{e.error ? ` · ${e.error}` : ""}</small></div>
      <span className={`pill rc-email-${e.status}`}>{statusLabel[e.status]}</span>
    </li>)}</ul>}
  </section>;
}
