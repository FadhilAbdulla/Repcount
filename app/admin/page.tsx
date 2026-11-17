import type {Metadata} from "next";
import {requireRole} from "@/lib/dal";
import {getSettings, listClients, recentAudit, trainerAnalytics} from "@/lib/store";
import {listAdmins} from "@/lib/users";
import {mailStatus, recentEmails} from "@/lib/mail";
import StaffApp from "../StaffApp";

export const metadata: Metadata = {title: "Super admin — RepCount"};

export default async function AdminPage({searchParams}: {searchParams: Promise<{tab?: string}>}) {
  const user = await requireRole("admin");
  const {tab} = await searchParams;
  const [clients, settings, activity, trainers, admins, mail, sentEmails] = await Promise.all([listClients(), getSettings(), recentAudit(), trainerAnalytics(), listAdmins(), mailStatus(), recentEmails()]);
  return <StaffApp area="admin" user={{name: user.name, initials: user.initials, email: user.email}} clients={clients} settings={settings} activity={activity} trainers={trainers} admins={admins} mail={{status: mail, recent: sentEmails}} initialTab={tab}/>;
}
