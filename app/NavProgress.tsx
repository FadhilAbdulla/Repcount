"use client";
import {useEffect, useRef, useState} from "react";
import {usePathname, useSearchParams} from "next/navigation";
import "./nav-progress.css";

const START_EVENT = "rc:navstart";

/** Call before a programmatic navigation (router.push) to show the top bar. */
export function startNavProgress() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(START_EVENT));
}

/** Thin red bar at the top of the page while a navigation is in flight. */
export default function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timers = useRef<number[]>([]);
  const active = useRef(false);

  const clear = () => { timers.current.forEach(t => window.clearTimeout(t)); timers.current = []; };

  useEffect(() => {
    const trickle = () => {
      setProgress(p => p + (90 - p) * 0.12);
      timers.current.push(window.setTimeout(trickle, 220));
    };
    const start = () => {
      clear();
      active.current = true;
      setVisible(true);
      setProgress(8);
      timers.current.push(window.setTimeout(trickle, 120));
      // Safety net: never leave the bar stuck if a navigation is abandoned.
      timers.current.push(window.setTimeout(() => { if (active.current) { active.current = false; clear(); setVisible(false); setProgress(0); } }, 15000));
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || !a.href || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return; // same page / hash link
      start();
    };
    window.addEventListener(START_EVENT, start);
    document.addEventListener("click", onClick);
    return () => { window.removeEventListener(START_EVENT, start); document.removeEventListener("click", onClick); clear(); };
  }, []);

  // The route changed: the new page has rendered, so finish the bar.
  useEffect(() => {
    if (!active.current) return;
    active.current = false;
    clear();
    setProgress(100);
    timers.current.push(window.setTimeout(() => setVisible(false), 250));
    timers.current.push(window.setTimeout(() => setProgress(0), 550));
  }, [pathname, search]);

  return <div className="rc-nav-progress" data-visible={visible} aria-hidden="true">
    <div className="rc-nav-progress-bar" style={{transform: `scaleX(${progress / 100})`}}/>
  </div>;
}
