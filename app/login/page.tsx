import type {Metadata} from "next";
import Login from "../Login";
import {googleConfig} from "@/lib/google";

export const metadata: Metadata = {title: "Log in — RepCount"};

const googleErrors: Record<string, string> = {
  google_no_account: "That Google account isn’t linked to RepCount yet. Create your account first, then sign in with Google using the same email.",
  google_cancelled: "Google sign-in was cancelled.",
  google_failed: "Google sign-in didn’t complete. Please try again.",
  google_unavailable: "Google sign-in isn’t set up yet. Use your email and password.",
};

export default async function LoginPage({searchParams}: {searchParams: Promise<{error?: string; notice?: string}>}) {
  const {error, notice} = await searchParams;
  return <Login googleEnabled={googleConfig() !== null} notice={error ? googleErrors[error] : undefined} success={notice === "password_set" ? "Your password is saved. Sign in with it below." : undefined}/>;
}
