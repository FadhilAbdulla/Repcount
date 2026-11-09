import type {Metadata} from "next";
import {mailConfigured} from "@/lib/mail";
import {ForgotPassword} from "../PasswordForms";

export const metadata: Metadata = {title: "Reset your password — RepCount"};

export default function ForgotPasswordPage() {
  return <ForgotPassword mailReady={mailConfigured()}/>;
}
