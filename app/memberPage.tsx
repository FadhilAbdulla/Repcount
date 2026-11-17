import {notFound} from "next/navigation";
import {requireRole} from "@/lib/dal";
import {istToday} from "@/lib/dates";
import {daySlugs, planningWeeks} from "@/lib/schedule";
import {clientDetail, confirmedDays, getMemberLog, getNutritionPlan, getWeekPlans} from "@/lib/store";
import {listTrainers} from "@/lib/users";
import {healthForClient} from "@/lib/health";
import {shiftDay} from "@/lib/streak";
import ClientDetail, {type MemberSection} from "./ClientDetail";

/**
 * One section of a member's page (overview, workouts, nutrition or progress) for their trainer or the admin. Each section is
 * its own URL and loads only what it shows. A trainer only opens their own members (anyone else's is a 404); the admin opens
 * every client and also gets the admin controls. Workouts take an optional `week` (one of the four planning weeks) and
 * `day` slug, which opens that single day's editor.
 */
export async function memberPage(viewer: "trainer" | "admin", id: string, section: MemberSection, at: {week?: string; day?: string} = {}) {
  const user = await requireRole(viewer);
  const admin = viewer === "admin";
  const {day: today, weekStart} = istToday();
  const weeks = planningWeeks(weekStart);
  const week = weeks.find(w => w.start === at.week)?.start;
  const day = at.day === undefined ? undefined : daySlugs.indexOf(at.day);
  if (at.day !== undefined && (!week || day === -1)) notFound();
  // Everything loads in one go (the database is a long round trip away); nothing is shown until access is checked.
  const [detail, plans, nutrition, confirmed, trainers, log, health] = await Promise.all([
    clientDetail(id),
    section === "workouts" ? getWeekPlans([id], weeks.map(w => w.start)) : {},
    section === "overview" || section === "nutrition" ? getNutritionPlan(id) : null,
    section === "overview" ? confirmedDays(id, weekStart, today) : [],
    admin ? listTrainers() : [],
    admin && section === "progress" ? getMemberLog(id) : null,
    section === "progress" ? healthForClient(id, shiftDay(today, -13)) : null,
  ]);
  if (!detail || (!admin && detail.client.trainerId !== user.id)) notFound();
  // The sidebar, header and tabs around this come from the [id] layout (ClientShell), so only this part loads per section.
  return <ClientDetail viewer={viewer} section={section} detail={detail} log={log} health={health} trainers={trainers.filter(t => t.active || t.id === detail.client.trainerId).map(t => ({id: t.id, name: t.name}))}
    coaching={{weeks, plans, nutrition, confirmed, today, week: week ?? weeks[0].start, day}}/>;
}
