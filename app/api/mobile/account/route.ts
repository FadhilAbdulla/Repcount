import {revalidatePath} from "next/cache";
import {json, mobileMember, readJson, unauthorized} from "@/lib/mobileAuth";
import {audit, clientByUser, deleteClient} from "@/lib/store";
import {db} from "@/lib/db";
import {loginLimited, recordLoginFailure, verifyCredentials} from "@/lib/users";

/**
 * A member permanently deletes their own account and all their data (required by the App Store and Google Play).
 * Body: {password}. Uses the same full delete as the admin's "Delete client"; health data goes with the user row.
 */
export async function DELETE(request: Request) {
  const user = await mobileMember(request);
  if (!user) return unauthorized();
  const body = await readJson(request) as {password?: unknown} | null;
  const password = String(body?.password ?? "");
  const key = `delete:${user.email}`;
  if (await loginLimited([[key, 5]])) return json({error: "Too many attempts. Please wait 15 minutes and try again."}, 429);
  if (!password || !(await verifyCredentials(user.email, password))) {
    await recordLoginFailure([key]);
    return json({error: "That password isn’t right."}, 403);
  }

  const client = await clientByUser(user.id);
  if (client) await deleteClient(client.id);
  else await (await db())`delete from users where id = ${user.id} and role = 'member'`;
  await audit(user.id, "delete_own_account", "A member deleted their account from the app", null);
  revalidatePath("/admin", "layout");
  revalidatePath("/trainer", "layout");
  return json({ok: true});
}
