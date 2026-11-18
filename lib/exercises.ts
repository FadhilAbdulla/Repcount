/*
 * Exercises in a workout. Stored (and shown to members) as one line each, e.g. "Goblet squat · 3 × 10" or "Plank · 3 × 30 s";
 * the trainer edits them as rows of exercise, sets and reps (or time). Shared by the server and the pages.
 */

/** One row of a workout. `sets` may be empty (e.g. "Warm-up walk · 5 min"); `reps` is free text: "10", "8 each leg", "30 s". */
export type ExerciseItem = {name: string; sets: string; reps: string};
/** An exercise in the library. `own` = added by this trainer (they can remove it); otherwise a RepCount exercise. */
export type Exercise = {id: number; name: string; own: boolean};

/** "Goblet squat · 3 × 10" → {name: "Goblet squat", sets: "3", reps: "10"}. */
export function parseExercise(line: string): ExerciseItem {
  const [name, ...rest] = line.split(" · ");
  const detail = rest.join(" · ").trim();
  const m = /^(\d{1,2})\s*[×x]\s*(.+)$/.exec(detail);
  return m ? {name: name.trim(), sets: m[1], reps: m[2].trim()} : {name: name.trim(), sets: "", reps: detail};
}

/** The stored line for a row. */
export function formatExercise({name, sets, reps}: ExerciseItem) {
  const n = name.trim(), s = sets.trim(), r = reps.trim();
  if (!n) return "";
  return s && r ? `${n} · ${s} × ${r}` : r ? `${n} · ${r}` : s ? `${n} · ${s} sets` : n;
}

export const parseExercises = (lines: string[]) => lines.filter(l => l.trim()).map(parseExercise);
export const formatExercises = (items: ExerciseItem[]) => items.map(formatExercise).filter(Boolean);

/** RepCount's starter exercise library (trainers add their own on top). */
export const builtInExercises = [
  "Warm-up walk", "Easy march", "Arm circles", "Jumping jacks", "High knees", "Butt kicks",
  "Bodyweight squat", "Chair squat", "Goblet squat", "Sumo squat", "Split squat", "Reverse lunge", "Walking lunge", "Step-up",
  "Glute bridge", "Hip thrust", "Romanian deadlift", "Deadlift", "Calf raise", "Wall sit",
  "Push-up", "Incline push-up", "Wall push-up", "Knee push-up", "Dumbbell bench press", "Dumbbell row", "Bent-over row", "Lat pulldown",
  "Shoulder press", "Lateral raise", "Front raise", "Bicep curl", "Hammer curl", "Tricep dip", "Tricep extension",
  "Plank", "Side plank", "Dead bug", "Bird dog", "Crunch", "Bicycle crunch", "Russian twist", "Mountain climber", "Leg raise",
  "Burpee", "Skipping", "Battle ropes", "Cycling", "Treadmill walk", "Rowing machine",
  "Cat-cow", "Hip flexor stretch", "Hamstring stretch", "Quad stretch", "Child’s pose", "Thoracic rotations", "Deep breathing", "Cool-down stretch",
];
