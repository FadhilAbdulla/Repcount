import type {Metadata} from "next";
import {memberPage} from "../../../../memberPage";

export const metadata: Metadata = {title: "Progress — RepCount"};

/** The member's logged progress and history; the admin can also correct what the member logged. */
export default async function AdminClientProgress({params}: {params: Promise<{id: string}>}) {
  return memberPage("admin", (await params).id, "progress");
}
