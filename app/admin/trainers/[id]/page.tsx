import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {requireRole} from "@/lib/dal";
import {getSettings, listClients, trainerAnalytics} from "@/lib/store";
import StaffApp from "../../../StaffApp";
import TrainerDetail from "../../../TrainerDetail";

export const metadata: Metadata = {title: "Trainer details — RepCount"};

/** One trainer's details, numbers, account actions and clients. Unknown trainers are a real 404. */
export default async function AdminTrainerPage({params}: {params: Promise<{id: string}>}) {
  const [user, {id}] = await Promise.all([requireRole("admin"), params]);
  const [clients, settings, trainers] = await Promise.all([listClients(), getSettings(), trainerAnalytics()]);
  const trainer = trainers.find(t => t.id === id);
  if (!trainer) notFound();
  return <StaffApp area="admin" user={{name: user.name, initials: user.initials, email: user.email}} clients={clients} settings={settings} activity={[]} trainers={trainers} detailTab="trainers"
    detail={<TrainerDetail trainer={trainer} clients={clients.filter(c => c.trainerId === id).sort((a, b) => a.name.localeCompare(b.name))}/>}/>;
}
