"use client";

import {useTransition, useState} from "react";
import Link from "next/link";
import {Icon} from "./Media";
import {LineChart, palette} from "./Tracker";
import {activityLabels} from "./StaffApp";
import {assignTrainer, sendResetLink, setAccountActive, verifyPayment} from "./actions/data";
import {StaffConversation} from "./Conversation";
import type {ClientDetail as Detail, MemberLog} from "@/lib/store";
import {DeleteAccount, MemberLogEditor, MembershipEditor} from "./AdminEditors";
import {ageFrom, memberCode} from "@/lib/programme";
import {dayNames, formatTime, type WeekPlan} from "@/lib/schedule";
import type {NutritionPlan} from "@/lib/nutritionPlan";
import {DayEditor, WeekOverview} from "./ScheduleEditor";
import {NutritionPlanEditor, SessionChecklist} from "./TrainerTools";

/** What the assigned trainer can manage on a member's page: weekly workouts, nutrition and session completion. */
export type Coaching = {weeks: {start: string; label: string}[]; plans: Record<string, WeekPlan | null>; nutrition: NutritionPlan | null; confirmed: string[]; today: string; week: string; day?: number};

/* A trainer's member page is split into sections, each at its own URL under /trainer/clients/[id]. */
export type MemberSection = "overview" | "workouts" | "nutrition" | "progress";

const formatDate = (iso: string | null) => iso ? new Date(`${iso.length === 10 ? iso + "T00:00:00Z" : iso.replace(" ", "T") + "Z"}`).toLocaleDateString("en-GB", {day: "numeric", month: "short", year: "numeric", timeZone: "UTC"}) : "—";

const shortDate = (label: string) => /^\d{4}-\d{2}-\d{2}$/.test(label) ? formatDate(label).replace(/ \d{4}$/, "") : label;

/**
 * One client: profile, membership, coaching, saved progress and history, one `section` at a time with tabs between them.
 * The trainer manages coaching; the admin manages coaching too, and can also edit or delete every other record.
 */
export default function ClientDetail({viewer, section, detail, trainers, coaching, log = null}: {viewer: "admin" | "trainer"; section?: MemberSection; detail: Detail; trainers: {id: string; name: string}[]; coaching?: Coaching; log?: MemberLog | null}) {
  const {client: c, state, history, lastSaved, plan, pastWeeks, messages} = detail;
  const admin = viewer === "admin";
  const firstName = c.name.split(" ")[0];
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState("");
  const [noticeError, setNoticeError] = useState(false);
  const run = (action: () => Promise<{ok?: string; error?: string}>) => startTransition(async () => {
    const result = await action();
    setNoticeError(!result.ok);
    setNotice(result.ok ?? result.error ?? "");
  });
  const weights = (state?.tracker.weights ?? []).map(p => ({label: shortDate(p.label), value: p.value}));
  const latestWeight = weights.at(-1)?.value;
  const weightChange = latestWeight !== undefined && weights[0] ? Math.round((latestWeight - weights[0].value) * 10) / 10 : null;
  const base = `/${viewer}/clients/${c.id}`;
  const shows = (s: MemberSection) => !section || section === s;
  const scheduled = plan?.filter(Boolean).length ?? 0;

  return <>
    {notice && <div className={noticeError ? "notice notice-error" : "notice"} role={noticeError ? "alert" : "status"}>{notice}<button onClick={() => setNotice("")} aria-label="Dismiss notification"><Icon name="close" size={18}/></button></div>}


    {shows("overview") && <>
    <div className="three-grid metrics">
      <section className="card"><span className="eyebrow">This week</span><strong className={c.weekPlanned ? undefined : "rc-detail-small"}>{c.weekPlanned ? `${c.weekDone} of ${c.weekPlanned}` : "No plan yet"}</strong>{c.weekPlanned > 0 && <small>workouts done · {c.progress}%</small>}</section>
      <section className="card"><span className="eyebrow">Last workout</span><strong className="rc-detail-small">{c.lastWorkout}</strong></section>
      <section className="card"><span className="eyebrow">Next check-in</span><strong className="rc-detail-small">{c.nextCheckIn}</strong></section>
    </div>

    {coaching && <>
      <SessionChecklist clientId={c.id} firstName={firstName} plan={plan} weekStart={coaching.weeks[0].start} today={coaching.today}
        memberDone={state?.workout.completedDays ?? []} confirmed={coaching.confirmed} pending={pending} run={run}/>
      <div className="two-grid equal rc-detail-grid">
        <section className="card rc-plan-summary"><div className="section-top"><h2>Workout plan</h2><span className="pill">{plan ? `${scheduled} THIS WEEK` : "NOT SCHEDULED"}</span></div>
          <p className="small-note">{plan ? `${scheduled} workout${scheduled === 1 ? "" : "s"} planned this week${plan.some(w => w?.meetingUrl) ? ", with live-session links" : ""}.` : `${firstName}’s week isn’t planned yet.`} Check-in call link: {c.meetingUrl ? "set" : "not set"}.</p>
          <Link className="button outline" href={`${base}/workouts`}>{plan ? "Open workout plan" : "Plan this week"} <span><Icon name="arrow" size={16}/></span></Link></section>
        <section className="card rc-plan-summary"><div className="section-top"><h2>Nutrition plan</h2><span className="pill">{coaching.nutrition ? "SHARED" : "NOT SET"}</span></div>
          <p className="small-note">{coaching.nutrition ? [coaching.nutrition.calories && `${coaching.nutrition.calories} kcal`, coaching.nutrition.protein && `${coaching.nutrition.protein} g protein`, `${coaching.nutrition.meals.length} meal${coaching.nutrition.meals.length === 1 ? "" : "s"}`].filter(Boolean).join(" · ") : `No nutrition plan for ${firstName} yet.`}</p>
          <Link className="button outline" href={`${base}/nutrition`}>{coaching.nutrition ? "Open nutrition plan" : "Write a nutrition plan"} <span><Icon name="arrow" size={16}/></span></Link></section>
      </div>
      <div className="section-heading"><h2>Profile</h2></div>
    </>}

    <div className="two-grid equal rc-detail-grid">
      <section className="card"><h2>Contact &amp; account</h2><dl className="rc-detail-list">
        <div><dt>Email</dt><dd>{c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : "—"}</dd></div>
        <div><dt>Phone</dt><dd>{c.phone ? <a href={`tel:${c.phone.replace(/\s/g, "")}`}>{c.phone}</a> : "—"}</dd></div>
        <div><dt>Member ID</dt><dd>{memberCode(c.memberNo)}</dd></div>
        <div><dt>Date of birth</dt><dd>{c.bio?.dob ? `${formatDate(c.bio.dob)} · ${ageFrom(c.bio.dob)} years` : "—"}</dd></div>
        <div><dt>Gender</dt><dd>{c.bio?.gender ?? "—"}</dd></div>
        <div><dt>Height</dt><dd>{c.bio?.heightCm ? `${c.bio.heightCm} cm` : "—"}</dd></div>
        <div><dt>Member login</dt><dd>{!c.userId ? "No account yet" : c.accountActive ? "Active account" : "Deactivated"}{admin && c.userId && <> <button className="small-button" disabled={pending} onClick={() => run(() => setAccountActive(c.userId!, !c.accountActive, c.id))}>{c.accountActive ? "Deactivate" : "Reactivate"}</button>{c.accountActive && <button className="small-button" disabled={pending} onClick={() => run(() => sendResetLink(c.userId!, c.id))}>Send reset link</button>}</>}</dd></div>
        <div><dt>Last saved activity</dt><dd>{lastSaved ? `${lastSaved.slice(0, 16)} UTC` : "—"}</dd></div>
      </dl></section>

      <section className="card"><div className="section-top"><h2>Membership &amp; coaching</h2>{admin && <MembershipEditor client={c} pending={pending} run={run}/>}</div><dl className="rc-detail-list">
        <div><dt>Payment</dt><dd>{c.paid ? <span className="paid">Verified ✓</span> : !admin ? "Awaiting verification" : <button className="small-button" disabled={pending} onClick={() => run(() => verifyPayment(c.id))}>Verify {c.reference ?? "payment"}</button>}</dd></div>
        <div><dt>Payment reference</dt><dd>{c.reference ?? "—"}</dd></div>
        <div><dt>Trainer</dt><dd>{admin ? <select aria-label={`Trainer for ${c.name}`} value={c.trainerId ?? ""} disabled={pending} onChange={e => {const trainerId = e.target.value; run(() => assignTrainer(c.id, trainerId));}}><option value="">Unassigned</option>{trainers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select> : c.trainer}</dd></div>
        <div><dt>Trains</dt><dd>{c.intake ? `${c.intake.place} · ${c.intake.days}` : "—"}</dd></div>
        <div><dt>Latest check-in</dt><dd>{c.checkinNote ? `“${c.checkinNote}”` : "—"}</dd></div>
        <div><dt>Check-in call link</dt><dd>{c.meetingUrl ? <a href={c.meetingUrl} target="_blank" rel="noopener noreferrer">{c.meetingUrl}</a> : "Not set by trainer"}</dd></div>
      </dl></section>
    </div>

    <StaffConversation clientId={c.id} firstName={firstName} messages={messages} canReply={c.userId !== null} canDelete={admin} pending={pending} run={run}/>

    {admin && <section className="card rc-danger-zone"><h2>Delete client</h2>
      <p>Permanently removes {firstName} and everything stored about them. To pause access instead, use Deactivate under Contact &amp; account.</p>
      <DeleteAccount kind="client" id={c.id} name={c.name} pending={pending} run={run}/>
    </section>}

    </>}

    {section === "workouts" && coaching && (coaching.day === undefined
      ? <WeekOverview area={viewer} client={c} weeks={coaching.weeks} week={coaching.week} plans={coaching.plans} today={coaching.today} pending={pending} run={run}/>
      : <DayEditor area={viewer} key={`${coaching.week}-${coaching.day}`} client={c} weeks={coaching.weeks} week={coaching.week} day={coaching.day} plans={coaching.plans} pending={pending} run={run}/>)}

    {section === "nutrition" && coaching && <>
      <NutritionPlanEditor clientId={c.id} firstName={firstName} plan={coaching.nutrition} pending={pending} run={run}/>
      {state && <section className="card"><h2>What {firstName} logs</h2><dl className="rc-detail-list">
        <div><dt>Meals logged</dt><dd>{state.nutrition.logged.length}</dd></div>
        <div><dt>Meal preference</dt><dd>{state.nutrition.preference}</dd></div>
        <div><dt>Water today</dt><dd>{state.tracker.water} glasses</dd></div>
      </dl></section>}
    </>}

    {shows("progress") && <>
    {state ? <>
      <div className="section-heading"><h2>This week, from the member’s app</h2>{admin && log && coaching ? <MemberLogEditor clientId={c.id} firstName={firstName} log={log} today={coaching.today} pending={pending} run={run}/> : <span>SAVED AUTOMATICALLY</span>}</div>
      <div className="two-grid equal rc-detail-grid">
        <section className="card"><h2>Today’s tracker</h2><dl className="rc-detail-list rc-detail-two">
          <div><dt>Water</dt><dd>{state.tracker.water} glasses</dd></div>
          <div><dt>Steps</dt><dd>{state.tracker.steps.toLocaleString("en-IN")}</dd></div>
          <div><dt>Sleep</dt><dd>{state.tracker.sleep ? `${state.tracker.sleep} h` : "Not logged"}</dd></div>
          <div><dt>Mood</dt><dd>{state.tracker.mood ?? "Not logged"}</dd></div>
          <div><dt>Moved today</dt><dd>{state.tracker.trained ? "Yes" : "Not yet"}</dd></div>
          <div><dt>Booked check-in</dt><dd>{state.booking ?? "Not booked"}</dd></div>
        </dl></section>
        <section className="card"><h2>Workout &amp; check-in</h2><dl className="rc-detail-list">
          <div><dt>Workouts done this week</dt><dd>{state.workout.completedDays.length ? state.workout.completedDays.sort().map(i => dayNames[i]).join(", ") : "None yet"}</dd></div>
          <div><dt>Weekly check-in</dt><dd>{state.checkin.submitted ? `Energy ${state.checkin.energy.toLowerCase()} · ${state.checkin.planFit.toLowerCase()}` : "Not submitted"}</dd></div>
          <div><dt>Meals logged</dt><dd>{state.nutrition.logged.length} · {state.nutrition.preference} plan</dd></div>
        </dl></section>
      </div>
      <section className="card rc-detail-weight"><div className="section-top"><h2>Weight trend</h2><span className="pill">{latestWeight !== undefined ? `${latestWeight} KG${weightChange !== null ? ` · ${weightChange > 0 ? "+" : ""}${weightChange} KG` : ""}` : "NO ENTRIES"}</span></div>
        {weights.length > 1 && <LineChart points={weights} unit="kg" label={`${c.name} weight trend`} color={palette.red}/>}
      </section>
    </> : <section className="card"><h2>Member app activity</h2><p className="small-note">This client hasn’t been invited to the member app yet, so there are no tracker, workout or meal entries.</p></section>}

    {!coaching && <section className="card rc-detail-weight"><div className="section-top"><h2>This week’s schedule</h2><span className="pill">{plan ? `${plan.filter(Boolean).length} WORKOUTS` : "NOT SCHEDULED"}</span></div>
      {plan ? <dl className="rc-detail-list">{plan.map((w, i) => <div key={i}><dt>{dayNames[i]}</dt><dd>{w ? `${w.title}${w.time ? ` · ${formatTime(w.time)}` : ""}${w.durationMin ? ` · ${w.durationMin} min` : ""}${state?.workout.completedDays.includes(i) ? " · done ✓" : ""}${w.meetingUrl ? " · live link" : ""}` : "Rest"}</dd></div>)}</dl>
        : <p className="small-note">The trainer hasn’t scheduled this week yet. The member sees a “plan coming soon” message until they do.</p>}
    </section>}

    {pastWeeks.length > 0 && <section className="card"><div className="section-top"><h2>Past weeks</h2><span className="pill">{pastWeeks.length} WEEKS</span></div>
      <dl className="rc-detail-list">{pastWeeks.map(w => <div key={w.weekStart}><dt>Week of {formatDate(w.weekStart)}</dt><dd>{w.workoutsDone} workout{w.workoutsDone === 1 ? "" : "s"} done · {w.checkin ? `“${w.checkin}”` : "no check-in"}</dd></div>)}</dl>
    </section>}

    <section className="card"><div className="section-top"><h2>History</h2><span className="pill">{history.length} EVENTS</span></div>
      {history.length === 0 ? <p className="rc-staff-empty">No staff actions recorded for this client yet.</p>
        : <ul className="rc-staff-activity">{history.map((a, i) => <li key={i}><b>{activityLabels[a.action] ?? a.action}</b><span>{a.detail} · by {a.actor}</span><time dateTime={a.at.replace(" ", "T") + "Z"}>{a.at.slice(0, 16)} UTC</time></li>)}</ul>}
    </section>
    </>}
  </>;
}
