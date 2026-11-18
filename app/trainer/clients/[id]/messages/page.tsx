import type {Metadata} from "next";
import {memberPage} from "../memberPage";

export const metadata: Metadata = {title: "Messages — RepCount"};

/** The member’s questions and the replies. */
export default async function TrainerClientMessages({params}: {params: Promise<{id: string}>}) {
  return memberPage((await params).id, "messages");
}
