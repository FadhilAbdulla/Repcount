"use client";

/*
 * A month grid (Monday first) used for the trainer's Sessions calendar, a client's Calendar log and the member's calendar.
 * Each day shows small entries; entries marked `draggable` can be dropped on another day (calendar drag and drop).
 * On phones the grid becomes a list of the days that have something on them.
 */
import {useState, type ReactNode} from "react";
import Link from "next/link";
import {formatIstDate, monthGrid, shiftMonth} from "@/lib/dates";
import "./calendar.css";

export type CalendarEntry = {
  id: string; day: string; label: string;
  /** Colour group: session, done, missed, cancelled, workout, meal, rest. */
  tone: string;
  /** A short time or detail shown before the label, e.g. "6:30 PM". */
  time?: string;
  href?: string; onClick?: () => void; draggable?: boolean;
};

export default function MonthCalendar({month, today, entries, monthHref, onDropEntry, legend, emptyNote}: {
  /** "2026-11" */
  month: string; today: string; entries: CalendarEntry[];
  /** Link for another month (keeps the URL in sync); omit to hide the month arrows. */
  monthHref?: (month: string) => string;
  /** Called when a draggable entry is dropped on another day. */
  onDropEntry?: (id: string, day: string) => void;
  legend?: {tone: string; label: string}[];
  emptyNote?: ReactNode;
}) {
  const {days, first} = monthGrid(month);
  const [over, setOver] = useState<string | null>(null);
  const byDay = new Map<string, CalendarEntry[]>();
  for (const e of entries) byDay.set(e.day, [...(byDay.get(e.day) ?? []), e]);
  const title = formatIstDate(first, {month: "long", year: "numeric"});
  const listDays = days.filter(d => d.startsWith(month) && byDay.has(d));

  const entry = (e: CalendarEntry) => {
    const body = <>{e.time && <time>{e.time}</time>}<span>{e.label}</span></>;
    const common = {className: "rc-cal-entry", "data-tone": e.tone, draggable: !!e.draggable && !!onDropEntry,
      onDragStart: (ev: React.DragEvent) => { ev.dataTransfer.setData("text/plain", e.id); ev.dataTransfer.effectAllowed = "move"; }};
    return e.href ? <Link key={e.id} href={e.href} {...common}>{body}</Link>
      : e.onClick ? <button key={e.id} type="button" onClick={e.onClick} {...common}>{body}</button>
      : <span key={e.id} {...common}>{body}</span>;
  };

  return <section className="card rc-cal">
    <div className="rc-cal-head">
      <h2>{title}</h2>
      {monthHref && <nav aria-label="Change month">
        <Link className="small-button" href={monthHref(shiftMonth(month, -1))} aria-label="Previous month">←</Link>
        <Link className="small-button" href={monthHref(today.slice(0, 7))}>Today</Link>
        <Link className="small-button" href={monthHref(shiftMonth(month, 1))} aria-label="Next month">→</Link>
      </nav>}
    </div>
    {legend && <ul className="rc-cal-legend">{legend.map(l => <li key={l.tone} data-tone={l.tone}>{l.label}</li>)}</ul>}
    {onDropEntry && <p className="small-note rc-cal-hint">Drag a session to another day to move it (same time). Tap a session to change its time.</p>}

    <div className="rc-cal-weekdays" aria-hidden="true">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => <span key={d} className="rc-cal-weekday">{d}</span>)}</div>
    <ol className="rc-cal-grid" aria-label={title}>
      {days.map(d => <li key={d}
        className={`rc-cal-day${d.startsWith(month) ? "" : " rc-cal-out"}${d === today ? " rc-cal-today" : ""}${over === d ? " rc-cal-over" : ""}`}
        onDragOver={onDropEntry ? e => { e.preventDefault(); setOver(d); } : undefined}
        onDragLeave={onDropEntry ? () => setOver(o => o === d ? null : o) : undefined}
        onDrop={onDropEntry ? e => { e.preventDefault(); setOver(null); const id = e.dataTransfer.getData("text/plain"); if (id) onDropEntry(id, d); } : undefined}>
        <span className="rc-cal-date" aria-hidden="true">{Number(d.slice(8))}</span>
        <span className="visually-hidden">{formatIstDate(d, {weekday: "long", day: "numeric", month: "long"})}{byDay.has(d) ? "" : ", nothing planned"}</span>
        {byDay.get(d)?.map(entry)}
      </li>)}
    </ol>

    <ol className="rc-cal-list" aria-label={`${title}, days with entries`}>
      {listDays.length === 0 && <li className="rc-cal-empty">{emptyNote ?? "Nothing this month."}</li>}
      {listDays.map(d => <li key={d} className={d === today ? "rc-cal-today" : undefined}>
        <b>{formatIstDate(d, {weekday: "short", day: "numeric", month: "short"})}{d === today ? " · today" : ""}</b>
        <div>{byDay.get(d)!.map(entry)}</div>
      </li>)}
    </ol>
  </section>;
}
