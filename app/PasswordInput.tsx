"use client";
import {useState, type InputHTMLAttributes} from "react";

/** Password field with a show/hide toggle. Takes the same props as an <input>. */
export default function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [shown, setShown] = useState(false);
  return <span className="rc-password-field">
    <input {...props} type={shown ? "text" : "password"}/>
    <button type="button" className="rc-password-toggle" onClick={() => setShown(s => !s)}
      aria-label={shown ? "Hide password" : "Show password"} aria-pressed={shown}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>
        {shown && <path d="M4 4l16 16"/>}
      </svg>
    </button>
  </span>;
}
