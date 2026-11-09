"use client";

import {useActionState, useEffect, useRef} from "react";
import Link from "next/link";
import {Icon} from "./Media";
import {AuthShell} from "./Login";
import "./register.css";
import {requestPasswordReset, resetPassword, type ForgotState, type ResetState} from "./actions/password";

/** /forgot-password: asks for the account email and sends a reset link. */
export function ForgotPassword({mailReady}: {mailReady: boolean}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [state, action, pending] = useActionState<ForgotState, FormData>(requestPasswordReset, undefined);
  useEffect(() => { heading.current?.focus({preventScroll: true}); }, [state?.sent]);
  return <AuthShell>
    <h1 id="auth-heading" tabIndex={-1} ref={heading}>{state?.sent ? <>Check your <em>inbox.</em></> : <>Reset your <em>password.</em></>}</h1>
    {state?.sent
      ? <p className="rc-login-lead" role="status">If {state.email} has a RepCount account, we’ve sent it a link to choose a new password. It expires in 1 hour.{!mailReady && " If nothing arrives, ask the RepCount team for a reset link."}</p>
      : <>
        <p className="rc-login-lead">Enter the email you sign in with and we’ll send you a link to choose a new password.</p>
        <form className="rc-login-form" action={action} noValidate>
          {state?.error && <div className="rc-login-error" role="alert">{state.error}</div>}
          <label><span>Email</span><input name="email" type="email" placeholder="you@example.com" autoComplete="username" required defaultValue={state?.email}/></label>
          <button type="submit" className="rc-login-submit" disabled={pending}>{pending ? "Sending…" : "Send reset link"} <Icon name="arrow" size={18}/></button>
        </form>
      </>}
    <p className="rc-login-switch">Remembered it? <Link href="/login">Sign in →</Link></p>
  </AuthShell>;
}

/** /reset-password?token=…: choose a new password from a reset or invitation link. */
export function ResetPassword({token, valid, invite, firstName}: {token: string; valid: boolean; invite: boolean; firstName?: string}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [state, action, pending] = useActionState<ResetState, FormData>(resetPassword, undefined);
  useEffect(() => { heading.current?.focus({preventScroll: true}); }, []);
  if (!valid) return <AuthShell>
    <h1 id="auth-heading" tabIndex={-1} ref={heading}>This link has <em>expired.</em></h1>
    <p className="rc-login-lead" role="alert">Password links work once and expire after a while. Ask for a new one below, or ask the RepCount team.</p>
    <Link className="rc-login-submit" href="/forgot-password">Send a new link <Icon name="arrow" size={18}/></Link>
  </AuthShell>;
  return <AuthShell>
    <h1 id="auth-heading" tabIndex={-1} ref={heading}>{invite ? <>Welcome, <em>{firstName}.</em></> : <>Choose a new <em>password.</em></>}</h1>
    <p className="rc-login-lead">{invite ? "Choose a password for your RepCount account." : "Your new password signs you out on every other device."}</p>
    <form className="rc-login-form rc-register-form" action={action} noValidate>
      {state?.error && <div className="rc-login-error" role="alert">{state.error}</div>}
      <input type="hidden" name="token" value={token}/>
      <label><span>New password</span><input name="password" type="password" autoComplete="new-password" placeholder="10+ characters" minLength={10} required/></label>
      <label><span>Confirm password</span><input name="confirm" type="password" autoComplete="new-password" minLength={10} required/></label>
      <label className="rc-register-consent"><input type="checkbox" name="privacy" required/><span>I’ve read and accept the <Link href="/privacy" target="_blank">privacy policy</Link>.</span></label>
      <button type="submit" className="rc-login-submit" disabled={pending}>{pending ? "Saving…" : "Save password"} <Icon name="arrow" size={18}/></button>
    </form>
  </AuthShell>;
}
