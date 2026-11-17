"use client";

import Photo from "./Photo";
import {useState, useTransition, type ReactNode} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import Brand from "./Brand";
import {Icon} from "./Media";
import {BarChart, StaffInsights, palette} from "./Tracker";
import {logout} from "./actions/auth";
import {addClient, addTrainer, assignTrainer, reviewCheckin, saveSettings, saveWhatsApp, verifyPayment} from "./actions/data";
import type {AuditEntry, ClientRow, Settings, TrainerStats} from "@/lib/store";
import Modal from "./Modal";
import PasswordInput from "./PasswordInput";
import {AdminAccounts, ChangePassword, EmailSettings, MembershipEditor} from "./AdminEditors";
import type {EmailLogRow, MailStatus} from "@/lib/mail";
import type {AdminAccount} from "@/lib/users";
import type {Post} from "@/lib/blog";
import BlogAdmin from "./BlogAdmin";
import {PAYMENTS_ENABLED} from "@/lib/features";
import {clientStatus, clientStatuses} from "@/lib/programme";
import "./member-polish.css";
import "./accessibility-polish.css";
import "./staff.css";
import "./admin.css";
import "./staff-ui.css";

export type StaffRole = "trainer" | "admin";
export type StaffUser = {name: string; initials: string; email: string};

const tabs: Record<StaffRole, [string, string, string, string][]> = {
  trainer: [["today", "home", "Today", "Today"], ["clients", "move", "My members", "Members"], ["checkins", "chat", "Check-ins", "Check-ins"]],
  admin: [["overview", "chart", "Overview", "Overview"], ["clients", "users", "Clients", "Clients"], ["payments", "card", "Payments", "Payments"], ["trainers", "heart", "Trainers", "Trainers"], ["admins", "shield", "Admins", "Admins"], ["blog", "edit", "Blog", "Blog"], ["settings", "sliders", "Settings", "Settings"]],
};
const headings: Record<string, [string, string]> = {
  today: ["Today’s floor.", "Who’s training, who needs a nudge, and what’s next."],
  clients: ["Clients.", "Everyone you coach, their stage, trainer and progress this week."],
  members: ["Your members.", "Open a member to plan their week, add their Meet links and nutrition, and mark sessions completed."],
  checkins: ["Weekly check-ins.", "Review how each client’s week went and adjust their plan."],
  overview: ["Overview.", "Your clients, payments and trainers at a glance."],
  payments: PAYMENTS_ENABLED ? ["Payments.", "Every client’s payment: verify references as they come in."] : ["Payments.", "Online payments are coming in phase 2."],
  trainers: ["Trainers.", "Your coaching team. Open a trainer to see their details and clients."],
  admins: ["Admins.", "Everyone who can manage RepCount."],
  blog: ["Blog.", "Health articles and resources for the public website. They help people find RepCount on Google."],
  settings: ["Settings.", "Pricing, WhatsApp, email and your password."],
};

export const activityLabels: Record<string, string> = {update_whatsapp: "WhatsApp number changed", add_post: "Blog post added", edit_post: "Blog post edited", delete_post: "Blog post deleted", cancel_membership: "Membership cancelled", restore_membership: "Membership restored", assign_trainer: "Trainer assigned", verify_payment: "Payment verified", review_checkin: "Check-in reviewed", update_settings: "Settings updated", add_trainer: "Trainer added", edit_trainer: "Trainer edited", edit_client: "Client details edited", schedule_week: "Week scheduled", confirm_session: "Session completed", unconfirm_session: "Session completion removed", save_nutrition: "Nutrition plan saved", set_meeting_link: "Call link updated", add_client: "Client added", set_stage: "Stage changed", deactivate_user: "Account deactivated", reactivate_user: "Account reactivated", self_register: "Registered online", ask_coach: "Question sent", reply_member: "Reply sent", send_reset_link: "Reset link sent", edit_membership: "Membership edited", edit_member_log: "Member log corrected", delete_client: "Client deleted", delete_trainer: "Trainer deleted", delete_admin: "Admin deleted", delete_message: "Message removed", add_admin: "Admin added", edit_admin: "Admin edited", change_password: "Password changed", edit_email_settings: "Email settings changed", complete_onboarding: "Onboarding answered"};
const statusOrder = ["Unassigned", "Assigned", "Cancelled"];
const sorters: Record<string, (a: ClientRow, b: ClientRow) => number> = {
  Name: (a, b) => a.name.localeCompare(b.name),
  Trainer: (a, b) => (a.trainer === "Unassigned" ? 1 : 0) - (b.trainer === "Unassigned" ? 1 : 0) || a.trainer.localeCompare(b.trainer) || a.name.localeCompare(b.name),
  Newest: (a, b) => (b.joinedOn ?? "").localeCompare(a.joinedOn ?? "") || a.name.localeCompare(b.name),
  "Progress (high to low)": (a, b) => b.progress - a.progress || b.weekPlanned - a.weekPlanned || a.name.localeCompare(b.name),
  Status: (a, b) => statusOrder.indexOf(clientStatus(a)) - statusOrder.indexOf(clientStatus(b)) || a.name.localeCompare(b.name),
};
const emptyTrainer = {name: "", email: "", title: "Trainer", password: ""};
const emptyClient = {name: "", email: "", phone: "", goal: "", trainerId: "", password: ""};
const formatDate = (iso: string | null) => iso ? new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", {day: "numeric", month: "short", year: "numeric", timeZone: "UTC"}) : "—";
/** Where a client's payment stands: verified by an admin, a reference waiting for review, or nothing submitted yet. */
export const paymentStatus = (c: ClientRow) => c.paid ? "Verified" : c.reference ? "Awaiting verification" : "Not submitted";
const paymentKey = (status: string) => status.toLowerCase().replace(/[^a-z]+/g, "-");
/** The client's status pill: Unassigned, Assigned or Cancelled. */
export const StatusPill = ({client}: {client: {cancelled: boolean; trainerId: string | null}}) => {const status = clientStatus(client); return <span className="rc-pay-status" data-status={paymentKey(status)}>{status}</span>;};

type Props = {
  area: StaffRole; user: StaffUser; clients: ClientRow[]; settings: Settings; activity: AuditEntry[];
  trainers?: TrainerStats[]; initialTab?: string; detail?: ReactNode; detailTab?: string; admins?: AdminAccount[]; mail?: {status: MailStatus; recent: EmailLogRow[]}; posts?: Post[];
};

export default function StaffApp({area: role, user, clients, settings, activity, trainers = [], initialTab, detail, detailTab, admins = [], mail, posts = []}: Props) {
  const router = useRouter();
  const admin = role === "admin";
  const [tab, setTab] = useState(initialTab && tabs[role].some(([key]) => key === initialTab) ? initialTab : tabs[role][0][0]);
  const [trainerFilter, setTrainerFilter] = useState("All trainers");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [sort, setSort] = useState("Name");
  const [paymentView, setPaymentView] = useState(() => clients.some(c => !c.paid && c.reference) ? "Awaiting verification" : "All");
  const [newTrainer, setNewTrainer] = useState(emptyTrainer);
  const [addingTrainer, setAddingTrainer] = useState(false);
  const [newClient, setNewClient] = useState(emptyClient);
  const [addingClient, setAddingClient] = useState(false);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [noticeError, setNoticeError] = useState(false);
  const [pending, startTransition] = useTransition();
  const [price, setPrice] = useState(settings.price);
  const [whatsapp, setWhatsapp] = useState(settings.whatsapp ? `+${settings.whatsapp}` : "");
  // Server actions re-check the role; the refreshed clients arrive as new props.
  const run = (action: () => Promise<{ok?: string; error?: string}>) => startTransition(async () => {
    const result = await action();
    setNoticeError(!result.ok);
    setNotice(result.ok ?? result.error ?? "");
  });
  const dueCheckIns = clients.filter(c => c.stage === "Check-in due");
  const search = query.trim().toLowerCase();
  const matches = (c: ClientRow) => !search || [c.name, c.email ?? "", c.phone ?? ""].some(v => v.toLowerCase().includes(search));
  const visible = clients
    .filter(c => matches(c) && (statusFilter === "All statuses" || clientStatus(c) === statusFilter) && (trainerFilter === "All trainers" || (trainerFilter === "Unassigned" ? !c.trainerId : c.trainerId === trainerFilter)))
    .sort(sorters[sort]);
  const filtered = query !== "" || trainerFilter !== "All trainers" || statusFilter !== "All statuses";
  const clearFilters = () => {setQuery(""); setTrainerFilter("All trainers"); setStatusFilter("All statuses");};
  const openTab = (key: string) => {
    setNotice("");
    if (detail) { router.push(`/${role}?tab=${key}`); return; }
    setTab(key);
    router.replace(`/${role}?tab=${key}`, {scroll: false});
    // A new tab starts at its top, not wherever the previous tab was scrolled to.
    window.scrollTo({top: 0, behavior: "instant"});
    requestAnimationFrame(() => document.querySelector<HTMLElement>("main h1")?.focus({preventScroll: true}));
  };
  const current = detail ? detailTab : tab;
  const [title, subtitle] = headings[role === "trainer" && tab === "clients" ? "members" : tab];
  const clientHref = (c: ClientRow) => `/${role}/clients/${c.id}`;
  const money = (n: number) => `${n.toLocaleString("en-AE")} ${settings.currency}`;

  /* ---------- Clients ---------- */
  const roster = <section className="card">
    <div className="section-top"><h2>{admin ? "All clients" : "Your assigned members"}</h2><span className="pill">{visible.length} SHOWN</span></div>
    <div className="filters rc-roster-filters">
      <input type="search" aria-label="Search clients by name" placeholder="Search by name…" value={query} onChange={e => setQuery(e.target.value)}/>
      {admin && <select aria-label="Filter clients by status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option>All statuses</option>{clientStatuses.map(s => <option key={s}>{s}</option>)}</select>}
      {admin && <>
        <select aria-label="Filter clients by trainer" value={trainerFilter} onChange={e => setTrainerFilter(e.target.value)}><option>All trainers</option>{trainers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}<option>Unassigned</option></select>
        <select aria-label="Sort clients" value={sort} onChange={e => setSort(e.target.value)}>{Object.keys(sorters).map(k => <option key={k} value={k}>Sort: {k}</option>)}</select>
      </>}
      {filtered && <button type="button" className="small-button" onClick={clearFilters}>Clear filters</button>}
    </div>
    <div className="table-scroll"><table className="rc-cards"><thead><tr><th>Client</th>{admin ? <th>Trainer</th> : <th>Goal</th>}<th>This week</th><th>{admin ? "Joined" : "Last workout"}</th>{admin && <th>Status</th>}</tr></thead><tbody>
      {visible.map(c => <tr key={c.id}>
        <td data-label="Client"><Link className="client-name rc-client-link" href={clientHref(c)}><span className="avatar">{c.initials}</span><span><b>{c.name}</b>{c.email && <small>{c.email}</small>}</span></Link>{!c.intake && <span className="pill rc-pill-warn" title="Profile completes when the member answers the onboarding questions">Profile incomplete</span>}</td>
        {admin
          ? <td data-label="Trainer"><select className="rc-inline-select" aria-label={`Trainer for ${c.name}`} value={c.trainerId ?? ""} disabled={pending} onChange={e => {const trainerId = e.target.value; run(() => assignTrainer(c.id, trainerId));}}><option value="">Unassigned</option>{trainers.filter(t => t.active || t.id === c.trainerId).map(t => <option key={t.id} value={t.id}>{t.name}{t.active ? "" : " (inactive)"}</option>)}</select></td>
          : <td data-label="Goal">{c.goal}</td>}
        <td data-label="This week">{c.weekPlanned
          ? <><progress max={c.weekPlanned} value={c.weekDone} aria-label={`${c.name}: ${c.weekDone} of ${c.weekPlanned} workouts done this week`}/><small>{c.weekDone} of {c.weekPlanned} workouts · {c.progress}%</small></>
          : <small className="rc-muted">No plan this week</small>}</td>
        <td data-label={admin ? "Joined" : "Last workout"}>{admin ? formatDate(c.joinedOn) : c.lastWorkout}</td>
        {admin && <td data-label="Status"><StatusPill client={c}/></td>}
      </tr>)}
      {visible.length === 0 && <tr className="member-empty-row"><td colSpan={admin ? 5 : 4} data-label="">{clients.length === 0 ? "No clients yet." : "No clients match this view. Try another filter or search."}</td></tr>}
    </tbody></table></div>
  </section>;

  const addClientModal = <Modal open={addingClient} eyebrow="CLIENTS" title="Add a client" onClose={() => setAddingClient(false)}>
    <p>Creates their sign-in. They start unassigned until you pick a trainer, and sign in with Google using this email, or with the password you set.</p>
    <form className="rc-modal-form" onSubmit={e => {e.preventDefault(); run(async () => {const result = await addClient(newClient); if (result.ok) {setNewClient(emptyClient); setAddingClient(false);} return result;});}}>
      <label className="field">Full name<input value={newClient.name} onChange={e => setNewClient({...newClient, name: e.target.value})} required maxLength={60} autoComplete="off"/></label>
      <div className="rc-modal-row">
        <label className="field">Email (Google account)<input type="email" value={newClient.email} onChange={e => setNewClient({...newClient, email: e.target.value})} required autoComplete="off"/></label>
        <label className="field">Phone (optional)<input type="tel" value={newClient.phone} onChange={e => setNewClient({...newClient, phone: e.target.value})} maxLength={20} autoComplete="off"/></label>
      </div>
      <div className="rc-modal-row">
        <label className="field">Goal<input value={newClient.goal} onChange={e => setNewClient({...newClient, goal: e.target.value})} maxLength={60} placeholder="e.g. Build strength"/></label>
        <label className="field">Trainer<select value={newClient.trainerId} onChange={e => setNewClient({...newClient, trainerId: e.target.value})}><option value="">Unassigned</option>{trainers.filter(t => t.active).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      </div>
      <label className="field">Password (optional)<PasswordInput value={newClient.password} onChange={e => setNewClient({...newClient, password: e.target.value})} minLength={10} autoComplete="new-password" placeholder="Blank sends an invitation link"/></label>
      {notice && noticeError && <p className="rc-modal-error" role="alert">{notice}</p>}
      <button className="button dark" type="submit" disabled={pending}>{pending ? "Adding…" : "Add client"} →</button>
    </form>
  </Modal>;

  /* ---------- Payments ---------- */
  const paymentViews = ["Awaiting verification", "Not submitted", "Verified", "All"];
  const paymentCount = (v: string) => v === "All" ? clients.length : clients.filter(c => paymentStatus(c) === v).length;
  const paymentRows = clients.filter(c => paymentView === "All" || paymentStatus(c) === paymentView).sort(sorters.Newest);
  const verifiedCount = paymentCount("Verified");
  const payments = !PAYMENTS_ENABLED ? <section className="card rc-locked">
    <span className="rc-locked-icon" aria-hidden="true"><Icon name="lock" size={26}/></span>
    <span className="pill">PHASE 2</span>
    <h2>Payments are locked for now.</h2>
    <p>Online payments and payment verification arrive in phase 2. Until then, clients start straight in onboarding, and each client’s status is Unassigned, Assigned or Cancelled.</p>
    <button type="button" className="button dark" onClick={() => openTab("clients")}>See client statuses →</button>
  </section> : <>
    <div className="three-grid metrics">
      <section className="card"><span className="eyebrow">Verified revenue</span><strong>{money(verifiedCount * Number(settings.price))}</strong><small>{verifiedCount} verified payment{verifiedCount === 1 ? "" : "s"}</small></section>
      <section className="card"><span className="eyebrow">Awaiting verification</span><strong>{paymentCount("Awaiting verification")}</strong><small>References to check</small></section>
      <section className="card"><span className="eyebrow">Not submitted</span><strong>{paymentCount("Not submitted")}</strong><small>No payment reference yet</small></section>
    </div>
    <section className="card">
      <div className="section-top"><h2>Payments</h2><span className="pill">{money(Number(settings.price))} PER 30 DAYS</span></div>
      <div className="rc-segmented" role="group" aria-label="Show payments">{paymentViews.map(v => <button key={v} type="button" aria-pressed={paymentView === v} onClick={() => setPaymentView(v)}>{v}<span>{paymentCount(v)}</span></button>)}</div>
      <div className="table-scroll"><table className="rc-cards"><thead><tr><th>Client</th><th>Amount</th><th>Reference</th><th>Joined</th><th>Status</th><th><span className="visually-hidden">Actions</span></th></tr></thead><tbody>
        {paymentRows.map(c => {const status = paymentStatus(c); return <tr key={c.id}>
          <td data-label="Client"><Link className="client-name rc-client-link" href={clientHref(c)}><span className="avatar">{c.initials}</span><span><b>{c.name}</b>{c.email && <small>{c.email}</small>}</span></Link></td>
          <td data-label="Amount">{money(Number(settings.price))}</td>
          <td data-label="Reference">{c.reference ? <code className="rc-ref">{c.reference}</code> : <span className="rc-muted">—</span>}</td>
          <td data-label="Joined">{formatDate(c.joinedOn)}</td>
          <td data-label="Status"><span className="rc-pay-status" data-status={paymentKey(status)}>{status}</span></td>
          <td data-label="" className="rc-row-actions">{!c.paid && c.reference && <button className="small-button dark" disabled={pending} onClick={() => run(() => verifyPayment(c.id))}>Verify</button>}<MembershipEditor client={c} pending={pending} run={run}/></td>
        </tr>;})}
        {paymentRows.length === 0 && <tr className="member-empty-row"><td colSpan={6} data-label="">{paymentView === "Awaiting verification" ? "Nothing to verify. All caught up." : "No payments in this view."}</td></tr>}
      </tbody></table></div>
      <p className="small-note">Clients pay by bank transfer and submit the transaction reference from their profile. Use Edit membership to record a payment yourself.</p>
    </section>
  </>;

  /* ---------- Trainers ---------- */
  const trainerList = <section className="card">
    <div className="section-top"><h2>Coaching team</h2><span className="pill">{trainers.length} TRAINER{trainers.length === 1 ? "" : "S"}</span></div>
    {trainers.length === 0 ? <p className="rc-staff-empty">No trainers yet. Add your first trainer to start assigning clients.</p>
      : <div className="table-scroll"><table className="rc-cards"><thead><tr><th>Trainer</th><th>Email</th><th>Clients</th><th>Workouts this week</th><th>Status</th></tr></thead><tbody>
        {trainers.map(t => <tr key={t.id}>
          <td data-label="Trainer"><Link className="client-name rc-client-link" href={`/admin/trainers/${t.id}`}><span className="avatar">{t.initials}</span><span><b>{t.name}</b><small>{t.title}</small></span></Link></td>
          <td data-label="Email">{t.email}</td>
          <td data-label="Clients">{t.clients}</td>
          <td data-label="Workouts this week">{t.workoutsPlanned ? `${t.workoutsDone} of ${t.workoutsPlanned} · ${t.completion}%` : <span className="rc-muted">None planned</span>}</td>
          <td data-label="Status"><span className="rc-pay-status" data-status={t.active ? "verified" : "not-submitted"}>{t.active ? "Active" : "Deactivated"}</span></td>
        </tr>)}
      </tbody></table></div>}
  </section>;

  const addTrainerModal = <Modal open={addingTrainer} eyebrow="TRAINERS" title="Add a trainer" onClose={() => setAddingTrainer(false)}>
    <p>The trainer signs in with Google using this email. Add a password too if they don’t use Google.</p>
    <form className="rc-modal-form" onSubmit={e => {e.preventDefault(); run(async () => {const result = await addTrainer(newTrainer); if (result.ok) {setNewTrainer(emptyTrainer); setAddingTrainer(false);} return result;});}}>
      <label className="field">Full name<input value={newTrainer.name} onChange={e => setNewTrainer({...newTrainer, name: e.target.value})} required maxLength={40} autoComplete="off"/></label>
      <label className="field">Email (Google account)<input type="email" value={newTrainer.email} onChange={e => setNewTrainer({...newTrainer, email: e.target.value})} required autoComplete="off"/></label>
      <label className="field">Role title<input value={newTrainer.title} onChange={e => setNewTrainer({...newTrainer, title: e.target.value})} maxLength={40}/></label>
      <label className="field">Password (optional)<PasswordInput value={newTrainer.password} onChange={e => setNewTrainer({...newTrainer, password: e.target.value})} minLength={10} autoComplete="new-password" placeholder="Blank sends an invitation link"/></label>
      {notice && noticeError && <p className="rc-modal-error" role="alert">{notice}</p>}
      <button className="button dark" type="submit" disabled={pending}>{pending ? "Adding…" : "Add trainer"} →</button>
    </form>
  </Modal>;

  /* ---------- Overview ---------- */
  const trainerPerformance = admin && trainers.length > 0 && <section className="card rc-trainer-performance" aria-labelledby="rc-trainer-performance">
    <div className="section-top"><h2 id="rc-trainer-performance">Trainer performance</h2><span className="pill">THIS WEEK</span></div>
    <div className="rc-trainer-perf-grid">
      <div><h3>Workout completion</h3><BarChart label="Share of planned workouts done this week, per trainer" unit="percent" color={palette.sage} bars={trainers.map(t => ({label: t.name, value: t.completion, planned: 100}))} format={n => `${n}%`} emptyLabel="0%" rowLabel="Trainer"/></div>
      <div><h3>Clients active in the last 7 days</h3><BarChart label="Share of each trainer’s clients who trained in the last 7 days" unit="percent" color={palette.lilac} bars={trainers.map(t => ({label: t.name, value: t.clients ? Math.round((t.activeWeek / t.clients) * 100) : 0, planned: 100}))} format={n => `${n}%`} emptyLabel="0%" rowLabel="Trainer"/></div>
    </div>
  </section>;

  const unassigned = clients.filter(c => !c.trainerId);
  const awaiting = clients.filter(c => paymentStatus(c) === "Awaiting verification");
  const incomplete = clients.filter(c => !c.intake);
  const cancelledCount = clients.filter(c => c.cancelled).length;
  const attention: [number, string, string, string, () => void][] = [
    [PAYMENTS_ENABLED ? awaiting.length : 0, "payment reference to verify", "payment references to verify", "Review payments", () => {setPaymentView("Awaiting verification"); openTab("payments");}],
    [unassigned.length, "client without a trainer", "clients without a trainer", "Assign trainers", () => {setTrainerFilter("Unassigned"); openTab("clients");}],
    [dueCheckIns.length, "check-in waiting for review", "check-ins waiting for review", "See clients", () => openTab("clients")],
    [incomplete.length, "client hasn’t finished onboarding", "clients haven’t finished onboarding", "See clients", () => openTab("clients")],
  ];
  const newest = [...clients].sort(sorters.Newest).slice(0, 5);
  const activeTrainers = trainers.filter(t => t.active).length;
  const trainedThisWeek = clients.filter(c => c.weekDone > 0).length;
  const adminMetrics: [string, string, string][] = [
    [String(clients.length), "Clients", `${clients.filter(c => clientStatus(c) === "Assigned").length} assigned · ${clients.filter(c => clientStatus(c) === "Unassigned").length} unassigned`],
    PAYMENTS_ENABLED ? [money(verifiedCount * Number(settings.price)), "Verified revenue", `${verifiedCount} of ${clients.length} paid`]
      : [String(clients.length - cancelledCount), "Active memberships", `${cancelledCount} cancelled`],
    [String(activeTrainers), "Trainers", `${clients.length - unassigned.length} of ${clients.length} clients assigned`],
    [String(trainedThisWeek), "Trained this week", `${clients.filter(c => c.weekPlanned > 0).length} of ${clients.length} have a plan`],
  ];
  const overview = <>
    <div className="rc-kpis">{adminMetrics.map(([v, l, sub]) => <section className="card" key={l}><span className="eyebrow">{l}</span><strong>{v}</strong><small>{sub}</small></section>)}</div>
    <div className="two-grid equal rc-overview-grid">
      <section className="card"><div className="section-top"><h2>Needs your attention</h2></div>
        {attention.every(([n]) => n === 0) ? <p className="rc-staff-empty">Nothing waiting. All caught up.</p>
          : <ul className="rc-attention">{attention.filter(([n]) => n > 0).map(([n, one, many, action, go]) => <li key={one}><strong>{n}</strong><span>{n === 1 ? one : many}</span><button type="button" className="small-button" onClick={go}>{action} →</button></li>)}</ul>}
      </section>
      <section className="card"><div className="section-top"><h2>Newest clients</h2><button type="button" className="small-button" onClick={() => {setSort("Newest"); openTab("clients");}}>All clients →</button></div>
        {newest.length === 0 ? <p className="rc-staff-empty">No clients yet.</p>
          : <ul className="rc-mini-list">{newest.map(c => <li key={c.id}><Link className="client-name rc-client-link" href={clientHref(c)}><span className="avatar">{c.initials}</span><span><b>{c.name}</b><small>{c.trainer === "Unassigned" ? "No trainer yet" : c.trainer} · joined {formatDate(c.joinedOn)}</small></span></Link>{PAYMENTS_ENABLED ? <span className="rc-pay-status" data-status={paymentKey(paymentStatus(c))}>{paymentStatus(c)}</span> : <StatusPill client={c}/>}</li>)}</ul>}
      </section>
    </div>
    <StaffInsights clients={clients}/>
    {trainerPerformance}
    <section className="card"><div className="section-top"><h2>Recent activity</h2><span className="pill">AUDIT LOG</span></div>{activity.length === 0 ? <p className="rc-staff-empty">No admin or trainer actions yet.</p> : <ul className="rc-staff-activity">{activity.map((a, i) => <li key={i}><b>{activityLabels[a.action] ?? a.action}</b><span>{a.detail} · by {a.actor}</span><time dateTime={a.at.replace(" ", "T") + "Z"}>{a.at.slice(0, 16)} UTC</time></li>)}</ul>}</section>
  </>;

  /* ---------- Trainer home ---------- */
  const checkIns = <section className="card">
    <div className="section-top"><h2>Check-ins to review</h2><span className="pill">{dueCheckIns.length} WAITING</span></div>
    {dueCheckIns.length === 0
      ? <p className="rc-staff-empty">All caught up. Nice work.</p>
      : <ul className="rc-staff-list">{dueCheckIns.map(c => <li key={c.id}>
        <span className="avatar">{c.initials}</span>
        <div><b>{c.name}</b><small>{c.goal} · last workout {c.lastWorkout.toLowerCase()} · {c.nextCheckIn}</small>{c.checkinNote && <small className="rc-staff-note">“{c.checkinNote}”</small>}</div>
        <button className="button dark" disabled={pending} onClick={() => run(() => reviewCheckin(c.id))}>Mark reviewed</button>
      </li>)}</ul>}
  </section>;
  const trainerMetrics: [string, string][] = [[String(clients.length), "Clients assigned to you"], [String(clients.filter(c => c.lastWorkout === "Today").length), "Trained today"], [String(dueCheckIns.length), "Check-ins waiting"]];

  /* ---------- Settings ---------- */
  const settingsPage = <div className="rc-settings">
    <section className="rc-settings-row">
      <div className="rc-settings-intro"><h2>Pricing</h2><p>What a 30-day programme costs. Members see a new price on their profile straight away.</p></div>
      <div className="card">
        <form className="rc-settings-form" onSubmit={e => {e.preventDefault(); run(() => saveSettings({price}));}}>
          <label className="field">Price per 30 days<span className="rc-input-affix"><input inputMode="numeric" value={price} onChange={e => setPrice(e.target.value)} required/><span>{settings.currency}</span></span></label>
          <dl className="rc-settings-facts"><div><dt>Currency</dt><dd>AED (UAE dirham)</dd></div><div><dt>Payments</dt><dd>{PAYMENTS_ENABLED ? "Bank transfer, verified by an admin" : "Coming in phase 2"}</dd></div></dl>
          <div className="rc-settings-actions"><button className="button dark" type="submit" disabled={pending || price === settings.price}>{pending ? "Saving…" : "Save price"}</button></div>
        </form>
      </div>
    </section>
    <section className="rc-settings-row">
      <div className="rc-settings-intro"><h2>WhatsApp</h2><p>Adds a WhatsApp chat button to the public website. Visitors tap it to message this number.</p></div>
      <div className="card">
        <form className="rc-settings-form" onSubmit={e => {e.preventDefault(); run(() => saveWhatsApp({number: whatsapp}));}}>
          <label className="field">WhatsApp number (with country code)<input type="tel" inputMode="tel" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="+971 50 123 4567" autoComplete="off"/></label>
          <p className="small-note">{settings.whatsapp ? <>The button is live and opens <a href={`https://wa.me/${settings.whatsapp}`} target="_blank" rel="noreferrer">wa.me/{settings.whatsapp}</a>. Clear the number to remove it.</> : "No number yet, so the website shows no WhatsApp button."}</p>
          <div className="rc-settings-actions"><button className="button dark" type="submit" disabled={pending || whatsapp.replace(/[\s()+.-]/g, "") === settings.whatsapp}>{pending ? "Saving…" : "Save number"}</button></div>
        </form>
      </div>
    </section>
    {mail && <section className="rc-settings-row">
      <div className="rc-settings-intro"><h2>Email</h2><p>The Resend account RepCount sends notifications from, and a log of recent emails.</p></div>
      <EmailSettings status={mail.status} recent={mail.recent} selfEmail={user.email} pending={pending} run={run}/>
    </section>}
    <section className="rc-settings-row">
      <div className="rc-settings-intro"><h2>Your password</h2><p>Changing it signs you out on every other device.</p></div>
      <ChangePassword hasPassword={admins.find(a => a.email === user.email)?.canUsePassword ?? true} pending={pending} run={run}/>
    </section>
  </div>;

  const headingAction = admin && tab === "clients" ? <button type="button" className="button dark" onClick={() => {setNotice(""); setAddingClient(true);}}><Icon name="plus" size={16}/> Client</button>
    : admin && tab === "trainers" ? <button type="button" className="button dark" onClick={() => {setNotice(""); setAddingTrainer(true);}}><Icon name="plus" size={16}/> Trainer</button>
    : null;

  return <div className="app rc-member rc-staff">
    <aside className="sidebar">
      <span className="brand"><Brand/></span>
      <div className="workspace-label">{admin ? "ADMIN" : "TRAINER WORKSPACE"}</div>
      <nav aria-label={admin ? "Admin navigation" : "Trainer navigation"}>{tabs[role].map(([key, icon, label, short]) => <button key={key} title={label} className={current === key ? "nav active" : "nav"} aria-current={current === key ? "page" : undefined} onClick={() => openTab(key)}><span aria-hidden="true"><Icon name={icon} size={20}/></span><span className="nav-label">{label}</span><span className="nav-short" aria-hidden="true">{short}</span>{key === "checkins" && dueCheckIns.length > 0 && <small>{dueCheckIns.length}</small>}{key === "payments" && (PAYMENTS_ENABLED ? awaiting.length > 0 && <small>{awaiting.length}</small> : <small className="rc-nav-lock" title="Coming in phase 2"><Icon name="lock" size={12}/></small>)}</button>)}</nav>
      <div className="sidebar-bottom"><form action={logout}><button type="submit" className="rc-sidebar-logout"><Icon name="logout" size={18}/> Log out</button></form></div>
    </aside>
    <div className="content">
      <header className="topbar"><span className="rc-topbar-status" role="status">{pending ? "Saving…" : ""}</span>
        <div className="rc-topbar-user"><div><b>{user.name}</b><small>{user.email}</small></div><span className="top-avatar" aria-hidden="true">{user.initials}</span><form action={logout} className="rc-topbar-logout"><button type="submit" aria-label="Log out"><Icon name="logout" size={18}/></button></form></div>
      </header>
      <main id="main">
        {detail ?? <>
        <div className="page-heading rc-page-heading"><div><p className="eyebrow">{admin ? "ADMIN" : `TRAINER · ${user.name.toUpperCase()}`}</p><h1 tabIndex={-1}>{title}</h1><p>{subtitle}</p></div>{headingAction}</div>
        {notice && <div className={noticeError ? "notice notice-error" : "notice"} role={noticeError ? "alert" : "status"}>{notice}<button onClick={() => setNotice("")} aria-label="Dismiss notification"><Icon name="close" size={18}/></button></div>}
        {tab === "overview" && overview}
        {tab === "today" && <>
          <div className="three-grid metrics">{trainerMetrics.map(([v, l]) => <section className="card" key={l}><span className="eyebrow">{l}</span><strong>{v}</strong></section>)}</div>
          <section className="rc-staff-hero"><Photo src="https://images.pexels.com/photos/6455927/pexels-photo-6455927.jpeg?auto=compress&cs=tinysrgb&w=1400" alt="Trainer encouraging a client between gym exercises" sizes="(max-width: 700px) 100vw, 75vw"/><div><span>COACH’S NOTE</span><h2>Great coaching is noticing<br/>the rep they almost skipped.</h2></div></section>
          {checkIns}
        </>}
        {tab === "clients" && <>{roster}{admin && addClientModal}</>}
        {tab === "payments" && admin && payments}
        {tab === "checkins" && checkIns}
        {tab === "trainers" && admin && <>{trainerList}{addTrainerModal}</>}
        {tab === "admins" && admin && <AdminAccounts admins={admins} selfEmail={user.email} pending={pending} run={run}/>}
        {tab === "blog" && admin && <BlogAdmin posts={posts} pending={pending} run={run}/>}
        {tab === "settings" && admin && settingsPage}
        </>}
      </main>
    </div>
  </div>;
}
