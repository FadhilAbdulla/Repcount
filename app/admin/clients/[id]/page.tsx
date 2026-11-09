import type {Metadata} from "next";
import {memberPage} from "../../../memberPage";

export const metadata: Metadata = {title: "Client details — RepCount"};

/** A client's overview for the admin: membership, contact, coaching summary, messages and every admin control. */
export default async function ClientDetailPage({params}: {params: Promise<{id: string}>}) {
  return memberPage("admin", (await params).id, "overview");
}
