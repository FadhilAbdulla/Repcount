import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { createServer as createHttpServer } from 'node:http';
import { SignJWT } from 'jose';
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { seedFixture } from './demo-fixture.mjs';

// Runs against `next start` on a free port, so the proxy, layouts and server actions are exercised for real.
const SESSION_SECRET = 'test-secret-'.padEnd(48, 'x');
let server;
let baseUrl;
// Each run wipes and reseeds TEST_DATABASE_URL, so it must name a throwaway database (its name has to contain "test").
const DATABASE_URL = process.env.TEST_DATABASE_URL;
if (!DATABASE_URL || !/test/i.test(new URL(DATABASE_URL).pathname)) throw new Error('Set TEST_DATABASE_URL to a throwaway Postgres database whose name contains "test".');
const sql = postgres(DATABASE_URL, {max: 2, onnotice: () => {}});
// A stand-in for Resend's API: records each email; the key re_rejected_key1 gets Resend's "domain not verified" refusal.
const mailbox = [];
const fakeResend = createHttpServer((req, res) => {
 let body = '';
 req.on('data', c => body += c);
 req.on('end', () => {
  if (req.headers.authorization === 'Bearer re_rejected_key1') { res.writeHead(403, {'content-type': 'application/json'}); res.end(JSON.stringify({message: 'The example.com domain is not verified.'})); return; }
  mailbox.push({auth: req.headers.authorization, ...JSON.parse(body)});
  res.writeHead(200, {'content-type': 'application/json'}); res.end(JSON.stringify({id: `email-${mailbox.length}`}));
 });
});
before(async () => {
 await new Promise(resolve => fakeResend.listen(0, '127.0.0.1', resolve));
 await sql.unsafe('drop schema public cascade; create schema public;');
 const port = await new Promise(resolve => { const s = createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => resolve(p)); }); });
 baseUrl = `http://127.0.0.1:${port}`;
 server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(port), '-H', '127.0.0.1'], {env: {...process.env, SESSION_SECRET, DATABASE_URL, GOOGLE_CLIENT_ID: 'test-client.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'test-secret', ADMIN_EMAIL: 'Owner@Example.com', ADMIN_PASSWORD: 'short', RESEND_API_KEY: '', MAIL_FROM: '', RESEND_API_URL: `http://127.0.0.1:${fakeResend.address().port}/emails`}, stdio: 'ignore'});
 for (let i = 0; i < 100; i++) {
  try { await fetch(baseUrl + '/'); } catch { await new Promise(r => setTimeout(r, 100)); continue; }
  // The first request created the schema; now insert the test accounts.
  await seedFixture(sql);
  return;
 }
 throw new Error('next start did not respond');
});
after(async () => { server?.kill(); fakeResend.close(); await sql.end(); });

let rendered;
function productionHomepage() {
 rendered ??= (async () => {
  const response = await fetch(baseUrl + '/', {headers:{accept:'text/html'}});
  assert.equal(response.status,200);
  return response.text();
 })();
 return rendered;
}
const sessionCookie = async (userId, role, secret = SESSION_SECRET, v = 0) => 'rc_session=' + await new SignJWT({userId, role, v, expiresAt: new Date(Date.now() + 864e5).toISOString()}).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('1d').sign(new TextEncoder().encode(secret));
const visit = (path, cookie) => fetch(baseUrl + path, {redirect:'manual', headers: cookie ? {cookie} : {}});
const markupOnly = html => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
const readableText = html => markupOnly(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

test('production opens public coaching with an optional member demo', async () => {
 const html = markupOnly(await productionHomepage());
 const headings = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)];
 assert.equal(headings.length, 1, 'Public homepage needs one primary heading');
 assert.match(readableText(headings[0][1]), /stronger.*own space/i);
 assert.match(html, /<main\b[^>]*id="rc-main"/i);
 assert.match(html, /<button\b[^>]*>\s*Create your account\b/i);
 assert.doesNotMatch(readableText(html), /\b(?:demo|interactive preview|sample)\b/i, 'The public site must not describe itself as a demo');
 assert.doesNotMatch(html, /rc-preview-bar/, 'The preview strip has been removed');
 assert.doesNotMatch(html, /class="(?:sidebar|topbar)"/, 'Member workspace must not replace the public first view');
 assert.doesNotMatch(readableText(html), /ThriveMotion|Your site is taking shape/);
});

test('pilot preserves confirmed scope and distinguishes future services', async () => {
 const text = readableText(await productionHomepage());
 assert.match(text, /AED\s*299\s*\/\s*30 days/);
 assert.match(text, /1:1\s+a personal trainer\s+for every client/);
 assert.match(text, /Adults 18\+/);
  assert.match(text, /Weekly trainer follow-ups/);
 assert.match(text, /The team shares payment details when you join/, 'Payments are locked until phase 2');
 assert.match(text, /Health articles/, 'The home page links to the blog');
 assert.match(text, /personalised nutrition plans are not currently part of the confirmed pilot package/);
 assert.doesNotMatch(text, /psycholog|counsel|therap/i, 'The psychologist service has been withdrawn');
 assert.match(text, /How do I join\?/);
 assert.doesNotMatch(text, /guaranteed (?:weight loss|results|transformation)|cures? depression|lose \d+\s*(?:kg|pounds)/i);
});

test('public response protects project contacts and excludes rejected gym media', async () => {
 const html = await productionHomepage();
 assert.doesNotMatch(html, /@gmail\.com|\+971|mujeeb\.dba|zainulisin|saleemdbest/i);
 assert.doesNotMatch(html, /codex-preview|localhost:5678|Lkn-Auto/);
 const mediaTags = markupOnly(html).match(/<(?:img|video|source)\b[^>]*>/gi) ?? [];
 assert.ok(mediaTags.length > 0, 'Expected meaningful visual media');
 assert.doesNotMatch(mediaTags.join('\n'), /photo-1548932813-88dcf75599c6|52082|100544/, 'Rejected bodybuilding assets must not be rendered');
 assert.match(readableText(html), /People shown are not presented as RepCount staff or clients/);
});

test('navigation links refer to existing local targets', async () => {
 const html = markupOnly(await productionHomepage());
 const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
 const fragments = [...html.matchAll(/<a\b[^>]*\bhref="#([^"]*)"/gi)].map(match => match[1]);
 assert.ok(fragments.length > 0, 'Expected local feature navigation');
 for (const fragment of fragments) {
  assert.ok(fragment.length > 0, 'Empty hash links have no named target');
  assert.ok(ids.has(decodeURIComponent(fragment)), `Missing fragment target: ${fragment}`);
 }
 assert.doesNotMatch(html, /<dialog\b/i, 'Starting point is a page (/register), not a modal');
});

test('videos offer silent inline playback, posters and labelled controls', async () => {
 const html = markupOnly(await productionHomepage());
 const videos = html.match(/<video\b[^>]*>/gi) ?? [];
 assert.ok(videos.length >= 2, 'Expected hero and product media');
 for (const video of videos) {
  assert.match(video, /\bmuted(?:\s|=|>)/i);
  assert.match(video, /\bplaysinline(?:\s|=|>)/i);
  assert.match(video, /\bposter="[^"]+"/i, 'Videos need a loading fallback');
  assert.match(video, /\baria-label="[^"]+"/i);
 }
 const playControls = [...html.matchAll(/<button\b[^>]*aria-label="(?:Play|Pause) [^"]+"[^>]*>/gi)];
 assert.ok(playControls.length >= videos.length, 'Each video needs a labelled play/pause control');
 const ranges = html.match(/<input\b[^>]*type="range"[^>]*>/gi) ?? [];
 assert.ok(ranges.some(input => /aria-label="Seek [^"]+"/i.test(input)), 'Product video needs an accessible timeline');
});

test('protected areas send signed-out visitors to login', async () => {
 for (const path of ['/member/overview', '/trainer', '/admin']) {
  const response = await visit(path);
  assert.equal(response.status, 307, path);
  assert.match(response.headers.get('location'), /\/login$/);
 }
 const login = await visit('/login');
 assert.equal(login.status, 200);
 const html = await login.text();
 assert.match(html, /name="email"/);
 assert.match(html, /name="password"/);
 assert.doesNotMatch(html, /Member#2026|Admin#2026/, 'Production login must not list demo passwords by default');
});

test('each role reaches only its own dashboard', async () => {
 const member = await sessionCookie('u-member-aarav', 'member');
 const trainer = await sessionCookie('u-trainer-akif', 'trainer');
 const admin = await sessionCookie('u-admin', 'admin');
 const page = await visit('/member/overview', member);
 assert.equal(page.status, 200);
 assert.match(readableText(await page.text()), /Let’s train, Aarav\./);
 assert.equal((await visit('/admin', member)).headers.get('location')?.endsWith('/member/overview'), true);
 assert.equal((await visit('/member/plan', trainer)).headers.get('location')?.endsWith('/trainer'), true);
 assert.match(readableText(await (await visit('/trainer', trainer)).text()), /TRAINER WORKSPACE/);
 assert.match(readableText(await (await visit('/admin', admin)).text()), /ADMIN/);
 assert.equal((await visit('/login', admin)).headers.get('location')?.endsWith('/admin'), true);
 assert.equal((await visit('/member/unknown', member)).status, 404);
});

test('forged or mismatched sessions are rejected', async () => {
 const forged = await sessionCookie('u-admin', 'admin', 'not-the-real-secret'.padEnd(48, 'y'));
 assert.match((await visit('/admin', forged)).headers.get('location') ?? '', /\/login$/);
 const wrongRole = await sessionCookie('u-member-aarav', 'admin');
 const response = await visit('/admin', wrongRole);
 assert.equal(response.status, 307, 'A role claim that does not match the stored user must not open the admin area');
 assert.match(response.headers.get('location') ?? '', /\/login$/);
});

test('live data drives the public price and the trainer’s check-in queue', async () => {
 await productionHomepage(); // creates and seeds the database
 await sql`update settings set value = '7999' where key = 'price'`;
 await sql`update clients set stage = 'Check-in due', checkin_note = 'Energy low · i need shorter sessions' where id = 'c-aarav'`;
 const home = readableText(await (await fetch(baseUrl + '/')).text());
 assert.match(home, /AED\s*7,999\s*\/\s*30 days/);
 const trainer = readableText(await (await visit('/trainer', await sessionCookie('u-trainer-akif', 'trainer'))).text());
 assert.match(trainer, /Energy low · i need shorter sessions/);
 assert.doesNotMatch(trainer, /Maya R\./, 'Trainers must only receive clients assigned to them');
 await sql`update settings set value = '299' where key = 'price'`;
});

// Monday of the current week in India time, matching lib/dates.ts.
function istWeekStart() {
 const now = new Date(new Date().toLocaleString('en-US', {timeZone: 'Asia/Kolkata'}));
 return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))).toISOString().slice(0, 10);
}

test('admin can open a client detail page; other roles cannot', async () => {
 const admin = await sessionCookie('u-admin', 'admin');
 const page = await visit('/admin/clients/c-maya', admin);
 assert.equal(page.status, 200);
 const text = readableText(await page.text());
 assert.match(text, /Maya R\./);
 assert.match(text, /maya@example\.com/);
 assert.match(text, /Payment Coming in phase 2/, 'Payment details are locked until phase 2');
 assert.match(text, /RC-\d{4}/, 'The client page shows the member ID');
 assert.equal((await visit('/admin/clients/does-not-exist', admin)).status, 404);
 assert.match((await visit('/admin/clients/c-maya', await sessionCookie('u-trainer-akif', 'trainer'))).headers.get('location') ?? '', /\/trainer$/);
 const overview = readableText(await (await visit('/admin', admin)).text());
 assert.match(overview, /Trainer performance/);
});

test('Google sign-in starts with state and PKCE and refuses a forged return', async () => {
 assert.match(await (await visit('/login')).text(), /Continue with Google/);
 const start = await visit('/api/auth/google');
 assert.equal(start.status, 307);
 const target = new URL(start.headers.get('location'));
 assert.equal(target.host, 'accounts.google.com');
 assert.equal(target.searchParams.get('client_id'), 'test-client.apps.googleusercontent.com');
 assert.equal(target.searchParams.get('code_challenge_method'), 'S256');
 assert.ok(target.searchParams.get('state') && target.searchParams.get('nonce'));
 assert.match(start.headers.get('set-cookie') ?? '', /rc_google_oauth=.*HttpOnly/i);
 const forged = await visit('/api/auth/google/callback?code=abc&state=wrong');
 assert.match(forged.headers.get('location') ?? '', /\/login\?error=google_failed$/);
});

test('a trainer’s schedule and booked sessions reach the member', async () => {
 await productionHomepage();
 const week = istWeekStart();
 await sql`delete from workout_plans where client_id = 'c-aarav'`;
 for (let day = 0; day < 7; day++) {
  await sql`insert into workout_plans (client_id, week_start, day, title, exercises, start_time, duration_min, meeting_url, updated_by)
   values ('c-aarav', ${week}, ${day}, 'Lower body strength', ${'Goblet squat · 3 × 10\nGlute bridge · 3 × 12'}, '18:30', 35, 'https://meet.google.com/abc-defg-hij', 'u-trainer-akif')`;
 }
 await sql`delete from sessions where client_id = 'c-aarav'`;
 await sql`insert into sessions (client_id, kind, title, starts_at, ends_at, meeting_url, created_by)
  values ('c-aarav', 'weekly', 'Weekly check-in', now() + interval '2 days', now() + interval '2 days 30 minutes', 'https://zoom.us/j/123456', 'u-trainer-akif')`;
 const member = await sessionCookie('u-member-aarav', 'member');
 const plan = await (await visit('/member/plan', member)).text();
 assert.match(readableText(plan), /Lower body strength/);
 assert.match(readableText(plan), /Goblet squat · 3 × 10/);
 assert.match(readableText(await (await visit('/member/overview', member)).text()), /NEXT SESSION Weekly check-in/);
 const sessionsPage = readableText(await (await visit('/member/sessions', member)).text());
 assert.match(sessionsPage, /Upcoming .*Weekly check-in/);
 assert.match(sessionsPage, /Join opens 15 min before/, 'The join link opens shortly before the start');
 const trainer = readableText(await (await visit('/trainer/clients/c-aarav', await sessionCookie('u-trainer-akif', 'trainer'))).text());
 assert.match(trainer, /Sessions this week/);
 assert.match(trainer, /Workout plan Nutrition Sessions Messages Calendar Progress/, 'Each part of the member has its own tab');
 assert.doesNotMatch(trainer, /Open workout plan|Write a nutrition plan|Open nutrition plan/, 'The overview doesn’t repeat the plan tabs');
 // Workouts, nutrition and progress each have their own page under the member.
 const akif = await sessionCookie('u-trainer-akif', 'trainer');
 assert.match(readableText(await (await visit('/trainer/clients/c-aarav/workouts', akif)).text()), /Live sessions .*Open Sessions/);
 assert.match(readableText(await (await visit('/trainer/clients/c-aarav/sessions', akif)).text()), /Upcoming New session .*Weekly check-in/);
 assert.match(readableText(await (await visit('/trainer/clients/c-aarav/calendar', akif)).text()), /Weekly check-in/);
 assert.match(readableText(await (await visit('/trainer?tab=sessions', akif)).text()), /Aarav · Weekly check-in/);
 // Each day of the week is edited on its own page; unknown weeks and days are 404s.
 assert.match(readableText(await (await visit(`/trainer/clients/c-aarav/workouts/${week}/monday`, akif)).text()), /Save Monday/);
 assert.equal((await visit(`/trainer/clients/c-aarav/workouts/${week}/funday`, akif)).status, 404);
 assert.equal((await visit('/trainer/clients/c-aarav/workouts/2001-01-01/monday', akif)).status, 404);
 assert.match(readableText(await (await visit('/trainer/clients/c-aarav/nutrition', akif)).text()), /Save nutrition plan/);
 assert.match(readableText(await (await visit('/trainer/clients/c-aarav/progress', akif)).text()), /History/);
 assert.equal((await visit('/trainer/clients/c-maya/nutrition', akif)).status, 404, 'Sub-pages check the assignment too');
});

test('members see their rank, score and streak on the leaderboard', async () => {
 const member = await sessionCookie('u-member-aarav', 'member');
 const text = readableText(await (await visit('/member/leaderboard', member)).text());
 assert.match(text, /YOUR RANK/);
 assert.match(text, /Aarav S\. · you/);
});

test('admins see member IDs, profile status and editable trainers', async () => {
 const admin = await sessionCookie('u-admin', 'admin');
 const roster = readableText(await (await visit('/admin?tab=clients', admin)).text());
 assert.match(roster, /Status/);
 assert.match(roster, /Profile incomplete|No plan this week|workouts/);
 const team = readableText(await (await visit('/admin?tab=trainers', admin)).text());
 assert.match(team, /Coaching team/);
 assert.doesNotMatch(team, /capacity/i, 'Trainers no longer have a client capacity');
 const detail = readableText(await (await visit('/admin/clients/c-aarav', admin)).text());
 assert.match(detail, /Edit details/);
 assert.match(detail, /Member ID/);
});

test('trainers open only their own clients’ detail pages', async () => {
 const trainer = await sessionCookie('u-trainer-akif', 'trainer');
 const page = await visit('/trainer/clients/c-kabir', trainer);
 assert.equal(page.status, 200);
 const text = readableText(await page.text());
 assert.match(text, /Kabir M\./);
 assert.doesNotMatch(text, /Deactivate/, 'Trainers must not see admin account controls');
 assert.equal((await visit('/trainer/clients/c-maya', trainer)).status, 404, 'Unassigned clients are not visible to a trainer');
 assert.equal((await visit('/trainer/clients/c-kabir', await sessionCookie('u-trainer-2', 'trainer'))).status, 404);
});

test('deactivating an account ends its existing sessions', async () => {
 await productionHomepage();
 const member = await sessionCookie('u-member-kabir', 'member');
 assert.equal((await visit('/member/overview', member)).status, 200);
 await sql`update users set active = false, session_version = session_version + 1 where id = 'u-member-kabir'`;
 assert.match((await visit('/member/overview', member)).headers.get('location') ?? '', /\/login$/);
 await sql`update users set active = true where id = 'u-member-kabir'`;
 assert.match((await visit('/member/overview', member)).headers.get('location') ?? '', /\/login$/, 'An old cookie stays revoked after reactivation');
 assert.equal((await visit('/member/overview', await sessionCookie('u-member-kabir', 'member', SESSION_SECRET, 1))).status, 200);
});

test('responses carry security headers', async () => {
 const response = await visit('/login');
 assert.equal(response.headers.get('x-frame-options'), 'DENY');
 assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
 assert.match(response.headers.get('content-security-policy') ?? '', /frame-ancestors 'none'/);
 assert.equal(response.headers.get('x-powered-by'), null);
});

// Submits a server-action form the way a browser without JavaScript would.
async function submitForm(path, fields, ip = '10.20.30.40', cookie) {
 const html = await (await fetch(baseUrl + path, {headers: cookie ? {cookie} : {}})).text();
 const form = html.match(/<form[^>]*>[\s\S]*?<\/form>/)[0];
 const body = new FormData();
 for (const m of form.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
  const name = m[0].match(/name="([^"]+)"/)?.[1];
  if (name) body.append(name, (m[0].match(/value="([^"]*)"/)?.[1] ?? '').replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
 }
 for (const [k, v] of Object.entries(fields)) body.append(k, v);
 return fetch(baseUrl + path, {method: 'POST', body, redirect: 'manual', headers: {origin: baseUrl, 'x-forwarded-for': ip, ...(cookie ? {cookie} : {})}});
}

test('visitors register, answer the onboarding questions, and staff see their answers', async () => {
 const page = await visit('/register');
 assert.equal(page.status, 200);
 const html = await page.text();
 for (const name of ['name', 'email', 'password', 'adult', 'privacy']) assert.match(html, new RegExp(`name="${name}"`), name);
 const fields = {name: 'Lina Haddad', email: 'lina@example.com', phone: '+971 50 000 0000', password: 'LinaPass#2026'};
 const refused = await submitForm('/register', fields);
 assert.equal(refused.headers.get('set-cookie')?.includes('rc_session='), undefined, 'The adult confirmation is required');
 const noConsent = await submitForm('/register', {...fields, adult: 'on'}, '10.20.30.42');
 assert.match(await noConsent.text(), /accept the privacy policy/, 'Privacy consent is required');
 const created = await submitForm('/register', {...fields, adult: 'on', privacy: 'on'});
 const cookie = (created.headers.get('set-cookie') ?? '').match(/rc_session=[^;]+/)?.[0];
 assert.ok(cookie, 'Registration signs the member in');
 assert.match(created.headers.get('location') ?? created.headers.get('x-action-redirect') ?? '', /\/onboarding/);
 // Until the questions are answered the dashboard sends them back to onboarding.
 assert.match((await visit('/member/overview', cookie)).headers.get('location') ?? '', /\/onboarding$/);
 const onboarding = await visit('/onboarding', cookie);
 assert.equal(onboarding.status, 200);
 assert.doesNotMatch(await onboarding.text(), /<dialog\b/i, 'Onboarding is a page, not a modal');
 const answered = await submitForm('/onboarding', {goal: 'Improve mobility', place: 'At a gym', days: '2 days a week'}, undefined, cookie);
 assert.match(answered.headers.get('location') ?? answered.headers.get('x-action-redirect') ?? '', /\/member\/overview/);
 const [client] = await sql`select c.id, c.stage, c.goal, c.intake, u.role from clients c join users u on u.id = c.user_id where c.email = 'lina@example.com'`;
 assert.equal(client.role, 'member');
 assert.equal(client.stage, 'Onboarding', 'With payments locked, new members skip payment review');
 assert.equal(client.goal, 'Improve mobility');
 assert.deepEqual(client.intake, {place: 'At a gym', days: '2 days a week'});
 assert.match((await visit('/onboarding', cookie)).headers.get('location') ?? '', /\/member\/overview$/, 'Onboarding is asked once');
 const detail = readableText(await (await visit(`/admin/clients/${client.id}`, await sessionCookie('u-admin', 'admin'))).text());
 assert.match(detail, /At a gym · 2 days a week/);
 const [{privacy_accepted_at: consented}] = await sql`select privacy_accepted_at from users where email = 'lina@example.com'`;
 assert.ok(consented, 'Consent time is recorded');
 const again = await submitForm('/register', {...fields, adult: 'on', privacy: 'on'}, '10.20.30.41');
 assert.match(await again.text(), /already exists/);
 assert.match((await visit('/register', await sessionCookie('u-member-aarav', 'member'))).headers.get('location') ?? '', /\/member\/overview$/);
});

test('members without a schedule see no invented workouts', async () => {
 const [{session_version: v}] = await sql`select session_version from users where id = 'u-member-kabir'`;
 const member = await sessionCookie('u-member-kabir', 'member', SESSION_SECRET, v);
 const plan = readableText(await (await visit('/member/plan', member)).text());
 assert.match(plan, /Your plan is on its way/);
 for (const path of ['/member/overview', '/member/plan', '/member/progress', '/member/leaderboard', '/member/profile', '/member/nutrition']) {
  // Email addresses are ignored: the seeded test accounts live on repcount.demo.
  const text = readableText(await (await visit(path, member)).text()).replace(/\S+@\S+/g, '');
  assert.doesNotMatch(text, /\b(?:demo|sample|preview|illustrative)\b/i, path);
 }
});

/* ---- Server actions called the way the browser calls them: POST with the action's id from the build manifest. ---- */
let actionIds;
async function callAction(file, name, args, cookie, path = '/') {
 actionIds ??= JSON.parse(readFileSync('.next/server/server-reference-manifest.json', 'utf8')).node;
 const id = Object.entries(actionIds).find(([, a]) => a.filename === file && a.exportedName === name)?.[0];
 assert.ok(id, `No server action ${name} in ${file}`);
 const response = await fetch(baseUrl + path, {method: 'POST', redirect: 'manual', body: JSON.stringify(args),
  headers: {'next-action': id, 'content-type': 'text/plain;charset=UTF-8', accept: 'text/x-component', origin: baseUrl, cookie}});
 // The RSC payload carries the returned {ok} / {error} object as JSON on one of its lines.
 const text = await response.text();
 const line = text.split('\n').map(l => l.replace(/^[0-9a-f]+:/, '')).find(l => /^\{"(?:ok|error|stale)"/.test(l));
 return line ? JSON.parse(line) : {raw: text, status: response.status};
}
const currentCookie = async (userId, role) => {
 const [{session_version: v}] = await sql`select session_version from users where id = ${userId}`;
 return sessionCookie(userId, role, SESSION_SECRET, v);
};
const tokenFrom = message => message.match(/\/reset-password\?token=([\w-]+)/)?.[1];

test('the admin edits a trainer’s email, title and password; a new password ends old sessions', async () => {
 const admin = await sessionCookie('u-admin', 'admin');
 const oldTrainer = await currentCookie('u-trainer-2', 'trainer');
 const taken = await callAction('app/actions/data.ts', 'editTrainer', ['u-trainer-2', {name: 'Trainer 2', email: 'trainer@repcount.demo', title: 'Coach', password: ''}], admin, '/admin');
 assert.match(taken.error ?? '', /already signs in with that email/);
 assert.match((await callAction('app/actions/data.ts', 'editTrainer', ['u-trainer-2', {name: 'Trainer 2', email: 'bad', title: '', password: ''}], admin, '/admin')).error ?? '', /valid email/);
 assert.match((await callAction('app/actions/data.ts', 'editTrainer', ['u-trainer-2', {name: 'Trainer 2', email: 'coach2@example.com', title: '', password: 'short'}], admin, '/admin')).error ?? '', /at least 8/);
 const saved = await callAction('app/actions/data.ts', 'editTrainer', ['u-trainer-2', {name: 'Sam Coach', email: 'Coach2@Example.com', title: 'Strength coach', password: 'NewCoach#2026'}], admin, '/admin');
 assert.match(saved.ok ?? JSON.stringify(saved), /details saved/);
 const [row] = await sql`select name, email, title, session_version from users where id = 'u-trainer-2'`;
 assert.deepEqual({name: row.name, email: row.email, title: row.title}, {name: 'Sam Coach', email: 'coach2@example.com', title: 'Strength coach'});
 assert.match((await visit('/trainer', oldTrainer)).headers.get('location') ?? '', /\/login$/, 'The old session is signed out');
 const signedIn = await submitForm('/login', {email: 'coach2@example.com', password: 'NewCoach#2026'}, '10.9.9.1');
 assert.match(signedIn.headers.get('location') ?? '', /\/trainer$/, 'The new email and password sign in');
 const old = await submitForm('/login', {email: 'trainer2@repcount.demo', password: 'Trainer2#2026'}, '10.9.9.2');
 assert.match(await old.text(), /don’t match an account/, 'The old email no longer works');
 // Only an admin may edit trainers.
 assert.equal((await callAction('app/actions/data.ts', 'editTrainer', ['u-trainer-akif', {name: 'X', email: 'x@example.com', title: '', password: ''}], await sessionCookie('u-trainer-akif', 'trainer'), '/admin')).ok, undefined);
 const [akif] = await sql`select email from users where id = 'u-trainer-akif'`;
 assert.equal(akif.email, 'trainer@repcount.demo');
});

test('the admin edits a member’s email, training space and rhythm', async () => {
 const admin = await sessionCookie('u-admin', 'admin');
 const base = {name: 'Kabir Mehta', email: 'member2@repcount.demo', phone: '', goal: 'Lose body fat', dob: '', gender: '', heightCm: ''};
 const partial = await callAction('app/actions/data.ts', 'editClientDetails', ['c-kabir', {...base, place: 'At a gym', days: ''}], admin, '/admin/clients/c-kabir');
 assert.match(partial.error ?? '', /both where they train and how often/);
 const clash = await callAction('app/actions/data.ts', 'editClientDetails', ['c-kabir', {...base, email: 'member@repcount.demo', place: '', days: ''}], admin, '/admin/clients/c-kabir');
 assert.match(clash.error ?? '', /already signs in/);
 const saved = await callAction('app/actions/data.ts', 'editClientDetails', ['c-kabir', {...base, email: 'kabir@example.com', place: 'A mix of both', days: '4 days a week'}], admin, '/admin/clients/c-kabir');
 assert.match(saved.ok ?? JSON.stringify(saved), /details saved/);
 const [c] = await sql`select c.email, c.intake, u.email as login from clients c join users u on u.id = c.user_id where c.id = 'c-kabir'`;
 assert.deepEqual(c.intake, {place: 'A mix of both', days: '4 days a week'});
 assert.equal(c.email, 'kabir@example.com');
 assert.equal(c.login, 'kabir@example.com', 'The sign-in email changes too');
 assert.match(readableText(await (await visit('/admin/clients/c-kabir', admin)).text()), /A mix of both · 4 days a week/);
 // Leaving both blank keeps the member's own onboarding answers.
 await callAction('app/actions/data.ts', 'editClientDetails', ['c-kabir', {...base, email: 'kabir@example.com', place: '', days: ''}], admin, '/admin/clients/c-kabir');
 assert.deepEqual((await sql`select intake from clients where id = 'c-kabir'`)[0].intake, {place: 'A mix of both', days: '4 days a week'});
});

test('onboarding progress fills a third per question', async () => {
 await sql`insert into users (id, email, name, initials, role) values ('u-member-onb', 'onb@example.com', 'Omar B', 'OB', 'member')`;
 await sql`insert into clients (id, user_id, name, initials, stage, goal) values ('c-onb', 'u-member-onb', 'Omar B', 'OB', 'Payment review', '')`;
 const html = await (await visit('/onboarding', await sessionCookie('u-member-onb', 'member'))).text();
 assert.match(html, /rc-onb-progress[^>]*><i style="width:33%"/);
 assert.match(html, /0?1 \/ 03/);
});

test('the trainer’s week planner shows the member’s preferred rhythm', async () => {
 const akif = await sessionCookie('u-trainer-akif', 'trainer');
 await sql`update clients set intake = ${sql.json({place: 'At home', days: '2 days a week'})} where id = 'c-aarav'`;
 const text = readableText(await (await visit('/trainer/clients/c-aarav/workouts', akif)).text());
 assert.match(text, /Aarav prefers 2 days a week · at home\s*\./);
 // The earlier schedule test planned 7 workouts this week, so the mismatch is pointed out.
 assert.match(text, /This week has 7 workout\s*s\s*\. Worth agreeing the rhythm together\./);
});

test('unknown weeks and days of the planner are real 404s', async () => {
 const akif = await sessionCookie('u-trainer-akif', 'trainer');
 for (const path of ['/trainer/clients/c-aarav/workouts/2001-01-01/monday', `/trainer/clients/c-aarav/workouts/${istWeekStart()}/funday`]) {
  assert.equal((await visit(path, akif)).status, 404, path);
 }
});

test('forgot password sends the same reply for any email and stores only a hashed link', async () => {
 const login = await (await visit('/login')).text();
 assert.match(login, /href="\/forgot-password"/, 'Forgot? links to the reset page');
 const page = await visit('/forgot-password');
 assert.equal(page.status, 200);
 const known = readableText(await (await submitForm('/forgot-password', {email: 'member@repcount.demo'}, '10.7.0.1')).text());
 const unknown = readableText(await (await submitForm('/forgot-password', {email: 'nobody@example.com'}, '10.7.0.2')).text());
 assert.match(known, /Check your inbox/);
 assert.match(unknown, /Check your inbox/, 'No hint whether the account exists');
 const tokens = await sql`select t.token_hash, t.purpose, t.expires_at - now() as ttl from password_tokens t join users u on u.id = t.user_id where u.email = 'member@repcount.demo'`;
 assert.equal(tokens.length, 1);
 assert.equal(tokens[0].purpose, 'reset');
 assert.match(tokens[0].token_hash, /^[0-9a-f]{64}$/);
 for (let i = 0; i < 3; i++) await submitForm('/forgot-password', {email: 'limit@example.com'}, '10.7.0.3');
 assert.match(readableText(await (await submitForm('/forgot-password', {email: 'limit@example.com'}, '10.7.0.3')).text()), /Too many reset requests/);
});

test('a reset link sets a new password once, needs consent and signs out old sessions', async () => {
 const admin = await sessionCookie('u-admin', 'admin');
 const oldSession = await currentCookie('u-member-onb', 'member');
 await sql`update users set password_hash = null where id = 'u-member-onb'`;
 const sent = await callAction('app/actions/data.ts', 'sendResetLink', ['u-member-onb', 'c-onb'], admin, '/admin/clients/c-onb');
 assert.match(sent.ok ?? JSON.stringify(sent), /Email isn’t set up/, 'Without email, the admin gets the link to pass on');
 const token = tokenFrom(sent.ok);
 assert.ok(token);
 assert.equal((await sql`select count(*)::int as n from password_tokens where token_hash = ${createHash('sha256').update(token).digest('hex')}`)[0].n, 1, 'Stored hashed');
 const path = `/reset-password?token=${token}`;
 assert.match(readableText(await (await visit(path)).text()), /Choose a new password/);
 assert.match(readableText(await (await submitForm(path, {password: 'OmarPass#2026', confirm: 'Different#2026', privacy: 'on'})).text()), /don’t match/);
 assert.match(readableText(await (await submitForm(path, {password: 'OmarPass#2026', confirm: 'OmarPass#2026'})).text()), /accept the privacy policy/);
 const done = await submitForm(path, {password: 'OmarPass#2026', confirm: 'OmarPass#2026', privacy: 'on'});
 assert.match(done.headers.get('location') ?? '', /\/login\?notice=password_set$/);
 assert.match(readableText(await (await visit('/login?notice=password_set')).text()), /Your password is saved/);
 assert.match((await visit('/onboarding', oldSession)).headers.get('location') ?? '', /\/login$/, 'Old sessions are signed out');
 assert.match((await submitForm('/login', {email: 'onb@example.com', password: 'OmarPass#2026'}, '10.7.1.1')).headers.get('location') ?? '', /\/member\/overview$/);
 assert.match(readableText(await (await visit(path)).text()), /This link has expired/, 'A link works only once');
 assert.match(readableText(await (await visit('/reset-password?token=not-a-real-token-at-all-123')).text()), /This link has expired/);
 // Expired links are refused too.
 const fresh = tokenFrom((await callAction('app/actions/data.ts', 'sendResetLink', ['u-member-onb'], admin, '/admin')).ok);
 await sql`update password_tokens set expires_at = now() - interval '1 minute' where token_hash = ${createHash('sha256').update(fresh).digest('hex')}`;
 assert.match(readableText(await (await visit(`/reset-password?token=${fresh}`)).text()), /This link has expired/);
 // Only an admin can issue a reset link.
 const aaravLinks = async () => (await sql`select count(*)::int as n from password_tokens where user_id = 'u-member-aarav'`)[0].n;
 const before = await aaravLinks();
 assert.equal((await callAction('app/actions/data.ts', 'sendResetLink', ['u-member-aarav'], await sessionCookie('u-trainer-akif', 'trainer'), '/admin')).ok, undefined);
 assert.equal(await aaravLinks(), before, 'No link was issued');
});

test('people the admin adds without a password get an invitation link', async () => {
 const admin = await sessionCookie('u-admin', 'admin');
 const added = await callAction('app/actions/data.ts', 'addTrainer', [{name: 'Nora Lane', email: 'nora@example.com', title: 'Trainer', password: ''}], admin, '/admin');
 assert.match(added.ok ?? JSON.stringify(added), /invitation link/);
 const page = readableText(await (await visit(`/reset-password?token=${tokenFrom(added.ok)}`)).text());
 assert.match(page, /Welcome, Nora\s*\./);
 assert.match(page, /privacy policy/);
 const [{purpose}] = await sql`select t.purpose from password_tokens t join users u on u.id = t.user_id where u.email = 'nora@example.com'`;
 assert.equal(purpose, 'invite');
 const member = await callAction('app/actions/data.ts', 'addClient', [{name: 'Ivy Park', email: 'ivy@example.com', phone: '', goal: '', trainerId: '', password: ''}], admin, '/admin');
 assert.match(member.ok ?? JSON.stringify(member), /invitation link/);
 const withPassword = await callAction('app/actions/data.ts', 'addClient', [{name: 'Ravi Das', email: 'ravi@example.com', phone: '', goal: '', trainerId: '', password: 'RaviPass#2026'}], admin, '/admin');
 assert.doesNotMatch(withPassword.ok ?? '', /invitation/, 'No invitation when the admin sets a password');
});

test('trainers reply to members’ questions and members see the conversation', async () => {
 const aarav = await currentCookie('u-member-aarav', 'member');
 const asked = await callAction('app/actions/data.ts', 'askCoach', ['Can I swap squats for lunges?'], aarav, '/member/profile');
 assert.match(asked.ok ?? JSON.stringify(asked), /Profile/);
 const akif = await sessionCookie('u-trainer-akif', 'trainer');
 const staffView = readableText(await (await visit('/trainer/clients/c-aarav/messages', akif)).text());
 assert.match(staffView, /Messages with Aarav/);
 assert.match(staffView, /Can I swap squats for lunges\?/);
 assert.match(staffView, /Reply to Aarav/);
 assert.match((await callAction('app/actions/data.ts', 'replyToMember', ['c-aarav', ' '], akif, '/trainer/clients/c-aarav')).error ?? '', /Write your reply/);
 const replied = await callAction('app/actions/data.ts', 'replyToMember', ['c-aarav', 'Yes, reverse lunges, 3 × 8 each leg.'], akif, '/trainer/clients/c-aarav');
 assert.match(replied.ok ?? JSON.stringify(replied), /Reply sent/);
 // A trainer can't reply to someone else's member; a member can't use the staff reply at all.
 const other = await currentCookie('u-trainer-2', 'trainer');
 const otherReply = await callAction('app/actions/data.ts', 'replyToMember', ['c-aarav', 'Hello'], other, '/trainer/clients/c-aarav');
 assert.match(otherReply.error ?? JSON.stringify(otherReply), /isn’t assigned to you/);
 assert.equal((await callAction('app/actions/data.ts', 'replyToMember', ['c-aarav', 'Hello'], aarav, '/member/profile')).ok, undefined);
 const profile = readableText(await (await visit('/member/profile', aarav)).text());
 assert.match(profile, /Messages with Akif/);
 assert.match(profile, /Can I swap squats for lunges\?.*Yes, reverse lunges, 3 × 8 each leg\./, 'Oldest first');
 const counts = await sql`select author_id, count(*)::int as n from messages where client_id = 'c-aarav' group by author_id order by author_id`;
 assert.deepEqual(counts.map(r => [r.author_id, r.n]), [['u-member-aarav', 1], ['u-trainer-akif', 1]], 'Only the assigned trainer’s reply was stored');
});

test('the privacy policy is public and linked from sign-up and the footer', async () => {
 const page = await visit('/privacy');
 assert.equal(page.status, 200);
 const text = readableText(await page.text());
 assert.match(text, /Privacy policy/);
 assert.match(text, /What we collect/);
 assert.match(text, /Who can see it/);
 assert.match(text, /delete/);
 assert.match(await (await visit('/register')).text(), /href="\/privacy"/);
 assert.match(await productionHomepage(), /href="\/privacy"/);
});

/* ---- The admin can manage and edit every record ---- */

test('the admin plans workouts, call links, sessions and nutrition for any client', async () => {
 const admin = await sessionCookie('u-admin', 'admin');
 const week = istWeekStart();
 const workouts = readableText(await (await visit('/admin/clients/c-riya/workouts', admin)).text());
 assert.match(workouts, /Riya\s*’s week/);
 assert.equal((await visit(`/admin/clients/c-riya/workouts/${week}/funday`, admin)).status, 404);
 assert.match(readableText(await (await visit(`/admin/clients/c-riya/workouts/${week}/monday`, admin)).text()), /Save Monday/);
 const plan = [{title: 'Mobility & stretch', exercises: ['Cat-cow · 1 min'], time: '07:00', durationMin: 20, meetingUrl: 'https://meet.google.com/aaa-bbbb-ccc'}, null, null, null, null, null, null];
 const saved = await callAction('app/actions/data.ts', 'saveSchedule', ['c-riya', week, plan], admin, `/admin/clients/c-riya/workouts/${week}/monday`);
 assert.match(saved.ok ?? JSON.stringify(saved), /1 workout scheduled/);
 assert.equal((await sql`select count(*)::int as n from workout_plans where client_id = 'c-riya' and week_start = ${week}`)[0].n, 1);
 const booking = {title: 'Introduction call', date: week, start: '19:00', meetingUrl: 'https://zoom.us/j/999'};
 assert.match((await callAction('app/actions/sessions.ts', 'saveSession', ['c-riya', {...booking, title: ' '}], admin, '/admin/clients/c-riya/sessions')).error ?? '', /Give the session a title/);
 assert.match((await callAction('app/actions/sessions.ts', 'saveSession', ['c-riya', {...booking, meetingUrl: 'zoom.us/j/1'}], admin, '/admin/clients/c-riya/sessions')).error ?? '', /https:\/\//);
 const booked = await callAction('app/actions/sessions.ts', 'saveSession', ['c-riya', booking], admin, '/admin/clients/c-riya/sessions');
 assert.match(booked.ok ?? JSON.stringify(booked), /Session booked/);
 const nutrition = await callAction('app/actions/data.ts', 'saveNutritionPlan', ['c-riya', {calories: 1800, protein: 90, meals: [{name: 'Breakfast', detail: 'Oats and fruit'}], notes: ''}], admin, '/admin/clients/c-riya/nutrition');
 assert.match(nutrition.ok ?? JSON.stringify(nutrition), /Nutrition plan saved/);
 const session = await callAction('app/actions/data.ts', 'confirmSession', ['c-riya', week, true], admin, '/admin/clients/c-riya');
 assert.match(session.ok ?? JSON.stringify(session), /marked completed/);
 const [riya] = await sql`select (select meeting_url from sessions where client_id = 'c-riya') as meeting_url, (select title from sessions where client_id = 'c-riya') as title, (select count(*)::int from nutrition_plans where client_id = 'c-riya') as plans, (select count(*)::int from session_confirmations where client_id = 'c-riya') as sessions`;
 assert.deepEqual({...riya}, {meeting_url: 'https://zoom.us/j/999', title: 'Introduction call', plans: 1, sessions: 1});
 const overview = readableText(await (await visit('/admin/clients/c-riya', admin)).text());
 for (const tab of ['Workout plan', 'Nutrition', 'Sessions', 'Messages', 'Calendar', 'Progress & history']) assert.ok(overview.includes(tab.replace('&', '&amp;')) || overview.includes(tab), tab);
 // A trainer still can't touch someone else's client.
 assert.match((await callAction('app/actions/sessions.ts', 'saveSession', ['c-riya', {title: 'Check-in', date: week, start: '10:00', meetingUrl: ''}], await sessionCookie('u-trainer-akif', 'trainer'), '/trainer/clients/c-aarav/sessions')).error ?? '', /isn’t assigned to you/);
 const [riyaSession] = await sql`select id from sessions where client_id = 'c-riya'`;
 assert.match((await callAction('app/actions/sessions.ts', 'moveSession', [Number(riyaSession.id), week, '20:00'], await sessionCookie('u-trainer-akif', 'trainer'), '/trainer')).error ?? '', /isn’t assigned to you/);
});

test('the admin edits membership dates; payments stay locked until phase 2', async () => {
 const admin = await sessionCookie('u-admin', 'admin');
 const [m0] = await sql`select paid, stage, payment_reference from clients where id = 'c-maya'`;
 const maya = await callAction('app/actions/data.ts', 'editMembership', ['c-maya', {paid: !m0.paid, reference: 'UPI-77777', joinedOn: '2026-10-01', nextCheckIn: 'Sat · 9:00 AM'}], admin, '/admin/clients/c-maya');
 assert.match(maya.ok ?? JSON.stringify(maya), /membership saved/);
 const [m] = await sql`select paid, stage, payment_reference, joined_on::text as joined, next_checkin from clients where id = 'c-maya'`;
 assert.deepEqual({...m}, {paid: m0.paid, stage: m0.stage, payment_reference: m0.payment_reference, joined: '2026-10-01', next_checkin: 'Sat · 9:00 AM'}, 'Only the dates change while payments are locked');
 assert.match((await callAction('app/actions/data.ts', 'editMembership', ['c-maya', {paid: true, reference: '', joinedOn: '01/10/2026', nextCheckIn: ''}], admin, '/admin/clients/c-maya')).error ?? '', /valid join date/);
 assert.match((await callAction('app/actions/data.ts', 'verifyPayment', ['c-maya'], admin, '/admin')).error ?? '', /phase 2/);
 // For a member with an account, the change reaches their app too.
 const [{revision: before}] = await sql`select revision from member_state where user_id = 'u-member-kabir'`.then(r => r.length ? r : [{revision: 0}]);
 await callAction('app/actions/data.ts', 'editMembership', ['c-kabir', {paid: false, reference: 'BANK-123', joinedOn: '2026-10-20', nextCheckIn: 'Mon · 7:00 PM'}], admin, '/admin/clients/c-kabir');
 const [k] = await sql`select ms.data->>'booking' as booking, ms.revision from clients c join member_state ms on ms.user_id = c.user_id where c.id = 'c-kabir'`;
 assert.equal(k.booking, 'Mon · 7:00 PM');
 assert.ok(k.revision > before);
 assert.equal((await callAction('app/actions/data.ts', 'editMembership', ['c-maya', {paid: false, reference: '', joinedOn: '', nextCheckIn: ''}], await sessionCookie('u-trainer-akif', 'trainer'), '/admin/clients/c-maya')).ok, undefined);
 // The admin Payments page shows the locked state.
 assert.match(await (await visit('/admin?tab=payments', admin)).text(), /Payments are locked for now/);
});

test('client status is Unassigned, Assigned or Deactivated, and the admin deactivates and activates clients', async () => {
 const admin = await sessionCookie('u-admin', 'admin');
 const page = await (await visit('/admin?tab=clients', admin)).text();
 assert.match(page, /data-status="assigned"/);
 const off = await callAction('app/actions/data.ts', 'setClientActive', ['c-maya', false], admin, '/admin/clients/c-maya');
 assert.match(off.ok ?? JSON.stringify(off), /deactivated and signed out/);
 const [u] = await sql`select u.active from users u join clients c on c.user_id = u.id where c.id = 'c-maya'`;
 if (u) assert.equal(u.active, false, 'Their sign-in is blocked too');
 const detail = readableText(await (await visit('/admin/clients/c-maya', admin)).text());
 assert.match(detail, /Activate client .* Activate/);
 assert.doesNotMatch(detail, /Cancel membership|Restore membership|Delete client/);
 const on = await callAction('app/actions/data.ts', 'setClientActive', ['c-maya', true], admin, '/admin/clients/c-maya');
 assert.match(on.ok ?? JSON.stringify(on), /active again \(unassigned\)/);
 const [row] = await sql`select cancelled_at, trainer_id from clients where id = 'c-maya'`;
 assert.deepEqual({...row}, {cancelled_at: null, trainer_id: null}, 'Activated clients come back unassigned');
 assert.equal((await callAction('app/actions/data.ts', 'setClientActive', ['c-maya', false], await sessionCookie('u-trainer-akif', 'trainer'), '/admin/clients/c-maya')).ok, undefined, 'Only admins deactivate');
});

test('the blog: starter articles, admin publishing, SEO pages and the WhatsApp button', async () => {
 const admin = await sessionCookie('u-admin', 'admin');
 const list = await visit('/blog');
 assert.equal(list.status, 200);
 const listHtml = await list.text();
 assert.match(listHtml, /How much protein do you need/);
 assert.doesNotMatch(listHtml, /noindex/, 'The blog is indexable');
 const article = await (await visit('/blog/how-much-protein-do-you-need')).text();
 assert.match(article, /application\/ld\+json/);
 assert.match(article, /rel="canonical"[^>]*\/blog\/how-much-protein-do-you-need/);
 assert.equal((await visit('/blog/not-a-real-post')).status, 404);

 const saved = await callAction('app/actions/data.ts', 'savePost', [null, {title: 'Test draft article', slug: '', excerpt: 'A draft.', body: 'Draft body text that is long enough.', coverUrl: '', published: false}], admin, '/admin?tab=blog');
 assert.match(saved.ok ?? JSON.stringify(saved), /draft/);
 assert.equal((await visit('/blog/test-draft-article')).status, 404, 'Drafts are not public');
 const [post] = await sql`select id from posts where slug = 'test-draft-article'`;
 await callAction('app/actions/data.ts', 'savePost', [Number(post.id), {title: 'Test draft article', slug: 'test-draft-article', excerpt: 'Now live.', body: '## Hello\n\nSome **bold** text and <script>alert(1)</script>.', coverUrl: '', published: true}], admin, '/admin?tab=blog');
 const live = await (await visit('/blog/test-draft-article')).text();
 assert.match(live, /<h2>Hello<\/h2>/);
 assert.match(live, /<strong>bold<\/strong>/);
 assert.doesNotMatch(live, /<script>alert/, 'Raw HTML in an article is escaped');
 assert.match((await callAction('app/actions/data.ts', 'savePost', [null, {title: 'Duplicate', slug: 'test-draft-article', excerpt: '', body: 'Another body long enough.', coverUrl: '', published: true}], admin, '/admin?tab=blog')).error ?? '', /already uses/);
 assert.match(await (await visit('/sitemap.xml')).text(), /\/blog\/test-draft-article/);
 assert.match(await (await visit('/robots.txt')).text(), /Disallow: \/admin/);
 assert.match((await callAction('app/actions/data.ts', 'deletePost', [Number(post.id)], admin, '/admin?tab=blog')).ok ?? '', /deleted/);

 assert.doesNotMatch(await (await visit('/')).text(), /wa\.me\//, 'No WhatsApp button until a number is set');
 assert.match((await callAction('app/actions/data.ts', 'saveWhatsApp', [{number: '12'}], admin, '/admin?tab=settings')).error ?? '', /country code/);
 await callAction('app/actions/data.ts', 'saveWhatsApp', [{number: '+971 50 123 4567'}], admin, '/admin?tab=settings');
 assert.match(await (await visit('/')).text(), /wa\.me\/971501234567/);
 assert.match(await (await visit('/blog')).text(), /wa\.me\/971501234567/);
 await callAction('app/actions/data.ts', 'saveWhatsApp', [{number: ''}], admin, '/admin?tab=settings');
});

test('the admin corrects a member’s own log, and the member’s stale app can’t overwrite it', async () => {
 const admin = await sessionCookie('u-admin', 'admin');
 const progress = readableText(await (await visit('/admin/clients/c-aarav/progress', admin)).text());
 assert.match(progress, /Edit Aarav\s*’s log/);
 const today = new Date().toLocaleDateString('en-CA', {timeZone: 'Asia/Kolkata'});
 const future = await callAction('app/actions/data.ts', 'editMemberLog', ['c-aarav', {weights: [{label: '2099-01-01', value: 70}], fats: [], water: 0, steps: 0, sleep: null, mood: null, checkinSubmitted: false}], admin, '/admin/clients/c-aarav/progress');
 assert.match(future.error ?? '', /date up to today/);
 assert.match((await callAction('app/actions/data.ts', 'editMemberLog', ['c-aarav', {weights: [{label: today, value: 5}], fats: [], water: 0, steps: 0, sleep: null, mood: null, checkinSubmitted: false}], admin, '/admin/clients/c-aarav/progress')).error ?? '', /between 20 and 400/);
 const [{revision: loaded}] = await sql`select revision from member_state where user_id = 'u-member-aarav'`;
 const saved = await callAction('app/actions/data.ts', 'editMemberLog', ['c-aarav', {weights: [{label: '2026-11-01', value: 77.5}, {label: today, value: 76.9}], fats: [{label: today, value: 25.5}], water: 4, steps: 5200, sleep: 7, mood: 'Good', checkinSubmitted: false}], admin, '/admin/clients/c-aarav/progress');
 assert.match(saved.ok ?? JSON.stringify(saved), /log saved/);
 const [row] = await sql`select data, revision from member_state where user_id = 'u-member-aarav'`;
 assert.deepEqual(row.data.tracker.weights, [{label: '2026-11-01', value: 77.5}, {label: today, value: 76.9}]);
 assert.equal(row.data.tracker.steps, 5200);
 assert.equal(row.data.tracker.mood, 'Good');
 assert.equal(row.revision, loaded + 1);
 const member = await currentCookie('u-member-aarav', 'member');
 const stale = await callAction('app/actions/data.ts', 'saveProgress', [{...row.data, tracker: {...row.data.tracker, weights: []}}, loaded], member, '/member/overview');
 assert.equal(stale.stale, true, 'A save from before the correction is refused');
 assert.deepEqual((await sql`select data from member_state where user_id = 'u-member-aarav'`)[0].data.tracker.weights.length, 2, 'The correction survives');
 const fresh = await callAction('app/actions/data.ts', 'saveProgress', [{...row.data, tracker: {...row.data.tracker, water: 5}}, loaded + 1], member, '/member/overview');
 assert.equal(fresh.stale, false, 'A save from the current revision goes through');
 assert.match(await (await visit('/member/overview', member)).text(), /76\.9/);
});

test('the admin removes messages; trainers cannot', async () => {
 const admin = await sessionCookie('u-admin', 'admin');
 const [{id}] = await sql`select id::int as id from messages where client_id = 'c-aarav' order by id limit 1`;
 const trainerTry = await callAction('app/actions/data.ts', 'deleteClientMessage', ['c-aarav', id], await sessionCookie('u-trainer-akif', 'trainer'), '/trainer/clients/c-aarav');
 assert.equal(trainerTry.ok, undefined);
 assert.equal((await sql`select count(*)::int as n from messages where id = ${id}`)[0].n, 1);
 const removed = await callAction('app/actions/data.ts', 'deleteClientMessage', ['c-aarav', id], admin, '/admin/clients/c-aarav');
 assert.match(removed.ok ?? JSON.stringify(removed), /Message removed/);
 assert.equal((await sql`select count(*)::int as n from messages where id = ${id}`)[0].n, 0);
 assert.match((await callAction('app/actions/data.ts', 'deleteClientMessage', ['c-aarav', id], admin, '/admin/clients/c-aarav')).error ?? '', /no longer exists/);
});

test('clients can’t be deleted from the admin, only deactivated', async () => {
 const admin = await sessionCookie('u-admin', 'admin');
 const page = readableText(await (await visit('/admin/clients/c-onb', admin)).text());
 assert.match(page, /Deactivate client/);
 assert.doesNotMatch(page, /Delete client/);
 const manifest = JSON.parse(readFileSync('.next/server/server-reference-manifest.json', 'utf8')).node;
 assert.ok(!Object.values(manifest).some(a => a.exportedName === 'deleteClient'), 'There is no delete-client action');
});

test('the admin permanently deletes a trainer; their members become unassigned', async () => {
 const admin = await sessionCookie('u-admin', 'admin');
 const [nora] = await sql`select id from users where email = 'nora@example.com'`;
 await sql`update clients set trainer_id = ${nora.id} where id = 'c-neha'`;
 assert.match((await callAction('app/actions/data.ts', 'deleteTrainer', [nora.id, 'Nor'], admin, '/admin')).error ?? '', /Type Nora Lane exactly/);
 const deleted = await callAction('app/actions/data.ts', 'deleteTrainer', [nora.id, 'Nora Lane'], admin, '/admin');
 assert.match(deleted.ok ?? JSON.stringify(deleted), /Their members are now unassigned/);
 assert.equal((await sql`select count(*)::int as n from users where id = ${nora.id}`)[0].n, 0);
 assert.equal((await sql`select trainer_id from clients where id = 'c-neha'`)[0].trainer_id, null);
 const [akif] = await sql`select id from users where email = 'trainer@repcount.demo'`;
 assert.match(readableText(await (await visit(`/admin/trainers/${akif.id}`, admin)).text()), /Delete trainer permanently/);
});

test('admins manage admin accounts, but never deactivate themselves', async () => {
 const admin = await sessionCookie('u-admin', 'admin');
 const added = await callAction('app/actions/data.ts', 'addAdmin', [{name: 'Second Admin', email: 'admin2@example.com', password: 'Admin2Pass#2026'}], admin, '/admin');
 assert.match(added.ok ?? JSON.stringify(added), /added as an admin/);
 assert.match((await callAction('app/actions/data.ts', 'addAdmin', [{name: 'Dup', email: 'admin2@example.com', password: ''}], admin, '/admin')).error ?? '', /already exists/);
 const [second] = await sql`select id, role from users where email = 'admin2@example.com'`;
 assert.equal(second.role, 'admin');
 const settings = readableText(await (await visit('/admin?tab=admins', admin)).text());
 assert.match(settings, /All admins/);
 assert.match(settings, /Second Admin/);
 assert.match(settings, /Super admin \(you\)/);
 const edited = await callAction('app/actions/data.ts', 'editAdmin', [second.id, {name: 'Second Admin', email: 'admin.two@example.com', password: ''}], admin, '/admin');
 assert.match(edited.ok ?? JSON.stringify(edited), /details saved/);
 assert.equal((await sql`select email from users where id = ${second.id}`)[0].email, 'admin.two@example.com');
 assert.match((await callAction('app/actions/data.ts', 'editAdmin', [second.id, {name: 'Second Admin', email: 'trainer@repcount.demo', password: ''}], admin, '/admin')).error ?? '', /already signs in/);
 const renamed = await callAction('app/actions/data.ts', 'editAdmin', ['u-admin', {name: 'Head Admin', email: 'admin@repcount.demo', password: ''}], admin, '/admin');
 assert.match(renamed.ok ?? JSON.stringify(renamed), /details saved/);
 assert.equal((await sql`select name from users where id = 'u-admin'`)[0].name, 'Head Admin');
 assert.match((await callAction('app/actions/data.ts', 'setAccountActive', ['u-admin', false], admin, '/admin')).error ?? '', /your own account/);
 const off = await callAction('app/actions/data.ts', 'setAccountActive', [second.id, false], admin, '/admin');
 assert.match(off.ok ?? JSON.stringify(off), /deactivated/);
 assert.equal((await sql`select active from users where id = ${second.id}`)[0].active, false);
 // Trainers can't add admins.
 assert.equal((await callAction('app/actions/data.ts', 'addAdmin', [{name: 'Sneaky', email: 'sneaky@example.com', password: 'Sneaky#20266'}], await sessionCookie('u-trainer-akif', 'trainer'), '/admin')).ok, undefined);
 assert.equal((await sql`select count(*)::int as n from users where email = 'sneaky@example.com'`)[0].n, 0);
});

test('ADMIN_EMAIL creates the first admin once; a too-short ADMIN_PASSWORD is ignored', async () => {
 const owners = await sql`select role, password_hash, name from users where email = 'owner@example.com'`;
 assert.equal(owners.length, 1);
 assert.equal(owners[0].role, 'admin');
 assert.equal(owners[0].password_hash, null);
 // Only Google sign-in works for it until a password is set in Settings.
 const login = await submitForm('/login', {email: 'owner@example.com', password: 'short'}, '10.7.7.1');
 assert.doesNotMatch(login.headers.get('location') ?? '', /\/admin$/);
});

test('an admin changes their own password in Settings', async () => {
 const id = (await sql`select id from users where email = 'owner@example.com'`)[0].id;
 const owner = await currentCookie(id, 'admin');
 assert.match(readableText(await (await visit('/admin?tab=settings', owner)).text()), /Your password.*You sign in with Google/);
 // A Google-only admin sets a first password without a current one.
 const first = await callAction('app/actions/data.ts', 'changeMyPassword', [{current: '', next: 'OwnerPass#2026', confirm: 'OwnerPass#2026'}], owner, '/admin');
 assert.match(first.ok ?? JSON.stringify(first), /Password changed/);
 assert.match((await submitForm('/login', {email: 'owner@example.com', password: 'OwnerPass#2026'}, '10.7.7.2')).headers.get('location') ?? '', /\/admin$/);
 // The old session is signed out; from now on the current password is required.
 assert.match((await visit('/admin', owner)).headers.get('location') ?? '', /\/login$/);
 const fresh = await currentCookie(id, 'admin');
 assert.match((await callAction('app/actions/data.ts', 'changeMyPassword', [{current: '', next: 'Another#20266', confirm: 'Another#20266'}], fresh, '/admin')).error ?? '', /current password is wrong/);
 assert.match((await callAction('app/actions/data.ts', 'changeMyPassword', [{current: 'OwnerPass#2026', next: 'Root@12', confirm: 'Root@12'}], fresh, '/admin')).error ?? '', /at least 8/);
 assert.match((await callAction('app/actions/data.ts', 'changeMyPassword', [{current: 'OwnerPass#2026', next: 'Another#20266', confirm: 'Another#2027'}], fresh, '/admin')).error ?? '', /don’t match/);
 const changed = await callAction('app/actions/data.ts', 'changeMyPassword', [{current: 'OwnerPass#2026', next: 'Another#20266', confirm: 'Another#20266'}], fresh, '/admin');
 assert.match(changed.ok ?? JSON.stringify(changed), /Password changed/);
 assert.match((await submitForm('/login', {email: 'owner@example.com', password: 'Another#20266'}, '10.7.7.3')).headers.get('location') ?? '', /\/admin$/);
 // Five wrong current passwords lock the form for 15 minutes.
 const now = await currentCookie(id, 'admin');
 for (let i = 0; i < 5; i++) await callAction('app/actions/data.ts', 'changeMyPassword', [{current: 'wrong-guess', next: 'Guess#202600', confirm: 'Guess#202600'}], now, '/admin');
 assert.match((await callAction('app/actions/data.ts', 'changeMyPassword', [{current: 'Another#20266', next: 'Guess#202600', confirm: 'Guess#202600'}], now, '/admin')).error ?? '', /Too many/);
 // Trainers can't use it.
 assert.equal((await callAction('app/actions/data.ts', 'changeMyPassword', [{current: '', next: 'Trainer#20266', confirm: 'Trainer#20266'}], await sessionCookie('u-trainer-akif', 'trainer'), '/admin')).ok, undefined);
});

/** Notifications go out just after the response, so wait for them to land. */
async function waitFor(check, what) {
 for (let i = 0; i < 50; i++) { const found = await check(); if (found) return found; await new Promise(r => setTimeout(r, 100)); }
 assert.fail(`Timed out waiting for ${what}`);
}

test('without email set up, notifications are logged as not sent', async () => {
 const rows = await sql`select kind, status from email_log`;
 for (const kind of ['welcome', 'admin_new_member', 'member_question', 'staff_reply', 'invite']) {
  assert.ok(rows.some(r => r.kind === kind && r.status === 'skipped'), `${kind} logged as skipped`);
 }
 assert.equal(mailbox.length, 0, 'Nothing reached the provider');
});

test('the admin sets up email in Settings; the API key is stored encrypted', async () => {
 const admin = await sessionCookie('u-admin', 'admin');
 const save = input => callAction('app/actions/data.ts', 'saveEmailSettings', [input], admin, '/admin');
 assert.match((await save({apiKey: 'sk_live_123', from: 'hello@example.com'})).error ?? '', /starts with re_/);
 assert.match((await save({apiKey: 're_test_key_123456', from: 'not an address'})).error ?? '', /Enter the sender/);
 assert.equal((await callAction('app/actions/data.ts', 'saveEmailSettings', [{apiKey: 're_trainer_key_99', from: 'x@example.com'}], await sessionCookie('u-trainer-akif', 'trainer'), '/admin')).ok, undefined);
 assert.equal((await sql`select count(*)::int as n from settings where key = 'mail_api_key'`)[0].n, 0, 'Trainers cannot set it');
 assert.match((await callAction('app/actions/data.ts', 'sendTestEmail', [], admin, '/admin')).error ?? '', /API key and sender first/);
 const saved = await save({apiKey: 're_test_key_123456', from: 'RepCount <hello@example.com>'});
 assert.match(saved.ok ?? JSON.stringify(saved), /Email settings saved/);
 const [stored] = await sql`select value from settings where key = 'mail_api_key'`;
 assert.doesNotMatch(stored.value, /re_test_key/, 'The key is not stored in plain text');
 const settings = readableText(await (await visit('/admin?tab=settings', admin)).text());
 assert.match(settings, /CONNECTED/);
 assert.match(await (await visit('/admin?tab=settings', admin)).text(), /Saved \(…3456\)/, 'Only the last four characters are shown');
 assert.doesNotMatch(await (await visit('/admin?tab=settings', admin)).text(), /re_test_key_123456/, 'The key never reaches the page');
 // Saving again with a blank key keeps it.
 assert.ok((await save({apiKey: '', from: 'RepCount <team@example.com>'})).ok);
 assert.equal((await sql`select count(*)::int as n from settings where key = 'mail_api_key'`)[0].n, 1);

 const test = await callAction('app/actions/data.ts', 'sendTestEmail', [], admin, '/admin');
 assert.match(test.ok ?? JSON.stringify(test), /Test email sent to admin@repcount.demo/);
 const sent = mailbox.at(-1);
 assert.equal(sent.auth, 'Bearer re_test_key_123456');
 assert.equal(sent.from, 'RepCount <team@example.com>');
 assert.deepEqual(sent.to, ['admin@repcount.demo']);
 assert.match(sent.html, /REP<span[^>]*>COUNT/);
 assert.match(sent.text, /email is working/);
 assert.match(readableText(await (await visit('/admin?tab=settings', admin)).text()), /RepCount test email.*Sent/);
});

test('members, trainers and admins get emails for the events that matter to them', async () => {
 const akif = await currentCookie('u-trainer-akif', 'trainer');
 const aarav = await currentCookie('u-member-aarav', 'member');
 const inbox = (to, subject) => waitFor(() => mailbox.find(m => m.to[0] === to && subject.test(m.subject)), `${subject} to ${to}`);

 await callAction('app/actions/data.ts', 'askCoach', ['Is it fine to train with sore legs?'], aarav, '/member/profile');
 const question = await inbox('trainer@repcount.demo', /asked a question/);
 assert.match(question.text, /sore legs/);
 assert.match(question.html, /\/trainer\/clients\/c-aarav/);

 await callAction('app/actions/data.ts', 'replyToMember', ['c-aarav', 'Yes, go lighter today.'], akif, '/trainer/clients/c-aarav');
 assert.match((await inbox('member@repcount.demo', /replied on RepCount/)).text, /go lighter today/);


 const week = new Date(Date.parse(`${istWeekStart()}T00:00:00Z`) + 21 * 86400000).toISOString().slice(0, 10);
 const plan = [{title: 'Full-body foundations', exercises: ['Squats'], time: '18:00', durationMin: 25, meetingUrl: null}, null, null, null, null, null, null];
 const before = mailbox.length;
 await callAction('app/actions/data.ts', 'saveSchedule', ['c-aarav', week, plan], akif, `/trainer/clients/c-aarav/workouts/${week}/monday`);
 assert.match((await inbox('member@repcount.demo', /plan for the week of/)).text, /planned 1 workout/);
 await callAction('app/actions/data.ts', 'saveSchedule', ['c-aarav', week, plan.map((d, i) => i === 2 ? plan[0] : d)], akif, `/trainer/clients/c-aarav/workouts/${week}/monday`);
 await new Promise(r => setTimeout(r, 500));
 assert.equal(mailbox.slice(before).filter(m => /plan for the week of/.test(m.subject)).length, 1, 'Later edits to the week send no more emails');

 await callAction('app/actions/data.ts', 'reviewCheckin', ['c-aarav'], akif, '/trainer/clients/c-aarav');
 await inbox('member@repcount.demo', /reviewed your check-in/);

 // A new sign-up gets a welcome email, and every active admin hears about it.
 const signup = await submitForm('/register', {name: 'Zara Khan', email: 'zara@example.com', phone: '', password: 'ZaraPass#2026', adult: 'on', privacy: 'on'}, '10.6.6.1');
 assert.match(signup.headers.get('location') ?? '', /\/onboarding$/);
 assert.match((await inbox('zara@example.com', /Welcome to RepCount/)).html, /Open RepCount/);
 await inbox('admin@repcount.demo', /New member: Zara Khan/);
 const logged = await sql`select status from email_log where to_email = 'zara@example.com'`;
 assert.deepEqual(logged.map(r => r.status), ['sent']);
});

test('a refused email is logged with the provider’s reason; resets are emailed with a working link', async () => {
 const admin = await sessionCookie('u-admin', 'admin');
 await callAction('app/actions/data.ts', 'saveEmailSettings', [{apiKey: 're_rejected_key1', from: 'RepCount <team@example.com>'}], admin, '/admin');
 assert.match((await callAction('app/actions/data.ts', 'sendTestEmail', [], admin, '/admin')).error ?? '', /refused/);
 const [failed] = await sql`select status, error from email_log where kind = 'test' order by id desc limit 1`;
 assert.deepEqual(failed, {status: 'failed', error: '403: The example.com domain is not verified.'});
 assert.match(readableText(await (await visit('/admin?tab=settings', admin)).text()), /domain is not verified.*Failed/);

 await callAction('app/actions/data.ts', 'saveEmailSettings', [{apiKey: 're_test_key_123456', from: 'RepCount <team@example.com>'}], admin, '/admin');
 await submitForm('/forgot-password', {email: 'owner@example.com'}, '10.6.6.2');
 const reset = await waitFor(() => mailbox.find(m => m.to[0] === 'owner@example.com' && /Reset your RepCount password/.test(m.subject)), 'reset email');
 const token = tokenFrom(reset.text);
 assert.ok(token, 'The email carries the reset link');
 assert.equal((await visit(`/reset-password?token=${token}`)).status, 200);
 // Using it sends a security notice.
 const done = await submitForm(`/reset-password?token=${token}`, {password: 'Owner#New2026', confirm: 'Owner#New2026', privacy: 'on'}, '10.6.6.3');
 assert.match(done.headers.get('location') ?? '', /password_set/);
 await waitFor(() => mailbox.find(m => m.to[0] === 'owner@example.com' && /password was changed/.test(m.subject)), 'password changed notice');
 // Removing the key stops email again.
 await callAction('app/actions/data.ts', 'saveEmailSettings', [{apiKey: '', from: 'RepCount <team@example.com>', removeKey: true}], admin, '/admin');
 assert.match(readableText(await (await visit('/admin?tab=settings', admin)).text()), /NOT SET UP/);
});

const mobile = (path, {token, method, body, ip = '10.40.0.1'} = {}) => fetch(baseUrl + '/api/mobile/' + path, {
 method: method ?? (body === undefined ? 'GET' : 'POST'),
 headers: {'x-forwarded-for': ip, ...(body === undefined ? {} : {'content-type': 'application/json'}), ...(token ? {authorization: `Bearer ${token}`} : {})},
 body: body === undefined ? undefined : JSON.stringify(body),
});
/** A member of trainer Akif with a known password, created just for the app tests. */
async function appMember(id, email) {
 const {randomBytes, scryptSync} = await import('node:crypto');
 const salt = randomBytes(16).toString('hex');
 await sql`insert into users (id, email, name, initials, role, password_hash) values (${'u-' + id}, ${email}, 'Appy Member', 'AM', 'member', ${`scrypt$${salt}$${scryptSync('App#member2026', salt, 64).toString('hex')}`})`;
 await sql`insert into clients (id, user_id, name, initials, stage, trainer_id, goal, email, intake) values (${'c-' + id}, ${'u-' + id}, 'Appy M.', 'AM', 'Active', 'u-trainer-akif', 'Build strength', ${email}, ${sql.json({place: 'At home', days: '3 days a week'})})`;
 const signIn = await mobile('session', {body: {email, password: 'App#member2026'}, ip: `10.41.0.${id.length}`});
 assert.equal(signIn.status, 200);
 return (await signIn.json()).token;
}
const istDay = (plus = 0) => new Date(Date.now() + 5.5 * 36e5 + plus * 864e5).toISOString().slice(0, 10);

test('the mobile app signs members in with a token that works only as a bearer token', async () => {
 assert.equal((await mobile('session', {body: {email: 'trainer@repcount.demo', password: 'Trainer#2026'}})).status, 403, 'The app is for members only');
 const token = await appMember('app-one', 'app1@example.com');
 assert.equal((await mobile('session', {body: {email: 'app1@example.com', password: 'wrong'}})).status, 401);
 assert.equal((await mobile('me')).status, 401, 'No token, no data');
 const me = await (await mobile('me', {token})).json();
 assert.equal(me.user.name, 'Appy Member');
 assert.equal(me.member.goal, 'Build strength');
 assert.ok(me.coach, 'The assigned trainer is included');
 assert.equal(typeof me.revision, 'number');
 assert.match((await visit('/member/overview', 'rc_session=' + token)).headers.get('location') ?? '', /\/login$/, 'An app token is not a website session');
});

test('phone health data syncs from the app and shows on the trainer’s progress page', async () => {
 const token = await appMember('app-two', 'app2@example.com');
 const trainer = await sessionCookie('u-trainer-akif', 'trainer');
 assert.match(readableText(await (await visit('/trainer/clients/c-app-two/progress', trainer)).text()), /Phone &amp; band data NOT CONNECTED/);
 const days = [{day: istDay(-1), steps: 7200, sleepMin: 420, restingHr: 62, workouts: 1}, {day: istDay(), steps: 8400, sleepMin: 400, restingHr: 60, weightKg: 81.24}, {day: istDay(5), steps: 99}];
 const sync = await mobile('health', {token, body: {platform: 'android', days, sources: ['Mi Fitness']}});
 assert.deepEqual(await sync.json(), {saved: 2}, 'Days in the future are ignored');
 assert.equal((await mobile('health', {token, body: {platform: 'windows', days}})).status, 400);
 const page = readableText(await (await visit('/trainer/clients/c-app-two/progress', trainer)).text());
 assert.match(page, /From Health Connect · Mi Fitness/);
 assert.match(page, /Steps a day 7,800/);
 assert.match(page, /Sleep a night 6h 50m/);
 assert.match(page, /Latest weight 81\.2 kg/);
});

test('members save progress, ask questions and delete their own account from the app', async () => {
 const token = await appMember('app-three', 'app3@example.com');
 const me = await (await mobile('me', {token})).json();
 const state = {...me.state, tracker: {...me.state.tracker, water: 4}, checkin: {submitted: true, energy: 'High', planFit: 'Manageable'}};
 assert.equal((await mobile('progress', {token, method: 'PUT', body: {state, revision: me.revision}})).status, 200);
 const [client] = await sql`select stage, checkin_note from clients where id = 'c-app-three'`;
 assert.deepEqual({...client}, {stage: 'Check-in due', checkin_note: 'Energy high · manageable'});
 await sql`update member_state set revision = revision + 1 where user_id = 'u-app-three'`;
 assert.equal((await mobile('progress', {token, method: 'PUT', body: {state, revision: me.revision}})).status, 409, 'A save over the admin’s correction is refused');
 const asked = await mobile('messages', {token, body: {body: 'Can I swap squats for lunges?'}});
 assert.equal((await asked.json()).messages.at(-1).body, 'Can I swap squats for lunges?');
 await mobile('health', {token, body: {platform: 'ios', days: [{day: istDay(), steps: 100}]}});

 assert.equal((await mobile('account', {token, method: 'DELETE', body: {password: 'nope'}})).status, 403);
 assert.equal((await mobile('account', {token, method: 'DELETE', body: {password: 'App#member2026'}})).status, 200);
 const [left] = await sql`select (select count(*) from users where id = 'u-app-three')::int as users, (select count(*) from clients where id = 'c-app-three')::int as clients,
   (select count(*) from health_daily where user_id = 'u-app-three')::int as health, (select count(*) from messages where client_id = 'c-app-three')::int as messages`;
 assert.deepEqual({...left}, {users: 0, clients: 0, health: 0, messages: 0}, 'Everything about the member is gone');
 assert.equal((await mobile('me', {token})).status, 401);
});

test('the client header picks the trainer; a deactivated client shows Deactivated there', async () => {
 const admin = await sessionCookie('u-admin', 'admin');
 const html = await (await visit('/admin/clients/c-kabir', admin)).text();
 const select = /<select[^>]*aria-label="Trainer for [^"]*"[^>]*>([\s\S]*?)<\/select>/.exec(html)?.[1] ?? '';
 const options = [...select.matchAll(/<option[^>]*>([^<]*)<\/option>/g)].map(m => m[1]);
 assert.equal(options[0], 'Unassigned');
 assert.ok(options.length >= 2 && !options.includes('Deactivated') && !options.includes('Cancelled'), 'Only Unassigned and the trainers');
 assert.doesNotMatch(markupOnly(html), /Payment review|aria-label="Stage for|aria-label="Status for/, 'Status isn’t changed from the header');
 await callAction('app/actions/data.ts', 'setClientActive', ['c-kabir', false], admin, '/admin/clients/c-kabir');
 const off = await (await visit('/admin/clients/c-kabir', admin)).text();
 assert.doesNotMatch(off, /aria-label="Trainer for/);
 assert.match(readableText(off), /Deactivated/);
 await callAction('app/actions/data.ts', 'setClientActive', ['c-kabir', true], admin, '/admin/clients/c-kabir');
 await sql`update clients set trainer_id = 'u-trainer-akif' where id = 'c-kabir'`;
});

test('booking a session emails the member a calendar invite with the join link', async () => {
 const akif = await currentCookie('u-trainer-akif', 'trainer');
 await callAction('app/actions/data.ts', 'saveEmailSettings', [{apiKey: 're_test_key_123456', from: 'RepCount <hello@example.com>'}], await sessionCookie('u-admin', 'admin'), '/admin');
 const date = new Date(Date.now() + 3 * 864e5 + 5.5 * 36e5).toISOString().slice(0, 10);
 const booked = await callAction('app/actions/sessions.ts', 'saveSession', ['c-aarav', {title: 'Live strength session', date, start: '07:00', meetingUrl: 'https://meet.google.com/xyz-abcd-efg'}], akif, '/trainer/clients/c-aarav/sessions');
 assert.match(booked.ok ?? JSON.stringify(booked), /Session booked/);
 const email = await waitFor(() => mailbox.find(m => m.to[0] === 'member@repcount.demo' && /Live strength session is booked/.test(m.subject)), 'session email');
 assert.match(email.text, /Join here at the time: https:\/\/meet\.google\.com\/xyz-abcd-efg/);
 const invite = email.attachments?.find(a => a.filename === 'invite.ics');
 assert.ok(invite, 'A calendar invite is attached');
 const ics = Buffer.from(invite.content, 'base64').toString();
 assert.match(ics, /BEGIN:VCALENDAR[\s\S]*METHOD:REQUEST[\s\S]*SUMMARY:Live strength session · RepCount/);
 assert.match(ics, new RegExp(`DTSTART:${date.replace(/-/g, '')}T013000Z`), '07:00 IST is 01:30 UTC');
 assert.ok(!mailbox.some(m => m.to[0] === 'trainer@repcount.demo' && /Live strength session/.test(m.subject)), 'The trainer who booked it isn’t emailed');

 // Moving it on the calendar keeps the length and emails an update for the same event.
 const [row] = await sql`select id from sessions where title = 'Live strength session'`;
 const later = new Date(Date.parse(`${date}T00:00:00Z`) + 864e5).toISOString().slice(0, 10);
 assert.match((await callAction('app/actions/sessions.ts', 'moveSession', [Number(row.id), later, '07:00'], akif, '/trainer')).ok ?? '', /Session moved/);
 const [moved] = await sql`select extract(epoch from ends_at - starts_at)::int as seconds from sessions where id = ${row.id}`;
 assert.equal(moved.seconds, 30 * 60, 'Sessions are 30 minutes; moving keeps the length');
 await waitFor(() => mailbox.find(m => m.to[0] === 'member@repcount.demo' && /Live strength session has moved/.test(m.subject)), 'moved email');
 assert.match((await callAction('app/actions/sessions.ts', 'setSessionStatus', [Number(row.id), 'cancelled'], akif, '/trainer')).ok ?? '', /cancelled/);
 const cancel = await waitFor(() => mailbox.find(m => m.to[0] === 'member@repcount.demo' && /is cancelled/.test(m.subject)), 'cancel email');
 assert.match(Buffer.from(cancel.attachments[0].content, 'base64').toString(), /METHOD:CANCEL/);
});

test('trainers keep their own list of workouts and use them when planning a day', async () => {
 const akif = await currentCookie('u-trainer-akif', 'trainer');
 const save = (input, cookie = akif) => callAction('app/actions/workouts.ts', 'saveWorkout', [input], cookie, '/trainer?tab=workouts');
 assert.match((await save({name: 'Lower body A', exercises: ''})).error ?? '', /at least one exercise/);
 assert.match((await save({name: 'Lower body A', exercises: 'Goblet squat · 3 × 10\n\nGlute bridge · 3 × 12'})).ok ?? '', /added/);
 assert.match((await save({name: 'Lower body A', exercises: 'Lunge'})).error ?? '', /already have/);
 const [w] = await sql`select id, exercises from workout_templates where name = 'Lower body A'`;
 assert.equal(w.exercises, 'Goblet squat · 3 × 10\nGlute bridge · 3 × 12', 'Blank lines are dropped');
 const library = readableText(await (await visit('/trainer?tab=workouts', akif)).text());
 assert.match(library, /Lower body A 2 exercises/);
 assert.match(library, /Full-body foundations/, 'The RepCount templates start the list');
 const dayHtml = await (await visit(`/trainer/clients/c-aarav/workouts/${istWeekStart()}/monday`, akif)).text();
 assert.match(dayHtml, /<option value="saved:\d+">Lower body A<\/option>/);
 assert.doesNotMatch(dayHtml, /<optgroup|>Custom</, 'One plain list of workouts');
 const [template] = await sql`select id from workout_templates where trainer_id = 'u-trainer-akif' and name = 'Full-body foundations'`;
 assert.match((await callAction('app/actions/workouts.ts', 'deleteWorkout', [Number(template.id)], akif, '/trainer')).ok ?? '', /deleted/);
 await visit('/trainer?tab=workouts', akif);
 assert.equal((await sql`select count(*)::int as n from workout_templates where trainer_id = 'u-trainer-akif' and name = 'Full-body foundations'`)[0].n, 0, 'A deleted template doesn’t come back');
 assert.doesNotMatch(readableText(dayHtml), /Google Meet link|Start time/, 'Times and links are booked as sessions, not on the workout');
 const other = await currentCookie('u-trainer-2', 'trainer');
 assert.match((await callAction('app/actions/workouts.ts', 'deleteWorkout', [Number(w.id)], other, '/trainer')).error ?? '', /no longer exists/, 'Only the owner can delete it');
 assert.match((await callAction('app/actions/workouts.ts', 'deleteWorkout', [Number(w.id)], akif, '/trainer')).ok ?? '', /deleted/);
});

test('members see Sessions, phone data inside My progress, their name in the top bar and labelled phone menu', async () => {
 const member = await currentCookie('u-member-aarav', 'member');
 const progress = await (await visit('/member/progress', member)).text();
 assert.match(readableText(progress), /COMING SOON .*Your growth, from your phone and band/, 'Growth is part of My progress');
 assert.match(progress, /class="rc-nav-bar"/);
 assert.match(progress, /<span class="rc-nav-text">Home<\/span>/, 'The phone menu has labels, not just icons');
 assert.match(readableText(progress), /More/, 'Pages that don’t fit the phone bar are under More');
 assert.match(readableText(progress), /Aarav Sharma member@repcount\.demo/, 'The top bar shows who is signed in');
 assert.match(progress, /class="rc-topbar-brand"/, 'The logo shows in the top bar on phones');
 assert.match(progress, /class="sidebar-bottom rc-sidebar-bottom"/, 'Log out sits at the bottom of the sidebar');
 assert.equal((await visit('/member/growth', member)).status, 404, 'Growth has no page of its own');
 const home = readableText(await (await visit('/member/overview', member)).text());
 assert.doesNotMatch(home, /A little structure|YOUR MOMENTUM|Coached every week/, 'Home keeps only what members use');
});

test('trainers build workouts from a searchable exercise library and add their own exercises', async () => {
 const akif = await currentCookie('u-trainer-akif', 'trainer');
 const added = await callAction('app/actions/exercises.ts', 'addExercise', ['Kettlebell swing'], akif, '/trainer?tab=workouts');
 assert.match(added.ok ?? JSON.stringify(added), /Kettlebell swing/);
 assert.match((await callAction('app/actions/exercises.ts', 'addExercise', ['Squat · 3 × 10'], akif, '/trainer')).error ?? '', /Leave out/);
 const again = await callAction('app/actions/exercises.ts', 'addExercise', ['kettlebell SWING'], akif, '/trainer');
 assert.ok(again.ok, 'Adding the same name again reuses it');
 assert.equal((await sql`select count(*)::int as n from exercises where trainer_id = 'u-trainer-akif' and lower(name) = 'kettlebell swing'`)[0].n, 1);
 assert.ok((await sql`select count(*)::int as n from exercises where trainer_id is null`)[0].n > 40, 'RepCount’s exercise library is there');
 const page = readableText(await (await visit('/trainer?tab=workouts', akif)).text());
 assert.match(page, /Your exercises .*Kettlebell swing/);
 const [own] = await sql`select id from exercises where trainer_id = 'u-trainer-akif' and name = 'Kettlebell swing'`;
 const [builtIn] = await sql`select id from exercises where trainer_id is null limit 1`;
 assert.match((await callAction('app/actions/exercises.ts', 'deleteExercise', [Number(builtIn.id)], akif, '/trainer')).error ?? '', /Only your own/);
 assert.match((await callAction('app/actions/exercises.ts', 'deleteExercise', [Number(own.id)], akif, '/trainer')).ok ?? '', /removed/);
 const day = await (await visit(`/trainer/clients/c-aarav/workouts/${istWeekStart()}/tuesday`, akif)).text();
 assert.match(day, /class="rc-builder"/, 'The day editor uses the workout builder');
 assert.doesNotMatch(day, /one per line/, 'No free-text box for exercises');
});

test('llms.txt and the sitemap describe the site and list every article', async () => {
 const llms = await visit('/llms.txt');
 assert.equal(llms.status, 200);
 assert.match(llms.headers.get('content-type') ?? '', /text\/plain/);
 const text = await llms.text();
 assert.match(text, /^# RepCount\n\n> Online personal training in India/);
 const [post] = await sql`select slug, title from posts where published limit 1`;
 if (post) assert.ok(text.includes(`/blog/${post.slug}`) && text.includes(post.title), 'Articles are listed');
 assert.match(await (await visit('/sitemap.xml')).text(), /\/register<\/loc>/);
 assert.match(await productionHomepage(), /"@type":"Organization"/, 'The homepage describes RepCount for search engines');
});
