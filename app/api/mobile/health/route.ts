import {json, mobileMember, readJson, unauthorized} from "@/lib/mobileAuth";
import {getHealthDays, sanitizeHealthDays, sanitizeSources, saveHealthDays} from "@/lib/health";
import {istToday} from "@/lib/dates";
import {shiftDay} from "@/lib/streak";

/**
 * Daily health totals from the phone. Body: {platform: "android" | "ios", days: [{day, steps, activeKcal, restingHr,
 * sleepMin, workouts, workoutMin, weightKg}], sources: string[]}. Days outside the last 30 are ignored.
 */
export async function POST(request: Request) {
  const user = await mobileMember(request);
  if (!user) return unauthorized();
  const body = await readJson(request) as {platform?: unknown; days?: unknown; sources?: unknown} | null;
  if (body?.platform !== "android" && body?.platform !== "ios") return json({error: "Unknown platform."}, 400);
  const saved = await saveHealthDays(user.id, body.platform, sanitizeHealthDays(body.days), sanitizeSources(body.sources));
  return json({saved});
}

/** The last 14 days the phone has synced, for the app's charts. */
export async function GET(request: Request) {
  const user = await mobileMember(request);
  if (!user) return unauthorized();
  return json(await getHealthDays(user.id, shiftDay(istToday().day, -13)));
}
