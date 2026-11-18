import "server-only";
import {randomBytes} from "node:crypto";
import postgres from "postgres";
import {hashPassword} from "./passwords";
import {starterPosts} from "./blogStarter";
import {passwordRuleText, validPassword} from "@/lib/passwordRules";

/*
 * Postgres store (Neon in production, any Postgres locally). Set DATABASE_URL to the connection string.
 * The schema is created on first use, under an advisory lock so concurrent cold starts don't race.
 */
type Sql = postgres.Sql;
const globalForDb = globalThis as unknown as {repcountSql?: Sql; repcountReady?: Promise<Sql>; repcountSchema?: string};

function connect(): Sql {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL must be set to a Postgres connection string (see .env.example).");
  // Serverless functions each hold one connection; Neon's pooler multiplexes them.
  return postgres(url, {max: process.env.VERCEL ? 1 : 10, idle_timeout: 20, prepare: false, onnotice: () => {}});
}

const schema = `
  create table if not exists users (
    id text primary key,
    email text not null unique,
    name text not null,
    initials text not null,
    role text not null check (role in ('member', 'trainer', 'admin')),
    password_hash text,
    title text,
    capacity integer not null default 8,
    active boolean not null default true,
    session_version integer not null default 0,
    created_at timestamptz not null default now()
  );
  create table if not exists clients (
    id text primary key,
    user_id text unique references users(id) on delete set null,
    name text not null,
    initials text not null,
    stage text not null check (stage in ('Active', 'Onboarding', 'Check-in due', 'Payment review')),
    trainer_id text references users(id) on delete set null,
    paid boolean not null default false,
    progress integer not null default 0 check (progress between 0 and 100),
    goal text not null,
    last_workout_on date,
    next_checkin text not null default '—',
    payment_reference text,
    checkin_note text,
    email text,
    phone text,
    joined_on date,
    meeting_url text
  );
  create index if not exists clients_trainer_idx on clients (trainer_id);
  alter table clients add column if not exists intake jsonb;
  alter table clients add column if not exists bio jsonb;
  -- Incremental member number shown as RC-0001; existing clients are numbered when the column is added.
  alter table clients add column if not exists member_no bigserial;
  create unique index if not exists clients_member_no_idx on clients (member_no);
  create table if not exists member_state (
    user_id text primary key references users(id) on delete cascade,
    data jsonb not null,
    updated_at timestamptz not null default now()
  );
  -- Bumped when the admin corrects a member's log, so a member's open app can't save over the correction.
  alter table member_state add column if not exists revision integer not null default 0;
  create table if not exists member_history (
    user_id text not null references users(id) on delete cascade,
    period text not null check (period in ('day', 'week')),
    period_start date not null,
    data jsonb not null,
    primary key (user_id, period, period_start)
  );
  create table if not exists settings (
    key text primary key,
    value text not null
  );
  create table if not exists workout_plans (
    client_id text not null references clients(id) on delete cascade,
    week_start date not null,
    day integer not null check (day between 0 and 6),
    title text not null,
    exercises text not null default '',
    start_time text,
    duration_min integer,
    meeting_url text,
    updated_by text not null,
    updated_at timestamptz not null default now(),
    primary key (client_id, week_start, day)
  );
  create table if not exists audit_log (
    id bigserial primary key,
    actor_id text not null,
    action text not null,
    detail text not null,
    subject_id text,
    created_at timestamptz not null default now()
  );
  create index if not exists audit_subject_idx on audit_log (subject_id);
  create table if not exists messages (
    id bigserial primary key,
    client_id text not null references clients(id) on delete cascade,
    author_id text not null,
    body text not null,
    created_at timestamptz not null default now()
  );
  create index if not exists messages_client_idx on messages (client_id, id desc);
  create table if not exists nutrition_plans (
    client_id text primary key references clients(id) on delete cascade,
    data jsonb not null,
    updated_by text not null,
    updated_at timestamptz not null default now()
  );
  create table if not exists session_confirmations (
    client_id text not null references clients(id) on delete cascade,
    day date not null,
    trainer_id text not null,
    created_at timestamptz not null default now(),
    primary key (client_id, day)
  );
  -- One-time links for password resets and invitations. Only a SHA-256 hash of the token is stored.
  create table if not exists password_tokens (
    token_hash text primary key,
    user_id text not null references users(id) on delete cascade,
    purpose text not null check (purpose in ('reset', 'invite')),
    expires_at timestamptz not null,
    used_at timestamptz,
    created_at timestamptz not null default now()
  );
  create index if not exists password_tokens_user_idx on password_tokens (user_id);
  -- When the person accepted the privacy policy (self-registration, or setting a password from an invitation).
  alter table users add column if not exists privacy_accepted_at timestamptz;
  -- Set when an admin deactivates the client (status Deactivated, no sign-in); cleared when they're reactivated.
  alter table clients add column if not exists cancelled_at timestamptz;
  -- Every email the app tried to send (sent, failed or skipped because email isn't set up), kept 180 days.
  create table if not exists email_log (
    id bigserial primary key,
    to_email text not null,
    subject text not null,
    kind text not null,
    status text not null check (status in ('sent', 'failed', 'skipped')),
    error text,
    created_at timestamptz not null default now()
  );
  create index if not exists email_log_to_idx on email_log (to_email);
  -- Blog / resources for the public site (SEO). Body is a small Markdown subset rendered by lib/markdown.ts.
  create table if not exists posts (
    id bigserial primary key,
    slug text not null unique,
    title text not null,
    excerpt text not null default '',
    body text not null default '',
    cover_url text,
    published boolean not null default false,
    published_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
  create index if not exists posts_published_idx on posts (published, published_at desc);
  -- Daily totals synced from the member's phone (Health Connect on Android, HealthKit on iOS) by the mobile app.
  -- The phone sends the platform's own de-duplicated daily aggregates, so a band and the phone are never double-counted.
  create table if not exists health_daily (
    user_id text not null references users(id) on delete cascade,
    day date not null,
    platform text not null check (platform in ('android', 'ios')),
    steps integer,
    active_kcal integer,
    resting_hr integer,
    sleep_min integer,
    workouts integer,
    workout_min integer,
    weight_kg numeric(5, 1),
    sources text[] not null default '{}',
    updated_at timestamptz not null default now(),
    primary key (user_id, day)
  );
  -- Video sessions between a member and their trainer: the introduction call, weekly check-ins and live workouts.
  -- Times are stored as instants and shown in India time. The member's trainer is always the client's current trainer.
  create table if not exists sessions (
    id bigserial primary key,
    client_id text not null references clients(id) on delete cascade,
    kind text not null check (kind in ('intro', 'weekly', 'workout')),
    title text not null,
    starts_at timestamptz not null,
    ends_at timestamptz not null,
    meeting_url text,
    status text not null default 'scheduled' check (status in ('scheduled', 'done', 'missed', 'cancelled')),
    notes text,
    created_by text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (ends_at > starts_at)
  );
  create index if not exists sessions_client_idx on sessions (client_id, starts_at);
  create index if not exists sessions_start_idx on sessions (starts_at);
  -- A trainer's own saved workouts, to put on any member's day in one click.
  create table if not exists workout_templates (
    id bigserial primary key,
    trainer_id text not null references users(id) on delete cascade,
    name text not null,
    exercises text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (trainer_id, name)
  );
  create table if not exists login_attempts (
    key text primary key,
    count integer not null,
    since timestamptz not null
  );
`;

async function prepare(sql: Sql) {
  await sql.begin(async tx => {
    await tx`select pg_advisory_xact_lock(74283015)`;
    await tx.unsafe(schema);
    await tx`insert into settings (key, value) values ('price', '299') on conflict (key) do nothing`;
    await bootstrapAdmin(tx);
    await seedStarterPosts(tx);
  });
  return sql;
}

/**
 * Creates the first super admin from ADMIN_EMAIL (Google sign-in) and optional ADMIN_PASSWORD, if no user has that email yet.
 * It never changes an existing account: further admins and password changes are managed in the admin panel (Settings).
 */
async function bootstrapAdmin(tx: postgres.TransactionSql) {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) return;
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (password && !validPassword(password)) console.warn(`ADMIN_PASSWORD is ignored: it needs ${passwordRuleText}. The admin can still sign in with Google.`);
  const id = `u-admin-${randomBytes(6).toString("hex")}`;
  await tx`insert into users (id, email, name, initials, role, password_hash) values
    (${id}, ${email}, 'Super admin', 'SA', 'admin', ${validPassword(password) ? hashPassword(password) : null})
    on conflict do nothing`;
}

/** Publishes the starter articles once. Deleting them later is respected: the flag stops them coming back. */
async function seedStarterPosts(tx: postgres.TransactionSql) {
  const [done] = await tx`select 1 from settings where key = 'blog_seeded'`;
  if (done) return;
  for (const [i, p] of starterPosts.entries()) {
    // Spread the dates a few days apart so the list has a natural order (newest first).
    await tx`insert into posts (slug, title, excerpt, body, published, published_at)
      values (${p.slug}, ${p.title}, ${p.excerpt}, ${p.body}, true, now() - make_interval(days => ${(starterPosts.length - i) * 3}))
      on conflict (slug) do nothing`;
  }
  await tx`insert into settings (key, value) values ('blog_seeded', '1') on conflict (key) do nothing`;
}

/** The ready-to-use connection; the first call creates the schema. */
export function db(): Promise<Sql> {
  globalForDb.repcountSql ??= connect();
  // In dev the connection outlives code reloads; re-apply the (idempotent) schema when it changes so new columns appear without a restart.
  if (globalForDb.repcountSchema !== schema) { globalForDb.repcountSchema = schema; globalForDb.repcountReady = undefined; }
  globalForDb.repcountReady ??= prepare(globalForDb.repcountSql).catch(error => {
    globalForDb.repcountReady = undefined;
    throw error;
  });
  return globalForDb.repcountReady;
}
