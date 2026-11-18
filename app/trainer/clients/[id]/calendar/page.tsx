import type {Metadata} from "next";
import {memberPage} from "../memberPage";

export const metadata: Metadata = {title: "Calendar — RepCount"};

/** A month of the member’s sessions, workouts and nutrition. */
export default async function TrainerClientCalendar({params, searchParams}: {params: Promise<{id: string}>; searchParams: Promise<{month?: string}>}) {
  return memberPage((await params).id, "calendar", {month: (await searchParams).month});
}
