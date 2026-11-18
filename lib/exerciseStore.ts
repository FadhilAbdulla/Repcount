import "server-only";
import {db} from "./db";
import {builtInExercises, type Exercise} from "./exercises";

/** Adds RepCount's starter exercises once (new ones in later releases are added too; names already there are kept). */
let seeded: Promise<void> | null = null;
function seedBuiltIns() {
  return seeded ??= (async () => {
    const sql = await db();
    await sql`insert into exercises (trainer_id, name) select null, n from unnest(${builtInExercises}::text[]) as n
      on conflict (coalesce(trainer_id, ''), lower(name)) do nothing`;
  })().catch(error => { seeded = null; throw error; });
}

/** RepCount's exercises plus the trainer's own, A–Z. */
export async function listExercises(trainerId: string | null): Promise<Exercise[]> {
  await seedBuiltIns();
  const sql = await db();
  const rows = await sql<{id: string; name: string; own: boolean}[]>`
    select id, name, trainer_id is not null as own from exercises
    where trainer_id is null ${trainerId ? sql`or trainer_id = ${trainerId}` : sql``} order by lower(name)`;
  return rows.map(r => ({id: Number(r.id), name: r.name, own: r.own}));
}

/** Adds one of the trainer's own exercises; returns the existing one when the name is already in their library. */
export async function addExercise(trainerId: string, name: string): Promise<Exercise> {
  await seedBuiltIns();
  const sql = await db();
  const [existing] = await sql<{id: string; name: string; own: boolean}[]>`
    select id, name, trainer_id is not null as own from exercises where (trainer_id is null or trainer_id = ${trainerId}) and lower(name) = lower(${name}) limit 1`;
  if (existing) return {id: Number(existing.id), name: existing.name, own: existing.own};
  const [row] = await sql<{id: string}[]>`insert into exercises (trainer_id, name) values (${trainerId}, ${name}) returning id`;
  return {id: Number(row.id), name, own: true};
}

/** Removes one of the trainer's own exercises. Workouts already using it keep it (they store the name). */
export async function deleteExercise(trainerId: string, id: number) {
  const sql = await db();
  return (await sql`delete from exercises where id = ${id} and trainer_id = ${trainerId} returning id`).length > 0;
}
