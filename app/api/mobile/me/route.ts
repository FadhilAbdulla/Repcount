import {json, mobileMember, unauthorized} from "@/lib/mobileAuth";
import {istToday} from "@/lib/dates";
import {shiftDay} from "@/lib/streak";
import {getHealthDays} from "@/lib/health";
import {clientByUser, confirmedDays, getMemberRevision, getMemberState, getNutritionPlan, getWeekPlan, listMessages} from "@/lib/store";
import {findUser} from "@/lib/users";
import {listSessions} from "@/lib/sessionStore";

/** Everything the member's home, workout, nutrition and coach screens show, in one round trip. */
export async function GET(request: Request) {
  const user = await mobileMember(request);
  if (!user) return unauthorized();
  const {day, weekStart} = istToday();
  const [client, state, revision, health] = await Promise.all([
    clientByUser(user.id), getMemberState(user.id), getMemberRevision(user.id), getHealthDays(user.id, shiftDay(day, -13)),
  ]);
  const [trainer, schedule, nutritionPlan, confirmed, messages, sessions] = await Promise.all([
    client?.trainerId ? findUser(client.trainerId) : null,
    client ? getWeekPlan(client.id, weekStart) : null,
    client ? getNutritionPlan(client.id) : null,
    client ? confirmedDays(client.id, weekStart, day) : [],
    client ? listMessages(client.id) : [],
    client ? listSessions({clientId: client.id, upcomingOnly: true, limit: 10}) : [],
  ]);
  return json({
    today: day, weekStart,
    user: {name: user.name, initials: user.initials, email: user.email},
    // New members answer the onboarding questions on the website first; the app links there.
    needsOnboarding: !!client && !client.intake,
    member: client ? {memberNo: client.memberNo, goal: client.goal, stage: client.stage, joinedOn: client.joinedOn, deactivated: client.deactivated, meetingUrl: client.meetingUrl} : null,
    coach: trainer ? {name: trainer.name, initials: trainer.initials} : null,
    state, revision, schedule, nutritionPlan, confirmed, messages, health,
    // Upcoming booked sessions, soonest first (video calls with the trainer).
    sessions,
  });
}
