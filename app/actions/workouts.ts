"use server";

import {revalidatePath} from "next/cache";
import {requireRole} from "@/lib/dal";
import type {Result} from "@/lib/access";
import {deleteWorkout as remove, exerciseLines, saveWorkout as save} from "@/lib/workoutLibrary";

/* A trainer's own list of saved workouts (Trainer → Workouts). Only the trainer who owns a workout can change it. */

export async function saveWorkout(input: {id?: number; name: string; exercises: string}): Promise<Result> {
  const user = await requireRole("trainer");
  const name = String(input.name ?? "").trim();
  const exercises = exerciseLines(String(input.exercises ?? ""));
  if (name.length < 2 || name.length > 60) return {error: "Give the workout a name (up to 60 characters)."};
  if (!exercises.length) return {error: "Add at least one exercise, one per line."};
  if (!(await save(user.id, {id: input.id, name, exercises}))) return {error: `You already have a workout called “${name}”.`};
  revalidatePath("/trainer", "layout");
  return {ok: input.id ? `“${name}” saved.` : `“${name}” added to your workouts.`};
}

export async function deleteWorkout(id: number): Promise<Result> {
  const user = await requireRole("trainer");
  if (!Number.isInteger(id) || !(await remove(user.id, id))) return {error: "That workout no longer exists."};
  revalidatePath("/trainer", "layout");
  return {ok: "Workout deleted. Days already planned with it keep their exercises."};
}
