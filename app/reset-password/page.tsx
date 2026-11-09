import type {Metadata} from "next";
import {checkPasswordToken} from "@/lib/passwordTokens";
import {ResetPassword} from "../PasswordForms";

export const metadata: Metadata = {title: "Choose a password — RepCount", referrer: "no-referrer"};

/** Opened from a reset or invitation email. The token is checked here and again when the form is saved. */
export default async function ResetPasswordPage({searchParams}: {searchParams: Promise<{token?: string}>}) {
  const token = String((await searchParams).token ?? "");
  const found = await checkPasswordToken(token);
  return <ResetPassword token={token} valid={!!found} invite={found?.purpose === "invite"} firstName={found?.name.split(" ")[0]}/>;
}
