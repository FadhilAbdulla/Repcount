import type {Metadata} from "next";
import {memberPage} from "../../../../memberPage";

export const metadata: Metadata = {title: "Workout plan — RepCount"};

/** The admin plans or corrects a client's weeks, the same way their trainer does. `?week=` picks the week. */
export default async function AdminClientWorkouts({params, searchParams}: {params: Promise<{id: string}>; searchParams: Promise<{week?: string}>}) {
  const [{id}, {week}] = await Promise.all([params, searchParams]);
  return memberPage("admin", id, "workouts", {week});
}
