"use server";

import {coachAccess, refreshAll, type Result} from "@/lib/access";
import {emails, type SessionMail} from "@/lib/emails";
import {mailStatus, sendLater} from "@/lib/mail";
import {memberOf, trainerOf} from "@/lib/memberNotify";
import {istInstant} from "@/lib/dates";
import {sessionStatuses, validateSession, type Session, type SessionInput, type SessionStatus} from "@/lib/sessions";
import * as sessions from "@/lib/sessionStore";
import {audit, type ClientRow} from "@/lib/store";
import type {User} from "@/lib/users";

/* Sessions between a member and their trainer. The trainer manages their own members' sessions; an admin any member's. */

/** The access check for an existing session: the session plus the signed-in staff member and its client. */
async function sessionAccess(id: number): Promise<{error: string} | {user: User; client: ClientRow; session: Session}> {
  const session = Number.isInteger(id) ? await sessions.getSession(id) : null;
  if (!session) return {error: "That session no longer exists."};
  const access = await coachAccess(session.clientId);
  if ("error" in access && access.error) return {error: access.error};
  if (!("user" in access)) return {error: "That client isn’t assigned to you."};
  return {user: access.user, client: access.client, session};
}

/** Emails the member and their trainer (if they didn't make the change themselves) with a calendar invite. */
async function announce(change: "new" | "changed" | "cancelled", s: Session, client: ClientRow, actorId: string) {
  const trainer = await trainerOf(client);
  const sender = (await mailStatus()).from.match(/<([^>]+)>/)?.[1] ?? (await mailStatus()).from;
  const mail: SessionMail = {id: s.id, clientId: client.id, title: s.title, startsAt: s.startsAt, endsAt: s.endsAt, meetingUrl: s.meetingUrl,
    memberName: client.name, trainerName: trainer?.name ?? "the RepCount team", organizerEmail: sender, sequence: Math.floor(Date.now() / 1000)};
  sendLater(emails.session(memberOf(client), change, mail, "member"), trainer && trainer.id !== actorId ? emails.session(trainer, change, mail, "trainer") : null);
}

/** Books a session (no `id`) or saves changes to one. */
export async function saveSession(clientId: string, input: SessionInput, id?: number): Promise<Result> {
  const access = id ? await sessionAccess(id) : await coachAccess(clientId);
  if ("error" in access) return {error: access.error};
  const {user, client} = access;
  const clean = validateSession(input);
  if ("error" in clean) return clean;
  if (id) await sessions.updateSession(id, clean);
  const savedId = id ?? await sessions.createSession(client.id, clean, user.id);
  const saved = await sessions.getSession(savedId);
  if (saved) await announce(id ? "changed" : "new", saved, client, user.id);
  await audit(user.id, id ? "edit_session" : "add_session", `${clean.title} · ${client.name}`, client.id);
  refreshAll();
  return {ok: id ? "Session updated. The member has been emailed the new details." : `Session booked. ${client.name.split(" ")[0]} gets an email with a calendar invite.`};
}

/** Drag and drop on the calendar: same length, new day and start time (India time). */
export async function moveSession(id: number, date: string, start: string): Promise<Result> {
  const access = await sessionAccess(id);
  if ("error" in access) return {error: access.error};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(start)) return {error: "Choose a day and time."};
  if (access.session.status !== "scheduled") return {error: "Only scheduled sessions can be moved."};
  await sessions.moveSession(id, istInstant(date, start));
  const moved = await sessions.getSession(id);
  if (moved) await announce("changed", moved, access.client, access.user.id);
  await audit(access.user.id, "move_session", `${access.session.title} · ${access.client.name} → ${date} ${start}`, access.client.id);
  refreshAll();
  return {ok: "Session moved. The member has been emailed the new time."};
}

/** Marks a session completed, missed or cancelled (or back to scheduled). Cancelling emails a calendar cancellation. */
export async function setSessionStatus(id: number, status: SessionStatus): Promise<Result> {
  const access = await sessionAccess(id);
  if ("error" in access) return {error: access.error};
  if (!sessionStatuses.includes(status)) return {error: "Unknown status."};
  await sessions.setSessionStatus(id, status);
  if (status === "cancelled" && access.session.status !== "cancelled") await announce("cancelled", access.session, access.client, access.user.id);
  await audit(access.user.id, "session_status", `${access.session.title} · ${access.client.name} → ${status}`, access.client.id);
  refreshAll();
  return {ok: status === "cancelled" ? "Session cancelled. The member has been told." : "Session updated."};
}

/** Removes a session completely (for one booked by mistake). Scheduled ones are cancelled on the member's calendar first. */
export async function deleteSession(id: number): Promise<Result> {
  const access = await sessionAccess(id);
  if ("error" in access) return {error: access.error};
  if (access.session.status === "scheduled" && Date.parse(access.session.endsAt) > Date.now()) await announce("cancelled", access.session, access.client, access.user.id);
  await sessions.deleteSession(id);
  await audit(access.user.id, "delete_session", `${access.session.title} · ${access.client.name}`, access.client.id);
  refreshAll();
  return {ok: "Session deleted."};
}
