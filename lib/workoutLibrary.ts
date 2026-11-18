import "server-only";
import {db} from "./db";
import {templates} from "./schedule";

/** A trainer's saved workout: a name and its exercises, one per line. */
export type SavedWorkout = {id: number; trainerId: string; name: string; exercises: string[]};

/** Exercises as stored (one per line), cleaned: no blank lines, at most 30 lines of 120 characters. */
export const exerciseLines = (text: string) => text.split("\n").map(l => l.trim().slice(0, 120)).filter(Boolean).slice(0, 30);

/**
 * A trainer's workouts. The first time, their list is started with the RepCount templates (lib/schedule.ts), which they can
 * then edit or delete like their own; a flag in settings stops deleted templates coming back.
 * A client without a trainer gets the templates themselves (negative ids) so the admin can still plan their days.
 */
export async function listSavedWorkouts(trainerId: string | null): Promise<SavedWorkout[]> {
  if (!trainerId) return Object.entries(templates).map(([name, t], i) => ({id: -(i + 1), trainerId: "", name, exercises: t.exercises}));
  const sql = await db();
  const flag = `workouts_seeded:${trainerId}`;
  const [seeded] = await sql`select 1 from settings where key = ${flag}`;
  if (!seeded) await sql.begin(async tx => {
    for (const [name, t] of Object.entries(templates)) {
      await tx`insert into workout_templates (trainer_id, name, exercises) values (${trainerId}, ${name}, ${t.exercises.join("\n")}) on conflict (trainer_id, name) do nothing`;
    }
    await tx`insert into settings (key, value) values (${flag}, '1') on conflict (key) do nothing`;
  });
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
