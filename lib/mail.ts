import "server-only";

/*
 * Transactional email through Resend's HTTP API (https://resend.com). Set RESEND_API_KEY and MAIL_FROM
 * (a sender on a domain verified in Resend, e.g. "RepCount <hello@yourdomain.com>").
 * Without them nothing is sent: callers fall back to showing the admin a link to pass on by hand.
 */
export const mailConfigured = () => !!(process.env.RESEND_API_KEY && process.env.MAIL_FROM);

/** Sends a plain-text email. Returns false when email isn't configured or the provider refuses it. */
export async function sendEmail({to, subject, text}: {to: string; subject: string; text: string}): Promise<boolean> {
  if (!mailConfigured()) return false;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json"},
      body: JSON.stringify({from: process.env.MAIL_FROM, to: [to], subject, text}),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) console.error(`Email to ${to} failed: ${response.status} ${await response.text().catch(() => "")}`);
    return response.ok;
  } catch (error) {
    console.error(`Email to ${to} failed:`, error);
    return false;
  }
}

/** Absolute link to a path on this site, from SITE_URL. */
export const siteLink = (path: string) => new URL(path, process.env.SITE_URL || "http://localhost:3000").toString();
