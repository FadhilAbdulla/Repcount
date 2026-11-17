import {json, mobileMember, readJson, unauthorized} from "@/lib/mobileAuth";
import {notifyMemberSave} from "@/lib/memberNotify";
import {clientByUser, saveMemberState} from "@/lib/store";

/**
 * Saves the member's tracker / workout / check-in state, exactly like the web app's autosave.
 * Body: {state, revision}. A stale save (the admin corrected the log since the app loaded) returns 409 so the app reloads.
 */
export async function PUT(request: Request) {
  const user = await mobileMember(request);
  if (!user) return unauthorized();
  const body = await readJson(request) as {state?: unknown; revision?: unknown} | null;
  if (!body || typeof body.state !== "object") return json({error: "Nothing to save."}, 400);
  const save = await saveMemberState(user.id, body.state, typeof body.revision === "number" ? body.revision : undefined);
  if (save.stale) return json({stale: true, error: "Your trainer updated your log. Refreshing…"}, 409);
  if (save.checkinNote || save.paymentReference) {
    const client = await clientByUser(user.id);
    if (client) await notifyMemberSave(client, save);
  }
  return json({ok: true});
}
