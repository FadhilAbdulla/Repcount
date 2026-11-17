import type {Metadata} from "next";
import {connection} from "next/server";
import {mailConfigured} from "@/lib/mail";
import {ForgotPassword} from "../PasswordForms";

export const metadata: Metadata = {title: "Reset your password — RepCount"};

export default async function ForgotPasswordPage() {
  await connection(); // Email settings live in the database, so read them per request, not at build time.
  return <ForgotPassword mailReady={await mailConfigured()}/>;
}
