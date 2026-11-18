import "server-only";
import {db} from "./db";
import type {CleanSession, Session, SessionStatus} from "./sessions";

type Row = {id: string; client_id: string; client_name: string; kind: Session["kind"]; title: string; starts_at: Date; ends_at: Date;
  meeting_url: string | null; status: SessionStatus; notes: string | null};
const toSession = (r: Row): Session => ({id: Number(r.id), clientId: r.client_id, clientName: r.client_name, kind: r.kind, title: r.title,
  startsAt: r.starts_at.toISOString(), endsAt: r.ends_at.toISOString(), meetingUrl: r.meeting_url, status: r.status, notes: r.notes});

/** Optional filters; `from`/`to` are ISO instants. `trainerId` limits to the trainer's current clients. */
type Filter = {clientId?: string; trainerId?: string; from?: string; to?: string; upcomingOnly?: boolean; limit?: number};

export async function listSessions({clientId, trainerId, from, to, upcomingOnly, limit = 500}: Filter = {}): Promise<Session[]> {
  const sql = await db();
  const rows = await sql<Row[]>`
    select s.*, c.name as client_name from sessions s join clients c on c.id = s.client_id
    where true
      ${clientId ? sql`and s.client_id = ${clientId}` : sql``}
      ${trainerId ? sql`and c.trainer_id = ${trainerId}` : sql``}
      ${from ? sql`and s.ends_at >= ${from}` : sql``}
      ${to ? sql`and s.starts_at < ${to}` : sql``}
      ${upcomingOnly ? sql`and s.status = 'scheduled' and s.ends_at >= now()` : sql``}
    order by s.starts_at limit ${limit}`;
  return rows.map(toSession);
}

export async function getSession(id: number): Promise<Session | null> {
  const sql = await db();
  const [row] = await sql<Row[]>`select s.*, c.name as client_name from sessions s join clients c on c.id = s.client_id where s.id = ${id}`;
  return row ? toSession(row) : null;
}

export async function createSession(clientId: string, s: CleanSession, actorId: string): Promise<number> {
  const sql = await db();
  const [row] = await sql<{id: string}[]>`insert into sessions (client_id, kind, title, starts_at, ends_at, meeting_url, notes, created_by)
    values (${clientId}, ${s.kind}, ${s.title}, ${s.startsAt}, ${s.endsAt}, ${s.meetingUrl}, ${s.notes}, ${actorId}) returning id`;
  return Number(row.id);
}

export async function updateSession(id: number, s: CleanSession) {
  const sql = await db();
  await sql`update sessions set kind = ${s.kind}, title = ${s.title}, starts_at = ${s.startsAt}, ends_at = ${s.endsAt},
    meeting_url = ${s.meetingUrl}, notes = ${s.notes}, updated_at = now() where id = ${id}`;
}

/** Moves a session to a new start, keeping its length (drag and drop on the calendar). */
export async function moveSession(id: number, startsAt: string) {
  const sql = await db();
  await sql`update sessions set ends_at = ${startsAt}::timestamptz + (ends_at - starts_at), starts_at = ${startsAt}, updated_at = now() where id = ${id}`;
}

export async function setSessionStatus(id: number, status: SessionStatus) {
  const sql = await db();
  await sql`update sessions set status = ${status}, updated_at = now() where id = ${id}`;
}

export async function deleteSession(id: number) {
  const sql = await db();
  await sql`delete from sessions where id = ${id}`;
}
