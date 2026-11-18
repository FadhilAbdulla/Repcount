"use client";

/*
 * Builds a workout from the exercise library: search, add an exercise, then set its sets and reps (or time).
 * Rows can be reordered and removed. A trainer can add a new exercise to their library from the search box.
 * Used by Trainer → Workouts (saved workouts) and the day editor (a client's planned day).
 */
import {useId, useState, useTransition} from "react";
import type {Exercise, ExerciseItem} from "@/lib/exercises";
import {Icon} from "../Media";
import {addExercise} from "../actions/exercises";
import "./workouts.css";

const MAX_ROWS = 30;

export default function WorkoutBuilder({items, onChange, library, canAddExercises}: {
  items: ExerciseItem[]; onChange: (items: ExerciseItem[]) => void; library: Exercise[];
  /** Trainers can add new exercises to their library; the admin picks from what's there. */
  canAddExercises: boolean;
}) {
  const [query, setQuery] = useState("");
  const [extra, setExtra] = useState<Exercise[]>([]);
  const [error, setError] = useState("");
  const [adding, startAdding] = useTransition();
  const listId = useId();
  const all = [...library, ...extra.filter(e => !library.some(l => l.id === e.id))];
  const q = query.trim().toLowerCase();
  const matches = q ? all.filter(e => e.name.toLowerCase().includes(q)).slice(0, 8) : [];
  const exact = all.some(e => e.name.toLowerCase() === q);

  const set = (i: number, change: Partial<ExerciseItem>) => onChange(items.map((it, j) => j === i ? {...it, ...change} : it));
  const move = (i: number, by: number) => {
    const j = i + by;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const add = (name: string) => {
    if (items.length >= MAX_ROWS) { setError(`A workout can have up to ${MAX_ROWS} exercises.`); return; }
    onChange([...items, {name, sets: "3", reps: "10"}]);
    setQuery("");
    setError("");
  };
  const create = () => startAdding(async () => {
    const r = await addExercise(query);
    if (r.error || !r.exercise) { setError(r.error ?? "Couldn’t add that exercise."); return; }
    setExtra(e => [...e, r.exercise!]);
    add(r.exercise.name);
  });

  return <div className="rc-builder">
    {items.length === 0 ? <p className="small-note">No exercises yet. Search below to add the first one.</p>
      : <ol className="rc-builder-rows">{items.map((it, i) => <li key={i}>
        <span className="rc-builder-num" aria-hidden="true">{i + 1}</span>
        <span className="rc-builder-name">{it.name}</span>
        <label className="rc-builder-field"><span>Sets</span><input inputMode="numeric" value={it.sets} maxLength={2} onChange={e => set(i, {sets: e.target.value.replace(/\D/g, "")})} aria-label={`Sets for ${it.name}`}/></label>
        <label className="rc-builder-field rc-builder-reps"><span>Reps or time</span><input value={it.reps} maxLength={30} placeholder="10 · 30 s · 8 each leg" onChange={e => set(i, {reps: e.target.value})} aria-label={`Reps or time for ${it.name}`}/></label>
        <span className="rc-builder-tools">
          <button type="button" className="small-button" aria-label={`Move ${it.name} up`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
          <button type="button" className="small-button" aria-label={`Move ${it.name} down`} disabled={i === items.length - 1} onClick={() => move(i, 1)}>↓</button>
          <button type="button" className="small-button" aria-label={`Remove ${it.name}`} onClick={() => onChange(items.filter((_, j) => j !== i))}><Icon name="close" size={14}/></button>
        </span>
      </li>)}</ol>}

    <div className="rc-builder-search">
      <label className="field"><span>Add an exercise</span>
        <input type="search" value={query} onChange={e => { setQuery(e.target.value); setError(""); }} placeholder="Search, e.g. squat, plank, row"
          aria-controls={listId} aria-autocomplete="list" autoComplete="off"
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (matches[0]) add(matches[0].name); else if (q && canAddExercises) create(); } }}/>
      </label>
      {q && <ul id={listId} className="rc-builder-matches" aria-label="Matching exercises">
        {matches.map(m => <li key={m.id}><button type="button" onClick={() => add(m.name)}><Icon name="plus" size={14}/> {m.name}{m.own && <small> · yours</small>}</button></li>)}
        {!exact && canAddExercises && <li><button type="button" className="rc-builder-new" disabled={adding} onClick={create}><Icon name="plus" size={14}/> {adding ? "Adding…" : `Add “${query.trim()}” as a new exercise`}</button></li>}
        {matches.length === 0 && !canAddExercises && <li className="small-note">No exercise called “{query.trim()}”.</li>}
      </ul>}
      {error && <p className="rc-modal-error" role="alert">{error}</p>}
    </div>
  </div>;
}
