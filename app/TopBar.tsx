"use client";

/*
 * The top bar of the signed-in apps (member, trainer, admin). Laptop: who is signed in (name and email) with their avatar.
 * Phone: the RepCount logo on the left (the sidebar logo is hidden there) and a log-out button on the right.
 * Log out on laptop lives at the bottom of the sidebar (see SidebarLogout).
 */
import type {ReactNode} from "react";
import Brand from "./Brand";
import {LogoutButton} from "./Buttons";
import "./top-bar.css";

export default function TopBar({user, status, onAvatar}: {
  user: {name: string; email: string; initials: string};
  /** Saving / error text, announced to screen readers. */
  status?: ReactNode;
  /** Makes the avatar a button (the member's opens their profile). */
  onAvatar?: () => void;
}) {
  const avatar = onAvatar
    ? <button type="button" className="top-avatar" onClick={onAvatar} aria-label="Open your profile">{user.initials}</button>
    : <span className="top-avatar" aria-hidden="true">{user.initials}</span>;
  return <header className="topbar rc-topbar">
    <span className="rc-topbar-brand"><Brand/></span>
    <span className="rc-topbar-status" role="status">{status}</span>
    <div className="rc-topbar-user">
      <div className="rc-topbar-who"><b>{user.name}</b><small>{user.email}</small></div>
      {avatar}
      <LogoutButton look="icon" formClassName="rc-topbar-logout"/>
    </div>
  </header>;
}

/** Log out at the bottom of the sidebar (laptop). */
export const SidebarLogout = () => <div className="sidebar-bottom rc-sidebar-bottom"><LogoutButton look="both" className="rc-sidebar-logout"/></div>;
