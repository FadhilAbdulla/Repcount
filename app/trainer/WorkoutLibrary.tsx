"use client";

/* Trainer → Workouts: the trainer's own named workouts, to put on any member's day in one click (Workout plan → day). */
import {useState} from "react";
import type {SavedWorkout} from "@/lib/workoutLibrary";
import {Icon} from "../Media";
import Modal from "../Modal";
import {deleteWorkout, saveWorkout} from "../actions/workouts";
import {useAction} from "../useAction";
import "../sessions/calendar.css";

type Draft = {id?: number; name: string; exercises: string};
const empty: Draft = {name: "", exercises: ""};

export default function WorkoutLibrary({workouts}: {workouts: SavedWorkout[]}) {
  const {pending, run, notice} = useAction();
  const [editing, setEditing] = useState<Draft | null>(null);
  return <>
    {notice}
    <section className="card">
      <div className="section-top"><h2>Your workouts</h2><button type="button" className="button dark" onClick={() => setEditing(empty)}><Icon name="plus" size={16}/> Workout</button></div>
      <p className="small-note">Save the workouts you use often. When you plan a member’s day, pick one from the list instead of typing it again.</p>
      {workouts.length === 0 ? <p className="rc-staff-empty">No saved workouts yet. Add your first, e.g. “Lower body A”.</p>
        : <ul className="rc-workout-library">{workouts.map(w => <li key={w.id}>
          <div><h3>{w.name}</h3><p>{`${w.exercises.length} exercise${w.exercises.length === 1 ? "" : "s"} · ${w.exercises.slice(0, 3).join(" · ")}${w.exercises.length > 3 ? " …" : ""}`}</p></div>
          <div className="rc-session-actions">
            <button type="button" className="small-button" onClick={() => setEditing({id: w.id, name: w.name, exercises: w.exercises.join("\n")})}>Edit</button>
            <button type="button" className="small-button" disabled={pending} onClick={() => { if (confirm(`Delete “${w.name}”?`)) run(() => deleteWorkout(w.id)); }}>Delete</button>
          </div>
        </li>)}</ul>}
    </section>
    <Modal open={!!editing} eyebrow="WORKOUTS" title={editing?.id ? "Edit workout" : "New workout"} onClose={() => setEditing(null)}>
      {editing && <form className="rc-modal-form" onSubmit={e => { e.preventDefault(); run(() => saveWorkout(editing), r => { if (r.ok) setEditing(null); }); }}>
        <label className="field">Name<input required maxLength={60} value={editing.name} onChange={e => setEditing({...editing, name: e.target.value})} placeholder="e.g. Lower body A"/></label>
        <label className="field">Exercises · one per line<textarea required rows={10} value={editing.exercises} onChange={e => setEditing({...editing, exercises: e.target.value})} placeholder={"Goblet squat · 3 × 10\nGlute bridge · 3 × 12\nPlank · 3 × 30 s"}/></label>
        <button className="button dark" type="submit" disabled={pending}>{pending ? "Saving…" : "Save workout"}</button>
      </form>}
    </Modal>
  </>;
}
