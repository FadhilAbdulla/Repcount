import "server-only";
import {siteLink} from "./site";

/*
 * A calendar invite (.ics, RFC 5545) attached to session emails. Gmail, Outlook and Apple Mail show "Add to calendar"
 * for it, and a later email with the same UID and a higher SEQUENCE updates or cancels the same event.
 */
type Invite = {id: number; title: string; startsAt: string; endsAt: string; meetingUrl: string | null; description: string;
  attendee: {name: string; email: string}; organizer: {name: string; email: string}; cancelled?: boolean; sequence: number};

const stamp = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
/** Escapes text values and folds long lines, as the format requires. */
const text = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, m => `\\${m}`);
const fold = (line: string) => line.length <= 74 ? line : line.match(/.{1,74}/g)!.join("\r\n ");

export function calendarInvite(i: Invite) {
  const host = new URL(siteLink("/")).hostname;
  const lines = [
    "BEGIN:VCALENDAR", "PRODID:-//RepCount//Sessions//EN", "VERSION:2.0", "CALSCALE:GREGORIAN", `METHOD:${i.cancelled ? "CANCEL" : "REQUEST"}`,
    "BEGIN:VEVENT",
    `UID:session-${i.id}@${host}`,
    `SEQUENCE:${i.sequence}`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(i.startsAt)}`,
    `DTEND:${stamp(i.endsAt)}`,
    `SUMMARY:${text(i.title)}`,
    `DESCRIPTION:${text(i.description)}`,
    ...(i.meetingUrl ? [`LOCATION:${text(i.meetingUrl)}`, `URL:${i.meetingUrl}`] : []),
    `ORGANIZER;CN=${text(i.organizer.name)}:mailto:${i.organizer.email}`,
    `ATTENDEE;CN=${text(i.attendee.name)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=FALSE:mailto:${i.attendee.email}`,
    `STATUS:${i.cancelled ? "CANCELLED" : "CONFIRMED"}`,
    ...(i.cancelled ? [] : ["BEGIN:VALARM", "TRIGGER:-PT15M", "ACTION:DISPLAY", `DESCRIPTION:${text(i.title)}`, "END:VALARM"]),
    "END:VEVENT", "END:VCALENDAR",
  ];
  const ics = lines.map(fold).join("\r\n") + "\r\n";
  return {filename: i.cancelled ? "cancelled.ics" : "invite.ics", content: Buffer.from(ics).toString("base64"),
    contentType: `text/calendar; charset=utf-8; method=${i.cancelled ? "CANCEL" : "REQUEST"}`};
}
