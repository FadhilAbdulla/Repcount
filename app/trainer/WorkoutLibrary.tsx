"use client";

/*
 * Trainer → Workouts: the workouts the trainer picks from when planning a client's day (the RepCount templates start the
 * list; they can edit or delete them), built from exercises with sets and reps; and the trainer's own exercises.
 */
import {useState} from "react";
import type {SavedWorkout} from "@/lib/workoutLibrary";
import {formatExercises, parseExercises, type Exercise, type ExerciseItem} from "@/lib/exercises";
import {Icon} from "../Media";
import Modal from "../Modal";
import {deleteWorkout, saveWorkout} from "../actions/workouts";
import {deleteExercise} from "../actions/exercises";
import {useAction} from "../useAction";
import WorkoutBuilder from "../workouts/WorkoutBuilder";
import "../sessions/calendar.css";

type Draft = {id?: number; name: string; items: ExerciseItem[]};
const empty: Draft = {name: "", items: []};

export default function WorkoutLibrary({workouts, exercises}: {workouts: SavedWorkout[]; exercises: Exercise[]}) {
  const {pending, run, notice} = useAction();
  const [editing, setEditing] = useState<Draft | null>(null);
  const own = exercises.filter(e => e.own);
  const save = (d: Draft) => run(() => saveWorkout({id: d.id, name: d.name, exercises: formatExercises(d.items).join("\n")}), r => { if (r.ok) setEditing(null); });
  return <>
    {notice}
    <section className="card">
      <div className="section-top"><h2>Your workouts</h2><button type="button" className="button dark" onClick={() => setEditing(empty)}><Icon name="plus" size={16}/> Workout</button></div>
      <p className="small-note">The workouts you pick from when you plan a client’s day. The RepCount templates are here to start you off. Edit or delete them, and add your own.</p>
      {workouts.length === 0 ? <p className="rc-staff-empty">No workouts yet. Add your first, e.g. “Lower body A”.</p>
        : <ul className="rc-workout-library">{workouts.map(w => <li key={w.id}>
          <div><h3>{w.name}</h3><p>{`${w.exercises.length} exercise${w.exercises.length === 1 ? "" : "s"} · ${w.exercises.slice(0, 3).join(" · ")}${w.exercises.length > 3 ? " …" : ""}`}</p></div>
          <div className="rc-session-actions">
            <button type="button" className="small-button" onClick={() => setEditing({id: w.id, name: w.name, items: parseExercises(w.exercises)})}>Edit</button>
            <button type="button" className="small-button" disabled={pending} onClick={() => { if (confirm(`Delete “${w.name}”?`)) run(() => deleteWorkout(w.id)); }}>Delete</button>
          </div>
        </li>)}</ul>}
    </section>

    <section className="card">
      <div className="section-top"><h2>Your exercises</h2><span className="pill">{exercises.length} IN YOUR LIBRARY</span></div>
      <p className="small-note">RepCount’s exercises are always there. Add your own from the search box while you build a workout; they appear here.</p>
      {own.length === 0 ? <p className="rc-staff-empty">You haven’t added any exercises yet.</p>
        : <ul className="rc-exercise-chips">{own.map(e => <li key={e.id}>{e.name}
          <button type="button" aria-label={`Remove ${e.name}`} disabled={pending} onClick={() => { if (confirm(`Remove “${e.name}” from your exercises?`)) run(() => deleteExercise(e.id)); }}><Icon name="close" size={14}/></button>
        </li>)}</ul>}
    </section>

    <Modal open={!!editing} eyebrow="WORKOUTS" title={editing?.id ? "Edit workout" : "New workout"} onClose={() => setEditing(null)}>
      {editing && <form className="rc-modal-form" onSubmit={e => { e.preventDefault(); save(editing); }}>
        <label className="field">Name<input required maxLength={60} value={editing.name} onChange={e => setEditing({...editing, name: e.target.value})} placeholder="e.g. Lower body A"/></label>
        <WorkoutBuilder items={editing.items} onChange={items => setEditing({...editing, items})} library={exercises} canAddExercises/>
        <button className="button dark" type="submit" disabled={pending || editing.items.length === 0}>{pending ? "Saving…" : "Save workout"}</button>
      </form>}
    </Modal>
  </>;
}
