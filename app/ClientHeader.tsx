"use client";

import {useState, useTransition} from "react";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {Icon} from "./Media";
import {assignTrainer} from "./actions/data";
import ClientBioEditor from "./ClientBioEditor";
import {ProfileIncomplete} from "./Pills";
import {clientStatus, memberCode} from "@/lib/programme";
import type {ClientRow} from "@/lib/store";

const sections: [string, string, string][] = [["overview", "Overview", ""], ["workouts", "Workout plan", "/workouts"], ["nutrition", "Nutrition", "/nutrition"],
  ["sessions", "Sessions", "/sessions"], ["messages", "Messages", "/messages"], ["calendar", "Calendar", "/calendar"], ["progress", "Progress & history", "/progress"]];
const formatDate = (iso: string | null) => iso ? new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", {day: "numeric", month: "short", year: "numeric", timeZone: "UTC"}) : "—";

/**
 * The client's name, status and details button, and the tabs between their pages. Stays mounted while the tabs change.
 * The admin changes the trainer here; deactivating and activating is at the bottom of the client's Overview.
 */
export default function ClientHeader({viewer, client: c, trainers = []}: {viewer: "admin" | "trainer"; client: ClientRow; trainers?: {id: string; name: string; active: boolean}[]}) {
  const admin = viewer === "admin";
  const base = `/${viewer}/clients/${c.id}`;
  const path = usePathname();
  const active = sections.find(([key, , suffix]) => key !== "overview" && path.startsWith(base + suffix))?.[0] ?? "overview";
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState("");
  const [noticeError, setNoticeError] = useState(false);
  const run = (action: () => Promise<{ok?: string; error?: string}>) => startTransition(async () => {
    const result = await action();
    setNoticeError(!result.ok);
    setNotice(result.ok ?? result.error ?? "");
  });
  const status = clientStatus(c);
  return <>
    <Link className="rc-back-link" href={`/${viewer}?tab=clients`}>← All clients</Link>
    <section className="card rc-client-head">
      <div className="rc-detail-identity">
        <span className="large-avatar">{c.initials}</span>
        <div>
          <p className="eyebrow">{admin ? "CLIENT" : "MEMBER"} · {memberCode(c.memberNo)}</p>
          <h1 tabIndex={-1}>{c.name}</h1>
          <p className="rc-client-meta">
            <span>{c.goal || "No goal yet"}</span>
            <span>Joined {formatDate(c.joinedOn)}</span>
            <span>{c.trainer === "Unassigned" ? "No trainer yet" : `Trainer: ${c.trainer}`}</span>
            {!c.intake && <ProfileIncomplete/>}
          </p>
        </div>
      </div>
      <div className="rc-client-head-actions">
        {admin && !c.deactivated
          ? <label className="rc-stage-control" data-stage={status.toLowerCase()}>
              <span className="rc-stage-dot" aria-hidden="true"/>
              <span className="rc-stage-label">Trainer</span>
              <select aria-label={`Trainer for ${c.name}`} value={c.trainerId ?? ""} disabled={pending} onChange={e => {const id = e.target.value; run(() => assignTrainer(c.id, id));}}>
                <option value="">Unassigned</option>
                {trainers.filter(t => t.active || t.id === c.trainerId).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
          : <span className="rc-stage-control rc-stage-static" data-stage={status.toLowerCase()}><span className="rc-stage-dot" aria-hidden="true"/>{status}</span>}
        {admin && <ClientBioEditor client={c} pending={pending} run={run}/>}
      </div>
    </section>
    {notice && <div className={noticeError ? "notice notice-error" : "notice"} role={noticeError ? "alert" : "status"}>{notice}<button onClick={() => setNotice("")} aria-label="Dismiss notification"><Icon name="close" size={18}/></button></div>}
    <nav className="rc-member-tabs" aria-label={`${c.name}’s pages`}>
      {sections.map(([key, label, suffix]) => <Link key={key} href={base + suffix} aria-current={active === key ? "page" : undefined}>{label}</Link>)}
    </nav>
  </>;
}
