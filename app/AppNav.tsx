"use client";

/*
 * The app's navigation, shared by the member app and the staff workspace.
 * Desktop: every item in the sidebar. Phone: a bottom bar with the first `primary` items plus "More", which opens a sheet
 * with the rest (so the bar never overflows however many pages there are).
 */
import {useEffect, useRef, useState} from "react";
import {Icon} from "./Media";
import "./app-nav.css";

/** [key, icon, full label, short label for the phone bar] */
export type NavItem = [key: string, icon: string, label: string, short: string];

export default function AppNav({items, active, onSelect, label, primary = 4, locked = []}: {
  items: NavItem[]; active: string; onSelect: (key: string) => void; label: string;
  /** How many items fit in the phone bar before "More". */
  primary?: number;
  /** Keys shown with a lock (coming soon); still selectable so they can explain why. */
  locked?: string[];
}) {
  const [sheet, setSheet] = useState(false);
  const sheetRef = useRef<HTMLDialogElement>(null);
  const fitsBar = items.length <= primary + 1;
  const bar = fitsBar ? items : items.slice(0, primary);
  const rest = fitsBar ? [] : items.slice(primary);
  const inRest = rest.some(([key]) => key === active);

  useEffect(() => {
    const d = sheetRef.current;
    if (!d) return;
    if (sheet && !d.open) d.showModal();
    if (!sheet && d.open) d.close();
  }, [sheet]);

  const pick = (key: string) => { setSheet(false); onSelect(key); };
  const button = ([key, icon, full, short]: NavItem, variant: "side" | "bar" | "sheet") =>
    <button key={key} type="button" title={full} className={`nav${active === key ? " active" : ""}`} aria-current={active === key ? "page" : undefined} onClick={() => pick(key)}>
      <span aria-hidden="true"><Icon name={locked.includes(key) ? "lock" : icon} size={20}/></span>
      <span className="nav-label">{variant === "bar" ? short : full}</span>
    </button>;

  return <>
    <nav className="rc-nav-side" aria-label={label}>{items.map(i => button(i, "side"))}</nav>
    <nav className="rc-nav-bar" aria-label={label}>
      {bar.map(i => button(i, "bar"))}
      {rest.length > 0 && <button type="button" className={`nav${inRest ? " active" : ""}`} aria-haspopup="dialog" aria-expanded={sheet} onClick={() => setSheet(true)}>
        <span aria-hidden="true"><Icon name="menu" size={20}/></span><span className="nav-label">More</span>
      </button>}
    </nav>
    {rest.length > 0 && <dialog ref={sheetRef} className="rc-nav-sheet" aria-label="More pages" onCancel={() => setSheet(false)} onClose={() => setSheet(false)}>
      <div><span className="rc-nav-grip" aria-hidden="true"/>{rest.map(i => button(i, "sheet"))}
        <button type="button" className="small-button rc-nav-close" onClick={() => setSheet(false)}>Close</button></div>
    </dialog>}
  </>;
}
