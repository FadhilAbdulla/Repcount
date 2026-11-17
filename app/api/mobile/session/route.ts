import {issueMobileToken, json, readJson} from "@/lib/mobileAuth";
import {clearLoginFailures, loginLimited, recordLoginFailure, verifyCredentials} from "@/lib/users";

/**
 * Mobile sign-in: email + password in, a 30-day bearer token out. Same checks and rate limits as the web login.
 * The app is for members; trainers and admins are pointed to the website.
 */
export async function POST(request: Request) {
  const body = await readJson(request) as {email?: unknown; password?: unknown} | null;
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return json({error: "Enter a valid email address."}, 400);
  if (!password || password.length > 200) return json({error: "Enter your password."}, 400);

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const keys = [`ip:${email}|${ip}`, `email:${email}`];
  if (await loginLimited([[keys[0], 5], [keys[1], 20]])) return json({error: "Too many attempts. Please wait 15 minutes and try again."}, 429);

  const user = await verifyCredentials(email, password);
  if (!user) {
    await recordLoginFailure(keys);
    return json({error: "That email and password don’t match an account."}, 401);
  }
  await clearLoginFailures([keys[0]]);
  if (user.role !== "member") return json({error: "The app is for members. Trainers and admins, please use the RepCount website."}, 403);

  const {token, expiresAt} = await issueMobileToken(user);
  return json({token, expiresAt, user: {name: user.name, initials: user.initials, email: user.email}});
}
