"use client";

/* Buttons that show they're working: a spinner while the form submits or the page changes. Edit them here. */
import {useState, type ButtonHTMLAttributes, type ReactNode} from "react";
import {useFormStatus} from "react-dom";
import {logout} from "./actions/auth";
import {Icon} from "./Media";
import {startNavProgress} from "./NavProgress";
import "./buttons.css";

/** A small spinning ring, sized to the text around it. */
export const Spinner = () => <span className="rc-spinner" aria-hidden="true"/>;

/**
 * A submit button for a form with a server action. While the form is submitting it shows a spinner and `pendingLabel`,
 * is disabled, and starts the page progress bar (most of these forms move to another page when they finish).
 */
export function SubmitButton({children, pendingLabel, className, ...rest}: ButtonHTMLAttributes<HTMLButtonElement> & {pendingLabel?: ReactNode}) {
  const {pending} = useFormStatus();
  return <button type="submit" className={className} disabled={pending || rest.disabled} aria-busy={pending} {...rest}
    onClick={e => { rest.onClick?.(e); if (!e.defaultPrevented && e.currentTarget.form?.checkValidity()) startNavProgress(); }}>
    {pending ? <><Spinner/>{pendingLabel ?? children}</> : children}
  </button>;
}

/**
 * Log out, as a form so it works before the page's scripts load.
 * `look`: "text" (just the words), "icon" (icon only, labelled for screen readers) or "both".
 */
export function LogoutButton({look = "text", formClassName, className}: {look?: "text" | "icon" | "both"; formClassName?: string; className?: string}) {
  const icon = look !== "text" && <Icon name="logout" size={18}/>;
  return <form action={logout} className={formClassName}>
    <SubmitButton className={className} aria-label={look === "icon" ? "Log out" : undefined} pendingLabel={look === "icon" ? null : "Logging out…"}>
      {icon}{look === "icon" ? null : <>{icon && " "}Log out</>}
    </SubmitButton>
  </form>;
}

/** "Continue with Google": a plain link to the sign-in route, showing a spinner once it's been pressed. */
export function GoogleButton({className, icon, children}: {className?: string; icon: ReactNode; children: ReactNode}) {
  const [busy, setBusy] = useState(false);
  return <a className={className} href="/api/auth/google" aria-busy={busy} data-busy={busy || undefined}
    onClick={e => { if (busy) { e.preventDefault(); return; } setBusy(true); startNavProgress(); }}>
    {busy ? <Spinner/> : icon}{busy ? "Opening Google…" : children}
  </a>;
}
