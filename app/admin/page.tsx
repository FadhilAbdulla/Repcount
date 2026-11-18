import type {Metadata} from "next";
import {requireRole} from "@/lib/dal";
import {getSettings, listClients, recentAudit, trainerAnalytics} from "@/lib/store";
import {listAdmins} from "@/lib/users";
import {mailStatus, recentEmails} from "@/lib/mail";
import {listPosts} from "@/lib/blog";
import {staffPages} from "../staffPages";
import StaffApp from "../StaffApp";

export const metadata: Metadata = {title: "Super admin — RepCount"};

export default async function AdminPage({searchParams}: {searchParams: Promise<{tab?: string; month?: string}>}) {
  const user = await requireRole("admin");
  const {tab, month} = await searchParams;
  const [clients, settings, activity, trainers, admins, mail, sentEmails, posts] = await Promise.all([listClients(), getSettings(), recentAudit(tab === "activity" ? 100 : 0), trainerAnalytics(), listAdmins(), mailStatus(), recentEmails(), listPosts({publishedOnly: false})]);
  const pages = await staffPages("admin", user.id, tab, month);
  return <StaffApp area="admin" user={{name: user.name, initials: user.initials, email: user.email}} clients={clients} settings={settings} activity={activity} trainers={trainers} admins={admins} mail={{status: mail, recent: sentEmails}} initialTab={tab} posts={posts} pages={pages}/>;
}
