import "server-only";
import {siteLink, type Email} from "./mail";

/*
 * Every email RepCount sends, in one place. Each one has a plain-text and an HTML version built from the same lines,
 * so they read the same in any mail app. Paths are turned into absolute links with SITE_URL.
 */
type Draft = {to: string | null | undefined; kind: string; subject: string; lines: string[]; quote?: string; cta?: {label: string; path: string}};

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const first = (name: string) => name.trim().split(/\s+/)[0] || name;

function render({to, kind, subject, lines, quote, cta}: Draft): Email | null {
  if (!to) return null;
  const url = cta && (/^https?:\/\//.test(cta.path) ? cta.path : siteLink(cta.path));
  const text = [
    ...lines,
    ...(quote ? [quote.split("\n").map(l => `> ${l}`).join("\n")] : []),
    ...(cta && url ? [`${cta.label}: ${url}`] : []),
    "— The RepCount team",
  ].join("\n\n");
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#fbf7f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#242623">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fbf7f0;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #ece6dc">
<tr><td style="background:#242623;padding:18px 24px;color:#fbf7f0;font-weight:800;font-size:18px;letter-spacing:.5px">REP<span style="color:#e51937">COUNT</span></td></tr>
<tr><td style="padding:24px;font-size:16px;line-height:1.55">
${lines.map(l => `<p style="margin:0 0 14px">${escape(l)}</p>`).join("\n")}
${quote ? `<blockquote style="margin:0 0 16px;padding:12px 14px;background:#f6f2ea;border-left:3px solid #e51937;border-radius:6px;white-space:pre-wrap">${escape(quote)}</blockquote>` : ""}
${cta && url ? `<p style="margin:20px 0 6px"><a href="${escape(url)}" style="display:inline-block;background:#e51937;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:999px">${escape(cta.label)}</a></p>` : ""}
<p style="margin:18px 0 0;color:#6b6a66;font-size:14px">— The RepCount team</p>
</td></tr></table>
<p style="color:#8a877f;font-size:12px;margin:14px 0 0">You’re receiving this because you have a RepCount account.</p>
</td></tr></table></body></html>`;
  return {to, subject, text, html, kind};
}

type Person = {name: string; email: string | null | undefined};
type Member = {id: string; name: string; email: string | null | undefined};

export const emails = {
  welcome: (m: Member) => render({to: m.email, kind: "welcome", subject: "Welcome to RepCount",
    lines: [`Hi ${first(m.name)}, your RepCount account is ready.`,
      "Next, the team verifies your payment and matches you with a trainer. We’ll email you at each step. If you haven’t added your payment reference yet, you can do it on your Profile."],
    cta: {label: "Open RepCount", path: "/member/overview"}}),

  newRegistration: (admin: Person, m: Member) => render({to: admin.email, kind: "admin_new_member", subject: `New member: ${m.name}`,
    lines: [`${m.name} (${m.email}) just created an account. They’re in payment review until you verify their payment and assign a trainer.`],
    cta: {label: "Open their page", path: `/admin/clients/${m.id}`}}),

  paymentReference: (admin: Person, m: Member, reference: string) => render({to: admin.email, kind: "admin_payment_reference", subject: `${m.name} sent a payment reference`,
    lines: [`${m.name} sent payment reference ${reference}. Check it against your account and verify it on their page.`],
    cta: {label: "Verify payment", path: `/admin/clients/${m.id}`}}),

  paymentVerified: (m: Member, trainer: string | null) => render({to: m.email, kind: "payment_verified", subject: "Your payment is verified",
    lines: [`Hi ${first(m.name)}, thanks, your payment is verified and your membership is active.`,
      trainer ? `${trainer} is your trainer and will plan your first week.` : "Next we match you with a trainer. We’ll email you when they’re assigned."],
    cta: {label: "Open RepCount", path: "/member/overview"}}),

  trainerAssigned: (m: Member, trainer: string) => render({to: m.email, kind: "trainer_assigned", subject: `${trainer} is your RepCount trainer`,
    lines: [`Hi ${first(m.name)}, ${trainer} is now your trainer.`, "They’ll plan your workouts and nutrition, and you can message them from your Profile."],
    cta: {label: "Say hello", path: "/member/profile"}}),

  newMemberForTrainer: (trainer: Person, m: Member, detail: string) => render({to: trainer.email, kind: "trainer_new_member", subject: `New member: ${m.name}`,
    lines: [`Hi ${first(trainer.name)}, ${m.name} has been assigned to you.`, ...(detail ? [detail] : []), "Plan their first week when you’re ready."],
    cta: {label: "Open their page", path: `/trainer/clients/${m.id}`}}),

  question: (to: Person, m: Member, body: string, area: "trainer" | "admin") => render({to: to.email, kind: "member_question", subject: `${first(m.name)} asked a question`,
    lines: [`${m.name} wrote:`], quote: body, cta: {label: "Reply", path: `/${area}/clients/${m.id}`}}),

  reply: (m: Member, from: string, body: string) => render({to: m.email, kind: "staff_reply", subject: `${from} replied on RepCount`,
    lines: [`Hi ${first(m.name)}, ${from} replied to you:`], quote: body, cta: {label: "See the conversation", path: "/member/profile"}}),

  weekReady: (m: Member, from: string, weekLabel: string, workouts: number) => render({to: m.email, kind: "week_planned", subject: `Your plan for ${weekLabel} is ready`,
    lines: [`Hi ${first(m.name)}, ${from} planned ${workouts} workout${workouts === 1 ? "" : "s"} for ${weekLabel}.`],
    cta: {label: "See your plan", path: "/member/plan"}}),

  meetingLink: (m: Member, from: string) => render({to: m.email, kind: "meeting_link", subject: "Your check-in call link",
    lines: [`Hi ${first(m.name)}, ${from} added the link for your weekly check-in call. Join it from your Profile at the time you agreed.`],
    cta: {label: "Open your Profile", path: "/member/profile"}}),

  checkinSubmitted: (trainer: Person, m: Member, note: string, area: "trainer" | "admin") => render({to: trainer.email, kind: "checkin_submitted", subject: `${first(m.name)} sent their weekly check-in`,
    lines: [`${m.name} sent this week’s check-in: ${note}.`], cta: {label: "Review it", path: `/${area}/clients/${m.id}`}}),

  checkinReviewed: (m: Member, from: string) => render({to: m.email, kind: "checkin_reviewed", subject: `${from} reviewed your check-in`,
    lines: [`Hi ${first(m.name)}, ${from} has reviewed this week’s check-in. Keep going!`], cta: {label: "Open RepCount", path: "/member/overview"}}),

  passwordChanged: (p: Person) => render({to: p.email, kind: "password_changed", subject: "Your RepCount password was changed",
    lines: [`Hi ${first(p.name)}, the password for your RepCount account was just changed, and other devices were signed out.`,
      "If this wasn’t you, reset your password now and tell the team."],
    cta: {label: "Reset password", path: "/forgot-password"}}),

  invite: (p: Person, link: string) => render({to: p.email, kind: "invite", subject: "Your RepCount account is ready",
    lines: [`Hi ${first(p.name)}, you’ve been added to RepCount. Choose your password to sign in.`,
      `This link works once and expires in 7 days. You can also sign in with Google using ${p.email}.`],
    cta: {label: "Choose your password", path: link}}),

  reset: (p: Person, link: string) => render({to: p.email, kind: "password_reset", subject: "Reset your RepCount password",
    lines: [`Hi ${first(p.name)}, use the button below to choose a new RepCount password.`, "It works once and expires in 1 hour. If you didn’t ask for this, you can ignore this email."],
    cta: {label: "Choose a new password", path: link}}),

  test: (p: Person) => render({to: p.email, kind: "test", subject: "RepCount test email",
    lines: [`Hi ${first(p.name)}, this is a test from Admin → Settings → Email. If you can read it, email is working.`],
    cta: {label: "Open the admin panel", path: "/admin?tab=settings"}}),
};
