import type {Metadata} from "next";
import {requireRole} from "@/lib/dal";
import {getSettings, listClients} from "@/lib/store";
import {staffPages} from "../staffPages";
import StaffApp from "../StaffApp";

export const metadata: Metadata = {title: "Trainer workspace — RepCount"};

export default async function TrainerPage({searchParams}: {searchParams: Promise<{tab?: string; month?: string}>}) {
  const user = await requireRole("trainer");
  const {tab, month} = await searchParams;
  // Trainers only ever receive their own assigned clients.
  const [clients, settings, pages] = await Promise.all([listClients(user.id), getSettings(), staffPages("trainer", user.id, tab, month)]);
  return <StaffApp area="trainer" user={{name: user.name, initials: user.initials, email: user.email}} clients={clients} settings={settings} activity={[]} initialTab={tab} pages={pages}/>;
}
