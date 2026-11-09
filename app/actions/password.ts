"use server";

import {headers} from "next/headers";
import {redirect} from "next/navigation";
import {findUserByEmail, loginLimited, recordLoginFailure} from "@/lib/users";
import {sendPasswordLink, redeemPasswordToken} from "@/lib/passwordTokens";

export type ForgotState = {sent?: boolean; error?: string; email?: string} | undefined;
export type ResetState = {error?: string} | undefined;

/*
 * "Forgot password": emails a one-hour reset link. The reply is the same whether or not the email has an
 * account, so the form can't be used to discover who is a member. Limited to 3 requests per email and 10 per IP in 15 minutes.
 */
export async function requestPasswordReset(_state: ForgotState, formData: FormData): Promise<ForgotState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return {error: "Enter a valid email address.", email};
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const keys = [`reset:${email}`, `reset-ip:${ip}`];
  if (await loginLimited([[keys[0], 3], [keys[1], 10]])) return {error: "Too many reset requests. Please wait 15 minutes and try again.", email};
  await recordLoginFailure(keys);
  const user = await findUserByEmail(email);
  if (user) await sendPasswordLink(user, "reset");
  return {sent: true, email};
}

/** Sets a new password from a reset or invitation link, then sends the person to sign in. */
export async function resetPassword(_state: ResetState, formData: FormData): Promise<ResetState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 10 || password.length > 200) return {error: "Choose a password of at least 10 characters."};
  if (password !== confirm) return {error: "The two passwords don’t match."};
  if (formData.get("privacy") !== "on") return {error: "Please accept the privacy policy to continue."};
  const userId = await redeemPasswordToken(token, password);
  if (!userId) return {error: "This link has expired or has already been used. Ask for a new one."};
  redirect("/login?notice=password_set");
}
