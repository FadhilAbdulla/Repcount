import "server-only";
import {SignJWT, jwtVerify} from "jose";
import {findUser, type User} from "./users";

/*
 * Bearer tokens for the RepCount mobile app. Same secret as the web session cookie but a separate audience,
 * so a mobile token is never accepted as a cookie and the other way round. Changing the password (or an admin
 * deactivating the account) bumps session_version, which revokes mobile tokens too.
 */
export const MOBILE_AUDIENCE = "repcount-mobile";
const TOKEN_DAYS = 30;

function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be set to at least 32 characters (see .env.example).");
  return new TextEncoder().encode(secret);
}

export async function issueMobileToken(user: User) {
  const expiresAt = new Date(Date.now() + TOKEN_DAYS * 24 * 60 * 60 * 1000);
  const token = await new SignJWT({userId: user.id, role: user.role, v: user.sessionVersion})
    .setProtectedHeader({alg: "HS256"})
    .setAudience(MOBILE_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_DAYS}d`)
    .sign(secretKey());
  return {token, expiresAt: expiresAt.toISOString()};
}

/** The signed-in member for a mobile API request, or null (missing, expired, revoked token, or not a member). */
export async function mobileMember(request: Request): Promise<User | null> {
  const header = request.headers.get("authorization") ?? "";
  const token = /^Bearer\s+(.+)$/i.exec(header)?.[1];
  if (!token) return null;
  try {
    const {payload} = await jwtVerify(token, secretKey(), {algorithms: ["HS256"], audience: MOBILE_AUDIENCE});
    if (typeof payload.userId !== "string") return null;
    const user = await findUser(payload.userId);
    const v = typeof payload.v === "number" ? payload.v : -1;
    return user && user.role === "member" && user.role === payload.role && user.sessionVersion === v ? user : null;
  } catch {
    return null;
  }
}

/** JSON helpers shared by the mobile routes. Responses are never cached. */
export const json = (body: unknown, status = 200) => Response.json(body, {status, headers: {"cache-control": "no-store"}});
export const unauthorized = () => json({error: "Please sign in again."}, 401);

export async function readJson(request: Request): Promise<unknown> {
  try { return await request.json(); } catch { return null; }
}
