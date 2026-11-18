import "server-only";
import {db} from "./db";

/** A trainer's saved workout: a name and its exercises, one per line. */
export type SavedWorkout = {id: number; trainerId: string; name: string; exercises: string[]};

/** Exercises as stored (one per line), cleaned: no blank lines, at most 30 lines of 120 characters. */
export const exerciseLines = (text: string) => text.split("\n").map(l => l.trim().slice(0, 120)).filter(Boolean).slice(0, 30);

export async function listSavedWorkouts(trainerId: string | null): Promise<SavedWorkout[]> {
  if (!trainerId) return [];
  const sql = await db();
  const rows = await sql<{id: string; trainer_id: string; name: string; exercises: string}[]>`
    select id, trainer_id, name, exercises from workout_templates where trainer_id = ${trainerId} order by lower(name)`;
  return rows.map(r => ({id: Number(r.id), trainerId: r.trainer_id, name: r.name, exercises: exerciseLines(r.exercises)}));
}

/** Creates (no id) or renames/edits a saved workout. Returns false when the trainer already has one with that name. */
export async function saveWorkout(trainerId: string, input: {id?: number; name: string; exercises: string[]}) {
  const sql = await db();
  const exercises = input.exercises.join("\n");
  try {
    if (input.id) await sql`update workout_templates set name = ${input.name}, exercises = ${exercises}, updated_at = now() where id = ${input.id} and trainer_id = ${trainerId}`;
    else await sql`insert into workout_templates (trainer_id, name, exercises) values (${trainerId}, ${input.name}, ${exercises})`;
    return true;
  } catch (error) {
    if ((error as {code?: string}).code === "23505") return false; // unique (trainer_id, name)
    throw error;
  }
}

export async function deleteWorkout(trainerId: string, id: number) {
  const sql = await db();
  const rows = await sql`delete from workout_templates where id = ${id} and trainer_id = ${trainerId} returning id`;
  return rows.length > 0;
}
