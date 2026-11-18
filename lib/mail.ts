import "server-only";
import {createCipheriv, createDecipheriv, createHash, randomBytes} from "node:crypto";
import {after} from "next/server";
import {db} from "./db";

/*
 * Transactional email through Resend's HTTP API (https://resend.com).
 * The admin enters the API key and sender in Admin → Settings → Email; the key is stored encrypted
 * (AES-256-GCM, keyed from SESSION_SECRET). RESEND_API_KEY / MAIL_FROM in the environment are a fallback.
 * Without either, nothing is sent: reset and invitation links are shown to the admin to pass on by hand.
 * Every attempt is written to email_log so the admin can see what went out and what failed.
 */
type MailConfig = {apiKey: string; from: string; source: "admin" | "env"};
/** `attachments` content is base64 (e.g. a calendar invite). */
export type Email = {to: string; subject: string; text: string; html: string; kind: string; attachments?: {filename: string; content: string; contentType: string}[]};
export type MailStatus = {configured: boolean; source: "admin" | "env" | null; from: string; keyHint: string; keyUnreadable: boolean};
export type EmailLogRow = {id: number; to: string; subject: string; kind: string; status: "sent" | "failed" | "skipped"; error: string | null; at: string};

const cipherKey = () => createHash("sha256").update(`repcount-mail:${process.env.SESSION_SECRET ?? ""}`).digest();

function seal(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", cipherKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv, cipher.getAuthTag(), data].map(p => typeof p === "string" ? p : p.toString("base64url")).join(".");
}

/** Null when the value can't be decrypted (e.g. SESSION_SECRET changed): the admin re-enters the key. */
function unseal(sealed: string): string | null {
  try {
    const [version, iv, tag, data] = sealed.split(".");
    if (version !== "v1") return null;
    const decipher = createDecipheriv("aes-256-gcm", cipherKey(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

async function stored() {
  const sql = await db();
  const rows = await sql<{key: string; value: string}[]>`select key, value from settings where key in ('mail_api_key', 'mail_from')`;
  const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
  return {sealedKey: map.mail_api_key ?? null, from: map.mail_from ?? ""};
}

async function mailConfig(): Promise<MailConfig | null> {
  const {sealedKey, from} = await stored();
  const apiKey = sealedKey ? unseal(sealedKey) : null;
  if (apiKey && from) return {apiKey, from, source: "admin"};
  if (process.env.RESEND_API_KEY && process.env.MAIL_FROM) return {apiKey: process.env.RESEND_API_KEY, from: process.env.MAIL_FROM, source: "env"};
  return null;
}

export const mailConfigured = async () => !!(await mailConfig());

/** What the admin's Email card shows. Never includes the key itself, only its last four characters. */
export async function mailStatus(): Promise<MailStatus> {
  const {sealedKey, from} = await stored();
  const config = await mailConfig();
  const key = config?.apiKey ?? "";
  return {
    configured: !!config, source: config?.source ?? null, from: config?.from ?? from,
    keyHint: key ? `…${key.slice(-4)}` : "", keyUnreadable: !!sealedKey && !unseal(sealedKey),
  };
}

/** `apiKey` undefined keeps the saved key, "" removes it. */
export async function saveMailSettings(input: {apiKey?: string; from: string}) {
  const sql = await db();
  await sql`insert into settings (key, value) values ('mail_from', ${input.from}) on conflict (key) do update set value = excluded.value`;
  if (input.apiKey === "") await sql`delete from settings where key = 'mail_api_key'`;
  else if (input.apiKey) await sql`insert into settings (key, value) values ('mail_api_key', ${seal(input.apiKey)}) on conflict (key) do update set value = excluded.value`;
}

async function log(email: Email, status: EmailLogRow["status"], error: string | null) {
  const sql = await db();
  await sql`insert into email_log (to_email, subject, kind, status, error) values (${email.to}, ${email.subject}, ${email.kind}, ${status}, ${error?.slice(0, 300) ?? null})`;
  // Six months is plenty for troubleshooting; older entries are personal data we no longer need.
  await sql`delete from email_log where created_at < now() - interval '180 days'`;
}

export async function recentEmails(limit = 20): Promise<EmailLogRow[]> {
  const sql = await db();
  const rows = await sql<{id: string; to_email: string; subject: string; kind: string; status: EmailLogRow["status"]; error: string | null; created_at: Date}[]>`
    select * from email_log order by id desc limit ${limit}`;
  return rows.map(r => ({id: Number(r.id), to: r.to_email, subject: r.subject, kind: r.kind, status: r.status, error: r.error, at: r.created_at.toISOString()}));
}

/** Sends one email now. Returns false when email isn't set up or the provider refuses it; the outcome is logged either way. */
export async function sendEmail(email: Email): Promise<boolean> {
  try {
    const config = await mailConfig();
    if (!config) { await log(email, "skipped", "Email isn’t set up"); return false; }
    const response = await fetch(process.env.RESEND_API_URL || "https://api.resend.com/emails", { // RESEND_API_URL: tests point this at a local fake
      method: "POST",
      headers: {authorization: `Bearer ${config.apiKey}`, "content-type": "application/json"},
      body: JSON.stringify({from: config.from, to: [email.to], subject: email.subject, text: email.text, html: email.html,
        ...(email.attachments?.length ? {attachments: email.attachments.map(a => ({filename: a.filename, content: a.content, content_type: a.contentType}))} : {})}),
      signal: AbortSignal.timeout(10_000),
    });
    if (response.ok) { await log(email, "sent", null); return true; }
    const body = await response.text().catch(() => "");
    let message = body;
    try { message = (JSON.parse(body) as {message?: string}).message ?? body; } catch { /* not JSON: keep the raw body */ }
    await log(email, "failed", `${response.status}: ${message}`);
    return false;
  } catch (error) {
    await log(email, "failed", error instanceof Error ? error.message : String(error)).catch(() => {});
    return false;
  }
}

/** Notifications: sent after the response, so a slow or failing email never delays or breaks the action. */
export function sendLater(...emails: (Email | null | undefined)[]) {
  const list = emails.filter((e): e is Email => !!e?.to);
  if (list.length) after(async () => { for (const email of list) await sendEmail(email); });
}

/** Absolute link to a path on this site, from SITE_URL. */
export {siteLink} from "./site";
