import {notFound} from "next/navigation";
import {requireRole} from "@/lib/dal";
import {getClient, getSettings, listClients, trainerAnalytics} from "@/lib/store";
import StaffApp from "./StaffApp";
import ClientHeader from "./ClientHeader";

/**
 * The frame around a client's pages (/admin/clients/[id]/… and /trainer/clients/[id]/…): sidebar, top bar, the client's
 * header and the section tabs. It lives in the [id] layout, so moving between Overview, Workout plan, Nutrition and
 * Progress keeps it on screen and only the section below it loads (see the loading.tsx next to each layout).
 * It also checks access before anything streams, so an unknown or unassigned client is a real 404.
 */
export default async function ClientShell({viewer, id, children}: {viewer: "admin" | "trainer"; id: string; children: React.ReactNode}) {
  const user = await requireRole(viewer);
  const admin = viewer === "admin";
  const [client, clients, settings, trainers] = await Promise.all([getClient(id), listClients(admin ? undefined : user.id), getSettings(), admin ? trainerAnalytics() : []]);
  if (!client || (!admin && client.trainerId !== user.id)) notFound();
  return <StaffApp area={viewer} user={{name: user.name, initials: user.initials, email: user.email}} clients={clients} settings={settings} activity={[]} trainers={trainers} detailTab="clients"
    detail={<><ClientHeader viewer={viewer} client={client}/>{children}</>}/>;
}
