"use client";

import Photo from './Photo';
import {useActionState,useEffect,useRef} from 'react';
import Link from 'next/link';
import Brand from './Brand';
import {Icon} from './Media';
import PasswordInput from './PasswordInput';
import {login,type LoginState} from './actions/auth';
import './login.css';
import {GoogleButton, SubmitButton} from './Buttons';

// High-res portrait (2000×3000) so the tall story panel stays sharp on retina screens.
const loginPhoto='https://images.pexels.com/photos/4164761/pexels-photo-4164761.jpeg?auto=compress&cs=tinysrgb&w=2000';

const googleMark=<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>;

/**
 * Auth shell shared by /login and /register: photo panel + centred card, sized to the viewport so the
 * page never scrolls. Pass the card content as children.
 */
export function AuthShell({children}:{children:React.ReactNode}) {
  return <div className="rc-login">
    <a className="skip" href="#auth-heading">Skip to form</a>
    <aside className="rc-login-story" aria-label="Personal coaching at home">
      <Photo src={loginPhoto} alt="Athlete training with dumbbells in a gym" priority sizes="(max-width: 860px) 1px, 52vw"/>
      <div className="rc-login-story-shade"/>
      <Link className="rc-login-story-brand" href="/" aria-label="RepCount home"><Brand tone="light"/></Link>
      <div className="rc-login-story-copy">
        <span>MAKE ROOM FOR YOU</span>
        <h2>A little effort.<br/><em>A stronger everyday.</em></h2>
        <p>Your plan, your progress and a coach in your corner.</p>
      </div>
    </aside>
    <main className="rc-login-panel">
      <div className="rc-login-card">
        <Link className="rc-login-mobile-brand" href="/" aria-label="RepCount home"><Brand/></Link>
        {children}
      </div>
    </main>
  </div>;
}

/** Sign in for members, trainers and the super admin (password or Google). */
export default function Login({googleEnabled,notice,success}:{googleEnabled:boolean;notice?:string;success?:string}) {
  const heading=useRef<HTMLHeadingElement>(null);
  const [state,action]=useActionState<LoginState,FormData>(login,undefined);
  const error=state?.error??notice;
  useEffect(()=>{heading.current?.focus({preventScroll:true});},[]);

  return <AuthShell>
    <h1 id="auth-heading" tabIndex={-1} ref={heading}>Welcome <em>back.</em></h1>
    <p className="rc-login-lead">Members, trainers and admins sign in here.</p>
    <form className="rc-login-form" action={action} noValidate>
      {error?<div className="rc-login-error" role="alert">{error}</div>:success&&<div className="rc-login-success" role="status">{success}</div>}
      <label><span>Email</span><input name="email" type="email" placeholder="you@example.com" autoComplete="username" required defaultValue={state?.email} aria-invalid={!!state?.error}/></label>
      <label><span className="rc-login-label-row">Password<Link href="/forgot-password">Forgot?</Link></span>
        <PasswordInput name="password" placeholder="Your password" autoComplete="current-password" required aria-invalid={!!state?.error}/></label>
      <SubmitButton className="rc-login-submit" pendingLabel="Signing in…">Sign in <Icon name="arrow" size={18}/></SubmitButton>
      {googleEnabled&&<GoogleButton className="rc-login-google" icon={googleMark}>Continue with Google</GoogleButton>}
    </form>
    <p className="rc-login-switch">New to RepCount? <Link href="/register">Create your account →</Link></p>
  </AuthShell>;
}
