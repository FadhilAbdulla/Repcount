"use server";

import {randomBytes} from "node:crypto";
import {revalidatePath} from "next/cache";
import {requireRole, requireStaff} from "@/lib/dal";
import {istToday} from "@/lib/dates";
import * as store from "@/lib/store";
import {createUser, emailTaken, emailTakenByOther, findUser, initialsOf, listTrainers, setUserActive, updateStaffUser, updateTrainer} from "@/lib/users";
import {cleanMeetingUrl, planningWeeks, sanitizeWeekPlan} from "@/lib/schedule";
import {sanitizeNutritionPlan} from "@/lib/nutritionPlan";
import {genders, places, rhythms} from "@/lib/programme";
import {moods} from "@/lib/memberState";
import {shiftDay} from "@/lib/streak";
import {sendPasswordLink} from "@/lib/passwordTokens";
import {sendEmail, siteLink} from "@/lib/mail";

type Result = {ok?: string; error?: string};
const validEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;

/** The member's app autosaves here. A stale save (the admin corrected the log since the app loaded) returns {stale: true}. */
export async function saveProgress(input: unknown, revision?: number) {
  const user = await requireRole("member");
  return store.saveMemberState(user.id, input, typeof revision === "number" ? revision : undefined);
}

/** Coaching data (workouts, call links, session completions, nutrition) is managed by the client's trainer or the admin. */
async function coachAccess(clientId: string) {
  const user = await requireStaff();
  const client = await store.getClient(clientId);
  if (!client || (user.role === "trainer" && client.trainerId !== user.id)) return {error: "That client isn’t assigned to you."};
  return {user, client};
}

/** Revalidates every area that shows client data. */
function refreshAll() {
  revalidatePath("/admin", "layout");
  revalidatePath("/trainer", "layout");
  revalidatePath("/member", "layout");
}

/** A member's question for their trainer; staff see it on the client page. */
export async function askCoach(body: string): Promise<Result> {
  const user = await requireRole("member");
  const text = String(body ?? "").trim();
  if (text.length < 3 || text.length > 1000) return {error: "Write your question (up to 1,000 characters)."};
  const client = await store.clientByUser(user.id);
  if (!client) return {error: "Your client record isn’t set up yet. Please contact the team."};
  await store.addMessage(client.id, user.id, text);
  await store.audit(user.id, "ask_coach", `${client.name} asked a question`, client.id);
  revalidatePath("/trainer", "layout");
  revalidatePath("/admin", "layout");
  return {ok: `Sent to ${client.trainer === "Unassigned" ? "the team" : client.trainer}. Their reply appears under My trainer on your Profile.`};
}

export async function assignTrainer(clientId: string, trainerId: string): Promise<Result> {
  const user = await requireRole("admin");
  const client = await store.getClient(clientId);
  const trainer = trainerId ? (await listTrainers()).find(t => t.id === trainerId && t.active) : null;
  if (!client || (trainerId && !trainer)) return {error: "Unknown client or trainer."};
  await store.assignTrainer(clientId, trainer?.id ?? null);
  const name = trainer?.name ?? "Unassigned";
  await store.audit(user.id, "assign_trainer", `${client.name} → ${name}`, clientId);
  revalidatePath("/admin", "layout");
  return {ok: `${client.name} assigned to ${name}.`};
}

export async function verifyPayment(clientId: string): Promise<Result> {
  const user = await requireRole("admin");
  const client = await store.getClient(clientId);
  if (!client) return {error: "Unknown client."};
  if (client.paid) return {ok: `${client.name} is already verified.`};
  await store.verifyPayment(clientId);
  await store.audit(user.id, "verify_payment", `${client.name} · ${client.reference ?? "no reference"}`, clientId);
  revalidatePath("/admin", "layout");
  return {ok: `Payment ${client.reference ?? ""} verified — ${client.name} moves to onboarding.`};
}

export async function setClientStage(clientId: string, stage: string): Promise<Result> {
  const user = await requireRole("admin");
  const client = await store.getClient(clientId);
  if (!client || !(store.stages as readonly string[]).includes(stage)) return {error: "Unknown client or stage."};
  await store.setStage(clientId, stage);
  await store.audit(user.id, "set_stage", `${client.name} · ${client.stage} → ${stage}`, clientId);
  revalidatePath("/admin", "layout");
  return {ok: `${client.name} moved to ${stage}.`};
}

export async function reviewCheckin(clientId: string): Promise<Result> {
  // Trainers may only act on clients assigned to them; the admin on any client.
  const access = await coachAccess(clientId);
  if ("error" in access) return access;
  const {user, client} = access;
  await store.markCheckinReviewed(clientId);
  await store.audit(user.id, "review_checkin", client.name, clientId);
  refreshAll();
  return {ok: `${client.name}’s check-in marked as reviewed.`};
}

/** Prices are in AED; only the amount and cohort size are editable. */
export async function saveSettings(input: {price: string; cohortSize: string}): Promise<Result> {
  const user = await requireRole("admin");
  const price = Number(input.price);
  const cohortSize = Number(input.cohortSize);
  if (!Number.isInteger(price) || price < 1 || price > 1_000_000) return {error: "Price must be a whole number above zero."};
  if (!Number.isInteger(cohortSize) || cohortSize < 1 || cohortSize > 500) return {error: "Cohort size must be between 1 and 500."};
  await store.updateSettings({price: String(price), cohortSize: String(cohortSize)});
  await store.audit(user.id, "update_settings", `${store.currency} ${price} · cohort ${cohortSize}`);
  revalidatePath("/", "layout");
  return {ok: "Programme settings saved."};
}

export async function addTrainer(input: {name: string; email: string; title: string; password: string}): Promise<Result> {
  const user = await requireRole("admin");
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const title = input.title.trim() || "Trainer";
  if (name.length < 2 || name.length > 40) return {error: "Enter the trainer’s name (2–40 characters)."};
  if (!validEmail(email)) return {error: "Enter a valid email address."};
  if (title.length > 40) return {error: "Keep the role title under 40 characters."};
  if (input.password && (input.password.length < 10 || input.password.length > 200)) return {error: "A password needs at least 10 characters, or leave it blank for Google sign-in only."};
  if (await emailTaken(email)) return {error: "A user with that email already exists."};
  const id = await createUser({role: "trainer", name, email, title, password: input.password || null});
  await store.audit(user.id, "add_trainer", `${name} · ${email}`, id);
  revalidatePath("/admin", "layout");
  return {ok: `${name} added. ${input.password ? `They can sign in with their password or Google using ${email}.` : await invite({id, name, email})}`};
}

export async function editTrainer(id: string, input: {name: string; email: string; title: string; password: string}): Promise<Result> {
  const user = await requireRole("admin");
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const title = input.title.trim() || "Trainer";
  const password = input.password ?? "";
  if (name.length < 2 || name.length > 40) return {error: "Enter the trainer’s name (2–40 characters)."};
  if (!validEmail(email)) return {error: "Enter a valid email address."};
  if (title.length > 40) return {error: "Keep the role title under 40 characters."};
  if (password && (password.length < 10 || password.length > 200)) return {error: "A new password needs at least 10 characters, or leave it blank to keep the current one."};
  if (await emailTakenByOther(email, id)) return {error: "Another user already signs in with that email."};
  const updated = await updateTrainer(id, {name, email, title, password: password || null});
  if (!updated) return {error: "That trainer no longer exists."};
  await store.audit(user.id, "edit_trainer", `${name} · ${email} · ${title}${password ? " · password changed" : ""}`, id);
  revalidatePath("/admin", "layout");
  revalidatePath("/trainer", "layout");
  revalidatePath("/member", "layout");
  return {ok: password ? `${name}’s details saved. The new password is active and old sessions are signed out.` : `${name}’s details saved.`};
}

/** Emails a new account an invitation to choose a password; without email set up, hands the admin the link instead. */
async function invite(person: {id: string; name: string; email: string}) {
  const {sent, link} = await sendPasswordLink(person, "invite");
  return sent
    ? `An invitation to choose a password was emailed to ${person.email}. They can also sign in with Google.`
    : `Email isn’t set up, so send them this invitation link yourself (valid 7 days): ${link}`;
}

/** Admin: a one-hour password reset link for a member or trainer, emailed to them (or shown here to pass on). */
export async function sendResetLink(userId: string, subjectId: string | null = null): Promise<Result> {
  const admin = await requireRole("admin");
  const person = await findUser(userId);
  if (!person || person.role === "admin") return {error: "That account doesn’t exist or is deactivated."};
  const {sent, link} = await sendPasswordLink(person, "reset");
  await store.audit(admin.id, "send_reset_link", `${person.name} · ${sent ? "emailed" : "link shown to admin"}`, subjectId ?? userId);
  return {ok: sent ? `Password reset link emailed to ${person.email}. It expires in 1 hour.` : `Email isn’t set up, so send ${person.name.split(" ")[0]} this reset link yourself (valid 1 hour): ${link}`};
}

/** Admin edit of a member's name, phone, goal and biodata (date of birth, gender, height). */
export async function editClientDetails(clientId: string, input: {name: string; email: string; phone: string; goal: string; place: string; days: string; dob: string; gender: string; heightCm: string}): Promise<Result> {
  const user = await requireRole("admin");
  const client = await store.getClient(clientId);
  if (!client) return {error: "That client no longer exists."};
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const phone = input.phone.trim();
  if (email ? !validEmail(email) : client.userId !== null) return {error: "Enter a valid email address."};
  if (email && client.userId && await emailTakenByOther(email, client.userId)) return {error: "Another user already signs in with that email."};
  if ((input.place || input.days) && !((places as readonly string[]).includes(input.place) && (rhythms as readonly string[]).includes(input.days))) return {error: "Choose both where they train and how often."};
  const goal = input.goal.trim();
  const height = input.heightCm.trim() ? Number(input.heightCm) : null;
  const {day: today} = istToday();
  if (name.length < 2 || name.length > 60) return {error: "Enter the client’s full name (2–60 characters)."};
  if (phone && !/^\+?[\d\s()-]{7,20}$/.test(phone)) return {error: "Enter a phone number with digits only, or leave it blank."};
  if (!goal || goal.length > 60) return {error: "Enter the client’s goal (up to 60 characters)."};
  if (input.dob && (!/^\d{4}-\d{2}-\d{2}$/.test(input.dob) || input.dob < "1920-01-01" || input.dob > shiftDay(today, -18 * 365))) return {error: "Enter a date of birth for someone 18 or over."};
  if (input.gender && !(genders as readonly string[]).includes(input.gender)) return {error: "Choose a gender from the list."};
  if (height !== null && (!Number.isInteger(height) || height < 100 || height > 250)) return {error: "Height must be a whole number of centimetres between 100 and 250."};
  await store.updateClientDetails(clientId, {name, initials: initialsOf(name, "RC"), email: email || null, phone: phone || null, goal,
    intake: input.place ? {place: input.place, days: input.days} : null, bio: {dob: input.dob || null, gender: input.gender || null, heightCm: height}});
  await store.audit(user.id, "edit_client", `${name} · details updated`, clientId);
  revalidatePath("/admin", "layout");
  revalidatePath("/trainer", "layout");
  revalidatePath("/member", "layout");
  return {ok: `${name}’s details saved.`};
}

/** Creates the member's sign-in and their client record. They start in payment review. */
export async function addClient(input: {name: string; email: string; phone: string; goal: string; trainerId: string; password: string}): Promise<Result> {
  const user = await requireRole("admin");
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const phone = input.phone.trim();
  const goal = input.goal.trim() || "Build a routine";
  if (name.length < 2 || name.length > 60) return {error: "Enter the client’s name (2–60 characters)."};
  if (!validEmail(email)) return {error: "Enter a valid email address."};
  if (phone && !/^\+?[\d\s()-]{7,20}$/.test(phone)) return {error: "Enter a phone number with digits only, or leave it blank."};
  if (goal.length > 60) return {error: "Keep the goal under 60 characters."};
  if (input.password && (input.password.length < 10 || input.password.length > 200)) return {error: "A password needs at least 10 characters, or leave it blank for Google sign-in only."};
  const trainer = input.trainerId ? (await listTrainers()).find(t => t.id === input.trainerId && t.active) : null;
  if (input.trainerId && !trainer) return {error: "Choose an active trainer."};
  if (await emailTaken(email)) return {error: "A user with that email already exists."};
  const userId = await createUser({role: "member", name, email, password: input.password || null});
  const id = `c-${randomBytes(6).toString("hex")}`;
  await store.createClient({id, userId, name, initials: initialsOf(name, "RC"), email, phone: phone || null, goal, trainerId: trainer?.id ?? null});
  await store.audit(user.id, "add_client", `${name} · ${email}`, id);
  revalidatePath("/admin", "layout");
  return {ok: `${name} added. ${input.password ? `They can sign in with their password or Google using ${email}.` : await invite({id: userId, name, email})}`};
}

/** Deactivating blocks sign-in and ends every open session; reactivating restores access. */
export async function setAccountActive(userId: string, active: boolean, subjectId: string | null = null): Promise<Result> {
  const user = await requireRole("admin");
  if (userId === user.id) return {error: "You can’t deactivate your own account."};
  const name = await setUserActive(userId, active);
  if (!name) return {error: "Unknown account, or it’s the last active admin."};
  await store.audit(user.id, active ? "reactivate_user" : "deactivate_user", name, subjectId ?? userId);
  refreshAll();
  return {ok: active ? `${name} can sign in again.` : `${name} is deactivated and signed out everywhere.`};
}

/** Trainers may schedule this week or the next three for their own clients. */
function allowedWeeks() {
  return planningWeeks(istToday().weekStart).map(w => w.start);
}

export async function saveSchedule(clientId: string, weekStart: string, input: unknown): Promise<Result> {
  const access = await coachAccess(clientId);
  if ("error" in access) return access;
  const {user, client} = access;
  if (!allowedWeeks().includes(weekStart)) return {error: "Choose this week or one of the next three."};
  const plan = sanitizeWeekPlan(input);
  if (!plan) return {error: "Check each workout has a title and any meeting link starts with https://."};
  await store.saveWeekPlan(clientId, weekStart, plan, user.id);
  const count = plan.filter(Boolean).length;
  await store.audit(user.id, "schedule_week", `${client.name} · week of ${weekStart} · ${count} workout${count === 1 ? "" : "s"}`, clientId);
  revalidatePath("/trainer", "layout");
  revalidatePath("/member", "layout");
  return {ok: `${client.name}’s week of ${weekStart} saved — ${count} workout${count === 1 ? "" : "s"} scheduled.`};
}

export async function saveMeetingLink(clientId: string, url: string): Promise<Result> {
  const access = await coachAccess(clientId);
  if ("error" in access) return access;
  const {user, client} = access;
  const cleaned = cleanMeetingUrl(url);
  if (cleaned === "invalid") return {error: "Paste a full meeting link starting with https:// (Google Meet, Zoom or Teams)."};
  await store.setMeetingUrl(clientId, cleaned);
  await store.audit(user.id, "set_meeting_link", `${client.name} · ${cleaned ? "check-in call link updated" : "check-in call link removed"}`, clientId);
  revalidatePath("/trainer", "layout");
  revalidatePath("/member", "layout");
  return {ok: cleaned ? `Check-in call link saved — ${client.name} can now join from their app.` : `Check-in call link removed — ${client.name}`};
}

/** The trainer confirms (or un-confirms) that a client's session happened. Only this week's days up to today can be confirmed. */
export async function confirmSession(clientId: string, day: string, done: boolean): Promise<Result> {
  const access = await coachAccess(clientId);
  if ("error" in access) return access;
  const {user, client} = access;
  const {day: today, weekStart} = istToday();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < weekStart || day > today) return {error: "Sessions can be confirmed for this week, up to today."};
  await store.setSessionConfirmed(clientId, day, done, user.id);
  await store.audit(user.id, done ? "confirm_session" : "unconfirm_session", `${client.name} · ${day}`, clientId);
  revalidatePath("/trainer", "layout");
  revalidatePath("/member", "layout");
  return {ok: done ? `Session on ${day} marked completed — it counts towards ${client.name}’s streak.` : `Completion removed for ${day}.`};
}

export async function saveNutritionPlan(clientId: string, input: unknown): Promise<Result> {
  const access = await coachAccess(clientId);
  if ("error" in access) return access;
  const {user, client} = access;
  const plan = sanitizeNutritionPlan(input);
  await store.saveNutritionPlan(clientId, plan, user.id);
  await store.audit(user.id, "save_nutrition", `${client.name} · ${plan ? `${plan.meals.length} meal${plan.meals.length === 1 ? "" : "s"}` : "plan removed"}`, clientId);
  revalidatePath("/trainer", "layout");
  revalidatePath("/member", "layout");
  return {ok: plan ? `Nutrition plan saved — ${client.name} sees it on their Nutrition page.` : `Nutrition plan removed for ${client.name}.`};
}

/** The assigned trainer (or an admin) answers a member's question. The member sees it on their Profile and gets an email when email is set up. */
export async function replyToMember(clientId: string, body: string): Promise<Result> {
  const user = await requireStaff();
  const client = await store.getClient(clientId);
  if (!client || (user.role === "trainer" && client.trainerId !== user.id)) return {error: "That client isn’t assigned to you."};
  const text = String(body ?? "").trim();
  if (text.length < 2 || text.length > 1000) return {error: "Write your reply (up to 1,000 characters)."};
  if (!client.userId) return {error: `${client.name} doesn’t have a member account yet.`};
  await store.addMessage(clientId, user.id, text);
  await store.audit(user.id, "reply_member", `Replied to ${client.name}`, clientId);
  if (client.email) await sendEmail({to: client.email, subject: `${user.name} replied on RepCount`, text: `${user.name} wrote:\n\n${text}\n\nSee the conversation on your Profile: ${siteLink("/member/profile")}`});
  revalidatePath("/trainer", "layout");
  revalidatePath("/admin", "layout");
  revalidatePath("/member", "layout");
  return {ok: `Reply sent to ${client.name}.`};
}

/* ---------- Admin: every record can be corrected or removed ---------- */

const isoDay = /^\d{4}-\d{2}-\d{2}$/;

/** Payment status and reference, join date and next check-in. Un-verifying a payment moves the client back to payment review. */
export async function editMembership(clientId: string, input: {paid: boolean; reference: string; joinedOn: string; nextCheckIn: string}): Promise<Result> {
  const user = await requireRole("admin");
  const reference = String(input.reference ?? "").trim();
  const nextCheckIn = String(input.nextCheckIn ?? "").trim() || "Not booked";
  const joinedOn = String(input.joinedOn ?? "").trim();
  if (reference.length > 60) return {error: "Keep the payment reference under 60 characters."};
  if (nextCheckIn.length > 60) return {error: "Keep the next check-in under 60 characters."};
  if (joinedOn && (!isoDay.test(joinedOn) || joinedOn < "2020-01-01" || joinedOn > shiftDay(istToday().day, 366))) return {error: "Enter a valid join date."};
  const ok = await store.updateMembership(clientId, {paid: input.paid === true, reference: reference || null, joinedOn: joinedOn || null, nextCheckIn});
  if (!ok) return {error: "That client no longer exists."};
  const client = await store.getClient(clientId);
  await store.audit(user.id, "edit_membership", `${client?.name} · ${input.paid ? "paid" : "unpaid"}${reference ? ` · ${reference}` : ""}`, clientId);
  refreshAll();
  return {ok: `${client?.name}’s membership saved.`};
}

/** Corrects what the member logged: weigh-ins, body fat, today's tracker, and can reopen this week's check-in. */
export async function editMemberLog(clientId: string, input: {weights: {label: string; value: number}[]; fats: {label: string; value: number}[]; water: number; steps: number; sleep: number | null; mood: string | null; checkinSubmitted: boolean}): Promise<Result> {
  const user = await requireRole("admin");
  const today = istToday().day;
  const clean = (points: unknown, min: number, max: number, what: string) => {
    if (!Array.isArray(points) || points.length > 60) return `Too many ${what} entries.`;
    const out: {label: string; value: number}[] = [];
    for (const p of points) {
      const value = Number(p?.value);
      if (!isoDay.test(String(p?.label)) || p.label > today) return `Each ${what} entry needs a date up to today.`;
      if (!Number.isFinite(value) || value < min || value > max) return `${what[0].toUpperCase() + what.slice(1)} must be between ${min} and ${max}.`;
      out.push({label: p.label, value: Math.round(value * 10) / 10});
    }
    return out.sort((a, b) => a.label.localeCompare(b.label));
  };
  const weights = clean(input.weights, 20, 400, "weight");
  if (typeof weights === "string") return {error: weights};
  const fats = clean(input.fats, 1, 80, "body-fat");
  if (typeof fats === "string") return {error: fats};
  const water = Number(input.water), steps = Number(input.steps);
  if (!Number.isInteger(water) || water < 0 || water > 30) return {error: "Water must be 0–30 glasses."};
  if (!Number.isInteger(steps) || steps < 0 || steps > 100000) return {error: "Steps must be a whole number up to 100,000."};
  const sleep = input.sleep === null ? null : Number(input.sleep);
  if (sleep !== null && (!Number.isFinite(sleep) || sleep < 0 || sleep > 24)) return {error: "Sleep must be 0–24 hours."};
  const mood = input.mood || null;
  if (mood && !(moods as readonly string[]).includes(mood)) return {error: "Choose a mood from the list."};
  const saved = await store.updateMemberLog(clientId, {weights, fats, water, steps, sleep, mood, checkinSubmitted: input.checkinSubmitted === true});
  if (!saved) return {error: "This client has no member account, so there is no log to edit."};
  const client = await store.getClient(clientId);
  await store.audit(user.id, "edit_member_log", `${client?.name} · ${weights.length} weigh-ins, ${fats.length} body-fat entries`, clientId);
  refreshAll();
  return {ok: `${client?.name}’s log saved. If their app is open it reloads with your changes.`};
}

/** Permanently deletes a client and all their data. The admin must type the client's name to confirm. */
export async function deleteClient(clientId: string, confirmName: string): Promise<Result> {
  const user = await requireRole("admin");
  const client = await store.getClient(clientId);
  if (!client) return {error: "That client no longer exists."};
  if (String(confirmName ?? "").trim().toLowerCase() !== client.name.trim().toLowerCase()) return {error: `Type ${client.name} exactly to confirm.`};
  await store.deleteClient(clientId);
  await store.audit(user.id, "delete_client", "Client and all their data deleted", null);
  refreshAll();
  return {ok: `${client.name} and all their data were deleted.`};
}

/** Permanently deletes a trainer's account; their members become unassigned. The admin must type the name to confirm. */
export async function deleteTrainer(trainerId: string, confirmName: string): Promise<Result> {
  const user = await requireRole("admin");
  const trainer = (await listTrainers()).find(t => t.id === trainerId);
  if (!trainer) return {error: "That trainer no longer exists."};
  if (String(confirmName ?? "").trim().toLowerCase() !== trainer.name.trim().toLowerCase()) return {error: `Type ${trainer.name} exactly to confirm.`};
  await store.deleteTrainer(trainerId);
  await store.audit(user.id, "delete_trainer", `${trainer.name} · ${trainer.email}`, trainerId);
  refreshAll();
  return {ok: `${trainer.name}’s account was deleted. Their members are now unassigned.`};
}

/** Removes one message from a member's conversation. */
export async function deleteClientMessage(clientId: string, messageId: number): Promise<Result> {
  const user = await requireRole("admin");
  if (!Number.isInteger(messageId) || !(await store.deleteMessage(clientId, messageId))) return {error: "That message no longer exists."};
  const client = await store.getClient(clientId);
  await store.audit(user.id, "delete_message", `Message removed from ${client?.name ?? "a client"}’s conversation`, clientId);
  refreshAll();
  return {ok: "Message removed."};
}

/** Adds another super admin. Without a password they get an invitation link. */
export async function addAdmin(input: {name: string; email: string; password: string}): Promise<Result> {
  const user = await requireRole("admin");
  const name = String(input.name ?? "").trim();
  const email = String(input.email ?? "").trim().toLowerCase();
  const password = String(input.password ?? "");
  if (name.length < 2 || name.length > 40) return {error: "Enter the admin’s name (2–40 characters)."};
  if (!validEmail(email)) return {error: "Enter a valid email address."};
  if (password && (password.length < 10 || password.length > 200)) return {error: "A password needs at least 10 characters, or leave it blank to send an invitation."};
  if (await emailTaken(email)) return {error: "A user with that email already exists."};
  const id = await createUser({role: "admin", name, email, password: password || null});
  await store.audit(user.id, "add_admin", `${name} · ${email}`, id);
  revalidatePath("/admin", "layout");
  return {ok: `${name} added as an admin. ${password ? `They can sign in with their password or Google using ${email}.` : await invite({id, name, email})}`};
}

/** Edits an admin account (your own or another admin's): name, email and optionally a new password. */
export async function editAdmin(id: string, input: {name: string; email: string; password: string}): Promise<Result> {
  const user = await requireRole("admin");
  const name = String(input.name ?? "").trim();
  const email = String(input.email ?? "").trim().toLowerCase();
  const password = String(input.password ?? "");
  if (name.length < 2 || name.length > 40) return {error: "Enter a name (2–40 characters)."};
  if (!validEmail(email)) return {error: "Enter a valid email address."};
  if (password && (password.length < 10 || password.length > 200)) return {error: "A new password needs at least 10 characters, or leave it blank to keep the current one."};
  if (await emailTakenByOther(email, id)) return {error: "Another user already signs in with that email."};
  const updated = await updateStaffUser(id, "admin", {name, email, title: null, password: password || null});
  if (!updated) return {error: "That admin no longer exists."};
  await store.audit(user.id, "edit_admin", `${name} · ${email}${password ? " · password changed" : ""}`, id);
  revalidatePath("/admin", "layout");
  return {ok: id === user.id && password ? "Your details are saved. Your new password signs you out on other devices; sign in again here if asked." : `${name}’s details saved.`};
}
