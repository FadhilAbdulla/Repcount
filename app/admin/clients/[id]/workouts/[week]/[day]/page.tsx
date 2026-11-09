import type {Metadata} from "next";
import {memberPage} from "../../../../../../memberPage";

export const metadata: Metadata = {title: "Plan a day — RepCount"};

export default async function AdminClientDay({params}: {params: Promise<{id: string; week: string; day: string}>}) {
  const {id, week, day} = await params;
  return memberPage("admin", id, "workouts", {week, day});
}
