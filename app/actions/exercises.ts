"use server";

import {revalidatePath} from "next/cache";
import {requireRole} from "@/lib/dal";
import type {Result} from "@/lib/access";
import {addExercise as add, deleteExercise as remove} from "@/lib/exerciseStore";
import type {Exercise} from "@/lib/exercises";

/* A trainer's own exercises, on top of RepCount's library (Trainer → Workouts, or straight from the workout builder). */

export async function addExercise(name: string): Promise<Result & {exercise?: Exercise}> {
  const user = await requireRole("trainer");
  const clean = String(name ?? "").trim().replace(/\s+/g, " ");
  if (clean.length < 2 || clean.length > 60) return {error: "Exercise names are 2 to 60 characters."};
  if (clean.includes(" · ")) return {error: "Leave out the “·”; add sets and reps in the workout instead."};
  const exercise = await add(user.id, clean);
  revalidatePath("/trainer", "layout");
  return {ok: `“${exercise.name}” is in your exercises.`, exercise};
}

export async function deleteExercise(id: number): Promise<Result> {
  const user = await requireRole("trainer");
  if (!Number.isInteger(id) || !(await remove(user.id, id))) return {error: "Only your own exercises can be removed."};
  revalidatePath("/trainer", "layout");
  return {ok: "Exercise removed. Workouts that already use it keep it."};
}
