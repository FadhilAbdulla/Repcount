import "server-only";
import {istToday, monthGrid, addDays} from "@/lib/dates";
import {listSessions} from "@/lib/sessionStore";
import {listSavedWorkouts} from "@/lib/workoutLibrary";
import {listExercises} from "@/lib/exerciseStore";
import SessionsCalendar from "./trainer/SessionsCalendar";
import WorkoutLibrary from "./trainer/WorkoutLibrary";

/**
 * The staff pages that load their own data, built only for the tab being opened:
 * Sessions (trainer: their members; admin: everyone) and Workouts (trainer only).
 */
export async function staffPages(area: "trainer" | "admin", userId: string, tab?: string, month?: string) {
  if (tab === "sessions") {
    const {day: today} = istToday();
    const shown = /^\d{4}-\d{2}$/.test(month ?? "") ? month! : today.slice(0, 7);
    const {days} = monthGrid(shown);
    const sessions = await listSessions({trainerId: area === "trainer" ? userId : undefined,
      from: `${days[0]}T00:00:00+05:30`, to: `${addDays(days[days.length - 1], 1)}T00:00:00+05:30`});
    return {sessions: <SessionsCalendar area={area} month={shown} today={today} sessions={sessions}/>};
  }
  if (tab === "workouts" && area === "trainer") {
    const [workouts, exercises] = await Promise.all([listSavedWorkouts(userId), listExercises(userId)]);
    return {workouts: <WorkoutLibrary workouts={workouts} exercises={exercises}/>};
  }
  return {};
}
