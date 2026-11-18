import type {Metadata} from "next";
import {memberPage} from "../memberPage";

export const metadata: Metadata = {title: "Sessions — RepCount"};

/** Booked sessions with the member: introduction call, weekly check-ins and live workouts. */
export default async function TrainerClientSessions({params}: {params: Promise<{id: string}>}) {
  return memberPage((await params).id, "sessions");
}
