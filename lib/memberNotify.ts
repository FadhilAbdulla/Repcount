import "server-only";
import type {ClientRow, MemberSave} from "./store";
import {listAdmins, listTrainers} from "./users";
import {sendLater} from "./mail";
import {emails} from "./emails";

/*
 * Who to email about a client, and the emails a member's own actions send to staff.
 * Shared by the web server actions (app/actions/*) and the mobile API (app/api/mobile).
 */

/** The member as an email recipient. */
export const memberOf = (c: ClientRow) => ({id: c.id, name: c.name, email: c.email});
export const activeAdmins = async () => (await listAdmins()).filter(a => a.active);

/** The client's trainer, if they have an active one. */
export async function trainerOf(c: ClientRow) {
  return c.trainerId ? (await listTrainers()).find(t => t.id === c.trainerId && t.active) ?? null : null;
}

/** Who hears about a member's question or check-in: their trainer, or every admin while they have none. */
export async function coachesOf(c: ClientRow) {
  const trainer = await trainerOf(c);
  return trainer ? {people: [trainer], area: "trainer" as const} : {people: await activeAdmins(), area: "admin" as const};
}

export async function notifyMemberSave(client: ClientRow, save: MemberSave) {
  if (save.checkinNote) {
    const {people, area} = await coachesOf(client);
    sendLater(...people.map(p => emails.checkinSubmitted(p, memberOf(client), save.checkinNote!, area)));
  }
  if (save.paymentReference) sendLater(...(await activeAdmins()).map(a => emails.paymentReference(a, memberOf(client), save.paymentReference!)));
}

export async function notifyQuestion(client: ClientRow, text: string) {
  const {people, area} = await coachesOf(client);
  sendLater(...people.map(p => emails.question(p, memberOf(client), text, area)));
}
