/* Small status badges shared by the staff pages (client list, client header, trainer page, payments). Edit them here. */
import {clientStatus} from "@/lib/programme";
import type {ClientRow} from "@/lib/store";

/** A label as a CSS key for its colour, e.g. "Awaiting verification" → "awaiting-verification". */
export const pillKey = (label: string) => label.toLowerCase().replace(/[^a-z]+/g, "-");

/** Where a client's payment stands: verified by an admin, a reference waiting for review, or nothing submitted yet. */
export const paymentStatus = (c: Pick<ClientRow, "paid" | "reference">) => c.paid ? "Verified" : c.reference ? "Awaiting verification" : "Not submitted";

/** A coloured status badge; the colour comes from the label (see [data-status] in staff-ui.css). */
export function Pill({label}: {label: string}) {
  return <span className="rc-pay-status" data-status={pillKey(label)}>{label}</span>;
}

/** The client's status: Unassigned, Assigned or Deactivated. */
export const StatusPill = ({client}: {client: {deactivated: boolean; trainerId: string | null}}) => <Pill label={clientStatus(client)}/>;

/** The client's payment status (phase 2). */
export const PaymentPill = ({client}: {client: Pick<ClientRow, "paid" | "reference">}) => <Pill label={paymentStatus(client)}/>;

/** Shown until the member answers the onboarding questions. `under` stacks it below a name instead of beside it. */
export function ProfileIncomplete({under = false}: {under?: boolean}) {
  return <span className={`pill rc-pill-warn${under ? " rc-pill-under" : ""}`} title="Completes when the member answers the onboarding questions">Profile incomplete</span>;
}
