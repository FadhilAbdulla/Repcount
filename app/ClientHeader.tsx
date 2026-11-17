"use client";

import {useState, useTransition} from "react";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {Icon} from "./Media";
import {setClientStage} from "./actions/data";
import ClientBioEditor from "./ClientBioEditor";
import {memberCode, stages} from "@/lib/programme";
import type {ClientRow} from "@/lib/store";

const sections: [string, string, string][] = [["overview", "Overview", ""], ["workouts", "Workout plan", "/workouts"], ["nutrition", "Nutrition", "/nutrition"], ["progress", "Progress & history", "/progress"]];
const formatDate = (iso: string | null) => iso ? new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", {day: "numeric", month: "short", year: "numeric", timeZone: "UTC"}) : "—";
/** A stage name as a CSS-friendly key for its colour, e.g. "Check-in due" → "check-in-due". */
const stageKey = (stage: string) => stage.toLowerCase().replace(/[^a-z]+/g, "-");

/** The client's name, stage and details button, and the tabs between their pages. Stays mounted while the tabs change. */
export default function ClientHeader({viewer, client: c}: {viewer: "admin" | "trainer"; client: ClientRow}) {
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

  return <>
    <Link className="rc-back-link" href={`/${viewer}?tab=clients`}>← {admin ? "All clients" : "All members"}</Link>
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
            {!c.intake && <span className="pill rc-pill-warn" title="Completes when the member answers the onboarding questions">Profile incomplete</span>}
          </p>
        </div>
      </div>
      <div className="rc-client-head-actions">
        {admin
          ? <label className="rc-stage-control" data-stage={stageKey(c.stage)}>
              <span className="rc-stage-dot" aria-hidden="true"/>
              <span className="rc-stage-label">Stage</span>
              <select aria-label={`Stage for ${c.name}`} value={c.stage} disabled={pending} onChange={e => {const stage = e.target.value; run(() => setClientStage(c.id, stage));}}>{stages.map(s => <option key={s}>{s}</option>)}</select>
            </label>
          : <span className="rc-stage-control rc-stage-static" data-stage={stageKey(c.stage)}><span className="rc-stage-dot" aria-hidden="true"/>{c.stage}</span>}
        {admin && <ClientBioEditor client={c} pending={pending} run={run}/>}
      </div>
    </section>
    {notice && <div className={noticeError ? "notice notice-error" : "notice"} role={noticeError ? "alert" : "status"}>{notice}<button onClick={() => setNotice("")} aria-label="Dismiss notification"><Icon name="close" size={18}/></button></div>}
    <nav className="rc-member-tabs" aria-label={`${c.name}’s pages`}>
      {sections.map(([key, label, suffix]) => <Link key={key} href={base + suffix} aria-current={active === key ? "page" : undefined}>{label}</Link>)}
    </nav>
  </>;
}
