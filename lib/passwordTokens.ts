import "server-only";
import {createHash, randomBytes} from "node:crypto";
import {db} from "./db";
import {hashPassword} from "./passwords";
import {sendEmail, siteLink} from "./mail";

/*
 * One-time password links. A reset link lasts 1 hour; an invitation (sent when the admin adds someone) lasts 7 days.
 * The raw token only ever exists in the link; the database keeps its SHA-256 hash. Issuing a new link cancels older unused ones.
 */
export type TokenPurpose = "reset" | "invite";
const lifetime: Record<TokenPurpose, string> = {reset: "1 hour", invite: "7 days"};
const hashOf = (token: string) => createHash("sha256").update(token).digest("hex");

export async function issuePasswordToken(userId: string, purpose: TokenPurpose) {
  const sql = await db();
  const token = randomBytes(32).toString("base64url");
  await sql.begin(async tx => {
    await tx`update password_tokens set used_at = now() where user_id = ${userId} and used_at is null`;
    await tx`insert into password_tokens (token_hash, user_id, purpose, expires_at)
      values (${hashOf(token)}, ${userId}, ${purpose}, now() + ${lifetime[purpose]}::interval)`;
  });
  return siteLink(`/reset-password?token=${token}`);
}

/** The person a valid, unused, unexpired token belongs to, or null. Does not use the token up. */
export async function checkPasswordToken(token: string) {
  if (!/^[\w-]{20,100}$/.test(token)) return null;
  const sql = await db();
  const [row] = await sql<{user_id: string; purpose: TokenPurpose; name: string; email: string}[]>`
    select t.user_id, t.purpose, u.name, u.email from password_tokens t join users u on u.id = t.user_id
    where t.token_hash = ${hashOf(token)} and t.used_at is null and t.expires_at > now() and u.active`;
  return row ? {userId: row.user_id, purpose: row.purpose, name: row.name, email: row.email} : null;
}

/**
 * Sets the new password and uses the token up, in one step so a link works only once.
 * Signs the person out everywhere and records privacy consent. Returns the user id, or null for a bad link.
 */
export async function redeemPasswordToken(token: string, password: string) {
  if (!/^[\w-]{20,100}$/.test(token)) return null;
  const sql = await db();
  return sql.begin(async tx => {
    const [row] = await tx<{user_id: string}[]>`update password_tokens set used_at = now()
      where token_hash = ${hashOf(token)} and used_at is null and expires_at > now() returning user_id`;
    if (!row) return null;
    const [user] = await tx<{id: string}[]>`update users set password_hash = ${hashPassword(password)}, session_version = session_version + 1,
      privacy_accepted_at = coalesce(privacy_accepted_at, now()) where id = ${row.user_id} and active returning id`;
    if (!user) throw new Error("inactive");
    await tx`update password_tokens set used_at = now() where user_id = ${row.user_id} and used_at is null`;
    return user.id;
  }).catch(error => { if (error instanceof Error && error.message === "inactive") return null; throw error; });
}

/** Emails a reset or invitation link. Returns whether it was sent, and the link so the admin can pass it on if not. */
export async function sendPasswordLink(user: {id: string; name: string; email: string}, purpose: TokenPurpose) {
  const link = await issuePasswordToken(user.id, purpose);
  const first = user.name.split(" ")[0];
  const sent = await sendEmail(purpose === "invite"
    ? {to: user.email, subject: "Your RepCount account is ready", text: `Hi ${first},\n\nYou've been added to RepCount. Choose your password to sign in:\n\n${link}\n\nThis link works once and expires in 7 days. You can also sign in with Google using ${user.email}.\n\n— The RepCount team`}
    : {to: user.email, subject: "Reset your RepCount password", text: `Hi ${first},\n\nUse this link to choose a new RepCount password:\n\n${link}\n\nIt works once and expires in 1 hour. If you didn't ask for this, you can ignore this email.\n\n— The RepCount team`});
  return {sent, link};
}
