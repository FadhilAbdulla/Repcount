"use client";

import {useState} from "react";
import Link from "next/link";
import {Icon} from "./Media";
import {saveSchedule} from "./actions/data";
import {dayNames, daySlugs, templates, type PlannedWorkout, type WeekPlan} from "@/lib/schedule";
import type {ClientRow} from "@/lib/store";
import type {SavedWorkout} from "@/lib/workoutLibrary";
import {formatExercises, parseExercises, type Exercise, type ExerciseItem} from "@/lib/exercises";
import WorkoutBuilder from "./workouts/WorkoutBuilder";
import type {Run} from "./useAction";
type Week = {start: string; label: string};
/** `kind` is "Rest day", "saved:<id>" for one of the trainer's workouts, or "current" for a planned workout that isn't in their list. */
type DraftDay = {kind: string; title: string; items: ExerciseItem[]; duration: string};

const rest: DraftDay = {kind: "Rest day", title: "", items: [], duration: ""};
const toDraft = (w: PlannedWorkout | null): DraftDay => w
  ? {kind: "current", title: w.title, items: parseExercises(w.exercises), duration: w.durationMin ? String(w.durationMin) : ""}
  : rest;
// Session times and meeting links live in Sessions now, so a planned day only describes the workout.
const toWorkout = (d: DraftDay): PlannedWorkout | null => d.kind === "Rest day" ? null : {
  title: d.title.trim(), exercises: formatExercises(d.items), time: null,
  durationMin: d.duration ? Number(d.duration) : null, meetingUrl: null,
};
const emptyWeek: WeekPlan = Array(7).fill(null);
const dateOf = (week: string, i: number, opts: Intl.DateTimeFormatOptions = {day: "numeric", month: "short"}) => new Date(Date.parse(`${week}T00:00:00Z`) + i * 86400000).toLocaleDateString("en-GB", {...opts, timeZone: "UTC"});
const isoOf = (week: string, i: number) => new Date(Date.parse(`${week}T00:00:00Z`) + i * 86400000).toISOString().slice(0, 10);
const plansKey = (client: ClientRow, week: string) => `${client.id}|${week}`;
/** The workout pages live under whichever area is planning: /trainer/clients/<id>/workouts or /admin/clients/<id>/workouts. */
export const workoutsPath = (clientId: string, area: "trainer" | "admin" = "trainer") => `/${area}/clients/${clientId}/workouts`;

/**
 * The Workout plan page for one member: pick a week and see the seven days as cards.
 * Each card opens that day's own page to edit it; whole-week shortcuts save straight away.
 */
export function WeekOverview({client, weeks, week, plans, today, pending, run, area = "trainer"}: {
  area?: "trainer" | "admin"; client: ClientRow; weeks: Week[]; week: string; plans: Record<string, WeekPlan | null>; today: string; pending: boolean; run: Run;
}) {
  const saved = plans[plansKey(client, week)] ?? null;
  const days = saved ?? emptyWeek;
  const weekIndex = weeks.findIndex(w => w.start === week);
  const previous = weekIndex > 0 ? plans[plansKey(client, weeks[weekIndex - 1].start)] : null;
  const workouts = days.filter(Boolean).length;
  // The rhythm the member chose at onboarding, e.g. "3 days a week" → 3.
  const preferred = client.intake ? Number(/\d+/.exec(client.intake.days)?.[0] ?? NaN) || null : null;
  const firstName = client.name.split(" ")[0];
  const base = workoutsPath(client.id, area);
  // Shortcuts replace the saved week, so ask before overwriting workouts that are already there.
  const replace = (plan: WeekPlan, what: string) => {
    if (workouts > 0 && !window.confirm(`${what} replaces the ${workouts} workout${workouts === 1 ? "" : "s"} already planned for this week. Continue?`)) return;
    run(() => saveSchedule(client.id, week, plan));
  };
  const quickFill = days.map((d, i) => [0, 2, 4].includes(i) ? {title: "Full-body foundations", exercises: templates["Full-body foundations"].exercises, time: d?.time ?? "18:00", durationMin: 25, meetingUrl: d?.meetingUrl ?? null} : null);

  return <>
    <nav className="rc-week-tabs" aria-label="Choose a week">
      {weeks.map(w => <Link key={w.start} href={`${base}?week=${w.start}`} aria-current={w.start === week ? "page" : undefined}>
        <b>{w.label.split(" · ")[0]}</b><small>{w.label.includes(" · ") ? w.label.split(" · ")[1] : "from " + dateOf(w.start, 0)}{plans[plansKey(client, w.start)] ? " · planned" : ""}</small>
      </Link>)}
    </nav>

    <section className="card rc-schedule">
      <div className="section-top"><h2>{firstName}’s week</h2><span className="pill">{workouts} WORKOUT{workouts === 1 ? "" : "S"}{saved ? "" : " · NOT SCHEDULED"}</span></div>
      {client.intake && <p className="rc-week-preference" role="note"><b>{firstName} prefers {client.intake.days.replace(" a week", "")} a week · {client.intake.place.toLowerCase()}.</b>{preferred !== null && workouts > 0 && workouts !== preferred && <> This week has {workouts} workout{workouts === 1 ? "" : "s"}. Worth agreeing the rhythm together.</>}</p>}
      <p className="small-note">Open a day to plan it. {firstName} sees saved days on their plan straight away.</p>
      <ol className="rc-week-days">{days.map((w, i) => {
        const iso = isoOf(week, i);
        return <li key={i}><Link href={`${base}/${week}/${daySlugs[i]}`} className={w ? undefined : "rest"} aria-label={`${dayNames[i]} ${dateOf(week, i)}: ${w ? w.title : "rest day"}. Edit`}>
          <span className="rc-week-day-top"><b>{dayNames[i]}</b><small>{dateOf(week, i)}{iso === today ? " · today" : ""}</small></span>
          {w ? <>
            <strong>{w.title}</strong>
            <small>{[w.durationMin && `${w.durationMin} min`, `${w.exercises.length} exercise${w.exercises.length === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}</small>
          </> : <><strong>Rest day</strong><small>Tap to plan a workout</small></>}
          <span className="rc-week-edit">{w ? "Edit" : "Plan"} <Icon name="arrow" size={14}/></span>
        </Link></li>;
      })}</ol>
    </section>

    <div className="two-grid equal rc-detail-grid">
      <section className="card rc-schedule">
        <h2>Week shortcuts</h2>
        <p className="small-note">These save the whole week at once.</p>
        <div className="rc-schedule-tools">
          {previous && <button type="button" className="small-button" disabled={pending} onClick={() => replace(previous, "Copying last week")}>Copy last week</button>}
          <button type="button" className="small-button" disabled={pending} onClick={() => replace(quickFill, "Quick fill")}>Quick fill: Mon · Wed · Fri</button>
          {workouts > 0 && <button type="button" className="small-button" disabled={pending} onClick={() => replace(emptyWeek, "Clearing the week")}>Clear week</button>}
        </div>
      </section>
      <section className="card rc-schedule"><h2>Live sessions</h2><p className="small-note">Check-in calls and live workouts with {firstName} are booked on the Sessions tab, with a calendar invite for both of you.</p><Link className="button outline" href={`/${area}/clients/${client.id}/sessions`}><Icon name="video" size={16}/> Open Sessions</Link></section>
    </div>
  </>;
}

/** One day of a member's week on its own page. Saving keeps the rest of the week as it is. */
export function DayEditor({client, weeks, week, day, plans, saved: library = [], exercises = [], pending, run, area = "trainer"}: {
  area?: "trainer" | "admin"; client: ClientRow; weeks: Week[]; week: string; day: number; plans: Record<string, WeekPlan | null>;
  /** The trainer's saved workouts (Trainer → Workouts). */
  saved?: SavedWorkout[];
  /** The exercise library (RepCount's plus the trainer's own) for the workout builder. */
  exercises?: Exercise[]; pending: boolean; run: Run;
}) {
  const saved = plans[plansKey(client, week)] ?? emptyWeek;
  const [d, setD] = useState<DraftDay>(() => {
    const draft = toDraft(saved[day]);
    const match = library.find(w => w.name === draft.title);
    return draft.kind === "current" && match ? {...draft, kind: `saved:${match.id}`} : draft;
  });
  const update = (change: Partial<DraftDay>) => setD({...d, ...change});
  const choose = (kind: string) => {
    if (kind === "Rest day") { setD(rest); return; }
    const w = library.find(x => `saved:${x.id}` === kind);
    if (w) update({kind, title: w.name, items: parseExercises(w.exercises), duration: d.duration || String(templates[w.name]?.durationMin ?? "")});
  };
  const base = workoutsPath(client.id, area);
  const weekLabel = weeks.find(w => w.start === week)?.label ?? `Week of ${dateOf(week, 0)}`;
  const sibling = (i: number) => i >= 0 && i < 7 && <Link className="small-button" href={`${base}/${week}/${daySlugs[i]}`}>{i < day ? "← " : ""}{dayNames[i]}{i > day ? " →" : ""}</Link>;

  return <section className="card rc-schedule rc-day-editor">
    <Link className="rc-back-link" href={`${base}?week=${week}`}>← {weekLabel}</Link>
    <div className="section-top"><h2>{dayNames[day]}, {dateOf(week, day, {weekday: undefined, day: "numeric", month: "long"})}</h2><span className="pill">{saved[day] ? "PLANNED" : "REST DAY"}</span></div>
    <form onSubmit={e => {e.preventDefault(); run(() => saveSchedule(client.id, week, saved.map((w, i) => i === day ? toWorkout(d) : w)));}}>
      <label><span>Workout</span><select value={d.kind} onChange={e => choose(e.target.value)}>
        <option>Rest day</option>
        {d.kind === "current" && <option value="current">{d.title}</option>}
        {library.map(w => <option key={w.id} value={`saved:${w.id}`}>{w.name}</option>)}
      </select></label>
      {area === "trainer" && <p className="small-note">Add, edit or remove workouts in <Link href="/trainer?tab=workouts">Workouts</Link>. You can still change the exercises, sets and reps below for this day.</p>}
      {d.kind !== "Rest day" && <>
        <label><span>Title</span><input value={d.title} onChange={e => update({title: e.target.value})} maxLength={60} required/></label>
        <label><span>About how many minutes</span><input type="number" min={5} max={240} step={5} value={d.duration} onChange={e => update({duration: e.target.value})}/></label>
        <div className="rc-day-exercises"><span className="rc-field-label">Exercises</span>
          <WorkoutBuilder items={d.items} onChange={items => update({items})} library={exercises} canAddExercises={area === "trainer"}/></div>
      </>}
      <div className="rc-day-actions">
        <button className="button dark" type="submit" disabled={pending}>{pending ? "Saving…" : `Save ${dayNames[day]}`}</button>
        <span>{sibling(day - 1)}{sibling(day + 1)}</span>
      </div>
    </form>
  </section>;
}
