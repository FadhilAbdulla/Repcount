import "server-only";
import type {ClientRow, MemberSave} from "./store";
import {listAdmins, listTrainers} from "./users";
import {sendLater} from "./mail";
import {emails} from "./emails";

/*
 * The emails a member's own actions send to staff. Used by the mobile API (app/api/mobile). The web server actions in
 * app/actions/data.ts send the same emails with their own copy of these helpers.
 */
const memberOf = (c: ClientRow) => ({id: c.id, name: c.name, email: c.email});
const activeAdmins = async () => (await listAdmins()).filter(a => a.active);

/** Who hears about a member's question or check-in: their trainer, or every admin while they have none. */
async function coachesOf(c: ClientRow) {
  const trainer = c.trainerId ? (await listTrainers()).find(t => t.id === c.trainerId && t.active) ?? null : null;
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
